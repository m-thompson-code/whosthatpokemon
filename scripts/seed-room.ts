import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { adminAuth, adminFirestore } from "./lib/firebase-admin";

const OUTPUT_FILE = resolve(".tmp/seeded-room.json");
const MAX_PLAYERS = 20;

const readNumberFlag = (argumentsList: string[], flag: string, fallback: number) => {
  const index = argumentsList.indexOf(flag);
  if (index === -1) return fallback;

  const value = Number(argumentsList[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
};

const readStringFlag = (argumentsList: string[], flag: string) => {
  const index = argumentsList.indexOf(flag);
  return index === -1 ? undefined : argumentsList[index + 1];
};

const parseOptions = () => {
  const argumentsList = process.argv.slice(2);
  const roomId = readStringFlag(argumentsList, "--room");
  if (!roomId) {
    throw new Error(
      "--room <roomId> is required. Create a room as host in the app first, then pass the room ID from the URL (/host/room/<roomId>).",
    );
  }

  return {
    roomId,
    players: readNumberFlag(argumentsList, "--players", 7),
    splitTeams: argumentsList.includes("--split-teams"),
  };
};

const main = async () => {
  const { roomId, players: botCount, splitTeams } = parseOptions();
  if (botCount < 1 || botCount > MAX_PLAYERS) {
    throw new Error(`--players must be between 1 and ${MAX_PLAYERS}.`);
  }

  const roomReference = adminFirestore.collection("rooms").doc(roomId);
  const roomSnapshot = await roomReference.get();
  if (!roomSnapshot.exists) {
    throw new Error(`Room ${roomId} does not exist. Create it as host in the app first.`);
  }

  const room = roomSnapshot.data() as { joinCode: string };

  console.log(`Creating ${botCount} bot trainer accounts for room ${roomId}...`);
  const bots = await Promise.all(
    Array.from({ length: botCount }, (_, index) =>
      adminAuth.createUser({ displayName: `Bot Trainer ${index + 1}` })),
  );

  const batch = adminFirestore.batch();
  bots.forEach((bot, index) => {
    const team = splitTeams ? (index % 2 === 0 ? "team-a" : "team-b") : "none";
    batch.set(roomReference.collection("players").doc(bot.uid), {
      uid: bot.uid,
      displayName: bot.displayName,
      score: 0,
      team,
      eliminated: false,
      connected: true,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
  });
  await batch.commit();

  await mkdir(resolve(".tmp"), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify({
    roomId,
    joinCode: room.joinCode,
    createdAt: new Date().toISOString(),
    bots: bots.map((bot) => ({ uid: bot.uid, displayName: bot.displayName })),
  }, null, 2));

  console.log("");
  console.log(`Added ${botCount} bot trainers to room ${roomId} (join code ${room.joinCode}).`);
  console.log(splitTeams ? "Bots were split evenly across Team A / Team B." : "Bots were added as Unassigned.");
  console.log("Refresh your host tab to see them in the lobby.");
  console.log("");
  console.log(`Use "npm run test:room:bot-answer -- --room ${roomId}" to have a bot answer the active round.`);
  console.log(`Use "npm run test:room:watch -- --room ${roomId}" to follow live room state in this terminal.`);
  console.log(`Saved ${OUTPUT_FILE}. Run "npm run test:room:cleanup" when you're done testing.`);
};

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

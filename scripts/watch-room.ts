import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { adminFirestore } from "./lib/firebase-admin";

const SEED_FILE = resolve(".tmp/seeded-room.json");

const readStringFlag = (argumentsList: string[], flag: string) => {
  const index = argumentsList.indexOf(flag);
  return index === -1 ? undefined : argumentsList[index + 1];
};

const resolveRoomId = async () => {
  const argumentsList = process.argv.slice(2);
  const flagRoomId = readStringFlag(argumentsList, "--room");
  if (flagRoomId) return flagRoomId;

  try {
    const seedRecord = JSON.parse(await readFile(SEED_FILE, "utf8")) as { roomId: string };
    return seedRecord.roomId;
  } catch {
    throw new Error('--room <roomId> is required (or run scripts/seed-room.ts first to create ".tmp/seeded-room.json").');
  }
};

const formatLine = (room: FirebaseFirestore.DocumentData) => {
  const parts = [
    `status=${room.status}`,
    `round=${room.roundNumber}`,
    `activeTeam=${room.activeTeam ?? "-"}`,
    `teamA=${room.teamASurvivors}`,
    `teamB=${room.teamBSurvivors}`,
    `winner=${room.winner ?? "-"}`,
  ];
  if (room.lastResult) {
    parts.push(`lastAnswer=${room.lastResult.answeredByName}(${room.lastResult.correct ? "correct" : "wrong"})`);
  }
  return parts.join("  ");
};

const main = async () => {
  const roomId = await resolveRoomId();
  console.log(`Watching room ${roomId} — press Ctrl+C to stop.\n`);

  let previousLine = "";
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const unsubscribe = adminFirestore.collection("rooms").doc(roomId).onSnapshot((snapshot) => {
      if (!snapshot.exists) {
        console.log("Room no longer exists.");
        unsubscribe();
        resolvePromise();
        return;
      }

      const line = formatLine(snapshot.data()!);
      if (line !== previousLine) {
        console.log(`[${new Date().toLocaleTimeString()}] ${line}`);
        previousLine = line;
      }
    }, rejectPromise);
  });
};

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { adminAuth, adminFirestore } from "./lib/firebase-admin";

const SEED_FILE = resolve(".tmp/seeded-room.json");

const readStringFlag = (argumentsList: string[], flag: string) => {
  const index = argumentsList.indexOf(flag);
  return index === -1 ? undefined : argumentsList[index + 1];
};

type SeedRecord = { roomId: string; joinCode: string; bots: Array<{ uid: string; displayName: string }> };

const loadSeedRecord = async (): Promise<SeedRecord | null> => {
  try {
    return JSON.parse(await readFile(SEED_FILE, "utf8")) as SeedRecord;
  } catch {
    return null;
  }
};

const main = async () => {
  const argumentsList = process.argv.slice(2);
  const seedRecord = await loadSeedRecord();
  const roomId = readStringFlag(argumentsList, "--room") ?? seedRecord?.roomId;
  const deleteRoom = argumentsList.includes("--delete-room");

  if (!roomId) {
    console.log("Nothing to clean up (no --room flag and no .tmp/seeded-room.json).");
    return;
  }

  const bots = seedRecord?.roomId === roomId ? seedRecord.bots : [];
  if (bots.length > 0) {
    console.log(`Removing ${bots.length} bot trainers from room ${roomId}...`);
    await Promise.all(bots.map((bot) =>
      adminFirestore.collection("rooms").doc(roomId).collection("players").doc(bot.uid).delete()));
    await Promise.all(bots.map((bot) => adminFirestore.collection("users").doc(bot.uid).delete()));
    await adminAuth.deleteUsers(bots.map((bot) => bot.uid)).catch(() => undefined);
  }

  if (deleteRoom) {
    console.log(`Deleting room ${roomId} entirely...`);
    const playerRefs = await adminFirestore.collection("rooms").doc(roomId).collection("players").listDocuments();
    await Promise.all(playerRefs.map((ref) => ref.delete()));
    await adminFirestore.collection("rooms").doc(roomId).delete();
    if (seedRecord?.joinCode) await adminFirestore.collection("joinCodes").doc(seedRecord.joinCode).delete();
  }

  await rm(SEED_FILE, { force: true });
  console.log("Done.");
};

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

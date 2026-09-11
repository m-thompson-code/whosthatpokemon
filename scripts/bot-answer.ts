import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { adminAuth, adminFirestore } from "./lib/firebase-admin";

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const SEED_FILE = resolve(".tmp/seeded-room.json");

const readStringFlag = (argumentsList: string[], flag: string) => {
  const index = argumentsList.indexOf(flag);
  return index === -1 ? undefined : argumentsList[index + 1];
};

type SeedRecord = { roomId: string; bots: Array<{ uid: string; displayName: string }> };

const loadSeedRecord = async (): Promise<SeedRecord | null> => {
  try {
    return JSON.parse(await readFile(SEED_FILE, "utf8")) as SeedRecord;
  } catch {
    return null;
  }
};

const parseOptions = async () => {
  const argumentsList = process.argv.slice(2);
  const seedRecord = await loadSeedRecord();
  const roomId = readStringFlag(argumentsList, "--room") ?? seedRecord?.roomId;
  if (!roomId) {
    throw new Error('--room <roomId> is required (or run scripts/seed-room.ts first to create ".tmp/seeded-room.json").');
  }

  const mode = readStringFlag(argumentsList, "--mode") ?? "random";
  if (!["correct", "wrong", "random"].includes(mode)) {
    throw new Error('--mode must be "correct", "wrong", or "random".');
  }

  return {
    roomId,
    mode: mode as "correct" | "wrong" | "random",
    forcedUid: readStringFlag(argumentsList, "--uid"),
    botUids: new Set((seedRecord?.roomId === roomId ? seedRecord.bots : []).map((bot) => bot.uid)),
  };
};

// Exchanges a Firebase Admin custom token for a real ID token via the Identity Toolkit
// REST API, exactly like the Firebase client SDK does internally when signing in.
const signInAsUid = async (uid: string) => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set (check .env.local).");

  const customToken = await adminAuth.createCustomToken(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  if (!response.ok) throw new Error(`Could not sign in as ${uid}: ${await response.text()}`);
  const payload = await response.json() as { idToken: string };
  return payload.idToken;
};

const main = async () => {
  const { roomId, mode, forcedUid, botUids } = await parseOptions();

  const roomSnapshot = await adminFirestore.collection("rooms").doc(roomId).get();
  if (!roomSnapshot.exists) throw new Error(`Room ${roomId} does not exist.`);

  const room = roomSnapshot.data() as {
    status: string;
    activeTeam: string | null;
    currentRound: { roundId: string; answerId: number; choices: Array<{ id: number; name: string }> } | null;
  };

  if (room.status !== "in_progress" || !room.currentRound) {
    throw new Error(`Room ${roomId} isn't in progress (status: ${room.status}). Start the game first.`);
  }

  let uid = forcedUid;
  if (!uid) {
    const playersSnapshot = await adminFirestore.collection("rooms").doc(roomId).collection("players")
      .where("team", "==", room.activeTeam)
      .where("eliminated", "==", false)
      .get();
    const candidate = playersSnapshot.docs.find((doc) => botUids.size === 0 || botUids.has(doc.id));
    if (!candidate) throw new Error(`No eligible bot found on the active team (${room.activeTeam}).`);
    uid = candidate.id;
  }

  const { answerId, choices } = room.currentRound;
  const selectedPokemonId = mode === "correct"
    ? answerId
    : mode === "wrong"
      ? (choices.find((choice) => choice.id !== answerId)?.id ?? answerId)
      : choices[Math.floor(Math.random() * choices.length)].id;

  console.log(`Signing in as ${uid} and answering round ${room.currentRound.roundId}...`);
  const idToken = await signInAsUid(uid);

  const response = await fetch(`${BASE_URL}/api/rooms/${roomId}/answer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roundId: room.currentRound.roundId, selectedPokemonId }),
  });

  const result = await response.json();
  console.log(response.ok ? "Answer submitted:" : "Answer failed:", result);
};

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

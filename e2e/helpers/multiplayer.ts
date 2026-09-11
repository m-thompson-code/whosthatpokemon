import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// A standalone Admin SDK instance for the e2e process itself (separate from the app's
// own src/lib/firebase/admin.ts, which is a Next.js server-only module).
const adminApp = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

export const adminAuth = getAuth(adminApp);
export const adminFirestore = getFirestore(adminApp);

export type TestPlayer = {
  context: BrowserContext;
  page: Page;
  uid: string;
  displayName: string;
};

const IDENTITY_KEY = "whosthatpokemon.identity.v1";

// Drives the real first-visit flow (anonymous sign-in + username) in a fresh,
// isolated browser context so each "player" is a genuinely separate Firebase user.
export const createPlayer = async (browser: Browser, displayName: string): Promise<TestPlayer> => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");
  await page.waitForURL(/\/welcome/, { timeout: 20_000 });
  await page.fill('input[placeholder="Trainer name"]', displayName);
  await page.click('button:has-text("Continue")');
  await page.waitForURL((url) => !url.pathname.startsWith("/welcome"), { timeout: 20_000 });

  const uid = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw) as { firebaseUid: string | null }).firebaseUid;
  }, IDENTITY_KEY);

  if (!uid) throw new Error(`Could not resolve a Firebase UID for "${displayName}".`);

  return { context, page, uid, displayName };
};

// Closes browser contexts and removes the Firebase Auth users + profile docs created for them,
// so repeated runs against the real project don't accumulate test accounts.
export const cleanupPlayers = async (players: TestPlayer[]) => {
  await Promise.all(players.map((player) => player.context.close()));

  const uids = players.map((player) => player.uid);
  await Promise.all(uids.map((uid) => adminFirestore.collection("users").doc(uid).delete()));
  await adminAuth.deleteUsers(uids).catch(() => undefined);
};

export const cleanupRoom = async (roomId: string, joinCode?: string) => {
  const playerRefs = await adminFirestore.collection("rooms").doc(roomId).collection("players").listDocuments();
  await Promise.all(playerRefs.map((ref) => ref.delete()));
  await adminFirestore.collection("rooms").doc(roomId).delete();
  if (joinCode) await adminFirestore.collection("joinCodes").doc(joinCode).delete();
};

export const getRoom = async (roomId: string) => {
  const snapshot = await adminFirestore.collection("rooms").doc(roomId).get();
  return snapshot.data();
};

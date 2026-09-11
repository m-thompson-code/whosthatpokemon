import { existsSync, readFileSync } from "node:fs";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// These scripts run as standalone Node processes (via tsx), so .env.local has to be
// loaded explicitly the same way playwright.config.ts does for the test runner.
const loadEnvLocal = () => {
  if (!existsSync(".env.local")) return;

  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
};

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set (check .env.local).");
}

// Loading the service account key directly (rather than applicationDefault()) lets
// createCustomToken sign locally instead of requiring the IAM Service Account Credentials API.
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credential = credentialsPath && existsSync(credentialsPath)
  ? cert(JSON.parse(readFileSync(credentialsPath, "utf8")))
  : applicationDefault();

const app = getApps()[0] ?? initializeApp({ credential, projectId });

export const adminAuth = getAuth(app);
export const adminFirestore = getFirestore(app);

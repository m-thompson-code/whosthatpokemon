import "server-only";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const usesLocalServiceAccount = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

export const firebaseAdminApp =
  getApps()[0] ??
  (usesLocalServiceAccount
    ? initializeApp({
        credential: applicationDefault(),
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
    : initializeApp());

export const adminAuth = getAuth(firebaseAdminApp);
export const adminFirestore = getFirestore(firebaseAdminApp);
export const adminStorage = getStorage(firebaseAdminApp);
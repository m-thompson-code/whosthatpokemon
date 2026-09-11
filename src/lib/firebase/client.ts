import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from "@/lib/firebase/config";

export const firebaseApp = getApps().length > 0
	? getApp()
	: firebaseConfig
		? initializeApp(firebaseConfig)
		: initializeApp();

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
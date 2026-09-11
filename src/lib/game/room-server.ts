import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";

import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

const getToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
};

export const requireAuthedUser = async (request: Request): Promise<DecodedIdToken | null> => {
  const token = getToken(request);
  if (!token) return null;

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
};

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const forbidden = (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 });
export const notFound = (message = "Room not found") => NextResponse.json({ error: message }, { status: 404 });
export const badRequest = (message = "Invalid request") => NextResponse.json({ error: message }, { status: 400 });
export const conflict = (message = "Conflict") => NextResponse.json({ error: message }, { status: 409 });

export class RoomActionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const roomDocument = (roomId: string) => adminFirestore.collection("rooms").doc(roomId);
export const playerDocument = (roomId: string, uid: string) => roomDocument(roomId).collection("players").doc(uid);
export const playersCollection = (roomId: string) => roomDocument(roomId).collection("players");

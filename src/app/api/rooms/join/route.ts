import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase/admin";
import { joinRoomSchema, Team } from "@/lib/game/schema";
import { badRequest, requireAuthedUser, unauthorized } from "@/lib/game/room-server";

export const POST = async (request: Request) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();

  try {
    const input = joinRoomSchema.parse(await request.json());
    const codeReference = adminFirestore.collection("joinCodes").doc(input.roomCode);
    const codeSnapshot = await codeReference.get();
    const roomId = codeSnapshot.data()?.roomId;
    if (!codeSnapshot.exists || typeof roomId !== "string") {
      return NextResponse.json({ error: "That room could not be found. Check the code and try again." }, { status: 404 });
    }

    const roomReference = adminFirestore.collection("rooms").doc(roomId);
    const playerReference = roomReference.collection("players").doc(user.uid);
    await adminFirestore.runTransaction(async (transaction) => {
      const [roomSnapshot, playerSnapshot] = await Promise.all([
        transaction.get(roomReference),
        transaction.get(playerReference),
      ]);
      if (!roomSnapshot.exists) throw new Error("ROOM_NOT_FOUND");

      if (playerSnapshot.exists) {
        transaction.update(playerReference, {
          displayName: input.displayName,
          connected: true,
          lastSeenAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      transaction.create(playerReference, {
        uid: user.uid,
        displayName: input.displayName,
        score: 0,
        team: Team.None,
        eliminated: false,
        connected: true,
        joinedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ roomId });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") {
      return NextResponse.json({ error: "That room is no longer available." }, { status: 404 });
    }
    return badRequest("Could not join the room.");
  }
};
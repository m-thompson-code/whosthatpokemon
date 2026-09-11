import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { RoomStatus, type Room } from "@/lib/game/schema";
import { forbidden, notFound, playersCollection, requireAuthedUser, roomDocument, unauthorized } from "@/lib/game/room-server";
import { adminFirestore } from "@/lib/firebase/admin";

type RouteParams = { params: Promise<{ roomId: string }> };

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();
  const { roomId } = await params;
  const reference = roomDocument(roomId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return notFound();
  const room = snapshot.data() as Room;
  if (room.hostId !== user.uid) return forbidden("Only the host can return to the lobby.");

  const players = await playersCollection(roomId).get();
  const batch = adminFirestore.batch();
  players.docs.forEach((player) => batch.update(player.ref, { eliminated: false }));
  batch.update(reference, {
    activeTeam: null,
    answerSubmissions: {},
    currentRound: null,
    lastResult: null,
    roundPhase: null,
    status: RoomStatus.Lobby,
    winner: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return NextResponse.json({ ok: true });
};
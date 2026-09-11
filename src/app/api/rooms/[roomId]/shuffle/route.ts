import { NextResponse } from "next/server";

import { RoomStatus, Team } from "@/lib/game/schema";
import {
  badRequest,
  forbidden,
  notFound,
  playersCollection,
  requireAuthedUser,
  roomDocument,
  unauthorized,
} from "@/lib/game/room-server";
import { adminFirestore } from "@/lib/firebase/admin";

type RouteParams = { params: Promise<{ roomId: string }> };

const shuffle = <T,>(items: T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();

  const { roomId } = await params;

  const roomSnapshot = await roomDocument(roomId).get();
  if (!roomSnapshot.exists) return notFound();

  const room = roomSnapshot.data() as { hostId: string; status: RoomStatus };
  if (room.hostId !== user.uid) return forbidden("Only the host can shuffle teams.");
  if (room.status !== RoomStatus.Lobby) return badRequest("Teams can only shuffle while in the lobby.");

  const playersSnapshot = await playersCollection(roomId).get();
  const playerIds = shuffle(playersSnapshot.docs.map((player) => player.id));

  const batch = adminFirestore.batch();
  playerIds.forEach((playerId, index) => {
    const team = index % 2 === 0 ? Team.TeamA : Team.TeamB;
    batch.update(playersCollection(roomId).doc(playerId), { team });
  });
  await batch.commit();

  return NextResponse.json({ ok: true });
};

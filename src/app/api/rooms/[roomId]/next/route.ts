import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { generateFreeModeRound } from "@/lib/free-mode/server";
import { RoomPhase, RoomStatus, Team, type Room } from "@/lib/game/schema";
import { forbidden, notFound, requireAuthedUser, roomDocument, unauthorized } from "@/lib/game/room-server";

type RouteParams = { params: Promise<{ roomId: string }> };

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();
  const { roomId } = await params;
  const reference = roomDocument(roomId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return notFound();
  const room = snapshot.data() as Room;
  if (room.hostId !== user.uid) return forbidden("Only the host can continue.");
  if (room.status !== RoomStatus.InProgress || room.roundPhase !== RoomPhase.Reveal || !room.activeTeam) {
    return NextResponse.json({ error: "The round is not ready to continue." }, { status: 400 });
  }

  const nextRound = await generateFreeModeRound(room.usedAnswerIds.slice(-50), room.selectedGameIds);
  await reference.update({
    activeTeam: room.activeTeam === Team.TeamA ? Team.TeamB : Team.TeamA,
    answerSubmissions: {},
    currentRound: nextRound,
    lastResult: null,
    roundNumber: room.roundNumber + 1,
    roundPhase: RoomPhase.Guessing,
    usedAnswerIds: [...room.usedAnswerIds, nextRound.answerId].slice(-50),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
};
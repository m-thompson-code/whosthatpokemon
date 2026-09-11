import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase/admin";
import { generateFreeModeRound } from "@/lib/free-mode/server";
import { RoomPhase, RoomStatus, Team, type Room } from "@/lib/game/schema";
import { badRequest, forbidden, notFound, playersCollection, requireAuthedUser, roomDocument, unauthorized } from "@/lib/game/room-server";

type RouteParams = { params: Promise<{ roomId: string }> };

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();
  const { roomId } = await params;
  const reference = roomDocument(roomId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return notFound();
  const room = snapshot.data() as Room;
  if (room.hostId !== user.uid) return forbidden("Only the host can start a new round.");
  if (room.status !== RoomStatus.Finished) return badRequest("The match has not finished.");

  const players = await playersCollection(roomId).get();
  const teamACount = players.docs.filter((player) => player.data().team === Team.TeamA).length;
  const teamBCount = players.docs.filter((player) => player.data().team === Team.TeamB).length;
  if (teamACount === 0 || teamBCount === 0) return badRequest("Both teams need at least one player.");

  const currentRound = await generateFreeModeRound([], room.selectedGameIds);
  const batch = adminFirestore.batch();
  players.docs.forEach((player) => batch.update(player.ref, { eliminated: false }));
  batch.update(reference, {
    activeTeam: Math.random() < .5 ? Team.TeamA : Team.TeamB,
    answerSubmissions: {},
    currentRound,
    lastResult: null,
    roundNumber: 1,
    roundPhase: RoomPhase.Guessing,
    status: RoomStatus.InProgress,
    teamASurvivors: teamACount,
    teamBSurvivors: teamBCount,
    usedAnswerIds: [currentRound.answerId],
    winner: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return NextResponse.json({ ok: true });
};
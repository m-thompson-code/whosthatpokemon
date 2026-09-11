import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { generateFreeModeRound } from "@/lib/free-mode/server";
import { RoomPhase, RoomStatus, Team } from "@/lib/game/schema";
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

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();

  const { roomId } = await params;

  const roomSnapshot = await roomDocument(roomId).get();
  if (!roomSnapshot.exists) return notFound();

  const room = roomSnapshot.data() as {
    hostId: string;
    selectedGameId?: string;
    selectedGameIds?: string[];
    status: RoomStatus;
  };
  if (room.hostId !== user.uid) return forbidden("Only the host can start the game.");
  if (room.status !== RoomStatus.Lobby) return badRequest("The room has already started.");

  const playersSnapshot = await playersCollection(roomId).get();
  const teamACount = playersSnapshot.docs.filter((player) => player.data().team === Team.TeamA).length;
  const teamBCount = playersSnapshot.docs.filter((player) => player.data().team === Team.TeamB).length;

  if (teamACount === 0 || teamBCount === 0) {
    return badRequest("Both teams need at least one player before starting.");
  }

  const selectedGameIds = room.selectedGameIds ?? (room.selectedGameId ? [room.selectedGameId] : undefined);
  const round = await generateFreeModeRound([], selectedGameIds);
  const activeTeam = Math.random() < 0.5 ? Team.TeamA : Team.TeamB;

  const batch = adminFirestore.batch();
  playersSnapshot.docs.forEach((player) => {
    batch.update(player.ref, { eliminated: false });
  });
  batch.update(roomDocument(roomId), {
    status: RoomStatus.InProgress,
    activeTeam,
    roundPhase: RoomPhase.Guessing,
    answerSubmissions: {},
    currentRound: round,
    lastResult: null,
    winner: null,
    roundNumber: 1,
    teamASurvivors: teamACount,
    teamBSurvivors: teamBCount,
    usedAnswerIds: [round.answerId],
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ ok: true });
};

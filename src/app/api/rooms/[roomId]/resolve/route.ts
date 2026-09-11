import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { RoomPhase, RoomStatus, Team, Winner, type Room, type RoomPlayer } from "@/lib/game/schema";
import { forbidden, notFound, playersCollection, requireAuthedUser, roomDocument, unauthorized } from "@/lib/game/room-server";
import { adminFirestore } from "@/lib/firebase/admin";

type RouteParams = { params: Promise<{ roomId: string }> };

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();
  const { roomId } = await params;
  const roomReference = roomDocument(roomId);

  try {
    await adminFirestore.runTransaction(async (transaction) => {
      const [roomSnapshot, playersSnapshot] = await Promise.all([
        transaction.get(roomReference),
        transaction.get(playersCollection(roomId)),
      ]);
      if (!roomSnapshot.exists) throw new Error("NOT_FOUND");
      const room = roomSnapshot.data() as Room;
      if (room.hostId !== user.uid) throw new Error("FORBIDDEN");
      if (room.status !== RoomStatus.InProgress || room.roundPhase !== RoomPhase.Guessing || !room.currentRound || !room.activeTeam) {
        throw new Error("ROUND_NOT_ACTIVE");
      }

      const activePlayers = playersSnapshot.docs
        .map((snapshot) => ({ snapshot, player: snapshot.data() as RoomPlayer }))
        .filter(({ player }) => player.team === room.activeTeam && !player.eliminated);
      const answerSubmissions = room.answerSubmissions ?? {};
      const submissions = activePlayers.map(({ player }) => {
        const selectedPokemonId = answerSubmissions[player.uid] ?? null;
        return { uid: player.uid, displayName: player.displayName, selectedPokemonId, correct: selectedPokemonId === room.currentRound?.answerId };
      });
      const incorrect = submissions.filter((submission) => !submission.correct);
      incorrect.forEach((submission) => {
        const player = activePlayers.find(({ player: candidate }) => candidate.uid === submission.uid);
        if (player) transaction.update(player.snapshot.ref, { eliminated: true });
      });

      const teamASurvivors = room.activeTeam === Team.TeamA
        ? Math.max(room.teamASurvivors - incorrect.length, 0)
        : room.teamASurvivors;
      const teamBSurvivors = room.activeTeam === Team.TeamB
        ? Math.max(room.teamBSurvivors - incorrect.length, 0)
        : room.teamBSurvivors;
      const finished = teamASurvivors === 0 || teamBSurvivors === 0;
      const winner = !finished ? null : teamASurvivors === teamBSurvivors
        ? Winner.Tie
        : teamASurvivors === 0 ? Winner.TeamB : Winner.TeamA;

      transaction.update(roomReference, {
        status: finished ? RoomStatus.Finished : RoomStatus.InProgress,
        activeTeam: finished ? null : room.activeTeam,
        roundPhase: finished ? null : RoomPhase.Reveal,
        teamASurvivors,
        teamBSurvivors,
        winner,
        lastResult: {
          roundNumber: room.roundNumber,
          entryText: room.currentRound.entryText,
          sourceGame: room.currentRound.sourceGame,
          answerId: room.currentRound.answerId,
          choices: room.currentRound.choices,
          answeredTeam: room.activeTeam,
          submissions,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return notFound();
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden("Only the host can reveal the round.");
    return NextResponse.json({ error: "Could not reveal the round." }, { status: 400 });
  }
};
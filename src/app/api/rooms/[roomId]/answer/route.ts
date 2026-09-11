import { NextResponse } from "next/server";

import { adminFirestore } from "@/lib/firebase/admin";
import { RoomPhase, RoomStatus, submitAnswerSchema, type Room, type RoomPlayer } from "@/lib/game/schema";
import {
  badRequest,
  playersCollection,
  requireAuthedUser,
  RoomActionError,
  roomDocument,
  unauthorized,
} from "@/lib/game/room-server";

type RouteParams = { params: Promise<{ roomId: string }> };

export const POST = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();

  const { roomId } = await params;

  let input: ReturnType<typeof submitAnswerSchema.parse>;
  try {
    input = submitAnswerSchema.parse(await request.json());
  } catch {
    return badRequest("Invalid answer payload.");
  }

  const roomReference = roomDocument(roomId);
  const playerReference = playersCollection(roomId).doc(user.uid);

  try {
    const result = await adminFirestore.runTransaction(async (transaction) => {
      const [roomSnapshot, playerSnapshot, playersSnapshot] = await Promise.all([
        transaction.get(roomReference),
        transaction.get(playerReference),
        transaction.get(playersCollection(roomId)),
      ]);

      if (!roomSnapshot.exists) throw new RoomActionError(404, "Room not found.");
      const room = roomSnapshot.data() as Room;

      if (room.status !== RoomStatus.InProgress || !room.currentRound) {
        throw new RoomActionError(400, "The round isn't active.");
      }
      if (room.roundPhase !== RoomPhase.Guessing) {
        throw new RoomActionError(400, "The round is being revealed.");
      }
      if (room.currentRound.roundId !== input.roundId) {
        throw new RoomActionError(409, "This round has already been answered.");
      }
      if (!playerSnapshot.exists) throw new RoomActionError(403, "You're not in this room.");

      const player = playerSnapshot.data() as RoomPlayer;
      if (player.team !== room.activeTeam) throw new RoomActionError(403, "It's not your team's turn.");
      if (player.eliminated) throw new RoomActionError(403, "You've been eliminated.");
      const answerSubmissions = room.answerSubmissions ?? {};
      if (answerSubmissions[user.uid] !== undefined) {
        throw new RoomActionError(409, "You've already submitted an answer.");
      }

      const nextSubmissions = { ...answerSubmissions, [user.uid]: input.selectedPokemonId };
      transaction.update(roomReference, { answerSubmissions: nextSubmissions });
      const eligiblePlayers = playersSnapshot.docs
        .map((snapshot) => snapshot.data() as RoomPlayer)
        .filter((candidate) => candidate.team === room.activeTeam && !candidate.eliminated);

      return { complete: eligiblePlayers.every((candidate) => nextSubmissions[candidate.uid] !== undefined) };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RoomActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return badRequest("Could not submit the answer.");
  }
};

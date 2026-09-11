import { NextResponse } from "next/server";

import { RoomStatus, teamAssignmentSchema } from "@/lib/game/schema";
import {
  badRequest,
  forbidden,
  notFound,
  playerDocument,
  requireAuthedUser,
  roomDocument,
  unauthorized,
} from "@/lib/game/room-server";

type RouteParams = { params: Promise<{ roomId: string }> };

export const PATCH = async (request: Request, { params }: RouteParams) => {
  const user = await requireAuthedUser(request);
  if (!user) return unauthorized();

  const { roomId } = await params;

  try {
    const input = teamAssignmentSchema.parse(await request.json());
    const roomSnapshot = await roomDocument(roomId).get();
    if (!roomSnapshot.exists) return notFound();

    const room = roomSnapshot.data() as { hostId: string; status: RoomStatus };
    const isHost = room.hostId === user.uid;

    if (input.targetUid !== user.uid && !isHost) {
      return forbidden("Only the host can move other players.");
    }

    if (room.status !== RoomStatus.Lobby) {
      return badRequest("Teams can only change while the room is in the lobby.");
    }

    const targetReference = playerDocument(roomId, input.targetUid);
    const targetSnapshot = await targetReference.get();
    if (!targetSnapshot.exists) return notFound("Player not found");

    await targetReference.update({ team: input.team });

    return NextResponse.json({ ok: true });
  } catch {
    return badRequest("Could not update the player's team.");
  }
};

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminAuth, adminFirestore } from "@/lib/firebase/admin";
import { createRoomSchema, RoomStatus, Team } from "@/lib/game/schema";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const createJoinCode = () =>
  Array.from({ length: 4 }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join("");

const getToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
};

export const POST = async (request: Request) => {
  const token = getToken(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await adminAuth.verifyIdToken(token);
    const input = createRoomSchema.parse(await request.json());
    const roomReference = adminFirestore.collection("rooms").doc();
    const hostPlayerReference = roomReference.collection("players").doc(user.uid);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = createJoinCode();
      const codeReference = adminFirestore.collection("joinCodes").doc(joinCode);

      try {
        await adminFirestore.runTransaction(async (transaction) => {
          const existingCode = await transaction.get(codeReference);
          if (existingCode.exists) {
            throw new Error("JOIN_CODE_COLLISION");
          }

          transaction.create(roomReference, {
            hostId: user.uid,
            joinCode,
            status: RoomStatus.Lobby,
            selectedGameIds: input.selectedGameIds,
            activeTeam: null,
            roundPhase: null,
            answerSubmissions: {},
            currentRound: null,
            lastResult: null,
            winner: null,
            roundNumber: 0,
            teamASurvivors: 0,
            teamBSurvivors: 0,
            usedAnswerIds: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.create(codeReference, {
            roomId: roomReference.id,
            createdAt: FieldValue.serverTimestamp(),
          });
          transaction.create(hostPlayerReference, {
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

        return NextResponse.json({ roomId: roomReference.id, joinCode }, { status: 201 });
      } catch (error) {
        if (error instanceof Error && error.message === "JOIN_CODE_COLLISION") {
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ error: "Could not allocate a room code" }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "Could not create room" }, { status: 400 });
  }
};

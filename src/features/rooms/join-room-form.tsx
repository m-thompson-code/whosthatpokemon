"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowRight, Crown, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { joinRoomSchema, Team } from "@/lib/game/schema";
import { useIdentity } from "@/features/auth/identity-provider";

const withTimeout = async <Value,>(operation: Promise<Value>, message: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), 15_000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

export const JoinRoomForm = () => {
  const router = useRouter();
  const { identity } = useIdentity();
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const result = joinRoomSchema.safeParse({
      roomCode: formData.get("roomCode"),
      displayName: identity?.username,
    });

    if (!result.success) {
      setError("Enter a four-character room code and set your username in Settings.");
      return;
    }

    if (!identity?.isFirebaseAuthenticated || !firebaseAuth.currentUser) {
      setError("Room play requires Firebase authentication. Change auth mode in Settings.");
      router.push("/settings");
      return;
    }

    setIsJoining(true);

    try {
      const user = firebaseAuth.currentUser;
      const codeSnapshot = await withTimeout(
        getDoc(doc(firestore, "joinCodes", result.data.roomCode)),
        "Joining is taking longer than expected. Please try again.",
      );

      if (!codeSnapshot.exists()) {
        setError("That room could not be found. Check the code and try again.");
        return;
      }

      const roomId = codeSnapshot.data().roomId;

      if (typeof roomId !== "string") {
        setError("That room is not available.");
        return;
      }

      const playerReference = doc(firestore, "rooms", roomId, "players", user.uid);
      const playerSnapshot = await withTimeout(
        getDoc(playerReference),
        "Joining is taking longer than expected. Please try again.",
      );

      if (playerSnapshot.exists()) {
        await withTimeout(setDoc(playerReference, {
          displayName: result.data.displayName,
          connected: true,
          lastSeenAt: serverTimestamp(),
        }, { merge: true }), "Joining is taking longer than expected. Please try again.");
      } else {
        await withTimeout(setDoc(playerReference, {
          uid: user.uid,
          displayName: result.data.displayName,
          score: 0,
          team: Team.None,
          eliminated: false,
          connected: true,
          joinedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        }), "Joining is taking longer than expected. Please try again.");
      }

      router.push(`/room/${roomId}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join right now. Confirm anonymous sign-in is enabled in Firebase.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <form className="join-panel" onSubmit={handleSubmit}>
      <div className="join-panel__copy">
        <div className="join-panel__header">
          <p className="eyebrow">Lobby</p>
          <h2>Join a room</h2>
        </div>
        <p className="join-panel__description">Enter a friend&apos;s room code to join, or host a new room of your own.</p>
      </div>
      <div className="join-panel__controls">
        <label>
          Room code
          <input autoComplete="off" maxLength={4} name="roomCode" placeholder="KTO7" required />
        </label>
        <p className="join-identity">Joining as <strong>{identity?.username ?? "No username"}</strong></p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="join-panel__actions">
          <Link className="secondary-button" href="/host">
            <Crown aria-hidden="true" />
            Host
          </Link>
          <button className="primary-button" disabled={isJoining} type="submit">
            {isJoining ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            {isJoining ? "Joining..." : "Join"}
          </button>
        </div>
      </div>
    </form>
  );
};
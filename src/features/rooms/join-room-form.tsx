"use client";

import { ArrowRight, Crown, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { firebaseAuth } from "@/lib/firebase/client";
import { joinRoomSchema } from "@/lib/game/schema";
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
      const token = await user.getIdToken();
      const response = await withTimeout(
        fetch("/api/rooms/join", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        }),
        "Joining is taking longer than expected. Please try again.",
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.roomId !== "string") {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Could not join the room.");
      }

      router.push(`/room/${payload.roomId}`);
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
          <input autoComplete="off" maxLength={4} name="roomCode" placeholder="xxxx" required />
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
"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { Copy, LoaderCircle, Play, Shuffle, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { RoomGame } from "@/features/rooms/room-game";
import { useIdentity } from "@/features/auth/identity-provider";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import { RoomStatus, Team, type Room, type RoomPlayer } from "@/lib/game/schema";

export type Player = RoomPlayer & { id: string };

type RoomLobbyProps = {
  roomId: string;
  isHost?: boolean;
};

const teamLabel: Record<Team, string> = {
  [Team.None]: "Unassigned",
  [Team.TeamA]: "Team A",
  [Team.TeamB]: "Team B",
};

const teamOptions = [Team.None, Team.TeamA, Team.TeamB];

export const RoomLobby = ({ roomId, isHost = false }: RoomLobbyProps) => {
  const { showToast } = useIdentity();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribeRoom: Unsubscribe | undefined;
    let unsubscribePlayers: Unsubscribe | undefined;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) return;
      setUid(user.uid);

      unsubscribeRoom = onSnapshot(
        doc(firestore, "rooms", roomId),
        (snapshot) => setRoom((snapshot.data() as Room | undefined) ?? null),
        () => setLoadError("Could not connect to this room. Check your connection and refresh."),
      );
      unsubscribePlayers = onSnapshot(
        collection(firestore, "rooms", roomId, "players"),
        (snapshot) => setPlayers(snapshot.docs.map((player) => ({ id: player.id, ...(player.data() as RoomPlayer) }))),
        () => setLoadError("Could not load the room players. Check your connection and refresh."),
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRoom?.();
      unsubscribePlayers?.();
    };
  }, [roomId]);

  const callRoomAction = async (path: string, method: "PATCH" | "POST", body: unknown) => {
    if (!firebaseAuth.currentUser) return;
    setIsWorking(true);
    setError("");

    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.error === "string" ? payload.error : "Request failed.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setIsWorking(false);
    }
  };

  const moveTeam = (targetUid: string, team: Team) =>
    callRoomAction(`/api/rooms/${roomId}/team`, "PATCH", { targetUid, team });
  const shuffleTeams = () => callRoomAction(`/api/rooms/${roomId}/shuffle`, "POST", {});
  const startGame = () => callRoomAction(`/api/rooms/${roomId}/start`, "POST", {});

  const copyCode = async () => {
    if (!room?.joinCode) return;
    try {
      await navigator.clipboard.writeText(room.joinCode);
      showToast("Room code copied.", "success");
    } catch {
      showToast("Could not copy the room code.");
    }
  };

  if (!room) {
    return (
      <main className="lobby-shell">
        <div className="lobby-loading">{loadError ? <p className="form-error" role="alert">{loadError}</p> : <LoaderCircle className="spin" aria-hidden="true" />}</div>
      </main>
    );
  }

  if (room.status !== RoomStatus.Lobby) {
    return <RoomGame players={players} room={room} roomId={roomId} uid={uid} />;
  }

  const teamACount = players.filter((player) => player.team === Team.TeamA).length;
  const teamBCount = players.filter((player) => player.team === Team.TeamB).length;
  const canStart = teamACount > 0 && teamBCount > 0;

  return (
    <main className="lobby-shell">
      <section className="lobby-grid team-lobby-grid">
        <div className="code-zone">
          <p className="eyebrow">Room code</p>
          <button className="room-code" onClick={copyCode} type="button">{room.joinCode}<Copy size={24} /></button>

          {isHost ? (
            <div className="host-controls">
              <button className="secondary-button" disabled={isWorking} onClick={shuffleTeams} type="button">
                <Shuffle size={18} /> Shuffle teams
              </button>
              <button className="primary-button start-button" disabled={isWorking || !canStart} onClick={startGame} type="button">
                <Play /> Start game
              </button>
              {!canStart && <p className="lobby-hint">Both teams need at least one player.</p>}
            </div>
          ) : (
            <div className="waiting-message">
              <LoaderCircle className="spin" aria-hidden="true" />
              <strong>Waiting for the host</strong>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <div className="team-columns">
          {teamOptions.map((team) => {
            const teamPlayers = players.filter((player) => player.team === team);

            return (
              <section className="team-column" data-team={team} key={team}>
                <div className="team-column-title">
                  <Users aria-hidden="true" size={16} />
                  <h2>{teamLabel[team]}</h2>
                  <span>{teamPlayers.length}</span>
                </div>
                <ul>
                  {teamPlayers.map((player) => {
                    const canMove = isHost || player.id === uid;

                    return (
                      <li key={player.id}>
                        <span>{player.displayName.slice(0, 1).toUpperCase()}</span>
                        <strong>{player.displayName}</strong>
                        {canMove ? (
                          <select
                            aria-label={`Move ${player.displayName}`}
                            disabled={isWorking}
                            onChange={(event) => moveTeam(player.id, event.target.value as Team)}
                            value={player.team}
                          >
                            {teamOptions.map((option) => (
                              <option key={option} value={option}>{teamLabel[option]}</option>
                            ))}
                          </select>
                        ) : null}
                      </li>
                    );
                  })}
                  {teamPlayers.length === 0 && <li className="empty-roster">No one here yet.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
};

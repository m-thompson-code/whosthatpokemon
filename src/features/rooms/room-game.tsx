"use client";

import { Check, Eye, Home, LoaderCircle, Play, Skull, Trophy, X } from "lucide-react";
import confetti from "canvas-confetti";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Player } from "@/features/rooms/room-lobby";
import { firebaseAuth } from "@/lib/firebase/client";
import { RoomPhase, RoomStatus, Team, Winner, type Room } from "@/lib/game/schema";

const teamLabel: Record<Team, string> = {
  [Team.None]: "Unassigned",
  [Team.TeamA]: "Red Team",
  [Team.TeamB]: "Blue Team",
};

type RoomGameProps = {
  players: Player[];
  room: Room;
  roomId: string;
  uid: string | null;
};

export const RoomGame = ({ players, room, roomId, uid }: RoomGameProps) => {
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const resolvedRoundRef = useRef<string | null>(null);
  const isHost = room.hostId === uid;
  const answerSubmissions = room.answerSubmissions ?? {};
  const activePlayers = players.filter((player) => player.team === room.activeTeam && !player.eliminated);
  const allActivePlayersAnswered = activePlayers.length > 0
    && activePlayers.every((player) => answerSubmissions[player.id] !== undefined);

  useEffect(() => {
    if (!isHost || room.roundPhase !== RoomPhase.Guessing || !room.currentRound || !allActivePlayersAnswered) return;
    if (resolvedRoundRef.current === room.currentRound.roundId) return;
    resolvedRoundRef.current = room.currentRound.roundId;
    void (async () => {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) return;
      await fetch(`/api/rooms/${roomId}/resolve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    })();
  }, [allActivePlayersAnswered, isHost, room.currentRound, room.roundPhase, roomId]);

  useEffect(() => {
    if (room.status !== RoomStatus.Finished || room.winner === Winner.Tie) return;
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: .65 },
      colors: room.winner === Winner.TeamA ? ["#f0443b", "#f4c542", "#f5f2e8"] : ["#4387c6", "#f4c542", "#f5f2e8"],
    });
  }, [room.status, room.winner]);

  const callHostAction = async (action: "resolve" | "next" | "restart" | "lobby") => {
    if (!firebaseAuth.currentUser) return;
    setIsWorking(true);
    setError("");
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch(`/api/rooms/${roomId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.error === "string" ? payload.error : "Could not update the room.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update the room.");
    } finally {
      setIsWorking(false);
    }
  };

  const submitAnswer = async (selectedPokemonId: number) => {
    if (!firebaseAuth.currentUser || !room.currentRound) return;
    setSubmittingId(selectedPokemonId);
    setError("");

    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch(`/api/rooms/${roomId}/answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: room.currentRound.roundId, selectedPokemonId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setSubmittingId(null);
        setError(typeof payload?.error === "string" ? payload.error : "Could not submit your answer.");
        return;
      }
      setSubmittingId(null);
    } catch {
      setSubmittingId(null);
      setError("Could not submit your answer.");
    }
  };

  const teamACount = players.filter((player) => player.team === Team.TeamA).length;
  const teamBCount = players.filter((player) => player.team === Team.TeamB).length;

  if (room.roundPhase === RoomPhase.Reveal && room.lastResult) {
    const result = room.lastResult;

    return (
      <main className="lobby-shell room-game-shell">
        <section className="free-entry-panel" data-team={result.answeredTeam}>
          <div className="free-round-meta">
            <span>Round {result.roundNumber}</span>
            <span>{teamLabel[result.answeredTeam]}</span>
          </div>
          <div className="free-answer-reveal" aria-live="polite">
            <div className="result-mark"><Eye aria-hidden="true" /></div>
            <div className="free-answer-copy">
              <p className="eyebrow">{teamLabel[result.answeredTeam]}</p>
              <h1>Answer revealed</h1>
              <p>The answer was revealed from <strong>Pokémon {result.sourceGame}</strong></p>
            </div>
          </div>
        </section>
        <section className="choice-section" aria-label="Answer reveal">
          <div className="choice-grid">
            {result.choices.map((choice, index) => {
              const isAnswer = choice.id === result.answerId;
              const isSelected = result.submissions.some((submission) => choice.id === submission.selectedPokemonId);
              const revealState = isAnswer ? "correct" : isSelected ? "incorrect" : "muted";

              return (
                <div className="free-choice" data-state={revealState} key={choice.id}>
                  <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                  <Image alt={choice.name} height={475} loading="eager" sizes="(max-width: 700px) 45vw, 22vw" src={choice.imagePath} width={475} />
                  <span className="choice-name">{choice.name}</span>
                  {isAnswer && <Check className="choice-result-icon" aria-hidden="true" />}
                  {isSelected && !isAnswer && <X className="choice-result-icon" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </section>
        <section className="room-phase-panel">
          <strong>{result.submissions.filter((submission) => submission.correct).length} correct guess{result.submissions.filter((submission) => submission.correct).length === 1 ? "" : "es"}</strong>
          {isHost && <button className="primary-button" disabled={isWorking} onClick={() => callHostAction("next")} type="button"><Play aria-hidden="true" /> Continue to {result.answeredTeam === Team.TeamA ? "Blue Team" : "Red Team"}</button>}
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    );
  }

  if (room.status === RoomStatus.Finished) {
    const winnerCopy = room.winner === Winner.Tie
      ? "It's a tie!"
      : room.winner === Winner.TeamA
        ? "Team A wins!"
        : "Team B wins!";

    return (
      <main className="lobby-shell room-results-shell">
        <section className="room-results-panel">
          <Trophy aria-hidden="true" size={48} />
          <h1>{winnerCopy}</h1>
          <div className="room-results-scores">
            <div data-team={Team.TeamA}><span>Red Team</span><strong>{room.teamASurvivors} left</strong></div>
            <div data-team={Team.TeamB}><span>Blue Team</span><strong>{room.teamBSurvivors} left</strong></div>
          </div>
          {isHost && <div className="room-results-actions">
            <button className="primary-button" disabled={isWorking} onClick={() => callHostAction("restart")} type="button"><Play aria-hidden="true" /> New round</button>
            <button className="secondary-button" disabled={isWorking} onClick={() => callHostAction("lobby")} type="button">Return to lobby</button>
            <Link className="secondary-button" href="/"><Home aria-hidden="true" /> Home</Link>
          </div>}
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    );
  }

  if (!room.currentRound) {
    return (
      <main className="lobby-shell">
        <div className="lobby-loading"><LoaderCircle className="spin" aria-hidden="true" /></div>
      </main>
    );
  }

  const me = players.find((player) => player.id === uid);
  const hasSubmitted = Boolean(uid && answerSubmissions[uid] !== undefined);
  const canAnswer = Boolean(me) && me?.team === room.activeTeam && !me?.eliminated && !hasSubmitted;

  return (
    <main className="lobby-shell room-game-shell">
      <div className="team-status-bar">
        <div className="team-status" data-active={room.activeTeam === Team.TeamA} data-team={Team.TeamA}>
          <span>Red Team</span>
          <strong>{room.teamASurvivors} of {teamACount} left</strong>
        </div>
        <div className="turn-indicator" data-team={room.activeTeam}>{teamLabel[room.activeTeam ?? Team.None]}&apos;s turn</div>
        <div className="team-status" data-active={room.activeTeam === Team.TeamB} data-team={Team.TeamB}>
          <span>Blue Team</span>
          <strong>{room.teamBSurvivors} of {teamBCount} left</strong>
        </div>
      </div>

      <section className="free-entry-panel">
        <div className="free-round-meta">
          <span>Round {room.roundNumber}</span>
          <span>{canAnswer ? "Your team's turn" : me?.eliminated ? <><Skull aria-hidden="true" size={14} /> Eliminated</> : <><Eye aria-hidden="true" size={14} /> Watching</>}</span>
        </div>
        <blockquote key={room.currentRound.roundId}>&ldquo;{room.currentRound.entryText}&rdquo;</blockquote>
        <div className="free-entry-prompt">
          {canAnswer ? "Choose a Pokémon and lock in your guess." : hasSubmitted ? "Your guess is locked in." : "Watch and wait for the active team to answer."}
        </div>
      </section>

      <section className="choice-section" aria-label="Answer choices">
        <div className="choice-grid">
          {room.currentRound.choices.map((choice, index) => (
            <button
              aria-label={`Choose ${choice.name}`}
              className="free-choice"
              disabled={!canAnswer || submittingId !== null}
              key={choice.id}
              onClick={() => submitAnswer(choice.id)}
              type="button"
            >
              <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
              {submittingId === choice.id && <span className="choice-submitting"><LoaderCircle className="spin" aria-hidden="true" /></span>}
              {hasSubmitted && answerSubmissions[uid ?? ""] === choice.id && <span className="choice-locked"><Check aria-hidden="true" /></span>}
              <Image alt={choice.name} height={475} loading="eager" sizes="(max-width: 700px) 45vw, 22vw" src={choice.imagePath} width={475} />
              <span className="choice-name">{choice.name}</span>
            </button>
          ))}
        </div>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="room-phase-panel">
        <strong>{hasSubmitted ? "Your guess is locked in" : `${Object.keys(answerSubmissions).length} of ${activePlayers.length} guesses locked in`}</strong>
        {isHost && <button className="secondary-button" disabled={isWorking} onClick={() => callHostAction("resolve")} type="button">Reveal answers</button>}
      </section>
    </main>
  );
};

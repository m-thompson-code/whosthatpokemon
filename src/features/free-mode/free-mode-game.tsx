"use client";

import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { FreeModeRound } from "@/lib/free-mode/types";

type FreeModeGameProps = {
  initialRound: FreeModeRound;
};

export const FreeModeGame = ({ initialRound }: FreeModeGameProps) => {
  const [round, setRound] = useState(initialRound);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [usedAnswerIds, setUsedAnswerIds] = useState([initialRound.answerId]);
  const [score, setScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const hasAnswered = selectedId !== null;
  const isCorrect = selectedId === round.answerId;
  const answer = round.choices.find((choice) => choice.id === round.answerId);

  const selectAnswer = (pokemonId: number) => {
    if (hasAnswered) return;
    setSelectedId(pokemonId);
    if (pokemonId === round.answerId) setScore((currentScore) => currentScore + 1);
  };

  const nextRound = async () => {
    setIsLoading(true);
    setError("");

    try {
      const exclude = usedAnswerIds.slice(-25).join(",");
      const response = await fetch(`/api/free-round?exclude=${exclude}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Round request failed");

      const next = await response.json() as FreeModeRound;
      setRound(next);
      setSelectedId(null);
      setUsedAnswerIds((ids) => [...ids, next.answerId]);
      setRoundNumber((currentRound) => currentRound + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("The next entry could not be prepared. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="free-game">
      <section
        className="free-entry-panel"
        data-result={hasAnswered ? (isCorrect ? "correct" : "incorrect") : "question"}
      >
        <div className="free-round-meta">
          <span>Round {roundNumber}</span>
          <span>{score} correct</span>
        </div>
        {hasAnswered && answer ? (
          <div className="free-answer-reveal" aria-live="polite">
            <div className="result-mark">
              {isCorrect ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            </div>
            <div className="free-answer-copy">
              <p className="eyebrow">{isCorrect ? "Correct answer" : "Not quite"}</p>
              <h1>{isCorrect ? `That’s ${answer.name}!` : `It was ${answer.name}.`}</h1>
              <p>
                This Pokédex entry comes from <strong>Pokémon {round.sourceGame}</strong>
              </p>
            </div>
            <button className="primary-button" disabled={isLoading} onClick={nextRound} type="button">
              {isLoading ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              {isLoading ? "Preparing..." : "Next entry"}
            </button>
            {error && <p className="round-error" role="alert">{error}</p>}
          </div>
        ) : (
          <>
            <div className="free-entry-heading">
              <span className="pokedex-lens" aria-hidden="true" />
              <h1>Pokédex transmission</h1>
            </div>
            <blockquote key={round.roundId}>&ldquo;{round.entryText}&rdquo;</blockquote>
            <div className="free-entry-prompt">Choose a Pokémon to reveal the game.</div>
          </>
        )}
      </section>

      <section className="choice-section" aria-label="Answer choices">
        <div className="choice-grid">
          {round.choices.map((choice, index) => {
            const isAnswer = choice.id === round.answerId;
            const isSelected = choice.id === selectedId;
            const revealState = hasAnswered
              ? isAnswer
                ? "correct"
                : isSelected
                  ? "incorrect"
                  : "muted"
              : "ready";

            return (
              <button
                aria-label={`Choose ${choice.name}`}
                className="free-choice"
                data-state={revealState}
                disabled={hasAnswered}
                key={choice.id}
                onClick={() => selectAnswer(choice.id)}
                type="button"
              >
                <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                <Image
                  alt={choice.name}
                  height={475}
                  loading="eager"
                  sizes="(max-width: 700px) 45vw, 22vw"
                  src={choice.imagePath}
                  width={475}
                />
                <span className="choice-name">{choice.name}</span>
                {hasAnswered && isAnswer && <Check className="choice-result-icon" aria-hidden="true" />}
                {hasAnswered && isSelected && !isAnswer && <X className="choice-result-icon" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
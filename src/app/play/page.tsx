import type { Metadata } from "next";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { FreeModeGame } from "@/features/free-mode/free-mode-game";
import { generateFreeModeRound } from "@/lib/free-mode/server";

export const metadata: Metadata = {
  title: "Free Mode | Who's That Pokemon?",
  description: "Guess the Pokemon from one of its Pokédex entries.",
};

const FreeModePage = async () => {
  await connection();
  const initialRound = await generateFreeModeRound();

  return (
    <main className="free-mode-shell">
      <header className="free-mode-header">
        <Link className="back-link" href="/">
          <ArrowLeft aria-hidden="true" size={18} /> Back home
        </Link>
        <div className="free-mode-title">
          <Gamepad2 aria-hidden="true" />
          <span>Free Mode</span>
        </div>
        <p>No lobby. No timer. Keep guessing.</p>
      </header>
      <FreeModeGame initialRound={initialRound} />
    </main>
  );
};

export default FreeModePage;
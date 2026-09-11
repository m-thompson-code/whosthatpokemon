"use client";

import { ArrowLeft, Crown, LoaderCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useIdentity } from "@/features/auth/identity-provider";
import { firebaseAuth } from "@/lib/firebase/client";

const gameSourceGroups = [
  { generation: "Generation I", games: [["red", "Red"], ["blue", "Blue"], ["yellow", "Yellow"]] },
  { generation: "Generation II", games: [["gold", "Gold"], ["silver", "Silver"], ["crystal", "Crystal"]] },
  { generation: "Generation III", games: [["ruby", "Ruby"], ["sapphire", "Sapphire"], ["emerald", "Emerald"], ["firered", "FireRed"], ["leafgreen", "LeafGreen"]] },
  { generation: "Generation IV", games: [["diamond", "Diamond"], ["pearl", "Pearl"], ["platinum", "Platinum"], ["heartgold", "HeartGold"], ["soulsilver", "SoulSilver"]] },
  { generation: "Generation V", games: [["black", "Black"], ["white", "White"], ["black-2", "Black 2"], ["white-2", "White 2"]] },
  { generation: "Generation VI", games: [["x", "X"], ["y", "Y"], ["omega-ruby", "Omega Ruby"], ["alpha-sapphire", "Alpha Sapphire"]] },
  { generation: "Generation VII", games: [["sun", "Sun"], ["moon", "Moon"], ["ultra-sun", "Ultra Sun"], ["ultra-moon", "Ultra Moon"], ["lets-go-pikachu", "Let's Go Pikachu"], ["lets-go-eevee", "Let's Go Eevee"]] },
  { generation: "Generation VIII", games: [["sword", "Sword"], ["shield", "Shield"], ["brilliant-diamond", "Brilliant Diamond"], ["shining-pearl", "Shining Pearl"], ["legends-arceus", "Legends: Arceus"]] },
  { generation: "Generation IX", games: [["scarlet", "Scarlet"], ["violet", "Violet"]] },
  { generation: "Generation X", games: [["legends-za", "Legends: Z-A"], ["champions", "Champions"]] },
] as const;

const gameSourceIds = gameSourceGroups.flatMap(({ games }) => games.map(([id]) => id));

const HostSetupPage = () => {
  const router = useRouter();
  const { identity } = useIdentity();
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>(
    gameSourceGroups[0].games.map(([id]) => id),
  );

  const allGamesSelected = selectedGameIds.length === gameSourceIds.length;

  const toggleAllGames = () => {
    setSelectedGameIds(allGamesSelected ? [] : gameSourceIds);
  };

  const toggleGeneration = (generationGameIds: readonly string[]) => {
    const generationIsSelected = generationGameIds.every((id) => selectedGameIds.includes(id));
    setSelectedGameIds((currentGameIds) => generationIsSelected
      ? currentGameIds.filter((id) => !generationGameIds.includes(id))
      : [...new Set([...currentGameIds, ...generationGameIds])]);
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!identity?.isFirebaseAuthenticated || !firebaseAuth.currentUser) {
      setError("Room hosting requires Firebase authentication.");
      router.push("/settings");
      return;
    }

    setIsCreating(true);
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedGameIds,
          displayName: identity.username,
        }),
      });

      if (!response.ok) {
        throw new Error("Room creation failed");
      }

      const room = (await response.json()) as { roomId: string };
      router.push(`/host/room/${room.roomId}`);
    } catch {
      setError("Could not create the room. Server credentials may still need configuration.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="setup-shell">
      <div className="setup-wrap">
        <Link className="back-link" href="/"><ArrowLeft size={18} /> Back to player entry</Link>
        <section className="setup-heading">
          <Crown aria-hidden="true" />
          <p className="eyebrow">Host console</p>
          <h1>Set the challenge.</h1>
          <p>Create a room, gather your trainers, then control every reveal.</p>
        </section>

        {!identity?.isFirebaseAuthenticated ? (
          <section className="auth-strip">
            <div><strong>Firebase authentication required</strong><p>Choose anonymous or email/password auth in Settings.</p></div>
            <Link className="secondary-button" href="/settings"><Settings size={19} /> Open Settings</Link>
          </section>
        ) : (
          <p className="signed-in">Hosting as <strong>{identity.username}</strong> <span>({identity.mode})</span></p>
        )}

        <form className="host-form" onSubmit={createRoom}>
          <fieldset className="game-source-picker">
            <legend>Source games</legend>
            <p>Choose the games that can provide Pokédex entries for this room.</p>
            <label className="game-source-toggle">
              <input checked={allGamesSelected} onChange={toggleAllGames} type="checkbox" />
              Select all generations
            </label>
            <div className="generation-source-options">
              {gameSourceGroups.map(({ generation, games }) => (
                <label key={generation}>
                  <input
                    checked={games.every(([id]) => selectedGameIds.includes(id))}
                    onChange={() => toggleGeneration(games.map(([id]) => id))}
                    type="checkbox"
                  />
                  <span><span className="generation-prefix">Generation </span>{generation.replace("Generation ", "")}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-error full-width" role="alert">{error}</p>}
          <button className="primary-button full-width" disabled={isCreating || !identity?.isFirebaseAuthenticated} type="submit">
            {isCreating ? <LoaderCircle className="spin" /> : <Crown />}
            {isCreating ? "Creating room..." : "Create room"}
          </button>
        </form>
      </div>
    </main>
  );
};

export default HostSetupPage;
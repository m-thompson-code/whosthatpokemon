import "server-only";

import { randomInt, randomUUID } from "node:crypto";

import { createFreeModeRound } from "@/lib/free-mode/round";
import {
  getPokedexCatalog,
  getPokemonRecord,
  getVersionPokemonIndex,
} from "@/lib/pokedex/data";

const randomIndex = (upperBound: number) => randomInt(upperBound);

export const generateFreeModeRound = async (
  excludedIds: number[] = [],
  selectedGameIds?: string[],
) => {
  const catalog = getPokedexCatalog();
  const excluded = new Set(excludedIds);
  const selectedGames = selectedGameIds && selectedGameIds.length > 0
    ? new Set(selectedGameIds)
    : null;
  const eligible = catalog.pokemon.filter((pokemon) =>
    pokemon.entryCount > 0 && !excluded.has(pokemon.id),
  );
  const pool = eligible.length > 0 ? eligible : catalog.pokemon.filter((pokemon) => pokemon.entryCount > 0);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const summary = pool[randomIndex(pool.length)];
    const answer = await getPokemonRecord(summary.id);

    if (answer?.entries.some((entry) =>
      !selectedGames || selectedGames.has(entry.version),
    )) {
      return createFreeModeRound(
        answer,
        catalog.pokemon,
        getVersionPokemonIndex(),
        randomIndex,
        randomUUID(),
        selectedGameIds,
      );
    }
  }

  throw new Error("Could not find a Pokémon with a usable Pokédex entry.");
};
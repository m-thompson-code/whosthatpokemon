import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { createFreeModeRound } from "@/lib/free-mode/round";
import type {
  PokedexCatalog,
  PokemonRecord,
  VersionPokemonIndex,
} from "@/lib/pokedex/types";

const readJson = <Value,>(path: string) =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as Value;

describe("Free Mode rounds", () => {
  const catalog = readJson<PokedexCatalog>("data/pokedex/index.json");
  const bulbasaur = readJson<PokemonRecord>("data/pokedex/pokemon/1.json");
  const versionPokemonIndex = readJson<VersionPokemonIndex>(
    "data/pokedex/version-pokemon.json",
  );

  test("creates four unique choices including the answer", () => {
    const round = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      () => 0,
      "round-1",
    );
    const choiceIds = round.choices.map((choice) => choice.id);

    expect(round.choices).toHaveLength(4);
    expect(new Set(choiceIds)).toHaveLength(4);
    expect(choiceIds).toContain(bulbasaur.id);
    expect(round.answerId).toBe(bulbasaur.id);
  });

  test("uses compound hard matches with game-valid, unrelated distractors", () => {
    const round = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      () => 0,
      "round-2",
    );
    const distractorIds = round.choices
      .filter((choice) => choice.id !== round.answerId)
      .map((choice) => choice.id);

    expect(round.entryText.toLocaleLowerCase("en-US")).not.toContain("bulbasaur");
    expect(round.sourceGame.length).toBeGreaterThan(0);
    expect(round.choices.every((choice) => choice.name && choice.imagePath)).toBe(true);
    expect(round.similarityStrategy).toBe("overall");
    expect(distractorIds.every((id) => versionPokemonIndex.red.includes(id))).toBe(true);
    expect(distractorIds).not.toContain(2);
    expect(distractorIds).not.toContain(3);
  });

  test("censors a Pokémon name when its selected Pokédex entry reveals it", () => {
    const round = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      () => 0,
      "round-censored",
      ["ruby"],
    );

    expect(round.entryText.toLocaleLowerCase("en-US")).not.toContain("bulbasaur");
    expect(round.entryText).toContain("_______");
  });

  test("prioritizes distractors supported by multiple similarity strategies", () => {
    const round = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      () => 0,
      "round-3",
    );
    const allPools = Object.values(bulbasaur.similarityPools);
    const distractorIds = round.choices
      .filter((choice) => choice.id !== round.answerId)
      .map((choice) => choice.id);

    expect(distractorIds.every((id) => allPools.filter((pool) => pool.includes(id)).length >= 2)).toBe(true);
  });
});
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

  test("uses a hard strategy with game-valid, unrelated distractors", () => {
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
    expect(round.similarityStrategy).not.toBe("overall");
    expect(distractorIds.every((id) => versionPokemonIndex.red.includes(id))).toBe(true);
    expect(distractorIds).not.toContain(2);
    expect(distractorIds).not.toContain(3);
  });

  test("can randomly choose different viable sorting strategies", () => {
    let call = 0;
    const chooseLastStrategy = (upperBound: number) => {
      call += 1;
      return call === 2 ? upperBound - 1 : 0;
    };
    const firstStrategy = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      () => 0,
      "round-3",
    ).similarityStrategy;
    const lastStrategy = createFreeModeRound(
      bulbasaur,
      catalog.pokemon,
      versionPokemonIndex,
      chooseLastStrategy,
      "round-4",
    ).similarityStrategy;

    expect(firstStrategy).not.toBe("overall");
    expect(lastStrategy).not.toBe("overall");
    expect(lastStrategy).not.toBe(firstStrategy);
  });
});
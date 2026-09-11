import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import type {
  PokedexCatalog,
  PokemonRecord,
  VersionPokemonIndex,
} from "@/lib/pokedex/types";

const readJson = <Value,>(path: string) =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as Value;

describe("committed Pokedex catalog", () => {
  const catalog = readJson<PokedexCatalog>("data/pokedex/index.json");

  test("contains the complete generation-sorted National Pokedex", () => {
    expect(catalog.speciesCount).toBe(1025);
    expect(catalog.pokemon).toHaveLength(1025);
    expect(catalog.generations.map((generation) => generation.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(catalog.pokemon.map((pokemon) => pokemon.id)).toEqual(
      Array.from({ length: 1025 }, (_, index) => index + 1),
    );
  });

  test("stores entries, games, local artwork, and similarity data", () => {
    const bulbasaur = readJson<PokemonRecord>("data/pokedex/pokemon/1.json");
    const pecharunt = readJson<PokemonRecord>("data/pokedex/pokemon/1025.json");
    const versionPokemonIndex = readJson<VersionPokemonIndex>(
      "data/pokedex/version-pokemon.json",
    );

    expect(bulbasaur.imagePath).toBe("/assets/pokemon/001.png");
    expect(bulbasaur.entries.some((entry) => entry.version === "red")).toBe(true);
    expect(bulbasaur.entries.every((entry) => entry.versionDisplayName.length > 0)).toBe(true);
    expect(bulbasaur.similarPokemonIds).toHaveLength(40);
    expect(bulbasaur.similarityPools["type-and-stage"]).toHaveLength(16);
    expect(versionPokemonIndex.red).toContain(bulbasaur.id);
    expect(pecharunt.generation).toBe(9);
    expect(pecharunt.entries.some((entry) => entry.version === "violet")).toBe(true);
  });
});
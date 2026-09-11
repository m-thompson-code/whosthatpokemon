import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cache } from "react";

import catalogJson from "../../../data/pokedex/index.json";
import versionPokemonJson from "../../../data/pokedex/version-pokemon.json";

import type {
  PokedexCatalog,
  PokemonRecord,
  VersionPokemonIndex,
} from "@/lib/pokedex/types";

export const getPokedexCatalog = () => catalogJson as PokedexCatalog;
export const getVersionPokemonIndex = () =>
  versionPokemonJson as VersionPokemonIndex;

export const getPokemonRecord = cache(async (id: number) => {
  try {
    const contents = await readFile(
      resolve("data/pokedex/pokemon", `${id}.json`),
      "utf8",
    );
    return JSON.parse(contents) as PokemonRecord;
  } catch {
    return null;
  }
});
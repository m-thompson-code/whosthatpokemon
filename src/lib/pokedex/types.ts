import type { EntryTrait } from "@/lib/pokedex/traits";

export type PokedexEntry = {
  versionId: number;
  version: string;
  versionDisplayName: string;
  versionGroup: string;
  text: string;
  revealsName: boolean;
  traits: EntryTrait[];
  keywords: string[];
};

export type PokemonSummary = {
  id: number;
  slug: string;
  name: string;
  generation: number;
  genus: string;
  types: string[];
  imagePath: string;
  entryCount: number;
  entryTraits: EntryTrait[];
  entryKeywords: string[];
};

export const SimilarityStrategy = {
  TypeAndStage: "type-and-stage",
  StatsAndRole: "stats-and-role",
  ShapeAndSize: "shape-and-size",
  Ecology: "ecology",
  Generation: "generation",
} as const;

export type SimilarityStrategy =
  (typeof SimilarityStrategy)[keyof typeof SimilarityStrategy];

export type SimilarityPools = Record<SimilarityStrategy, number[]>;
export type VersionPokemonIndex = Record<string, number[]>;

export type EntryWordStatistics = {
  frequency: number;
  common: boolean;
};

export type EntryWordIndex = Record<string, EntryWordStatistics>;

export type PokemonRecord = PokemonSummary & {
  color: string;
  shape: string | null;
  habitat: string | null;
  eggGroups: string[];
  evolutionChainId: number | null;
  evolvesFromId: number | null;
  evolutionStage: number;
  height: number;
  weight: number;
  stats: number[];
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  entries: PokedexEntry[];
  similarPokemonIds: number[];
  similarityPools: SimilarityPools;
};

export type PokedexCatalog = {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  speciesCount: number;
  generations: Array<{
    id: number;
    name: string;
    pokemonCount: number;
  }>;
  pokemon: PokemonSummary[];
};

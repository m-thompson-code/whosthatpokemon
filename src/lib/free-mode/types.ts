import type { SimilarityStrategy } from "@/lib/pokedex/types";

export type FreeModeChoice = {
  id: number;
  name: string;
  imagePath: string;
  types: string[];
};

export type FreeModeRound = {
  roundId: string;
  entryText: string;
  sourceGame: string;
  answerId: number;
  choices: FreeModeChoice[];
  similarityStrategy: SimilarityStrategy | "overall";
};
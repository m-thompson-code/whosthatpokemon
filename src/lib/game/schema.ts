import { z } from "zod";

import type { FreeModeRound } from "@/lib/free-mode/types";

export const RoomStatus = {
  Lobby: "lobby",
  InProgress: "in_progress",
  Finished: "finished",
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

export const RoomPhase = {
  Guessing: "guessing",
  Reveal: "reveal",
} as const;

export type RoomPhase = (typeof RoomPhase)[keyof typeof RoomPhase];

export const Team = {
  None: "none",
  TeamA: "team-a",
  TeamB: "team-b",
} as const;

export type Team = (typeof Team)[keyof typeof Team];

export const Winner = {
  TeamA: "team-a",
  TeamB: "team-b",
  Tie: "tie",
} as const;

export type Winner = (typeof Winner)[keyof typeof Winner];

export const gameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  generation: z.number().int().positive(),
  region: z.string().min(1),
  releaseOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});

export const pokedexEntrySchema = z.object({
  pokemonId: z.string().min(1),
  pokemonName: z.string().min(1),
  entryText: z.string().min(1),
  imagePath: z.string().min(1),
  silhouettePath: z.string().min(1).optional(),
  source: z.string().min(1),
  enabled: z.boolean(),
  schemaVersion: z.number().int().positive(),
});

export const createRoomSchema = z.object({
  selectedGameIds: z.array(z.string().min(1)).min(1),
  displayName: z.string().min(1),
});

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}$/),
  displayName: z.string().min(1),
});

export const teamAssignmentSchema = z.object({
  targetUid: z.string().min(1),
  team: z.enum([Team.None, Team.TeamA, Team.TeamB]),
});

export const submitAnswerSchema = z.object({
  roundId: z.string().min(1),
  selectedPokemonId: z.number().int().positive(),
});

export type RoomPlayer = {
  uid: string;
  displayName: string;
  team: Team;
  eliminated: boolean;
  score: number;
};

export type RoomLastResult = {
  roundNumber: number;
  entryText: string;
  sourceGame: string;
  answerId: number;
  choices: FreeModeRound["choices"];
  answeredTeam: Team;
  submissions: Array<{
    uid: string;
    displayName: string;
    selectedPokemonId: number | null;
    correct: boolean;
  }>;
};

export type Room = {
  hostId: string;
  joinCode: string;
  status: RoomStatus;
  selectedGameIds: string[];
  activeTeam: Team | null;
  roundPhase: RoomPhase | null;
  answerSubmissions: Record<string, number>;
  currentRound: FreeModeRound | null;
  lastResult: RoomLastResult | null;
  winner: Winner | null;
  roundNumber: number;
  teamASurvivors: number;
  teamBSurvivors: number;
  usedAnswerIds: number[];
};

export type Game = z.infer<typeof gameSchema>;
export type PokedexEntry = z.infer<typeof pokedexEntrySchema>;

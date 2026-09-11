import { describe, expect, test } from "vitest";

import { createRoomSchema, joinRoomSchema, submitAnswerSchema, teamAssignmentSchema } from "@/lib/game/schema";

describe("room input schemas", () => {
  test("normalizes valid room codes", () => {
    const result = joinRoomSchema.parse({ roomCode: "kto7", displayName: "Moo" });

    expect(result.roomCode).toBe("KTO7");
  });

  test("rejects room codes that aren't four characters", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "kanto7", displayName: "Moo" });

    expect(result.success).toBe(false);
  });

  test("requires selected game sources and a display name when creating a room", () => {
    const result = createRoomSchema.safeParse({ selectedGameIds: [], displayName: "" });

    expect(result.success).toBe(false);
  });

  test("only accepts known team values", () => {
    const result = teamAssignmentSchema.safeParse({ targetUid: "abc", team: "team-c" });

    expect(result.success).toBe(false);
  });

  test("requires a positive pokemon id for answers", () => {
    const result = submitAnswerSchema.safeParse({ roundId: "round-1", selectedPokemonId: 0 });

    expect(result.success).toBe(false);
  });
});
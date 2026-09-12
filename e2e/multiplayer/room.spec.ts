import { expect, test } from "@playwright/test";

import { cleanupPlayers, cleanupRoom, createPlayer, getRoom, type TestPlayer } from "../helpers/multiplayer";

// These specs run against the real Firebase project configured in .env.local (there is
// no emulator wired up yet), so each test cleans up every room/player/auth user it creates.

test("8 players can join a room, get shuffled into two teams, and the host can start the game", async ({ browser }) => {
  test.setTimeout(120_000);

  const host = await createPlayer(browser, "Host Trainer");
  const joiners: TestPlayer[] = [];
  let roomId = "";
  let joinCode = "";

  try {
    await host.page.goto("/host");
    await host.page.click('button:has-text("Create room")');
    await host.page.waitForURL(/\/host\/room\//, { timeout: 20_000 });

    roomId = host.page.url().split("/room/")[1];
    joinCode = (await host.page.locator(".room-code").textContent() ?? "").trim().slice(0, 4);
    expect(joinCode).toMatch(/^[A-Z0-9]{4}$/);

    const newJoiners = await Promise.all(
      Array.from({ length: 7 }, (_, index) => createPlayer(browser, `Trainer ${index + 1}`)),
    );
    joiners.push(...newJoiners);

    await Promise.all(joiners.map(async (joiner) => {
      await joiner.page.goto("/");
      await joiner.page.fill('input[name="roomCode"]', joinCode);
      await joiner.page.click('button:has-text("Join")');
      await joiner.page.waitForURL(/\/room\//, { timeout: 20_000 });
    }));

    await expect(host.page.locator('.team-column[data-team="none"] li')).toHaveCount(8, { timeout: 20_000 });

    await host.page.click('button:has-text("Shuffle teams")');
    await expect.poll(async () => {
      const room = await getRoom(roomId);
      return room !== undefined;
    }, { timeout: 10_000 }).toBe(true);
    await expect(host.page.locator('.team-column[data-team="none"] li.empty-roster')).toBeVisible({ timeout: 10_000 });

    const teamACount = await host.page.locator('.team-column[data-team="team-a"] li:not(.empty-roster)').count();
    const teamBCount = await host.page.locator('.team-column[data-team="team-b"] li:not(.empty-roster)').count();
    expect(teamACount).toBeGreaterThan(0);
    expect(teamBCount).toBeGreaterThan(0);
    expect(teamACount + teamBCount).toBe(8);

    await host.page.click('button:has-text("Start game")');
    await expect(host.page.locator(".team-status-bar")).toBeVisible({ timeout: 20_000 });

    for (const participant of [host, ...joiners]) {
      await expect(participant.page.locator(".team-status-bar")).toBeVisible({ timeout: 20_000 });
      await participant.page.getByRole("button", { name: "Start guessing" }).click();
    }
  } finally {
    if (roomId) await cleanupRoom(roomId, joinCode || undefined);
    await cleanupPlayers([host, ...joiners]);
  }
});

test("teammates submit individual answers before the host reveals the round", async ({ browser }) => {
  test.setTimeout(90_000);

  const host = await createPlayer(browser, "Race Host");
  const soloPlayer = await createPlayer(browser, "Solo Player");
  const allyA = await createPlayer(browser, "Ally One");
  const allyB = await createPlayer(browser, "Ally Two");
  let roomId = "";
  let joinCode = "";

  try {
    await host.page.goto("/host");
    await host.page.click('button:has-text("Create room")');
    await host.page.waitForURL(/\/host\/room\//, { timeout: 20_000 });

    roomId = host.page.url().split("/room/")[1];
    joinCode = (await host.page.locator(".room-code").textContent() ?? "").trim().slice(0, 4);

    for (const joiner of [soloPlayer, allyA, allyB]) {
      await joiner.page.goto("/");
      await joiner.page.fill('input[name="roomCode"]', joinCode);
      await joiner.page.click('button:has-text("Join")');
      await joiner.page.waitForURL(/\/room\//, { timeout: 20_000 });
    }

    await expect(host.page.locator('.team-column[data-team="none"] li')).toHaveCount(4, { timeout: 20_000 });

    await host.page.selectOption(`select[aria-label="Move ${soloPlayer.displayName}"]`, "team-a");
    await host.page.selectOption(`select[aria-label="Move ${allyA.displayName}"]`, "team-b");
    await host.page.selectOption(`select[aria-label="Move ${allyB.displayName}"]`, "team-b");

    await host.page.click('button:has-text("Start game")');
    await expect(host.page.locator(".team-status-bar")).toBeVisible({ timeout: 20_000 });
    for (const participant of [host, soloPlayer, allyA, allyB]) {
      await participant.page.getByRole("button", { name: "Start guessing" }).click();
    }

    const activeRoom = await getRoom(roomId);
    if (activeRoom?.activeTeam === "team-a" && activeRoom.currentRound) {
      const answerId = activeRoom.currentRound.answerId as number;
      const answer = activeRoom.currentRound.choices.find((choice: { id: number }) => choice.id === answerId) as { name: string };
      await soloPlayer.page.click(`button[aria-label="Choose ${answer.name}"]`);
      await expect(host.page.getByRole("button", { name: /Continue to Blue Team/i })).toBeVisible({ timeout: 20_000 });
      await host.page.getByRole("button", { name: /Continue to Blue Team/i }).click();
    }

    await expect.poll(async () => {
      const room = await getRoom(roomId);
      return `${room?.activeTeam}:${room?.roundPhase}`;
    }, { timeout: 20_000 }).toBe("team-b:guessing");

    const beforeRoom = await getRoom(roomId);
    const roundNumberBefore = beforeRoom?.roundNumber as number;
    const answerId = beforeRoom?.currentRound?.answerId as number;
    const choice = beforeRoom?.currentRound?.choices?.find(
      (candidate: { id: number; name: string }) => candidate.id === answerId,
    ) as { id: number; name: string };

    await Promise.all([
      allyA.page.click(`button[aria-label="Choose ${choice.name}"]`),
      allyB.page.click(`button[aria-label="Choose ${choice.name}"]`),
    ]);

    await expect.poll(async () => (await getRoom(roomId))?.roundPhase ?? null, { timeout: 20_000 }).toBe("reveal");
    const revealedRoom = await getRoom(roomId);
    expect(revealedRoom?.roundNumber).toBe(roundNumberBefore);
    expect(revealedRoom?.lastResult?.submissions.map((submission: { uid: string }) => submission.uid))
      .toEqual(expect.arrayContaining([allyA.uid, allyB.uid]));
  } finally {
    if (roomId) await cleanupRoom(roomId, joinCode || undefined);
    await cleanupPlayers([host, soloPlayer, allyA, allyB]);
  }
});

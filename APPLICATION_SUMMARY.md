# Who's That Pokemon?

## Product Summary

**Who's That Pokemon?** is a Pokédex trivia game built with Next.js and Firebase. In each round, players read a Pokédex entry from a selected Pokémon game and choose which of four Pokémon it describes.

The application has two modes. Free Mode is a local solo game with no lobby. Room Mode is a real-time, two-team elimination game controlled from one dedicated host device.

## Core Experience

A typical Room Mode game follows this flow:

1. A host signs in and creates a room.
2. The host selects a source game and optional answer timer.
3. Players join using a short room code and choose display names.
4. The server randomly and as evenly as possible assigns every player to one of two teams.
5. The host starts the game when both teams have at least one player.
6. Every active player sees the same Pokédex entry and four Pokémon choices.
7. Each active player selects one answer and locks in their guess.
8. The round closes when all active players answer, the timer expires, or the host closes it.
9. The correct Pokémon and source game are revealed. Every player who guessed incorrectly or failed to answer is eliminated.
10. If both teams still have active players, the host advances to the next round.
11. If only one team has active players, that team wins. If both teams lose their final active players in the same round, the game ends in a draw.

## Player Experience

Players should be able to join quickly without creating a permanent account. Firebase anonymous authentication gives each player a secure identity for the duration of the game while keeping onboarding lightweight.

During a round, a player sees:

- Their assigned team and whether they are still active
- The Pokédex entry text
- Four distinct Pokémon choices
- Artwork or silhouettes for each choice
- A round timer, when enabled
- Confirmation that their answer is locked
- The correct answer and source game after reveal
- Each team's remaining active players

An active player cannot submit more than one answer, change another player's data, control game state, or inspect the hidden answer before it is revealed. An eliminated player remains in the room as a spectator but cannot answer later rounds.

## Host Experience

Hosts can use Firebase anonymous or email/password authentication. The host dashboard includes controls to:

- Create a room and share its join code
- Select the Pokédex source game
- Set the answer duration
- See joined players, team assignments, and active/eliminated states
- Randomize or rebalance teams before the game starts
- Start the game
- Monitor how many active players have answered without exposing their choices early
- Close or reveal the current round
- Advance to the next Pokémon
- End the game early when necessary

The host device controls the room but does not join either team and does not submit guesses. Only the authenticated room owner can perform host actions. Team assignment, elimination, and game outcomes are validated by trusted server code rather than by the browser alone.

## Pokemon Catalog

Pokedex entries and visual assets are organized by game/version. This matters because the same Pokemon can have different descriptions across Pokemon releases.

Each catalog entry contains:

- A stable game/version ID
- A stable Pokemon ID and display name
- The Pokedex description for that source game
- Artwork and optional silhouette asset paths
- Source attribution
- Enabled and import-version metadata

Pokédex records and images are stored in the repository. The application reads normalized JSON from `data/pokedex` and artwork from `public/assets/pokemon`; it does not call PokéAPI while serving pages or running games. A repeatable import pipeline is the only process that refreshes catalog data.

The project must document data and asset licensing before public distribution. Pokemon names, artwork, and related content belong to their respective rights holders.

## Game Rules

Each round has one correct Pokémon and three distinct distractors. Choices are generated and shuffled on trusted server code so every active player receives the same question and ordering without receiving the hidden answer.

Room Mode has no point scoring. Each player begins active and has one life for the entire game:

- A correct answer keeps the player active.
- An incorrect answer eliminates the player.
- Failing to answer before a timed or host-triggered close counts as incorrect.
- Eliminations are applied together when the round resolves, not as answers arrive.
- A team is eliminated when it has no active players remaining.
- If exactly one team is eliminated, the other team wins immediately.
- If both teams are eliminated by the same round, the result is a draw.

Team assignment occurs once when the host starts the game. Assignment is random, with team sizes differing by no more than one when the player count is odd. At least two players are required so each team starts with one or more players.

A Pokémon should not repeat within a room until the selected catalog pool is exhausted. Distractors come from the same source game and are selected from precomputed hard-match pools based on typing, evolutionary stage, battle stats, shape, size, ecology, or generation. The answer's evolution family is excluded whenever a hard pool is available.

Free Mode uses the same question generation but has no teams or elimination. It tracks correct guesses for the current browser session and lets the player advance at their own pace.

## Technical Direction

The application uses:

- **Next.js App Router and TypeScript** for the web application
- **Firebase Authentication** for anonymous and email/password identities, plus a device-local Mock mode for development
- **Cloud Firestore** for rooms, teams, players, rounds, answers, and elimination state
- **Repository JSON and public assets** for Pokémon metadata, entries, similarity pools, and artwork
- **Firebase Emulator Suite** for local Auth, Firestore, Storage, and security-rule testing
- **Firebase Admin SDK** in server-only code for trusted game operations
- **Zod** for validating data at application boundaries
- **Playwright** for multi-user browser tests

Firestore real-time listeners keep host and player screens synchronized. The data exposed to players is separated from authoritative round data so the correct answer remains hidden until reveal. Team assignment, round resolution, elimination, and winner calculation are atomic trusted operations.

## Main Application Areas

The first version contains five primary areas:

- **Entry screen:** choose Free Mode, host, join, or browse the Pokédex.
- **Free Mode:** play consecutive local rounds without authentication or a lobby.
- **Host setup:** authenticate, select settings, and create a room.
- **Host room:** manage the two teams, rounds, reveal state, and game progression.
- **Player room:** see team assignment, wait in the lobby, answer while active, and spectate after elimination.

The interface must also handle room-not-found, duplicate-name, disconnected, host-left, loading, answer-locked, eliminated, revealed, team-win, draw, and game-finished states.

Required user input never appears in a modal. First-visit username setup uses the dedicated `/welcome` page, and username, authentication, and developer controls use `/settings`. Toasts are reserved for non-blocking success, warning, and error feedback.

## Minimum Viable Product

The MVP includes:

- Host sign-in
- Anonymous player sign-in
- Joinable rooms with short codes
- One dedicated non-playing host device
- Random, balanced assignment into two teams
- Repository-backed Pokémon game/version catalog
- Four-choice Pokédex questions
- Real-time lobby and round updates
- Host-controlled start, reveal, next-round, and end-game actions
- One-answer-per-player enforcement
- One-life elimination for incorrect or missing answers
- Team active-player counts
- Atomic team-win and simultaneous-elimination draw resolution
- Firestore and Storage security rules
- A tested catalog import process
- Responsive host and player interfaces

The MVP is complete when one host and at least two players can finish a team-elimination game across separate browser sessions without exposing answers early, eliminating a player more than once, or producing different outcomes for simultaneous submissions.

## Later Possibilities

Potential extensions include:

- Additional Pokemon games and generations
- Mixed-game playlists
- Additional distractor strategies and tuning
- Speed bonuses
- Audio clues, silhouettes, sprites, and cry-based rounds
- Host moderation and player removal
- Rejoin support across devices
- Saved host presets and game history
- Accessibility options for timers, motion, contrast, and screen readers
- Spectator and audience-display modes

These are deliberately outside the first multiplayer vertical slice. The first implementation should prove random team assignment, simultaneous elimination, and all three terminal outcomes before expanding room settings or game modes.

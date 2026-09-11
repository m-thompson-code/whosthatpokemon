# Who's That Pokemon?

A Pokédex trivia game built with Next.js and Firebase. Free Mode supports solo
play, while Room Mode is a two-team elimination game controlled from one
dedicated host device.

Free Mode is available at `/play` without authentication, Firebase, or a lobby.
It creates each round from the committed local catalog, presents four named
Pokémon, and reveals the answer and source game after one choice is locked.

First-visit username setup and account settings use dedicated pages rather than
modals. Toasts provide non-blocking authentication and storage feedback.

## Planned Room Mode

Players join a host-controlled room and are randomly divided between two teams,
with team sizes differing by no more than one. The host device controls the game
but does not belong to a team or submit answers.

Every player starts active and must answer every round correctly to remain in
the game. Incorrect and missing answers are resolved together at reveal and
eliminate those players permanently. When one team has no active players, the
other team wins. If both teams lose their final active players in the same
round, the game ends in a draw.

## Local Setup

Requirements:

- Node.js 24 or newer
- Java 21 or newer for the Firebase Emulator Suite
- A Firebase project with Anonymous and Email/Password Authentication enabled

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The provided Firebase web
configuration is stored in the ignored `.env.local`. Use `.env.example` when
configuring another environment.

Room creation runs through the Firebase Admin SDK. Local development uses
Application Default Credentials from the ignored
`.secrets/firebase-admin.json` file. `.env.local` points
`GOOGLE_APPLICATION_CREDENTIALS` at that file. Never expose a service account
key through a `NEXT_PUBLIC_*` variable.

```bash
npm run emulators
```

## Firebase App Hosting

Firebase App Hosting is the intended production target. Do not deploy the local
service-account JSON or configure `GOOGLE_APPLICATION_CREDENTIALS` in App
Hosting. The platform automatically provides its backend service account,
`FIREBASE_CONFIG`, and `FIREBASE_WEBAPP_CONFIG`.

The Firebase initializers support both environments:

- Local development uses the explicit web values in `.env.local` and the
	ignored service-account file through Application Default Credentials.
- App Hosting uses no-argument SDK initialization and the configuration and
	credentials injected by Firebase automatically.

If another local service-account key is generated, place it at
`.secrets/firebase-admin.json` and keep the `.secrets` directory ignored. The
project also ignores root files matching `*firebase-adminsdk*.json` to prevent
accidental commits before they are moved.

## Identity and Authentication

Every first-time visitor must choose a username. For Firebase identities, the
username is stored in the user's private Firestore profile and cached on the
device. Device persistence attempts `localStorage`, then `sessionStorage`, then
an in-memory JavaScript store when browser storage is unavailable.

Firebase Anonymous Auth is the default. Settings contains username editing and
a collapsed Developer Mode section with identity diagnostics and three modes:

- **Mock:** a device-local developer ID whose internal value always starts with
	`moo-`.
- **Firebase anonymous:** uses the generated Firebase UID.
- **Email/password:** supports account creation, sign-in, sign-out, and password
	reset using the generated Firebase UID.

Switching from anonymous to email/password abandons the anonymous account. If
the active Firebase UID does not match the cached UID, cached identity data is
cleared and the visitor completes first-time username setup again. If a
Firestore profile cannot be saved, the app temporarily switches to Mock mode,
shows a warning toast, and logs the Firebase error code in both the browser and
development server consoles.

## Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:rules
npm run build
```

Vitest runs unit and committed-catalog integrity tests. Playwright reuses a
running local Next.js server on port 3000 or starts one automatically, then runs
Chromium browser tests for onboarding, Settings, Free Mode, and responsive
layout behavior. Install the browser once with
`npx playwright install chromium`.

`npm run test:rules` launches the Firestore and Storage emulators and therefore
requires Java. The product scope and multiplayer rules are documented in
[APPLICATION_SUMMARY.md](APPLICATION_SUMMARY.md).

## Pokemon Artwork

Numbered Pokemon artwork is stored in `public/assets/pokemon`, so Bulbasaur is
available to the app at `/assets/pokemon/001.png`. The files are sourced from
the official Pokemon website and remain subject to the rights holder's terms.

The downloader covers National Pokedex IDs 001 through 1025 by default. It
validates PNG signatures, retries failed requests, writes atomically, and skips
valid existing files so interrupted downloads can be resumed safely.

```bash
npm run assets:pokemon
npm run assets:pokemon -- --start 1 --end 151
npm run assets:pokemon -- --concurrency 4 --force
```

## Local Pokédex Data

The application reads Pokédex content exclusively from `data/pokedex`. It does
not contact PokéAPI in the browser or while serving a page. Each Pokémon has a
separate numbered JSON record containing its English entries, source games,
display metadata, and precomputed similar Pokémon IDs.

Refresh the committed catalog intentionally with:

```bash
npm run data:pokedex
```

The importer is the only code that contacts PokéAPI. It caches raw responses in
the ignored `.cache/pokeapi` directory, normalizes control characters in entry
text, and regenerates the local index and records. PokéAPI asks consumers to
cache requested resources and use considerate request frequency; the importer
uses bounded concurrency and retries.

Free Mode uses precomputed hard-match pools rather than unrestricted random
choices. Each round randomly selects a viable ranking strategy based on shared
typing and evolution stage, battle stats and role, body shape and size,
ecology, or generation. Distractors are restricted to Pokémon with an entry in
the selected source game and exclude the answer's evolution family whenever a
hard pool is available.

Catalog data is sourced from [PokéAPI](https://pokeapi.co/) and its
[BSD 3-Clause licensed repository](https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md).
Pokémon names and characters are trademarks of Nintendo.

# Architecture

## Tech stack recommendation
Recommend React Native with Expo.
- Fits the scope of a lightweight, single-screen mobile UI with quick iteration.
- Expo simplifies build tooling and OTA updates for a small MVP.
- React ecosystem offers straightforward state management and storage options.

TODO: Confirm if Flutter is preferred by team or if existing infra mandates it.

## High-level architecture (text diagram)
Client (React Native + Expo)
  -> Netlify Functions (serverless API boundary)
      -> CockroachDB (data source)

## Separation of concerns
- Frontend: UI rendering, local session state, input validation, display logic
- Netlify Functions: all DB access, daily quiz selection, scoring verification, result persistence
- Database: persistent storage of quizzes, results, users, leaderboard aggregates

## Environment configuration
- Use .env files for environment-specific values (dev/staging/prod)
- Client uses only public, non-secret config (API base URL, feature flags)
- Server functions read secrets (DB connection string) from server-only env
- Enforce safe switching by separating per-environment build profiles

TODO: Define exact .env file names and keys once hosting conventions are chosen.

## Backend and database integration
- Integration method: Netlify Functions as a REST layer in front of CockroachDB
- Daily quiz fetch:
  - Server selects quiz by London date key
  - Returns only prompt and options to client
- Submit results:
  - Server verifies answers against stored correct options
  - Server computes score, streak, best score
  - Server writes result and updates user stats
- Reliability:
  - Retry transient DB failures in functions
  - Cache daily quiz responses in client storage
  - Avoid duplicate submissions by idempotent server handling (TODO: define key)

TODO: Confirm CockroachDB driver, connection pooling strategy, and function timeout limits.

## Trust boundaries
- Untrusted: Mobile client (cannot be trusted for scoring or streak rules)
- Trusted: Netlify Functions (enforce rules, compute results, query DB)
- Data: CockroachDB only accessible via Netlify Functions

## Today determination
- Server-side only
- London timezone (Europe/London)
- Function computes the daily date key

TODO: Confirm if quiz schedule uses UTC or London local midnight for resets.


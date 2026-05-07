# Database

This folder contains SQL files for the Pundit Trivia CockroachDB database.

## Structure

```text
db/
├── migrations/
│   ├── 001_users.sql
│   ├── 002_results.sql
│   ├── 003_leagues.sql
│   ├── 004_online_games.sql
│   ├── 005_challenges.sql
│   ├── 006_usernames.sql
│   └── 007_challenge_usernames.sql
├── queries/
└── README.md
```

## Migrations

Run migrations in order against CockroachDB:

```bash
cockroach sql --url "$DATABASE_URL" < db/migrations/001_users.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/002_results.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/003_leagues.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/004_online_games.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/005_challenges.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/006_usernames.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/007_challenge_usernames.sql
```

## Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | User profiles, aggregate stats, streaks, usernames, challenge counters |
| `results` | Authenticated daily quiz submissions |
| `leagues` | Legacy/private league definitions |
| `league_members` | Legacy/private league memberships |
| `online_games` | Legacy multiplayer game sessions |
| `online_game_players` | Legacy online game participants |
| `challenges` | Async 1v1 challenge lifecycle and answer payloads |

The `pu_player_ques` table is the existing daily quiz source table and is not managed by these migrations.

## Current App Semantics

- Authenticated daily quiz results persist in `results`.
- Guest daily results are local-only until login migration/adoption.
- User aggregate stats are server-authoritative for authenticated users.
- Challenge W/L/D counters live on `users`.
- Challenge participant usernames are copied onto challenge rows for stable history display.

## Dependencies

```text
users
  ├── results
  ├── leagues
  ├── league_members
  ├── online_games
  ├── online_game_players
  └── challenges
```

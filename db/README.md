# Database

This folder contains SQL files for the Pundit Trivia database (CockroachDB).

## Structure

```
db/
├── migrations/       # Schema changes (run in order)
│   ├── 001_users.sql
│   ├── 002_results.sql
│   ├── 003_leagues.sql
│   └── 004_online_games.sql
├── queries/          # Common queries for reference
│   ├── users.sql
│   ├── results.sql
│   ├── leagues.sql
│   └── online_games.sql
└── README.md
```

## Migrations

Run migrations in order against CockroachDB:

```bash
# Using cockroach sql
cockroach sql --url "$DATABASE_URL" < db/migrations/001_users.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/002_results.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/003_leagues.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/004_online_games.sql
```

## Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | User profiles, stats, streak tracking |
| `results` | Quiz submission history |
| `leagues` | Private league definitions |
| `league_members` | League memberships |
| `online_games` | Multiplayer game sessions |
| `online_game_players` | Players in online games |

## Existing Table

The `pu_player_ques` table (quiz questions) already exists and is not managed here.

## Dependencies

```
users
  ↑
  ├── results (user_id → users.id)
  ├── leagues (owner_id → users.id)
  ├── league_members (user_id → users.id)
  ├── online_games (host_id → users.id)
  └── online_game_players (user_id → users.id)

leagues
  ↑
  └── league_members (league_id → leagues.id)

online_games
  ↑
  └── online_game_players (game_id → online_games.id)
```

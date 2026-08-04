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
│   ├── 007_challenge_usernames.sql
│   ├── 008_friendships.sql
│   ├── 009_leaderboard_indexes.sql
│   ├── 010_api_rate_limits.sql
│   ├── 011_anonymous_analytics.sql
│   ├── 012_identity_onboarding.sql
│   ├── 013_social_backend_alignment.sql
│   ├── 014_streak_projection_backfill.sql
│   ├── 015_career_game_results.sql
│   └── 016_profile_avatars.sql
├── audits/
│   ├── identity_onboarding_pre.sql
│   ├── identity_onboarding.sql
│   ├── social_backend_pre.sql
│   ├── social_backend.sql
│   ├── streak_projection.sql
│   └── profile_avatars.sql
├── queries/
└── README.md
```

## Migrations

Production status: migrations 012 and 013 were applied and aggregate-audited on
25 July 2026. For another environment, apply every migration in numeric order.

Run migrations in order against CockroachDB:

```bash
cockroach sql --url "$DATABASE_URL" < db/migrations/001_users.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/002_results.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/003_leagues.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/004_online_games.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/005_challenges.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/006_usernames.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/007_challenge_usernames.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/008_friendships.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/009_leaderboard_indexes.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/010_api_rate_limits.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/011_anonymous_analytics.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/012_identity_onboarding.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/013_social_backend_alignment.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/014_streak_projection_backfill.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/015_career_game_results.sql
cockroach sql --url "$DATABASE_URL" < db/migrations/016_profile_avatars.sql
```

Immediately after migration 016, run `npm run audit:profile-avatars`. The audit
validates every stored ID against the checked-in avatar manifest; before the
updated client is released, its letter-avatar count should also be zero.

## Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | User profiles, aggregate stats, streaks, usernames, challenge counters |
| `results` | Authenticated daily quiz submissions |
| `career_game_results` | Independent authenticated daily career-game completion |
| `leagues` | Legacy/private league definitions |
| `league_members` | Legacy/private league memberships |
| `online_games` | Legacy multiplayer game sessions |
| `online_game_players` | Legacy online game participants |
| `challenges` | Async 1v1 challenge lifecycle and answer payloads |
| `friendships` | Symmetric friend relationships |
| `api_rate_limits` | Shared fixed-window API throttling across serverless instances |
| `analytics_events` | Anonymous aggregate product funnel events |

The `pu_player_ques` table is the existing daily quiz source table and is not managed by these migrations.

## Current App Semantics

- Authenticated daily quiz results persist in `results`.
- Authenticated career-game completion persists separately in
  `career_game_results` and does not update quiz aggregates.
- Guest daily results are local-only until login migration/adoption.
- User aggregate stats are server-authoritative for authenticated users.
- Daily results are authoritative for streaks; `users.streak` and `last_played`
  are rebuilt projections for compatible, efficient reads.
- Authenticated identity synchronization owns user-row creation and username onboarding.
- Every authenticated identity receives a validated static `avatar_id`;
  migration 016 and identity sync fill missing values from the football symbols.
- `onboarding_status = 'complete'` requires a canonical public username.
- Challenge W/L/D counters live on `users`.
- Challenge participant usernames are retained as compatibility snapshots while reads resolve current usernames from `users`.
- New friend links are reusable by multiple players for seven days; links issued before migration 013 remain single-use.
- `friendships` stores one ordered row per mutual relationship.
- Friendship acceptance and removal are idempotent around that ordered row.
- Analytics events contain no user IDs, email addresses, codes, answers, or free-form metadata.

## Dependencies

```text
users
  ├── results
  ├── career_game_results
  ├── leagues
  ├── league_members
  ├── online_games
  ├── online_game_players
  └── challenges
```

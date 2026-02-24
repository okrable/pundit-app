# Architecture (Current)

## Runtime Topology
- **Client**: Expo React Native app (TypeScript).
- **API**: Netlify Functions (`netlify/functions/*`).
- **Data**: CockroachDB/PostgreSQL via `pg`.
- **Auth**: Auth0 (optional on client, required for protected server endpoints).

## Core Domain Modules

### Daily Quiz
- Fetch questions by quiz date.
- Submit answers with timing metadata for speed-based scoring.
- Persist authenticated-user results and derived stats.

### Social Competition
- Global leaderboard.
- Friends graph + friends leaderboard.
- Async challenge mode (create/join/submit/revoke/history).

### Profile
- Auth-aware Me page.
- Username/display-name updates (cooldown rules enforced server-side).

## Cross-Cutting Concerns
- **Timezone consistency**: backend uses `QUIZ_TIMEZONE` and frontend uses `EXPO_PUBLIC_QUIZ_TIMEZONE`.
- **Ownership enforcement**: protected endpoints verify bearer token and match `token.sub` to requested `userId`.
- **Caching**: client caches quiz payloads and same-day results to reduce network dependence.

## Known Architectural Gaps
1. No offline submit queue for disconnected answer capture and delayed sync.
2. Error-boundary coverage is not complete at app root/screen boundaries.
3. Endpoint-level abuse controls (rate limit / throttling) are limited.

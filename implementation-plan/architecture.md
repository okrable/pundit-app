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
- **Bootstrap loading**: app startup now hydrates cached daily-loop state before first navigation render.
- **Auth session control**: explicit logout clears local credentials and attempts upstream Auth0 session logout; login and signup flows prefer interactive re-auth over silent session reuse.
- **Caching**: client caches quiz payloads, same-day results, profile stats, and leaderboard data to reduce network dependence.
- **Stale-first refresh**: Games, Me, and League Tables render cached data first and revalidate silently in the background.
- **Optimistic daily results**: the fifth answer reveals a local result immediately while submit/finalization continue asynchronously.

## Known Architectural Gaps
1. No offline submit queue for disconnected answer capture and delayed sync.
2. Error-boundary coverage is not complete at app root/screen boundaries.
3. Endpoint-level abuse controls (rate limit / throttling) are limited.

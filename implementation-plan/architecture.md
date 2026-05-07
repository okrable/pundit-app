# Architecture

## Runtime Topology

- Client: Expo React Native app with TypeScript.
- API: Netlify Functions under `netlify/functions/*`.
- Data: CockroachDB/PostgreSQL via `pg`.
- Auth: Auth0 through Expo AuthSession.
- State: Zustand stores backed by AsyncStorage/SecureStore caches.

## Core Domain Modules

### Daily Quiz

- Fetches the current 5-question quiz by timezone-aware quiz date.
- Plays locally with typewriter prompt pacing, delayed option reveal, timer-after-reveal behavior, and immediate answer reveal.
- Creates an immediate local summary after the fifth answer.
- Authenticated results submit to the server; guest results stay local until login migration/adoption.
- Cached same-day results prevent replay and show the completed state on warm opens.

### Challenge Mode

- Async 1v1 challenge lifecycle: create, join, play, submit, reveal, revoke, and history.
- Uses the shared refreshed `QuestionCard` gameplay surface.
- Persists challenge W/L/D stats for authenticated users.

### Profile and Social

- Me tab renders authenticated stats/profile or guest conversion state.
- Username/display-name updates are supported with server-side rules.
- Friends graph powers friends leaderboard and friend invite flows.

## Cross-Cutting Decisions

- Timezone consistency: backend `QUIZ_TIMEZONE` and frontend `EXPO_PUBLIC_QUIZ_TIMEZONE` must match.
- Ownership enforcement: protected endpoints verify Auth0 bearer tokens and require `token.sub === userId`.
- Auth coordination: screens call the shared auth flow; they do not exchange authorization codes directly.
- Auth sync gating: login, cached-session restore, quiz reconciliation, and first profile/leaderboard prefetch run behind loading UI before normal tabs are released.
- Logout behavior: local app credentials are cleared without invoking hosted Auth0 browser logout.
- Stale-first loading: quiz, result, profile, and leaderboard caches hydrate before authenticated sync or public warm refresh.
- Manual protected refresh: Me/profile and friends leaderboard protected refreshes are pull-to-refresh or mutation-triggered after initial sync, not tab-triggered.
- Defensive auth retry: API requests can retry once after token refresh or mid-flight token change, and refresh-token rotation is protected by single-flight refresh.
- Debuggability: persistent debug logs can be copied from Settings.

## Known Architectural Gaps

1. No full offline answer queue yet.
2. Error-boundary coverage is incomplete.
3. Endpoint-level abuse controls are limited.
4. API observability is still basic.

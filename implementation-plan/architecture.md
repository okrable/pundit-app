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
- Resolves signed-in participants from verified bearer-token identities and
  returns current canonical usernames; legacy guest history remains explicitly
  labelled.

### Profile and Social

- Me tab renders authenticated stats/profile or guest conversion state.
- `users.username` is the canonical public identity. Display-name storage and
  response aliases remain temporarily for installed-client compatibility.
- `POST /syncIdentity` and protected identity guards own authenticated user-row
  provisioning and username-onboarding state.
- Friendships use one ordered `(user_a, user_b)` row that is visible to both
  players.
- New friend invites are reusable for seven days; legacy invite rows retain
  single-use semantics.

## Cross-Cutting Decisions

- Timezone consistency: backend `QUIZ_TIMEZONE` and frontend `EXPO_PUBLIC_QUIZ_TIMEZONE` must match.
- Ownership enforcement: protected endpoints verify Auth0 bearer tokens and require `token.sub === userId`.
- Auth coordination: screens call the shared auth flow; they do not exchange authorization codes directly.
- Auth sync gating: login and restoration synchronize identity first. Username
  onboarding, quiz reconciliation, and initial protected prefetch all complete
  before normal tabs are released.
- Auth clients: responsive web uses an Auth0 SPA client while EAS native builds
  use a Native client and the `pundit-app://callback` scheme in the same tenant.
- Logout behavior: local app credentials are cleared without invoking hosted Auth0 browser logout.
- Stale-first loading: quiz, result, profile, and leaderboard caches hydrate before authenticated sync or public warm refresh.
- Protected refresh: Me/profile refresh remains explicit, while friends data is
  forcibly revalidated after friendship mutations and whenever League Tables
  gains navigation focus.
- Defensive auth retry: API requests can retry once after token refresh or mid-flight token change, and refresh-token rotation is protected by single-flight refresh.
- Debuggability: persistent debug logs can be copied from Settings.

## Known Architectural Gaps

1. Broader offline behavior is incomplete beyond persisted quiz/challenge submission retry.
2. Structured logs exist, but operational alerting and error-budget reporting are not configured.
3. Authenticated API, cache, and cross-platform UI integration coverage remains limited.
4. Error-boundary coverage exists at the app root; finer per-screen recovery can still be added later if needed.

# Architecture

## Runtime Topology

- Client: Expo SDK 55 / React Native 0.83 app with TypeScript.
- API: modern Netlify Functions under `netlify/functions/*`; existing
  Lambda-shaped handlers use the official compatibility adapter.
- Content data: BigQuery for UK questions/careers from the configured cutover
  date; CockroachDB `pu_player_ques` before cutover and for other languages.
- Transactional data: CockroachDB/PostgreSQL via `pg`.
- Auth: Auth0 through Expo AuthSession.
- State: Zustand stores backed by AsyncStorage/SecureStore caches.

## Core Domain Modules

### Daily Quiz

- Fetches the current 5-question quiz by timezone-aware quiz date.
- Resolves every delivery and answer-key read through one deterministic
  date/language source adapter.
- Plays locally with typewriter prompt pacing, delayed option reveal, timer-after-reveal behavior, and immediate answer reveal.
- Creates an immediate local summary after the fifth answer.
- Authenticated results submit to the server; guest results stay local until login migration/adoption.
- Cached same-day results prevent replay and show the completed state on warm opens.

### Daily Career Game

- Whose Journey ships beside the quiz in the combined daily payload and is
  playable from the Games gallery whenever `careerGame` is present.
- Matches full names, configured aliases, and surnames through shared
  client/server normalization.
- Persists completion through separate local keys and `career_game_results`;
  it never changes quiz or profile aggregates.
- Uses the BigQuery rank-6 question and `player_stats` career after cutover,
  while the date-scoped Anthony Gordon fixture remains only for legacy dates.
- Displays Domestic rows by rank, followed directly by International rows by
  rank, and restores only the current London date's completion.

### Retired Challenge Mode

- The Challenge tab/drawer entry opens a static Coming Soon screen.
- Old challenge links are cleared locally and redirected there without auth,
  previews, or mutations. Friend-invite links are unchanged.
- All six challenge Functions fail closed with HTTP `410` before auth, BigQuery,
  or CockroachDB work. Dormant screens, state modules, Functions, tables, and
  historical rows are retained for a future redesign.

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
- Daily result dates are authoritative for streaks. The user-row streak fields
  are recomputed projections, while profile responses expose date-aware status.

## Cross-Cutting Decisions

- Timezone consistency: backend `QUIZ_TIMEZONE` and frontend `EXPO_PUBLIC_QUIZ_TIMEZONE` must match.
- Ownership enforcement: protected endpoints verify Auth0 bearer tokens and require `token.sub === userId`.
- Auth coordination: screens call the shared auth flow; they do not exchange authorization codes directly.
- Auth sync gating: interactive login owns post-login activation and bootstrap
  activates only stored-session restoration. Activation is deduplicated by user
  and auth-state version; stale work is discarded. Explicit username
  onboarding, quiz reconciliation, and initial protected prefetch all complete
  before normal tabs are released.
- Auth clients: responsive web uses an Auth0 SPA client while EAS native builds
  use a Native client and the `pundit-app://callback` scheme in the same tenant.
- Platform navigation: web uses a responsive drawer, Android uses JavaScript
  bottom tabs, and custom iOS builds use the native Apple tab controller.
  Expo Go or a runtime without the experimental `Tabs.Host` API falls back to
  JavaScript tabs and records a diagnostic instead of attempting native tabs.
- Logout behavior: local app credentials are cleared without invoking hosted Auth0 browser logout.
- Stale-first loading: quiz, result, profile, and leaderboard caches hydrate before authenticated sync or public warm refresh.
- Protected refresh: Me/profile refresh remains explicit, while friends data is
  forcibly revalidated after friendship mutations and whenever League Tables
  gains navigation focus.
- Defensive auth retry: API requests can retry once after token refresh or mid-flight token change, and refresh-token rotation is protected by single-flight refresh.
- Debuggability: persistent debug logs can be copied from Settings.
- Product analytics: an installation-scoped random UUID is stored separately
  from account state and accompanies only allowlisted typed events. It survives
  logout, can be disabled or reset from Settings, is never derived from Auth0,
  and is retained with raw events for at most 90 days.
- Quiz completion ordering: local result, pending submission, and optimistic
  streak are published and persisted before the protected submission starts;
  authoritative success reconciles them before leaderboard refresh.
- BigQuery cutover is server-only and deterministic. Once a UK quiz date is on
  BigQuery, source errors use existing caches or return a temporary error; they
  never silently fall back to a different Cockroach question set.

## Known Architectural Gaps

1. Broader offline behavior is incomplete beyond persisted daily and Journey submission retry.
2. Structured logs exist, but operational alerting and error-budget reporting are not configured.
3. Authenticated API, cache, and cross-platform UI integration coverage remains limited.
4. Error-boundary coverage exists at the app root; finer per-screen recovery can still be added later if needed.

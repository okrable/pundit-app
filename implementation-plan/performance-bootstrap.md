# Performance Bootstrap and Daily-Loop Loading

## Objective

Keep warm opens fast while avoiding stale identity flashes after login/logout.

## Startup Sequence

1. Load fonts.
2. Restore cached auth/session metadata.
3. Hydrate cached daily-loop resources:
   - today quiz;
   - today result;
   - profile stats;
   - friends leaderboard;
   - global leaderboard.
4. Render the app shell from cached state where safe.
5. Revalidate auth and network-backed resources in the background.

## Auth Sync Sequence

Interactive login and cached-session restore enter the same authenticated sync
pipeline before normal tabs are released, but only one owner can activate a
given user and auth-state version:

1. Prompt Auth0 with Expo AuthSession.
2. Exchange the authorization code once using the matching redirect URI and PKCE verifier.
3. Store credentials and user info.
4. Synchronize verified identity with `/syncIdentity`.
5. If required, hold the app on username onboarding; otherwise continue.
6. Reconcile guest/auth daily result state.
7. Prefetch profile, quiz, global leaderboard, and friends leaderboard data.
8. Release normal navigation from `AuthSyncScreen`.

Screens do not process AuthSession responses directly. Me/profile stays
cached-first with explicit refresh, while League Tables deliberately forces a
friends refresh whenever the screen gains navigation focus.

Interactive login owns activation after the authorization-code exchange.
Bootstrap activation is reserved for sessions restored from storage. Every
completion/failure update rechecks the active user, token, and auth-state
version so stale work cannot revive a logged-out or replaced session.

## Cache Strategy

### Quiz

- Keyed by quiz date.
- Warm opens prefer cached quiz data only when its date and canonical quiz ID
  match the current London quiz date.
- Network requests are explicitly date-scoped; stale cross-date responses are
  discarded rather than displayed during background revalidation.

### Same-Day Result

- Stored per identity.
- Guest and authenticated results are separate until reconciliation.
- Used to prevent replay and show completed state immediately.
- Can carry sync status for pending/failed authenticated submission paths.

### Profile and Leaderboards

- Profile stats are cached per authenticated user.
- Friends and global leaderboards are cached separately.
- Quiz envelopes use schema version 3; profile and leaderboard resources retain
  their independently versioned schemas.
- Me and League Tables render cached or placeholder content before background refresh.
- Protected profile refreshes happen during authenticated session sync or
  explicit pull-to-refresh.
- Friends leaderboard refreshes happen during authenticated sync,
  pull-to-refresh, friendship mutations, and League Tables focus.

## Result Submission Model

- After the fifth answer, the app computes and publishes an immediate local
  result plus an optimistic streak projection.
- The result and pending submission are durably stored before an authenticated
  network request begins.
- Authenticated plays submit to the server and reconcile the optimistic state
  with authoritative stats before refreshing leaderboards.
- Guest plays are not submitted while still guest.
- One transient network, timeout, or server failure is retried automatically.
- Pending authenticated submissions survive persistent failure and retry on a
  later authenticated warm path.
- Submission logs include client duration and the existing `Server-Timing`
  response header for backend phase attribution.
- Challenge answers are persisted before submission and retry on authenticated warm paths.
- Challenge submission is idempotent: replaying a completed request returns the stored result instead of incrementing stats again.

## UX Rules

- Branded bootstrap is used for cold startup.
- `AuthSyncScreen` is used for login/reconciliation handoff.
- Daily quiz must not render stale `QuestionCard` state while identity reconciliation is active.
- Generic full-screen spinners are reserved for true cold-miss fallback states.
- App foreground events use public warm refresh only; protected profile data
  remains authenticated-sync/manual, while friends refresh is additionally
  navigation-focus driven.

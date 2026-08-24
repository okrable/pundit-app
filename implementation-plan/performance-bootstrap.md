# Performance Bootstrap and Daily-Loop Loading

## Objective

Keep warm opens fast while avoiding stale identity flashes after login/logout.

## Startup Sequence

1. Load fonts and read cached auth/session metadata.
2. Mark `localAuthReady`, select the cached identity, and begin its cache
   hydration concurrently with Auth0 token restoration.
3. Hydrate cached daily-loop resources for that captured user and auth-state
   version:
   - today quiz;
   - today result;
   - profile stats;
   - friends leaderboard;
   - global leaderboard.
4. Render the app shell as soon as fonts and the selected identity's caches are
   ready. A restored authenticated shell is eligible only when its stored
   username/onboarding state was previously complete.
5. Mark `restoreSettled` after token refresh and Auth0 user-info verification,
   then reconcile protected resources in the background.

Late hydration results are discarded when the user or `authStateVersion`
changes. Invalid restoration first rebinds guest caches and only then releases
guest navigation, so account A cannot flash after logout or appear in account B.

## Auth Sync Sequence

Interactive login and cached-session restore enter the same authenticated sync
pipeline, but only interactive login and incomplete restored identities block
normal tabs. An eligible restored shell remains usable while the pipeline runs:

1. Prompt Auth0 with Expo AuthSession.
2. Exchange the authorization code once using the matching redirect URI and PKCE verifier.
3. Store credentials and user info.
4. Synchronize verified identity with `/syncIdentity`.
5. If required, hold the app on username onboarding; otherwise continue.
6. Hydrate achievements, then reconcile Daily Quiz and Journey concurrently.
7. Revalidate profile, leaderboards, and pending submissions in parallel.
8. Release interactive login from `AuthSyncScreen`; restored sessions were not
   held behind it.

The first successful protected Function verification stores a 60-second,
strongly consistent site-scoped verification entry. Its key and value contain
only SHA-256 digests of the opaque access token and verified Auth0 subject, plus
an expiry timestamp; no raw token, Auth0 subject, username, or profile claim is
stored. Other Functions for that token owner reuse the entry rather than each
calling Auth0 `/userinfo`, whose per-user sustained limit is lower than the
normal reconciliation fan-out. Cache failure falls back to Auth0 and never
grants access without successful verification.

Screens do not process AuthSession responses directly. Me/profile stays
cached-first with explicit refresh, while League Tables deliberately forces a
friends refresh whenever the screen gains navigation focus.

Interactive login owns activation after the authorization-code exchange.
Bootstrap activation is reserved for sessions restored from storage. Every
completion/failure update rechecks the active user, token, and auth-state
version so stale work cannot revive a logged-out or replaced session.

Protected work uses one verified-session rule: authenticated status, token,
complete identity, matching operation owner, and unchanged auth-state version.
Pending invitations wait for that rule and resume automatically. A temporary
restored-session sync failure keeps cached navigation visible with an accessible
Retry banner; interactive login keeps the blocking failure screen. Once identity
synchronization has succeeded, a later profile, leaderboard, result, or Journey
refresh failure does not demote that identity. Retry resumes the failed
reconciliation pipeline without repeating `/syncIdentity`.

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
- Friends and global leaderboards are cached separately by period, London
  period anchor, and account. Weekly data is loaded only when selected.
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
- The result and account-scoped pending submission are durably stored before an authenticated
  network request begins.
- Authenticated plays may complete locally while a cached session is restoring.
  Submission is deferred without an error until that account is verified.
- Verified authenticated plays submit to the server and reconcile the optimistic state
  with authoritative stats before refreshing leaderboards.
- Guest plays are not submitted while still guest.
- One transient network, timeout, or server failure is retried automatically.
- Pending authenticated submissions survive persistent failure and retry on a
  later authenticated warm path.
- Daily Quiz and Journey queues are partitioned by account and never migrate to
  guest state when restoration fails.
- Submission logs include client duration and the existing `Server-Timing`
  response header for backend phase attribution.
- Legacy pending challenge submissions are discarded during cache hydration;
  retired challenge endpoints are never retried from warm paths.

## UX Rules

- Branded bootstrap is used for cold startup.
- `AuthSyncScreen` is used for interactive login, username onboarding, and
  restored identities without a previously complete cache.
- Eligible restored accounts keep cached Daily Quiz navigation playable during
  background reconciliation. Rebinding to another identity terminates the
  non-persisted screen attempt.
- Generic full-screen spinners are reserved for true cold-miss fallback states.
- App foreground events use public warm refresh only; protected profile data
  remains authenticated-sync/manual, while friends refresh is additionally
  navigation-focus driven.

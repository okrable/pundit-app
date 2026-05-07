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

Login and cached-session restore both run the same authenticated sync path before normal tabs are released:

1. Prompt Auth0 with Expo AuthSession.
2. Exchange the authorization code once using the matching redirect URI and PKCE verifier.
3. Store credentials and user info.
4. Reconcile guest/auth daily result state.
5. Prefetch profile, quiz, global leaderboard, and friends leaderboard data.
6. Release the UI from `AuthSyncScreen`.

Screens do not process AuthSession responses directly, and normal Me/Leaderboard navigation should not trigger protected refreshes after this transaction has completed.

## Cache Strategy

### Quiz

- Keyed by quiz date.
- Warm opens prefer cached quiz data first.
- Stale data is revalidated in the background.

### Same-Day Result

- Stored per identity.
- Guest and authenticated results are separate until reconciliation.
- Used to prevent replay and show completed state immediately.
- Can carry sync status for pending/failed authenticated submission paths.

### Profile and Leaderboards

- Profile stats are cached per authenticated user.
- Friends and global leaderboards are cached separately.
- Me and League Tables render cached or placeholder content before background refresh.
- Protected profile and friends leaderboard refreshes happen during authenticated session sync or explicit pull-to-refresh, not on tab focus.

## Result Submission Model

- After the fifth answer, the app computes an immediate local result from the quiz payload.
- Authenticated plays submit to the server and finalize stats.
- Guest plays are not submitted while still guest.
- Pending authenticated submissions can retry on later warm paths.

## UX Rules

- Branded bootstrap is used for cold startup.
- `AuthSyncScreen` is used for login/reconciliation handoff.
- Daily quiz must not render stale `QuestionCard` state while identity reconciliation is active.
- Generic full-screen spinners are reserved for true cold-miss fallback states.
- App foreground events use public warm refresh only; protected data refresh remains authenticated-sync or manual.

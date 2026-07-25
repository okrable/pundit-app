# Execution Plan

## Completed Milestones

### Foundation

- [x] Expo React Native app scaffold with TypeScript.
- [x] Zustand state, AsyncStorage persistence, navigation shell, and shared theme.

### Daily Quiz

- [x] Daily quiz fetch, local cache, and same-day result cache.
- [x] One-question-at-a-time gameplay.
- [x] Typewriter prompt pacing and delayed answer-option reveal.
- [x] Timer starts only after the prompt/options are visible.
- [x] Smooth circular countdown with post-zero answer support.
- [x] Speed-based scoring with minimum score for correct post-zero answers.
- [x] Local-first result creation and immediate post-quiz summary.
- [x] Cached completed state for already-played days.
- [x] Native text sharing from the summary screen.

### Accounts and Data

- [x] Guest mode and optional Auth0 login.
- [x] Centralized AuthSession login coordinator.
- [x] Auth sync/loading interstitial for login, reconciliation, and first prefetch.
- [x] Guest daily result migration/adoption after login.
- [x] Local logout without hosted Auth0 browser logout popup.
- [x] User/profile persistence for authenticated users.
- [x] Server-side ownership checks on protected endpoints.
- [x] Timezone-consistent quiz-day calculation.
- [x] Cached-first auth restoration with defensive 401 refresh/retry.

### Competition

- [x] Global leaderboard and Me stats.
- [x] Friends-first cached leaderboard warm loads.
- [x] Friend links and friend list.
- [x] Challenge mode end-to-end.
- [x] Challenge history and W/L/D stat updates.
- [x] Shared refreshed quiz UI in challenge play.

### Operations and UX Polish

- [x] Branded startup bootstrap and stale-first daily-loop hydration.
- [x] Background prefetch for quiz, stats, and leaderboard warm loads.
- [x] Persistent debug-log copy/clear controls.
- [x] App-level React crash recovery around the navigation root.
- [x] Transactional challenge submission completion and stat updates.
- [x] Settings version display from app SemVer.
- [x] Authenticated settings hide guest-only clear-cache controls.
- [x] Pull-request CI for tests, TypeScript, and web export.
- [x] Uniform Netlify preview behavior across all non-main branches.
- [x] Preview build identification and environment-correct share links.
- [x] Persistent challenge submission retry with idempotent server replay.
- [x] Database-backed endpoint rate limits.
- [x] Anonymous aggregate funnel analytics.

## Active Hardening

1. Configure operational alerts and error-budget reporting from structured logs.
2. Expand automated integration and UI coverage.
3. Formalize designated test-account cleanup while previews share production services.

## Next Feature Wave

1. Push notifications.
2. Quiz archives and historical access.
3. Use anonymous funnel telemetry to prioritize the next product wave.

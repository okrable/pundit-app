# Execution Plan

## Completed Milestones

### Foundation

- [x] Expo React Native app scaffold with TypeScript.
- [x] Zustand state, AsyncStorage persistence, navigation shell, and shared theme.

### Daily Quiz

- [x] Daily quiz fetch, local cache, and same-day result cache.
- [x] Games hub with independent Daily Quiz and player-journey results.
- [x] Temporary date-scoped Anthony Gordon career fixture behind a replaceable
  daily source adapter.
- [x] Date-gated BigQuery UK questions, challenge answer keys, and rank-6
  player-career content behind the shared server source adapter.
- [x] Launched the rank-6 Whose Journey game with date-scoped completion and
  category-then-rank career ordering.
- [x] Read-only BigQuery date-range audit for release validation.
- [x] One-question-at-a-time gameplay.
- [x] Typewriter prompt pacing and delayed answer-option reveal.
- [x] Timer starts only after the prompt/options are visible.
- [x] Smooth circular countdown with post-zero answer support.
- [x] Speed-based 10-point scoring bands with a 10-point post-zero minimum.
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
- [x] Verified Auth0 identity synchronization and persisted username-onboarding state.
- [x] Deterministic username backfill for legacy authenticated accounts.
- [x] Blocking post-Auth0 username onboarding and username-only client UI (v2.0.0).
- [x] Permanent creation-only usernames with resumable onboarding state.

### Competition

- [x] Global leaderboard and Me stats.
- [x] Friends-first cached leaderboard warm loads.
- [x] Friend links and friend list.
- [x] Seven-day reusable invites with legacy single-use compatibility.
- [x] One ordered mutual friendship row with idempotent accept/remove behavior.
- [x] Friends refresh after mutations and League Tables focus.
- [x] Challenge mode end-to-end.
- [x] Challenge history and W/L/D stat updates.
- [x] Shared refreshed quiz UI in challenge play.
- [x] Canonical username leaderboard eligibility and server-resolved challenge identities.
- [x] Retired Challenge from reachable navigation and disabled every challenge
  Function while preserving implementation and historical data.
- [x] Removed the Me Stats section while retaining compatible API fields.

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
- [x] First-party pseudonymous quiz funnel and retention analytics with typed
  dimensions, device controls, raw-event retention, and baseline reports.

## Active Hardening

1. Configure operational alerts and error-budget reporting from structured logs.
2. Expand automated integration and UI coverage.
3. Formalize designated test-account cleanup while previews share production services.

## Next Feature Wave

1. Push notifications.
2. Quiz archives and historical access.
3. Smoke-test v2.10 analytics in Production, then proceed with the Daily Quiz
   navigation and pacing refocus without using D1/D7 as a small-sample gate.

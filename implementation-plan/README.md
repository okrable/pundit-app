# Pundit Trivia - Implementation Plan

> Last updated: v1.1.0 documentation refresh
> Status: Active product with Daily Quiz, Challenge Mode, Friends, Auth0, and refreshed gameplay shipped
> Source of truth: This folder documents current behavior and near-term hardening.

## Product Status Snapshot

### Delivered

- Daily 5-question football quiz with local-first play and same-day replay prevention.
- Refreshed shared gameplay UI for daily quiz and challenge mode.
- Typewriter question pacing, delayed option reveal, timer start after full reveal, and content-only question transitions.
- Smooth circular timer with numeric seconds, urgency styling, and post-zero minimum-score behavior.
- Suspense-based answer reveal with locked/correct/incorrect message pairs.
- Immediate daily summary screen with final score, answer recap, and native text sharing.
- Cached completed screen for already-played daily state.
- Guest mode with local-only daily results.
- Auth0 accounts, Me profile, username/display-name support, and settings.
- Centralized auth flow with post-login quiz reconciliation and first data prefetch behind `AuthSyncScreen`.
- Guest-to-auth daily result migration/adoption where applicable.
- Global leaderboard, friends leaderboard, friend links, and async challenge mode.
- Branded bootstrap, stale-first cache hydration, and debug-log export.

### Hardening Remaining

- App-level error boundaries and crash-recovery UX.
- Offline answer queue with retry-on-reconnect.
- Endpoint-level rate limiting and abuse controls.
- API observability and alerting.
- Product analytics.

## Canonical Docs in This Folder

Read in this order:

1. `scope.md` - product boundaries and non-goals.
2. `execution-plan.md` - delivered milestones and active hardening.
3. `architecture.md` - runtime topology and cross-cutting decisions.
4. `frontend-plan.md` - current screen/component flow.
5. `api-plan.md` - endpoint groups and auth rules.
6. `data-contracts.md` - primary payload and persistence shapes.
7. `performance-bootstrap.md` - bootstrap, cache, auth sync, and daily-loop model.
8. `assumptions-and-todos.md` - current assumptions, TODOs, and limitations.
9. `features/` - feature-specific notes.

## Maintenance Rules

- Update these docs in the same change as any meaningful behavior change.
- Keep `CHANGELOG.md`, `package.json`, `app.json`, and `app/constants/version.ts` aligned for release/version changes.
- Agents should classify completed work before handoff and increment SemVer only when the work warrants a release checkpoint: patch for fixes, minor for user-visible features/meaningful UX changes, major for breaking product, scoring, storage, auth, or compatibility changes.
- Settings must display the version from `APP_VERSION`; do not hard-code version text in UI components.
- Prefer current-state documentation over historical planning notes.
- Remove or rewrite superseded plans instead of leaving contradictory details.

# Pundit Trivia - Implementation Plan

> Last updated: v1.5.0 plus unreleased identity and social alignment
> Status: Active product; identity foundation is merged and social backend alignment is ready for review
> Source of truth: This folder documents current behavior and near-term hardening.

## Recent Delivery Summary

In plain English, this thread delivered three connected changes:

1. **PR #11 — safer delivery:** `main` became the only production-significant
   branch. Every purpose-named branch receives the same Netlify preview
   behavior, CI checks the app before merge, and reliability work added
   submission retry, rate limits, structured logs, and anonymous funnel events.
2. **PR #12 — identity foundation:** the server can synchronize a verified Auth0
   account into `users`, track whether a username is still required, and
   deterministically repair legacy authenticated accounts without usernames.
   Migration 012 was applied and audited.
3. **PR #13 — social backend alignment:** friendships, leaderboards, and
   challenges now resolve public identity from `users.username`. New invites
   are reusable for seven days, one ordered friendship row connects both
   players, slow removal retries are safe, remote acceptances refresh on League
   Tables focus, and web/iOS share verified Auth0 identities. Migration 013 was
   applied and audited; the PR is ready for review.

The remaining v2.0.0 client-activation phase will make username selection a
blocking signup step, remove display-name UI, and invalidate legacy social
caches. Those client changes are not yet shipped.

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
- Auth0 accounts, Me profile, transitional username/display-name UI, and settings.
- Verified identity synchronization and canonical server-side usernames.
- Mutual ordered friendships with reusable seven-day invite links and retry-safe removal.
- Server-resolved username identities across friends, persisted leaderboards, and challenges.
- Centralized auth flow with post-login quiz reconciliation and first data prefetch behind `AuthSyncScreen`.
- Guest-to-auth daily result migration/adoption where applicable.
- Daily global leaderboard, friends leaderboard, friend links, and async challenge mode.
- Branded bootstrap, stale-first cache hydration, and debug-log export.
- Mobile-first web shell aligned with the native bottom-tab layout.
- Date-aware daily leaderboard caches with forced refresh after authenticated submissions.
- Friends-leaderboard refresh after friendship mutations and League Tables focus.
- Pull-request CI, uniform Netlify previews, and same-commit web/iOS validation gates.
- Persistent retry for daily and challenge submissions.
- Shared database-backed rate limiting on sensitive endpoints.
- Anonymous aggregate product funnel events.

### Hardening Remaining

- Complete v2.0.0 username-only client activation and social cache-version upgrades.
- Operational alert configuration and error-budget reporting.
- Broader automated integration and UI coverage.
- Test-account data governance while previews share production services.

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

# Pundit Trivia - Implementation Plan

> Last updated: v2.6.3 quiz-number reference date
> Status: Active product; all three username and social identity phases are delivered
> Source of truth: This folder documents current behavior and near-term hardening.

## Recent Delivery Summary

In plain English, this work delivered four connected changes:

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
   applied and audited; PR #13 is merged.

4. **v2.0.0 — client activation:** authenticated sessions now synchronize
   identity before entering the app. Incomplete accounts resume a blocking
   username screen, usernames are permanent, public UI uses `@username`, and
   version-1 social caches are discarded without removing quiz progress.

5. **v2.1.2 — auth and quiz hardening:** interactive login has sole ownership
   of post-login activation, stale identity work is discarded, and onboarding
   appears only for explicit new-account requirements. Quiz completion now
   publishes and persists an optimistic streak before a retryable background
   submission.

6. **v2.4.0 — avatar personalisation:** every authenticated player receives a
   persisted football-symbol avatar, can choose from the full 58-avatar Pundit
   library during onboarding or from Me, and publishes that avatar through
   friends and global leaderboards.

7. **v2.6.0 — refined scoring:** the first countdown second is worth 100
   points, later correct answers step down in 10-point bands to a post-zero
   minimum of 10, and an immediate perfect daily result receives fireworks.

8. **v2.6.1 — identity and streak clarity:** identity synchronization has a
   dedicated 15-second client timeout plus server-side auth, database, and total
   timing diagnostics. The streak flame is orange only after today's quiz has
   extended or confirmed the streak, and greyscale while today's play is pending.

9. **v2.6.2 — daily quiz safeguards:** daily and challenge answer options stay
   non-interactive until the full option reveal completes. Date-scoped requests,
   validated caches, and stale-response guards prevent previous-day questions
   after rollover, while daily results share a numbered public scorecard.

10. **v2.6.3 — quiz-number reference:** daily share numbering now uses one
    editable reference date, with 1 July 2026 defined as Pundit Trivia number 1.

## Product Status Snapshot

### Delivered

- Daily 5-question football quiz with local-first play and same-day replay prevention.
- Refreshed shared gameplay UI for daily quiz and challenge mode.
- Typewriter question pacing, delayed option reveal, timer and answer activation
  after full reveal, and content-only question transitions.
- Games landing page with independent Daily Quiz and player-journey completion
  cards, score recap, and career result restoration.
- Responsive Years/Team/Apps/Goals player journey with unlimited normalized
  name guesses and illustrated rules.
- Smooth circular timer with numeric seconds, 10-point score bands, and a 10-point post-zero minimum.
- Suspense-based answer reveal with locked/correct/incorrect message pairs.
- Immediate daily summary screen with final score, answer recap, numbered native
  scorecard sharing, and perfect-score fireworks.
- Cached completed screen for already-played daily state.
- Guest mode with local-only daily results.
- Auth0 accounts with blocking username onboarding, username-only Me profile, and settings.
- Persisted Pundit avatar assignment, onboarding selection, Me-page editing,
  and public friends/leaderboard rendering.
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
- Immediate local quiz completion and projected post-play streak before server
  reconciliation.
- Shared database-backed rate limiting on sensitive endpoints.
- Anonymous aggregate product funnel events.
- Selective version-2 social cache invalidation that preserves gameplay state.

### Hardening Remaining

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
- Keep `CHANGELOG.md`, `package.json`, `package-lock.json`, `app.json`,
  `app/constants/version.ts`, and native iOS/Android marketing versions aligned
  for release/version changes.
- Agents should classify completed work before handoff and increment SemVer only when the work warrants a release checkpoint: patch for fixes, minor for user-visible features/meaningful UX changes, major for breaking product, scoring, storage, auth, or compatibility changes.
- Settings must display the version from `APP_VERSION`; do not hard-code version text in UI components.
- Prefer current-state documentation over historical planning notes.
- Remove or rewrite superseded plans instead of leaving contradictory details.

# Changelog

This project uses SemVer for app and documentation checkpoints. Dates are intentionally milestone-style until release tags provide authoritative dates.

## v2.1.0 - Profile and streak redesign

- Refreshed the authenticated Me page with a compact username header,
  segmented stats, and a responsive inline football streak indicator.
- Made daily result dates authoritative for streaks and added a historical
  projection backfill.
- Added date-aware streak status to profile responses and prevented prior-day
  profile caches from presenting stale status.
- Removed the decorative `@` prefix from usernames across public app surfaces.

## v2.0.0 - Username-only identity and social alignment

- Added blocking, resumable username onboarding before authenticated navigation, reconciliation, prefetching, and deep-link actions.
- Made usernames permanent after first selection, with idempotent retries and explicit immutable-username responses.
- Removed editable display names and username changes from the current client, using `@username` across public surfaces.
- Added selective version-2 profile and leaderboard caches without invalidating quiz progress, results, or pending submissions.
- Added aggregate username-onboarding events and structured client handling for incomplete identities.
- Added verified Auth0 identity synchronization, persisted username-onboarding state, and deterministic username backfill for legacy authenticated accounts.
- Centralized authenticated user creation behind identity synchronization and protected incomplete identities from persisted social actions and rankings.
- Made new friendship invites reusable for seven days while preserving legacy single-use codes.
- Stored each friendship as one ordered mutual row, with transactional/idempotent acceptance and retry-safe removal.
- Standardized friends, leaderboards, and challenges around canonical usernames while retaining deprecated display-name fields for installed-client compatibility.
- Resolved challenge participants from verified server-side identities instead of trusting client-supplied names.
- Refreshed friends data after mutations and whenever League Tables gains focus.
- Added separate Auth0 web/native client configuration, the native `pundit-app://callback`, and iOS safe-area tab-bar fixes.
- Added production migrations 012 and 013 plus pre/post-migration audit queries.

## v1.5.0 - Delivery confidence and reliability

- Added pull-request CI for tests, TypeScript validation, and web exports on Node 20.19.4.
- Added a shared cross-platform test foundation for scoring, dates, links, payload validation, and identity reconciliation policy.
- Made all non-production Netlify contexts use the same preview behavior, with visible preview identification and environment-correct API/share URLs.
- Added persistent challenge-submission retry with idempotent server replay.
- Added database-backed rate limits for quiz, challenge, username, and invitation operations.
- Added anonymous aggregate analytics for quiz, authentication, and challenge funnels.
- Documented the main-and-feature-branch delivery workflow and cross-platform release gates.

## v1.4.3 - Web shared code handling

- Added web-first shared code handling for challenge links and friend invite links.
- Allowed the code entry flow to accept both 6-character challenge codes and 8-character friend invite codes.
- Updated challenge and friend sharing to use deployed web URLs.

## v1.4.2 - Daily leaderboard simplification

- Removed weekly leaderboard controls from the app surface.
- Made daily leaderboard caches date-aware to avoid showing prior-day rankings.
- Forced daily leaderboard refresh after authenticated quiz submission and guest-result migration.
- Simplified leaderboard ranking to unique score-and-submission-time ordering.
- Kept quiz stats and streak updates synchronous during normal daily submission.

## v1.4.1 - Pre-polish hardening

- Hardened challenge answer submission validation and duplicate-answer rejection.
- Made challenge result completion and stat updates transactional to avoid duplicate stat increments.
- Added app-level React crash recovery UI around the navigation tree.
- Clarified remaining offline retry hardening docs.

## v1.4.0 - Mobile-first web app

- Reworked the web app into a centered mobile shell that mirrors the native app layout.
- Removed the desktop-only web navigation path so web keeps bottom tabs across device sizes.
- Added compact quiz layout sizing for short and narrow mobile browsers.
- Reduced leaderboard stutter by keeping daily and weekly leaderboard data cached independently and deduping repeated refreshes.
- Updated the demo leaderboard seeder with 30 ordinary-looking seeded accounts and internal demo email markers.
- Updated the web favicon to use the main Pundit app icon.

## v1.3.0 - Daily and weekly leaderboards

- Added daily and weekly periods for global and friends leaderboards.
- Added backend leaderboard response metadata and SQL indexes for current-week ranking.
- Added period-aware leaderboard caching and UI controls.

## v1.2.0 - Desktop web navigation and layout

- Added a desktop web top navigation bar while preserving mobile bottom tabs.
- Centered and constrained primary web content so quiz, results, leaderboard, challenge, and profile screens scale cleanly on desktop.
- Capped viewport-scaled logos on web loading, welcome, and completed states.

## v1.1.0 - Current gameplay, auth, and documentation refresh

- Refreshed daily quiz and challenge gameplay with denser shared question UI.
- Preserved the typewriter prompt pacing and delayed timer start until the full question/options are visible.
- Reworked answer reveal with suspense copy, correct-answer pulse, smoother timer progress, and content-only question transitions.
- Removed timeout/unanswered behavior; answers after zero remain allowed and correct answers receive minimum score.
- Added compact daily summary screen with final score, answer recap, and native text sharing.
- Centralized mobile auth into a single app-level flow for login, token exchange, guest reconciliation, and first data prefetch.
- Added auth sync/reconciliation loading states to prevent stale guest quiz/profile flashes.
- Changed guest daily plays to remain local until login migration/adoption.
- Fixed logout to clear local app auth without triggering the iOS Auth0 browser sign-in popup.
- Fixed username prompt behavior and hid guest-only settings for authenticated users.
- Added app version display from a shared `APP_VERSION` constant.

## v1.0.0 - Product baseline

- Shipped daily quiz, Auth0 accounts, profile stats, leaderboards, friends, and async challenge mode.
- Added same-day replay prevention and cached completed states.
- Added protected API ownership checks for authenticated endpoints.

## v0.9.0 - Performance and bootstrap checkpoint

- Added branded startup bootstrap.
- Added stale-first cache hydration for quiz, profile, and leaderboard resources.
- Added daily-loop prefetch and persistent debug-log tooling.

## v0.8.0 - Social competition checkpoint

- Added async challenge mode, challenge history, W/L/D stats, friend links, and friends leaderboard.

## v0.7.0 - Accounts and profile checkpoint

- Added Auth0 login, Me profile surface, username/display-name support, and authenticated stats.

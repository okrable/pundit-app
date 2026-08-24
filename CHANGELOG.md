# Changelog

This project uses SemVer for app and documentation checkpoints. Dates are intentionally milestone-style until release tags provide authoritative dates.

## v2.13.0 - Global and weekly leaderboards

- Replaced separate Friends and Global tabs with one Global-first leaderboard,
  Daily/Weekly controls, and an authenticated Friends-only filter.
- Added London Monday-to-Sunday score aggregation, deterministic weekly ranks,
  unranked friends who have not played, and current-player highlighting.
- Partitioned stale-first caches by scope, period, week anchor, and account, and
  added privacy-bounded filter analytics through migration 019.

## v2.12.0 - Refresh-safe Daily Quiz attempts

- Persisted unfinished Daily Quiz attempts per identity, date, and quiz so
  refreshes, app restarts, backgrounding, and deliberate exits cannot reset progress.
- Restored elapsed wall-clock timers, locked answers, scores, reveal phases, and
  completion safely without allowing answered questions to be retried.
- Added a Continue state to the Games tile, durable completion handoff, retryable
  local-save failures, and privacy-bounded attempt-resume analytics.

## v2.11.0 - Fast authenticated startup

- Released previously complete cached account shells before token restoration
  and reconciliation, without exposing protected requests to unverified sessions.
- Kept cached navigation usable through temporary background sync failures with
  a compact Retry banner, while invalid restoration rebinds guest caches first.
- Reused successful Auth0 verification briefly across protected Functions so
  startup reconciliation cannot exhaust the per-user `/userinfo` rate limit;
  cached entries contain only one-way token and subject digests.
- Kept a verified identity eligible for protected work when only optional data
  refresh failed, and made Retry resume reconciliation without repeating the
  already successful identity synchronization.
- Allowed Daily Quiz and Journey completion during restoration, with durable
  account-partitioned submission queues that retry after verification.
- Added `app_shell_ready` alongside the unchanged full-readiness `app_ready`
  milestone and startup percentile reporting by actor, platform, and version.

## v2.10.1 - Friend invite loop hotfix

- Consumed web friend and retired Challenge links after capture so accepting,
  dismissing, or viewing an existing friendship cannot reopen the same modal
  and exhaust the invite-preview rate limit.
- Preserved pending friend invitations through sign-in and native deep-link
  handling without changing friendship persistence or server APIs.

## v2.10.0 - Product analytics baseline

- Added an optional random installation identifier and typed, allowlisted events
  for Daily Quiz funnel, latency, sharing, Journey discovery, and return-rate measurement.
- Added Settings controls to disable product analytics or reset the identifier
  without affecting account or quiz data.
- Added a backward-compatible analytics schema migration, 90-day scheduled raw
  event cleanup, read-only audits, and future-ready retention reporting.
- Kept Auth0 identity, usernames, question content, selected answers, invite
  codes, and free-form metadata outside the analytics contract.
- Stabilized the preview by deduplicating authenticated achievement reveals and
  making one-tap guest quiz clearing update persisted and live completion state
  together with inline success or failure feedback.
- Added branded Apple and Android home-screen icons for the installed web app.

## v2.9.0 - Local-first achievements

- Added eight daily and profile achievements with optimistic on-device evaluation,
  retry-safe authenticated persistence, and current-result guest adoption.
- Added stacked, reduced-motion-aware achievement reveals that wait for Daily
  Quiz results but appear immediately for non-game actions.
- Added an authenticated Me achievement collection with progress, mystery
  badges, cross-device profile synchronization, and account-scoped caching.
- Added additive achievement progress, unlock, and idempotency tables without
  backfilling activity from before this release.

## v2.8.0 - Whose Journey launch and Challenge retirement

- Launched the daily rank-6 Whose Journey game from the Games gallery with
  date-scoped completion restoration and explicit loading/unavailable states.
- Kept Journey independent from quiz scoring and ordered career rows as
  Domestic by rank followed directly by International by rank.
- Replaced every Challenge navigation entry and old challenge deep link with a
  dedicated Coming Soon screen while preserving the dormant implementation and
  historical CockroachDB data.
- Retired all six challenge Functions behind a shared fail-closed HTTP 410
  response before authentication or database work.
- Removed the Stats section from Me while retaining compatible profile response
  fields for older clients.

## v2.7.0 - BigQuery daily content source

- Added a server-only, date-gated BigQuery source for UK daily questions,
  challenge answer keys, and rank-6 player-journey career data while keeping
  CockroachDB authoritative for users, results, challenges, and social state.
- Kept pre-cutover and non-UK quizzes on the existing Cockroach source, with no
  automatic same-day fallback after BigQuery cutover.
- Added strict six-rank content validation, structured source diagnostics, and
  a read-only date-range audit command for release checks.
- Moved legacy Lambda-shaped endpoints onto Netlify's modern Functions runtime
  through the official compatibility adapter, removing the 4 KB environment
  limit without changing public endpoint contracts.

## v2.6.3 - Quiz-number reference date

- Simplified daily share numbering to a single editable reference date and set
  1 July 2026 as Pundit Trivia number 1.

## v2.6.2 - Daily quiz rollover and interaction safeguards

- Prevented daily and challenge answers from being selected before every option
  is visible and the countdown has started.
- Reset answer readiness and timer state between questions so an early interaction
  cannot activate the following question's countdown.
- Date-scoped daily quiz requests and validated cache entries so a bookmarked or
  suspended app cannot surface the previous day's questions after rollover.
- Replaced daily result sharing with numbered Pundit Trivia scorecards, including
  distinct standard and perfect-score copy with a public play link.

## v2.6.1 - Identity-sync resilience and streak-state clarity

- Gave identity synchronization a dedicated 15-second timeout while preserving
  manual retry and the existing timeout for ordinary API calls.
- Added request IDs plus Auth0, database, and total timing diagnostics to
  identity-sync response headers and server logs.
- Reserved the orange streak flame for streaks extended today, with intact
  streaks awaiting today's quiz shown in greyscale with state-aware accessibility copy.

## v2.6.0 - Refined quiz scoring and perfect-score celebration

- Limited 100 points to the first countdown second, then added finer 10-point
  scoring bands shared by daily quiz and challenge mode.
- Kept post-zero answers available with a new 10-point minimum for correct answers.
- Added a reduced-motion-aware fireworks celebration to immediate perfect daily results.

## v2.5.0 - Social invitations and challenge UX

- Added review-and-accept journeys for friend and challenge links, including
  visible processing, retryable errors, unavailable-link explanations, and
  pending invitations that resume after sign-in.
- Replaced the subtle League Tables friends icon with a labelled Add Friends
  action and brought friend-code entry into the friends management sheet.
- Refocused Challenge on creating, joining, and acting on challenges, with
  friend invitations kept in League Tables and cancellation progress made
  explicit.
- Aligned the committed iOS and Android native projects with v2.5.0 and added
  iOS safe-area handling for the invitation review sheet.
- Documented Universal Links as an App Store readiness goal; public invite
  links continue to use the web app until Apple signing and domain association
  are configured.
## v2.4.0 - Pundit avatar personalisation

- Added a 58-avatar Pundit collection with football-symbol and letter choices.
- Assigned every authenticated player a persisted football avatar, including
  random defaults for established accounts and new signups.
- Added avatar selection to username onboarding and the authenticated Me page.
- Published saved avatars across friends and global leaderboard identities.
- Returned the provisional player-journey gallery tile to Coming Soon without
  artwork until it can be backed by live player data.
- Added dedicated create-account and login/logout actions to the footer of the
  web navigation drawer, preserving username and avatar setup for new players.

## v2.3.0 - Adaptive web and native iOS navigation

- Replaced the mobile-width browser shell and bottom tabs with a full-viewport
  responsive web layout, centred content widths, and a global Pundit header
  with an accessible right-side navigation drawer.
- Added compact, tablet, and desktop gutters; widened the Games gallery,
  challenge, leaderboard, profile, gameplay, and result surfaces according to
  their reading needs.
- Moved iOS to React Navigation's native Apple tab controller with SF Symbols
  and automatic iPhone/iPad presentation while leaving Android's JavaScript
  bottom tabs unchanged.
- Upgraded the native runtime to Expo SDK 55, React Native 0.83, Reanimated
  4.2, and Worklets 0.7 so iOS builds can use `react-native-screens` 4.25.
  Expo Go and runtimes without `Tabs.Host` now fall back to the existing
  JavaScript tabs instead of crashing. Worklets resolution and the Uni Sans
  asset path are pinned so simulator builds load matching animation code and
  retain the Pundit typography. The native-tab adapter now supplies Screens
  4.25 with stable screen keys so switching iOS tabs cannot hit its nil-key
  assertion. The native navigator is isolated to the iOS bundle so its
  unsupported-platform guard cannot crash the responsive web app at startup;
  web exports now verify that the native-tabs runtime was excluded.
- Added a development-client EAS profile and aligned the tracked iOS and
  Android native projects with the SDK 55 templates while preserving the
  existing identifiers, signing settings, Auth0 callback scheme, and app
  resources.

## v2.2.0 - Games hub and daily player journey

- Renamed the Quiz tab to Games and added independently completed Daily Quiz
  and career-game tiles with cached recaps in a one-game-per-row gallery
  alongside Starting XI and The Link Up concepts. Playable tiles retain their
  own Pundit typography, artwork, and green matchday actions.
- Added an unlimited-guess player journey using career appearances and goals,
  tolerant name matching, illustrated rules, and a temporary Anthony Gordon
  fixture pending the upstream datasource.
- Added separate guest/authenticated career completion persistence, migration,
  retry, and server validation without changing quiz scores, streaks, profile
  aggregates, or leaderboards.
- Prevented temporary Auth0 verification failures during background refreshes
  from being presented as expired sessions or interrupting sign-in completion.

## v2.1.2 - Authentication and quiz sync hardening

- Removed duplicate post-login identity activation and restricted username
  onboarding to accounts explicitly marked as requiring a username.
- Discarded stale authentication work after logout, token changes, or account
  switches, with a dedicated retry/sign-out state for genuine sync failures.
- Made quiz completion local-first so the result and projected streak update
  immediately before the durable server submission starts.
- Added one automatic transient submission retry, retained failed submissions
  for later warm-start retry, and logged server timing details.

## v2.1.1 - Streak icon polish

- Replaced the profile streak artwork with the two-tone Microsoft Fluent Emoji
  flame, using its original colours for active streaks and greys for inactive.

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

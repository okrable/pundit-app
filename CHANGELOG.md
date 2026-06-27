# Changelog

This project uses SemVer for app and documentation checkpoints. Dates are intentionally milestone-style until release tags provide authoritative dates.

## v1.5.0 - Username-first profile

- Rebuilt the Me screen around permanent usernames, gameplay stats, streak status, and challenge record.
- Removed display-name editing and switched profile, leaderboard, friends, and challenge identity surfaces to username-only labels.
- Added first-run account setup copy requiring users to choose a permanent username and accept the under-development notice.

## v1.4.1 - Results sync polish

- Finalized post-game stats immediately after authenticated quiz submits without an extra stats fetch.
- Hid normal pending stats-sync copy while preserving failed-sync retry messaging.

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

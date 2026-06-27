# Scope: Current Product Boundaries

## In Scope

- One daily 5-question football quiz.
- Bottom navigation: Games, Challenge, League Tables, Me.
- Refreshed shared quiz gameplay for daily and challenge modes.
- Speed-based scoring with post-zero minimum score for correct answers.
- Daily summary immediately after play and completed state on return.
- Guest play with local-only daily result storage.
- Auth0 sign-in, profile stats, permanent username setup, and settings.
- Guest-to-auth result migration/adoption after login.
- Global leaderboard, friends leaderboard, friend links, and friend list.
- Async 1v1 challenge mode with create/join/play/reveal/history.
- Stale-first cache hydration and background refresh.
- Debug-log export from Settings.

## Current Constraints

- Daily quiz source is `pu_player_ques`.
- Database access is server-only through Netlify Functions.
- Guest users do not get full profile/social persistence until login.
- One active created challenge per user at a time.
- Authenticated protected endpoints require token ownership checks.

## Out of Scope

- Multiple quiz categories in production.
- Push notifications.
- In-app purchases/subscriptions.
- Admin/CMS quiz editor.
- Real-time multiplayer sync.
- Screenshot/image sharing for daily summary.

## Hardening Work Remaining

- App-level error boundaries.
- Offline answer queue.
- Endpoint-level rate limiting and abuse controls.
- API monitoring and incident visibility.

# Scope: Current Product Boundaries

## In Scope

- One daily 5-question football quiz.
- Bottom navigation: Games, Challenge, League Tables, Me.
- Refreshed shared quiz gameplay for daily and challenge modes.
- Games hub with independent Daily Quiz and daily player-journey completion.
- Daily career card with unlimited name guesses and separate guest/authenticated
  result persistence.
- Speed-based 10-point scoring bands with a 10-point post-zero minimum for correct answers.
- Daily summary immediately after play and completed state on return.
- Guest play with local-only daily result storage.
- Auth0 sign-in, blocking username onboarding, permanent canonical usernames,
  username-only profile UI, and settings.
- Guest-to-auth result migration/adoption after login.
- Global leaderboard plus a mutual friends leaderboard backed by one ordered
  relationship row and reusable seven-day invite links.
- Async 1v1 challenge mode with create/join/play/reveal/history and
  server-resolved participant usernames.
- Stale-first cache hydration and background refresh.
- Debug-log export from Settings.
- Uniform pull-request web previews and same-commit iOS validation.
- Persistent retry for authenticated quiz and challenge submissions.
- Anonymous aggregate product analytics.

## Current Constraints

- Daily quiz source is `pu_player_ques`.
- Database access is server-only through Netlify Functions.
- Guest users do not get full profile/social persistence until login.
- One active created challenge per user at a time.
- Authenticated protected endpoints require token ownership checks.
- Persisted social actions/rankings require a completed username identity.
- Preview and production runtimes currently share configured Auth0/CockroachDB
  services, so previews use designated test accounts and additive schemas.

## Out of Scope

- Multiple quiz categories in production.
- Push notifications.
- In-app purchases/subscriptions.
- Admin/CMS quiz editor.
- Real-time multiplayer sync.
- Screenshot/image sharing for daily summary.

## Hardening Work Remaining

- API alerting and incident visibility.
- Broader automated integration and UI coverage.
- Test-account cleanup while preview and production deployments share services.

# Scope: Current Product Boundaries

## In Scope (Delivered)
- One daily 5-question quiz experience
- Bottom navigation: Games, Challenge, League Tables, Me
- Quiz submission with speed-based scoring
- Daily leaderboard and personal stats
- Challenge mode (async 1v1 with create/join/play/reveal flow)
- Friend links and friends leaderboard
- Guest usage + authenticated usage (Auth0)

## Current Constraints
- Daily quiz source is `pu_player_ques` (server-selected by quiz date)
- Database access is server-only through Netlify Functions
- Guest users can play but do not get full persistence for profile-oriented history/stat features
- One active created challenge per user at a time (pending/active)

## Out of Scope (for now)
- Multiple quiz categories in production
- Push notifications
- In-app purchases/subscriptions
- Admin/CMS quiz editor
- Real-time multiplayer sync (challenge mode is asynchronous)

## Hardening Work Remaining
- Add app-level error boundaries
- Add offline answer queue
- Add endpoint-level rate limiting / abuse controls
- Improve API monitoring and incident visibility

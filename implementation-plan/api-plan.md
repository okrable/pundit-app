# API Plan

All APIs are Netlify Functions under `/.netlify/functions/`.

## Auth Model

- Guest-compatible endpoints allow unauthenticated `guest_*` identities only where explicitly supported.
- Protected flows require `Authorization: Bearer <access-token>`.
- Server validates Auth0 tokens through `/userinfo` and enforces `token.sub === userId`.
- Client API calls include a defensive one-time retry for refreshed or changed tokens.

## Daily Quiz APIs

- `GET /getDailyQuiz` returns the daily quiz payload by date/language.
- `GET /getTodayResult` checks whether an authenticated user has a persisted same-day result.
- `POST /submitQuiz` accepts authenticated quiz answers and timing metadata.
- `POST /migrateGuestResult` adopts a local guest result for an authenticated user when allowed.

Guest daily plays do not call `submitQuiz` immediately; they are local-only until migration/adoption after login.

## Profile APIs

- `GET /getUserStats`
- `POST /updateProfile`
- `GET /checkUsername`
- `POST /setUsername`

## Leaderboard APIs

- `GET /getLeaderboard?period=daily&limit=100`
- `GET /getFriendsLeaderboard?userId=...&period=daily`
- Legacy `period=weekly` requests are tolerated and return daily leaderboard data.
- Leaderboard responses include `period`, `quizDate`, and ranked entries.
- Global leaderboards are public to guests and authenticated users; persisted rankings include authenticated results only.
- Friends leaderboards require an authenticated user and include the current user plus friends, with unplayed users shown unranked.

## Challenge APIs

- `POST /createChallenge`
- `GET /getChallenge`
- `POST /joinChallenge`
- `POST /submitChallengeAnswers`
- `POST /revokeChallenge`
- `GET /getUserChallenges`

## Friends APIs

- `POST /createFriendLink`
- `POST /acceptFriendLink`
- `GET /getFriends`
- `POST /removeFriend`

## Operational Instrumentation

- Core endpoints emit structured lifecycle logs with request IDs, endpoint names, status, user context where available, and duration.
- Client-side debug logs capture API failures, auth transitions, bootstrap, daily-loop prefetch, and reconciliation behavior.

# API Plan

All APIs are Netlify Functions under `/.netlify/functions/`.

## Auth Model

- Guest-compatible endpoints allow unauthenticated `guest_*` identities only where explicitly supported.
- Protected flows require `Authorization: Bearer <access-token>`.
- Server validates Auth0 tokens through `/userinfo` and enforces `token.sub === userId`.
- `POST /syncIdentity` creates or refreshes the authenticated user record from verified Auth0 claims and returns username onboarding state.
- Protected identity guards return `USERNAME_REQUIRED` when signup username onboarding is incomplete.
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
- Global leaderboards are public to guests and authenticated users; persisted rankings include completed authenticated username identities only.
- Friends leaderboards require a completed username identity and include the current user plus friends, with unplayed users shown unranked.
- `username` is the canonical name. Deprecated `displayName` fields temporarily contain the username for installed-client compatibility.

## Challenge APIs

- `POST /createChallenge`
- `GET /getChallenge`
- `POST /joinChallenge`
- `POST /submitChallengeAnswers`
- `POST /revokeChallenge`
- `GET /getUserChallenges`
- Create/join ignore client-supplied names and resolve the player from the verified bearer token.
- Create, join, submit, revoke, and history require a completed username identity.
- Active, join, history, lookup, and result payloads return current usernames. Legacy guest rows return a legacy-activity label instead of an invented username.

## Friends APIs

- `POST /createFriendLink`
- `POST /acceptFriendLink`
- `GET /getFriends`
- `POST /removeFriend`
- New invite codes are reusable for seven days and are returned again while active.
- Previously issued codes retain single-use behavior.
- Acceptance transactionally inserts one ordered mutual friendship row and is idempotent when the relationship already exists.
- Friend responses use `PublicPlayer { userId, username, avatarUrl? }`; deprecated name/id aliases remain during the compatibility window.

## Operational Instrumentation

- Core endpoints emit structured lifecycle logs with request IDs, endpoint names, status, user context where available, and duration.
- Client-side debug logs capture API failures, auth transitions, bootstrap, daily-loop prefetch, and reconciliation behavior.
- Sensitive submit, challenge, username, and invitation endpoints use shared database-backed fixed-window rate limits.
- `POST /trackEvent` accepts an allowlisted anonymous event name plus actor type, platform, app version, and app environment; it never accepts user identifiers or free-form metadata.

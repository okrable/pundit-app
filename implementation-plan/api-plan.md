# API Plan

All APIs are Netlify Functions under `/.netlify/functions/`.

## Auth Model

- Guest-compatible endpoints allow unauthenticated `guest_*` identities only where explicitly supported.
- Protected flows require `Authorization: Bearer <access-token>`.
- Server validates Auth0 tokens through `/userinfo` and enforces `token.sub === userId`.
  A successful match is reusable for 60 seconds across the site's Functions via
  a strongly consistent verification cache containing only token/subject
  SHA-256 digests and an expiry timestamp. Raw credentials and identity claims
  are never cached, and storage failure falls back to Auth0 verification.
  A genuine upstream 401 is returned as an invalid-token 401; rate limits,
  upstream failures, malformed responses, and network errors return a temporary
  `AUTH_VERIFICATION_UNAVAILABLE` 503 so background refreshes cannot incorrectly
  expire an otherwise valid client session.
- `POST /syncIdentity` creates or refreshes the authenticated user record from verified Auth0 claims and returns username onboarding state.
- Protected identity guards return `USERNAME_REQUIRED` when signup username onboarding is incomplete.
- Current protected social endpoints invoke the shared identity guard; the
  client calls `syncIdentity` before authenticated reconciliation and
  navigation.
- Client API calls include a defensive one-time retry for refreshed or changed tokens.

## Daily Quiz APIs

- `GET /getDailyQuiz` returns the daily quiz payload by date/language.
- UK dates at or after `BIGQUERY_CUTOVER_DATE` read ranks 1–5 and optional
  rank-6 career content from BigQuery; earlier/non-UK dates read CockroachDB.
- Daily submissions resolve answer keys through the same source rule.
- `GET /getTodayResult` checks whether an authenticated user has a persisted same-day result.
- `POST /submitQuiz` accepts authenticated quiz answers and timing metadata.
- `POST /migrateGuestResult` adopts a local guest result for an authenticated user when allowed.

Guest daily plays do not call `submitQuiz` immediately; they are local-only until migration/adoption after login.

## Profile APIs

- `GET /getUserStats`
- `GET /getPlayerProfile?playerId=...&viewerUserId=...`
- `POST /updateProfile`
- `GET /checkUsername`
- `POST /setUsername`
- `updateProfile` persists a validated Pundit `avatarId`; its display-name path
  remains an old-client compatibility surface.
- `setUsername` atomically confirms the incomplete identity's username and
  selected avatar. Same-value retries are idempotent and later username changes
  return `USERNAME_IMMUTABLE`.
- Player profiles are public for completed identities and expose only username,
  avatar, current Daily streak, best score, quiz count, and earned achievement
  IDs/unlock dates. An optional viewer ID requires its matching bearer token and
  adds only the relationship enum.

## Leaderboard APIs

- `GET /getLeaderboard?period=daily|weekly&limit=100`
- `GET /getFriendsLeaderboard?userId=...&period=daily|weekly`
- Missing or invalid periods default to Daily for installed-client compatibility.
- Responses include `period`, `quizDate`, `periodStart`, `periodEnd`, ranked
  entries, and each player's current `avatarId`. Older today-specific fields
  remain alongside the new period-specific played counts.
- Global leaderboards are public to guests and authenticated users; persisted rankings include completed authenticated username identities only.
- Weekly scores sum the current London Monday-to-Sunday window and rank by total
  score, games played, earliest final contributing submission, then user ID.
- Friends leaderboards require a completed username identity and include the current user plus every friend, with unplayed users shown unranked.
- `username` is the canonical name. Deprecated `displayName` fields temporarily contain the username for installed-client compatibility.

## Challenge APIs

- `POST /createChallenge`
- `GET /getChallenge`
- `POST /joinChallenge`
- `POST /submitChallengeAnswers`
- `POST /revokeChallenge`
- `GET /getUserChallenges`

Challenge is retired. With `CHALLENGES_ENABLED` absent or not explicitly
`true`, every endpoint returns HTTP `410` with code `CHALLENGE_UNAVAILABLE`
before method validation, authentication, BigQuery, or CockroachDB work. The
Functions and historical data remain preserved for a future redesign.

## Friends APIs

- `POST /createFriendLink`
- `POST /acceptFriendLink`
- `GET /getFriends`
- `POST /removeFriend`
- `GET /getFriendRequests?userId=...`
- `POST /sendFriendRequest`
- `POST /respondFriendRequest` with `accept | decline`
- `POST /cancelFriendRequest`
- New invite codes are reusable for seven days and are returned again while active.
- Previously issued codes retain single-use behavior.
- Acceptance transactionally inserts one ordered mutual friendship row and is idempotent when the relationship already exists.
- Removal deletes that one ordered row, returns idempotent success when an
  earlier slow request already completed, and uses the longer social-mutation
  client timeout.
- Friend responses use `PublicPlayer { userId, username, avatarId?, avatarUrl? }`; deprecated name/id aliases remain during the compatibility window.
- Friend requests are protected by completed verified identity ownership and
  store one pending row per ordered pair. Duplicate sends are idempotent,
  reciprocal sends create the friendship, and decline/cancel permit a later retry.
- Sender and pair rate limits restrict repeated unsolicited sends. Existing
  invite links retain immediate friendship acceptance and clear pending requests.

## Operational Instrumentation

- Core endpoints emit structured lifecycle logs with request IDs, endpoint names, status, user context where available, and duration.
- Client-side debug logs capture API failures, auth transitions, bootstrap, daily-loop prefetch, and reconciliation behavior.
- Sensitive submit, username, and invitation endpoints use shared database-backed fixed-window rate limits. Retired challenge endpoints return before rate-limit work.
- `POST /trackEvent` remains backward-compatible with legacy aggregate events.
  Current clients add a random UUID installation identifier, tracking version,
  and fixed typed properties for quiz date, source, duration, question count,
  score, exit reason, leaderboard scope, and leaderboard period. Auth0 IDs,
  usernames, answers, codes, and free-form metadata are rejected.
- Profile views and friend-request send/accept events add event names only; they
  contain no target player ID or new free-form property.
- Scheduled `purgeAnalyticsEvents` removes raw analytics rows older than 90 days.

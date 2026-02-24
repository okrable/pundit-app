# API Plan (Current Contracts)

All APIs are Netlify Functions under `/.netlify/functions/`.

## Auth Model
- Guest-compatible endpoints allow unauthenticated requests for `guest_*` IDs where explicitly supported.
- Protected flows require `Authorization: Bearer <access-token>`.
- Server validates ownership by ensuring Auth0 `sub` matches requested `userId`.

## Daily Quiz APIs
- `GET /getDailyQuiz`
  - Returns daily quiz payload by date/language.
  - Payload includes options and `correctOptionIndex` by product decision to optimize in-app result UX.
- `POST /submitQuiz`
  - Accepts quiz answers (+ optional timing metadata).
  - Validates payload shape, duplicate question IDs, and index bounds.
  - Returns score + detailed answer correctness.

## Profile/Stats APIs
- `GET /getUserStats`
- `POST /updateProfile`
- `GET /checkUsername`
- `POST /setUsername`
- `POST /migrateGuestResult`

## Leaderboard APIs
- `GET /getLeaderboard`
- `GET /getFriendsLeaderboard`

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

## Time and Date Policy
- Quiz day is computed using configured timezone, not hardcoded UTC.
- Frontend and backend timezone env vars should match.


## Operational Instrumentation
- Core read/write endpoints emit structured request lifecycle logs (`start`, `end`, `error`) with request IDs.
- Log payloads include endpoint name, optional user ID, status, and duration for troubleshooting.

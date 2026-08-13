# Feature: Challenge Mode

> Status: Retired and preserved
> Last updated: v2.8.0

## Current Behavior

- The Challenge tab/drawer item remains visible on web, iOS, and Android.
- Selecting it opens a dedicated Coming Soon card with the training-ground
  message; challenge creation, joining, gameplay, results, and history are not
  reachable.
- Old `/c/{code}` and `pundit-app://challenge/{code}` links, plus stored pending
  challenge actions, are cleared locally and navigate to Coming Soon without
  authentication, preview requests, or mutations.
- Friend invitations retain their existing preview, authentication, and
  acceptance flow.
- The daily bootstrap clears any legacy pending challenge submission and never
  retries it.

## Server Contract

The preserved challenge Functions are:

- `createChallenge`
- `getChallenge`
- `joinChallenge`
- `submitChallengeAnswers`
- `revokeChallenge`
- `getUserChallenges`

They share one fail-closed availability guard. Unless `CHALLENGES_ENABLED` is
explicitly `true`, each returns HTTP `410` before method validation,
authentication, rate limiting, BigQuery, or CockroachDB work:

```json
{
  "code": "CHALLENGE_UNAVAILABLE",
  "message": "Challenge mode is currently unavailable."
}
```

Keep that override unset in production. A future replacement should be reviewed
as a new product flow rather than reactivating the old UI casually.

## Preserved Compatibility Surface

- `ChallengeScreen`, `ChallengeQuizScreen`, `ChallengeResultsScreen`, the
  challenge store/services, and Functions remain in source for redesign work.
- The `challenges` table, historical rows, challenge columns on `users`, and
  compatible profile response fields are not deleted or migrated.
- Historical challenge data is read by no active client path.
- The Me page no longer renders Best Score or challenge W-L-D Stats.

## Universal Links

Friend-link Universal Links remain a future App Store readiness item. Retired
challenge link patterns should continue resolving safely to Coming Soon unless
a future challenge product deliberately defines a replacement contract.

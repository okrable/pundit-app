# Data Contracts

Canonical TypeScript interfaces live in `app/types/index.ts`.

## Primary Client Types

- Daily quiz: `Quiz`, `Question`, `AnswerWithTiming`, `QuizResultImmediate`, `QuizResult`.
- Profile/social: `UserProfile`, `UserStats`, `LeaderboardEntry`, friends types.
- Challenge: active challenge, challenge history, challenge submit/result types.

## Daily Quiz Payload

```json
{
  "id": "quiz-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "questions": [
    {
      "id": "q_x",
      "prompt": "...",
      "options": ["A", "B", "C", "D"],
      "correctOptionIndex": 1
    }
  ]
}
```

`correctOptionIndex` is intentionally present before submit so the app can reveal answers and build local results immediately.

## Answer Timing

Answer payloads can include timing metadata. The client clamps timer behavior so:

- timer starts after the prompt/options finish revealing;
- answers at zero are valid;
- correct post-zero answers receive the minimum score;
- incorrect answers score zero.

## Result Persistence

- Authenticated daily submissions persist to the backend.
- Guest daily results are cached locally first and can be migrated after login.
- Same-day cached results prevent replay and drive `CompletedQuizScreen`.
- Immediate in-memory results drive the current-session daily summary.

## Database-Facing Model

- `users` stores profile and aggregate stats. Its `streak` and `last_played`
  fields are projections retained for compatible, efficient reads.
- `users.onboarding_status` is `username_required` or `complete`; persisted
  social actions require a completed row with a username.
- Username assignment is creation-only. Repeating the same value is idempotent;
  a different value returns `USERNAME_IMMUTABLE`.
- `results` stores daily quiz submissions and is authoritative for streak
  reconstruction.
- Daily leaderboards rank a single `quiz_date` by score, then earliest submission time, then user id.
- `challenges` stores async head-to-head lifecycle and answer payloads.
- `users.username` is the canonical public identity for persisted social data.
- `friendships` stores one ordered `(user_a, user_b)` row that is visible to both players.
- New `friend_links` rows are reusable for seven days; legacy rows remain single-use.
- Challenge username columns are compatibility snapshots. API reads prefer the current `users.username`.
- Deprecated display-name response fields contain usernames during the installed-client transition.
- New client contracts use `PublicPlayer { userId, username, avatarUrl? }`.
- Auth storage persists `username`, `usernameRequired`, and `onboardingStatus`;
  missing legacy metadata is resynchronized before navigation.

## Streak Status

`UserStats` keeps the scalar `streak` for compatibility and adds
`streakStatus` with the current count, `not_started`, `active_today`,
`at_risk`, or `inactive` state, last played date, and quiz date used to
evaluate the status. A run ending yesterday remains active but at risk; older
runs expose a current value of zero.

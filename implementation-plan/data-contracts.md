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

- `users` stores profile and aggregate stats.
- `results` stores daily quiz submissions.
- Daily leaderboards rank a single `quiz_date` by score, then earliest submission time, then user id.
- `challenges` stores async head-to-head lifecycle and answer payloads.
- `users.username` is the canonical public identity for persisted social data.
- `friendships` stores one ordered `(user_a, user_b)` row that is visible to both players.
- New `friend_links` rows are reusable for seven days; legacy rows remain single-use.
- Challenge username columns are compatibility snapshots. API reads prefer the current `users.username`.
- Deprecated display-name response fields contain usernames during the installed-client transition.

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
  ],
  "careerGame": {
    "id": "career-YYYY-MM-DD",
    "date": "YYYY-MM-DD",
    "prompt": "...",
    "canonicalName": "Anthony Gordon",
    "acceptedAliases": [],
    "acceptedSurnames": ["Gordon"],
    "career": [
      {
        "years": "2017–2023",
        "team": "Everton",
        "appearances": 65,
        "goals": 7,
        "category": "Domestic",
        "rank": 1
      }
    ]
  }
}
```

`correctOptionIndex` is intentionally present before submit so the app can reveal answers and build local results immediately.

`careerGame` is optional so a missing career datasource never blocks the
five-question quiz. The installed fallback is date-scoped and uses the supplied
Anthony Gordon record until the upstream adapter replaces it. Only Years, Team,
Apps, and Goals are displayed; category and rank remain source metadata.

## Answer Timing

Answer payloads can include timing metadata. The client clamps timer behavior so:

- timer starts after the prompt/options finish revealing;
- answers at zero are valid;
- correct answers score 100 while the countdown is 20, then drop in 10-point bands;
- correct post-zero answers receive the 10-point minimum;
- incorrect answers score zero.

## Result Persistence

- Authenticated daily submissions persist to the backend.
- Guest daily results are cached locally first and can be migrated after login.
- Same-day cached results prevent replay and drive `CompletedQuizScreen`.
- Immediate in-memory results drive the current-session daily summary.
- Authenticated completion stores a user/quiz-scoped pending submission before
  contacting the server. Its optimistic result is replaced by the authoritative
  response or retained for a later retry.

## Database-Facing Model

- `users` stores profile and aggregate stats. Its `streak` and `last_played`
  fields are projections retained for compatible, efficient reads.
- `users.onboarding_status` is `username_required` or `complete`; persisted
  social actions require a completed row with a username.
- Username assignment is creation-only. Repeating the same value is idempotent;
  a different value returns `USERNAME_IMMUTABLE`.
- `results` stores daily quiz submissions and is authoritative for streak
  reconstruction.
- `career_game_results` stores independent career-game completion and does not
  contribute to quiz scores, streaks, profile aggregates, or leaderboards.
- Daily leaderboards rank a single `quiz_date` by score, then earliest submission time, then user id.
- `challenges` stores async head-to-head lifecycle and answer payloads.
- `users.username` is the canonical public identity for persisted social data.
- `users.avatar_id` is the canonical static avatar identity. New and legacy
  accounts receive a football-symbol default before players may choose any
  symbol or letter avatar.
- `friendships` stores one ordered `(user_a, user_b)` row that is visible to both players.
- New `friend_links` rows are reusable for seven days; legacy rows remain single-use.
- Challenge username columns are compatibility snapshots. API reads prefer the current `users.username`.
- Deprecated display-name response fields contain usernames during the installed-client transition.
- New client contracts use `PublicPlayer { userId, username, avatarId?, avatarUrl? }`.
- Auth storage persists `username`, `usernameRequired`, `onboardingStatus`, and `avatarId`;
  missing legacy metadata is resynchronized before navigation.

## Streak Status

`UserStats` keeps the scalar `streak` for compatibility and adds
`streakStatus` with the current count, `not_started`, `active_today`,
`at_risk`, or `inactive` state, last played date, and quiz date used to
evaluate the status. A run ending yesterday remains active but at risk; older
runs expose a current value of zero.

Immediately after a local play, the client projects `at_risk` as current plus
one, `not_started` or `inactive` as one, and `active_today` as unchanged. The
server result remains authoritative after synchronization.

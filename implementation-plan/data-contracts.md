# Data Contracts (Current)

## Key Client Types
See `app/types/index.ts` for canonical interfaces.

Primary entities:
- `Quiz`, `Question`
- `AnswerWithTiming`, `QuizResultImmediate`, `QuizResult`
- `LeaderboardEntry`, `UserStats`
- Challenge entities (`ActiveChallenge`, `ChallengeHistoryItem`, `ChallengeSubmitResult`)
- Friends entities (`Friend`, `FriendsLeaderboardEntry`, link responses)

## Daily Quiz Response Shape (Current)
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

> Note: `correctOptionIndex` is intentionally present pre-submit by product decision to favor immediate UX and avoid extra answer-resolution calls.

## Submit Quiz Request Constraints
- `quizId`, `userId`, and non-empty `answers` are required.
- Max 5 answers.
- No duplicate `questionId` values in payload.
- `selectedOptionIndex` must be an integer and within server-validated option bounds.
- `timeRemainingMs` (when provided) must be within accepted range.

## Persistence Model
- `users` table stores profile and aggregate stats.
- `results` table stores daily submissions.
- `challenges` table stores async head-to-head lifecycle and answer payloads.
- Friendship and username-related tables/columns support social/profile flows.

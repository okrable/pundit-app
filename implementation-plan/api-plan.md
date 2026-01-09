# API Plan

## Netlify Functions (initially one)

### Function: getDailyQuiz
- Purpose: Return daily quiz questions (no correct answers)
- Input: none (date determined server-side in London timezone)
- Output: Daily Quiz Response
- Error cases:
  - No quiz found for date -> error code TODO
  - DB connection error -> error code TODO

### Function: submitDailyQuiz
- Purpose: Submit user answers, compute score/streak, persist results
- Input: quizId, answers[{ questionId, selectedOptionIndex }], userId or guestId
- Output: Submit Results Response
- Error cases:
  - Quiz not found or mismatch date -> error code TODO
  - Invalid answers -> error code TODO
  - DB write failure -> error code TODO

## DB access boundary
- All database access occurs exclusively inside Netlify Functions.
- Frontend never connects directly to CockroachDB.

TODO: Confirm if only one function should exist initially. If only one, combine getDailyQuiz + submitDailyQuiz or split by path.


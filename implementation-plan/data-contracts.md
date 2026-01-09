# Data Contracts

## Frontend Question Model
- id: string
- prompt: string
- options: string[]
- correctOptionIndex: number (only on server responses that verify answers)
- metadata: object (optional, TODO: define fields if needed)

## Core entities (example fields and types)
### Quiz
- id: string
- date: string (ISO date, London day)
- questions: Array<{ id: string, prompt: string, options: string[], correctOptionIndex: number }>

### User
- id: string
- name: string | null
- streak: number
- bestScore: number

### Result
- id: string
- userId: string
- date: string (ISO date, London day)
- quizId: string
- score: number
- answers: Array<{ questionId: string, selectedOptionIndex: number, correctOptionIndex: number }>

TODO: Confirm which fields are required vs optional and how IDs are generated.

## API Response Shapes

### Daily Quiz Response
- date: string (ISO date, London day)
- quizId: string
- questions: Array<{ id, prompt, options }>

### Submit Results Response
- date: string (ISO date, London day)
- quizId: string
- score: number
- streak: number
- bestScore: number
- answers: Array<{ questionId: string, selectedOptionIndex: number, correctOptionIndex: number }>

### Leaderboard Response
- date: string (ISO date, London day)
- entries: Array<{ userId: string, displayName: string | null, score: number, streak: number }>

### Error Response (all endpoints)
- error: { code: string, message: string }

## Mapping rules: DB rows -> frontend model
- DB question rows map to Frontend Question Model by selecting prompt + options only
- Correct answer is never sent in the daily quiz response
- Correct answer is only sent in submit response per question

TODO: Confirm if options order is randomized server-side.
TODO: Confirm if question IDs are stable across days or per quiz.

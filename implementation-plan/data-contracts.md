# Data Contracts

## TypeScript Types (Implemented)
**File**: `app/types/index.ts`

### Question
```typescript
interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex?: number;  // Included in responses
}
```

### Quiz
```typescript
interface Quiz {
  id: string;           // Format: "quiz-YYYY-MM-DD"
  date: string;         // ISO date: "YYYY-MM-DD"
  questions: Question[];
}
```

### QuizAnswer
```typescript
interface QuizAnswer {
  questionId: string;
  selectedOptionIndex: number;
  correctOptionIndex?: number;  // Filled by server
  isCorrect?: boolean;          // Filled by server
}
```

### QuizResult
```typescript
interface QuizResult {
  date: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  streak: number;
  bestScore: number;
  answers: QuizAnswer[];
}
```

### LeaderboardEntry
```typescript
interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  streak: number;
}
```

### UserStats
```typescript
interface UserStats {
  streak: number;
  bestScore: number;
}
```

---

## Database Schema

### ✅ Existing Table: `public.pu_player_ques`
```sql
CREATE TABLE public.pu_player_ques (
  date DATE NULL,
  language STRING NULL,
  rank INT4 NULL,
  question_id STRING NOT NULL PRIMARY KEY,
  question STRING NULL,
  player_id STRING NULL,
  player_name STRING NULL,       -- Correct answer
  player_0 STRING NULL,          -- Option 0
  player_1 STRING NULL,          -- Option 1
  player_2 STRING NULL,          -- Option 2
  player_3 STRING NULL           -- Option 3
);
```

**Mapping to Frontend**:
- `question_id` → `Question.id`
- `question` → `Question.prompt`
- `[player_0, player_1, player_2, player_3]` → `Question.options[]`
- Index of `player_name` in options → `Question.correctOptionIndex`

### ❌ Needed Table: `results` (Not Created)
```sql
-- Proposed schema
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id STRING NOT NULL,
  quiz_id STRING NOT NULL,
  date DATE NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  answers JSONB NOT NULL,       -- Array of QuizAnswer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)     -- Prevent duplicate submissions
);
```

### ❌ Needed Table: `users` (Not Created)
```sql
-- Proposed schema
CREATE TABLE users (
  id STRING PRIMARY KEY,        -- guest_xxx or auth0|xxx
  display_name STRING,
  streak INT DEFAULT 0,
  best_score INT DEFAULT 0,
  total_quizzes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_played DATE
);
```

---

## API Response Shapes (Actual)

### getDailyQuiz Response
```json
{
  "id": "quiz-2026-01-21",
  "date": "2026-01-21",
  "questions": [
    {
      "id": "q_abc123",
      "prompt": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correctOptionIndex": 2
    }
  ]
}
```
*Note: correctOptionIndex IS included (differs from original plan)*

### submitQuiz Response
```json
{
  "date": "2026-01-21",
  "quizId": "quiz-2026-01-21",
  "score": 4,
  "totalQuestions": 5,
  "streak": 1,
  "bestScore": 4,
  "answers": [
    {
      "questionId": "q_abc123",
      "selectedOptionIndex": 2,
      "correctOptionIndex": 2,
      "isCorrect": true
    }
  ]
}
```

### getLeaderboard Response
```json
[
  { "userId": "user1", "displayName": "Guest 1234", "score": 5, "streak": 3 }
]
```
*Currently placeholder data*

### getUserStats Response
```json
{
  "streak": 0,
  "bestScore": 0,
  "totalQuizzes": 0,
  "averageScore": 0
}
```
*Currently placeholder data*

---

## Local Storage Keys (Implemented)

| Key | Purpose | Location |
|-----|---------|----------|
| `@pundit_user_id` | Guest user ID | `app/storage/userStorage.ts` |
| `@pundit_daily_quiz_result` | Cached quiz result | `app/storage/quizStorage.ts` |
| `@pundit_quiz_{date}` | Cached quiz data | `app/storage/quizCache.ts` |

### User ID Format
- Guest: `guest_{timestamp}_{random}` (e.g., `guest_1705849200000_a1b2c3`)
- Auth0: Auth0 user ID (e.g., `auth0|abc123`)

### Quiz Cache Expiry
- 24 hours from cache time
- Keyed by date to allow pre-fetching

---

## ID Generation
- **Quiz ID**: `quiz-{date}` (derived from date)
- **Question ID**: `question_id` from database (stable)
- **User ID**: Generated client-side for guests, Auth0 ID for authenticated

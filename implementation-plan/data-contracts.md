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
  displayName: string | null;
  score: number;
  streak: number;
  rank: number;  // Added: position in leaderboard
}
```

### UserStats
```typescript
interface UserStats {
  streak: number;
  bestScore: number;
  totalQuizzes: number;   // Added: total completed quizzes
  averageScore: number;   // Added: percentage accuracy
}
```

### UserProfile (New)
```typescript
interface UserProfile {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
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

### ✅ Table: `users`
**Migration**: `db/migrations/001_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id STRING PRIMARY KEY,           -- auth0|xxx (guests don't use DB)
  display_name STRING,
  email STRING,
  avatar_url STRING,
  streak INT DEFAULT 0,
  best_score INT DEFAULT 0,
  total_quizzes INT DEFAULT 0,
  total_correct INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Notes**:
- Only Auth0 users are stored (guest users have no DB records)
- `display_name` is editable in-app (future feature)
- `streak` is updated after each quiz submission
- `total_correct` used to calculate average accuracy

### ✅ Table: `results`
**Migration**: `db/migrations/002_results.sql`

```sql
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id STRING NOT NULL REFERENCES users(id),
  quiz_id STRING NOT NULL,
  quiz_date DATE NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL DEFAULT 5,
  time_taken_seconds INT,          -- Not populated yet
  detailed_answers JSONB,          -- Array of QuizAnswer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)         -- Prevents duplicate submissions
);
```

**Notes**:
- `UNIQUE(user_id, quiz_id)` ensures idempotent submissions
- `quiz_date` used for streak calculation and leaderboard filtering
- `detailed_answers` stores full answer data as JSONB

### ❌ Table: `leagues` (Schema Created, Not Implemented)
**Migration**: `db/migrations/003_leagues.sql`

Future feature for league-based competition.

### ❌ Table: `online_games` (Schema Created, Not Implemented)
**Migration**: `db/migrations/004_online_games.sql`

Future feature for real-time multiplayer.

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
  {
    "userId": "auth0|abc123",
    "displayName": "John Smith",
    "score": 5,
    "streak": 7,
    "rank": 1
  }
]
```
*Real data from database - only Auth0 users appear*

### getUserStats Response
```json
{
  "streak": 7,
  "bestScore": 5,
  "totalQuizzes": 42,
  "averageScore": 82.5
}
```
*Real data for Auth0 users, zeros for guests*

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

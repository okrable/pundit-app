# API Plan

## Implemented Endpoints

All endpoints are Netlify Functions at `/.netlify/functions/`

### ✅ getDailyQuiz (Implemented)
**File**: `netlify/functions/getDailyQuiz.ts`

**Purpose**: Return daily quiz questions with correct answer indices

**Request**:
```
GET /.netlify/functions/getDailyQuiz?date=YYYY-MM-DD&language=uk
```
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| date | No | Today (UTC) | Quiz date in YYYY-MM-DD format |
| language | No | 'uk' | Language filter for questions |

**Response** (200):
```json
{
  "id": "quiz-2026-01-21",
  "date": "2026-01-21",
  "questions": [
    {
      "id": "q_abc123",
      "prompt": "Who scored the winning goal?",
      "options": ["Player A", "Player B", "Player C", "Player D"],
      "correctOptionIndex": 1
    }
  ]
}
```

**Error Responses**:
- `404`: No quiz found for the requested date
- `500`: Database connection error

**Implementation Notes**:
- Queries `pu_player_ques` table
- Limits to 5 questions per quiz
- Calculates `correctOptionIndex` by matching `player_name` against options
- Currently returns correct answers (could be hidden until submit for stricter security)

---

### ✅ submitQuiz (Implemented)
**File**: `netlify/functions/submitQuiz.ts`

**Purpose**: Submit user answers, compute score, return results

**Request**:
```
POST /.netlify/functions/submitQuiz
Content-Type: application/json

{
  "quizId": "quiz-2026-01-21",
  "userId": "guest_1705849200000_abc123",
  "answers": [
    { "questionId": "q_abc123", "selectedOptionIndex": 1 },
    { "questionId": "q_def456", "selectedOptionIndex": 0 }
  ]
}
```

**Response** (200):
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
      "selectedOptionIndex": 1,
      "correctOptionIndex": 1,
      "isCorrect": true
    }
  ]
}
```

**Error Responses**:
- `400`: Missing required fields (quizId, userId, answers)
- `404`: Quiz not found
- `500`: Database error

**Implementation Notes**:
- Fetches correct answers from DB to verify client submissions
- `streak` and `bestScore` are currently placeholder values (always 1 and score)
- **TODO**: Persist results to database
- **TODO**: Calculate actual streak from historical data
- **TODO**: Implement idempotent submission (prevent duplicates)

---

### 🚧 getLeaderboard (Placeholder)
**File**: `netlify/functions/getLeaderboard.ts`

**Purpose**: Return top players for leaderboard display

**Request**:
```
GET /.netlify/functions/getLeaderboard
```

**Response** (200):
```json
[
  { "userId": "user1", "displayName": "Guest 1234", "score": 5, "streak": 3 },
  { "userId": "user2", "displayName": "Guest 5678", "score": 4, "streak": 2 }
]
```

**Current Status**: Returns hardcoded placeholder data
**TODO**: Query actual results table, aggregate scores, rank users

---

### 🚧 getUserStats (Placeholder)
**File**: `netlify/functions/getUserStats.ts`

**Purpose**: Return personal statistics for a user

**Request**:
```
GET /.netlify/functions/getUserStats?userId=guest_123
```

**Response** (200):
```json
{
  "streak": 0,
  "bestScore": 0,
  "totalQuizzes": 0,
  "averageScore": 0
}
```

**Current Status**: Returns placeholder zeros
**TODO**: Query results table, calculate actual stats

---

## CORS Configuration (All Endpoints)
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}
```

## Database Access Layer
**File**: `netlify/functions/lib/db.ts`

```typescript
// Singleton connection pool
getPool(): Pool

// Execute query with typed results
query<T>(sql: string, params?: any[]): Promise<T[]>
```

- Uses `pg` (node-postgres) driver
- SSL enabled for CockroachDB
- Connection string from `DATABASE_URL` env var

## Authentication
- Endpoints accept `Authorization: Bearer <token>` header
- Currently used for user identification, not strict auth
- Auth0 tokens validated client-side via `useAuthStore`
- **TODO**: Add server-side token validation if needed


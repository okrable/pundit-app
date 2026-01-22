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

**Purpose**: Submit user answers, compute score, return results. Persists to database for Auth0 users.

**Request**:
```
POST /.netlify/functions/submitQuiz
Content-Type: application/json

{
  "quizId": "quiz-2026-01-21",
  "userId": "auth0|abc123",
  "answers": [
    { "questionId": "q_abc123", "selectedOptionIndex": 1 },
    { "questionId": "q_def456", "selectedOptionIndex": 0 }
  ],
  "userProfile": {
    "displayName": "John Smith",
    "email": "john@example.com",
    "avatarUrl": "https://..."
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| quizId | Yes | Quiz identifier (e.g., `quiz-2026-01-21`) |
| userId | Yes | User ID (guest_xxx or auth0\|xxx) |
| answers | Yes | Array of answer selections |
| userProfile | No | Auth0 profile data (only for Auth0 users) |

**Response** (200):
```json
{
  "date": "2026-01-21",
  "quizId": "quiz-2026-01-21",
  "score": 4,
  "totalQuestions": 5,
  "streak": 3,
  "bestScore": 5,
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

**Behavior by User Type**:

| User Type | Database | Streak | Best Score |
|-----------|----------|--------|------------|
| Guest (`guest_xxx`) | No interaction | Placeholder (1) | Current score |
| Auth0 (`auth0\|xxx`) | Persisted | Real (consecutive days) | Real (from DB) |

**Implementation Notes**:
- Guest users: No database interaction, returns placeholder response
- Auth0 users: Full persistence flow:
  1. Check for existing submission (idempotent - returns cached if exists)
  2. Upsert user record with profile data
  3. Insert result into results table
  4. Calculate streak from consecutive days
  5. Update user stats (streak, best_score, total_quizzes, total_correct)
- See `features/users-results-integration.md` for detailed streak calculation

---

### ✅ getLeaderboard (Implemented)
**File**: `netlify/functions/getLeaderboard.ts`

**Purpose**: Return today's top players ranked by score

**Request**:
```
GET /.netlify/functions/getLeaderboard
```

**Response** (200):
```json
[
  {
    "userId": "auth0|abc123",
    "displayName": "John Smith",
    "score": 5,
    "streak": 7,
    "rank": 1
  },
  {
    "userId": "auth0|def456",
    "displayName": "Jane Doe",
    "score": 4,
    "streak": 3,
    "rank": 2
  }
]
```

**Implementation Notes**:
- Queries today's results joined with users table
- Only Auth0 users appear (guests have no database records)
- Ranked by score descending, then by submission time
- Limited to 100 entries
- Returns empty array if no results for today

---

### ✅ getUserStats (Implemented)
**File**: `netlify/functions/getUserStats.ts`

**Purpose**: Return personal statistics for a user

**Request**:
```
GET /.netlify/functions/getUserStats?userId=auth0|abc123
```

**Response** (200):
```json
{
  "streak": 7,
  "bestScore": 5,
  "totalQuizzes": 42,
  "averageScore": 82.5
}
```

**Behavior by User Type**:

| User Type | Response |
|-----------|----------|
| Guest (`guest_xxx`) | Returns zeros (no DB record) |
| Auth0 (`auth0\|xxx`) | Real stats from users table |

**Implementation Notes**:
- Queries users table for Auth0 users
- Calculates averageScore as percentage: `(total_correct / (total_quizzes * 5)) * 100`
- Returns zeros gracefully if user not found

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


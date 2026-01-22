# Feature: Users + Results Database Integration

> **Status**: ✅ Implemented
> **Created**: January 2026

## Overview

This feature integrates the `users` and `results` database tables to enable real user profiles, game history, streak tracking, and leaderboards. It replaces the previous placeholder implementations with actual database persistence for authenticated users.

---

## Key Design Decisions

### Guest vs Authenticated Users

| Aspect | Guest Users | Auth0 Users |
|--------|-------------|-------------|
| Database storage | **None** — local only | Yes — users + results tables |
| Streak tracking | Local/placeholder | Real, persistent |
| Leaderboard | Not included | Included |
| Stats | Placeholder zeros | Real stats |
| User ID format | `guest_xxx_xxx` | `auth0\|xxx` |

**Rationale:** Incentivizes account creation. Guests continue working as before (AsyncStorage only).

### Auth0 Attributes Stored

| Column | Auth0 Field | Notes |
|--------|-------------|-------|
| `id` | `sub` | Primary key (e.g., `auth0\|abc123`) |
| `display_name` | `name` | Initial value from Auth0, **editable in-app** |
| `email` | `email` | From `email` scope |
| `avatar_url` | `picture` | From `profile` scope |

No additional Auth0 metadata stored — keeping it simple.

### Streak Calculation Rules

| Scenario | Streak Value |
|----------|--------------|
| Never played | 0 |
| Played today only | 1 |
| Played today + yesterday | 2 |
| Played yesterday, not today yet | 0 (until today's quiz completed) |
| Played 2 days ago, not yesterday | 0 (streak broken) |
| Played 5 consecutive days ending today | 5 |

**Key principle:** Streak is only non-zero if the chain of consecutive days includes today. Missing a day breaks the streak to 0 until the next quiz is completed.

---

## Database Schema

### Users Table
**Migration:** `db/migrations/001_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id STRING PRIMARY KEY,
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

### Results Table
**Migration:** `db/migrations/002_results.sql`

```sql
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id STRING NOT NULL REFERENCES users(id),
  quiz_id STRING NOT NULL,
  quiz_date DATE NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL DEFAULT 5,
  time_taken_seconds INT,
  detailed_answers JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);
```

---

## API Changes

### submitQuiz (Updated)
**File:** `netlify/functions/submitQuiz.ts`

**New Request Shape:**
```typescript
interface SubmitQuizRequest {
  quizId: string;
  userId: string;
  answers: { questionId: string; selectedOptionIndex: number }[];
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}
```

**Behavior:**
- **Guest users** (`userId.startsWith('guest_')`) — Returns placeholder response, no database interaction
- **Auth0 users** — Full database persistence:
  1. Check for existing submission (idempotent)
  2. Upsert user record with profile data
  3. Insert result into results table
  4. Calculate streak from consecutive days
  5. Update user stats (streak, best_score, total_quizzes, total_correct)

**Streak Calculation (JavaScript implementation):**
```typescript
async function calculateStreak(userId: string): Promise<number> {
  const results = await query<{ quiz_date: string }>(
    `SELECT DISTINCT quiz_date::TEXT as quiz_date
     FROM results WHERE user_id = $1 ORDER BY quiz_date DESC`,
    [userId]
  );

  if (results.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  if (results[0].quiz_date !== today) return 0;

  let streak = 1;
  let expectedDate = new Date(today);

  for (let i = 1; i < results.length; i++) {
    expectedDate.setDate(expectedDate.getDate() - 1);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    if (results[i].quiz_date === expectedDateStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
```

### getUserStats (Updated)
**File:** `netlify/functions/getUserStats.ts`

**Behavior:**
- **Guest users** — Returns zeros
- **Auth0 users** — Real database query:
```sql
SELECT
  streak,
  best_score as "bestScore",
  total_quizzes as "totalQuizzes",
  CASE WHEN total_quizzes > 0
    THEN ROUND(total_correct::DECIMAL / (total_quizzes * 5) * 100, 1)
    ELSE 0
  END as "averageScore"
FROM users WHERE id = $1
```

### getLeaderboard (Updated)
**File:** `netlify/functions/getLeaderboard.ts`

**Query:**
```sql
SELECT
  r.user_id as "userId",
  u.display_name as "displayName",
  r.score,
  u.streak,
  RANK() OVER (ORDER BY r.score DESC) as rank
FROM results r
JOIN users u ON r.user_id = u.id
WHERE r.quiz_date = $1
ORDER BY r.score DESC, r.created_at ASC
LIMIT 100
```

**Notes:**
- Only Auth0 users appear (guests have no results in DB)
- Returns empty array if no results for today

---

## Frontend Changes

### Updated Types
**File:** `app/types/index.ts`

```typescript
export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  score: number;
  streak: number;
  rank: number;  // NEW
}

export interface UserStats {
  streak: number;
  bestScore: number;
  totalQuizzes: number;  // NEW
  averageScore: number;  // NEW
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}
```

### API Service
**File:** `app/services/api.ts`

```typescript
export async function submitQuiz(
  quizId: string,
  userId: string,
  answers: { questionId: string; selectedOptionIndex: number }[],
  userProfile?: UserProfile  // NEW optional parameter
): Promise<QuizResult>
```

### Quiz Store
**File:** `app/state/useQuizStore.ts`

The `submitQuizAnswers` action now:
1. Gets Auth0 profile from `useAuthStore` if authenticated
2. Passes profile data to `submitQuiz()` API call

### LeaderboardScreen Guest Banner
**File:** `app/screens/LeaderboardScreen.tsx`

When user is not authenticated, displays a banner prompting account creation:

```
┌─────────────────────────────────────────┐
│  🏆 Join our growing community!         │
│                                         │
│  Create a free account to compete on    │
│  the leaderboard and track your stats.  │
│                                         │
│  [Create Account]                       │
└─────────────────────────────────────────┘
```

- Uses `useAuthStore.isAuthenticated` to determine visibility
- "Create Account" button triggers Auth0 login flow

---

## Files Modified

| File | Changes |
|------|---------|
| `netlify/functions/submitQuiz.ts` | Guest check, streak helper, idempotency, user upsert, result insert, stats update |
| `netlify/functions/getUserStats.ts` | Real database query for Auth0 users, zeros for guests |
| `netlify/functions/getLeaderboard.ts` | Daily leaderboard query from results+users join |
| `app/types/index.ts` | Added `rank` to LeaderboardEntry, expanded UserStats, added UserProfile |
| `app/services/api.ts` | Pass userProfile to submitQuiz |
| `app/state/useQuizStore.ts` | Include Auth0 profile in submit call |
| `app/screens/LeaderboardScreen.tsx` | Added guest prompt banner with Auth0 login |

## Files Created

| File | Purpose |
|------|---------|
| `db/migrations/001_users.sql` | Users table schema |
| `db/migrations/002_results.sql` | Results table schema |
| `db/queries/users.sql` | User query reference |
| `db/queries/results.sql` | Results query reference |

---

## Testing Verification

### Guest Submit (No DB)
```bash
curl -X POST http://localhost:8888/.netlify/functions/submitQuiz \
  -H "Content-Type: application/json" \
  -d '{"quizId":"quiz-2026-01-22","userId":"guest_123_abc","answers":[...]}'
# Returns placeholder, NO database insert
```

### Auth0 User Submit (With DB)
```bash
curl -X POST http://localhost:8888/.netlify/functions/submitQuiz \
  -H "Content-Type: application/json" \
  -d '{"quizId":"quiz-2026-01-22","userId":"auth0|test123","answers":[...],"userProfile":{"displayName":"Test User"}}'
# Creates user, stores result, returns real streak
```

### Idempotent Submission
Submitting the same quiz twice returns cached result (no duplicate).

### Streak Verification
- User with yesterday's result + today's = streak 2
- User with only today = streak 1
- User with yesterday but not today = streak 0

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Guest submission | No DB interaction, placeholder response |
| Duplicate submission (Auth0) | Returns cached result (idempotent) |
| New Auth0 user | Created automatically on first submit |
| Missing user stats | Returns zeros gracefully |
| Empty leaderboard | Returns empty array |
| Streak gap | Streak = 0 until today's quiz completed |
| Guest viewing leaderboard | Can see leaderboard but won't appear on it |

---

## Out of Scope (Future Work)

- London timezone handling (stays UTC for now)
- `time_taken_seconds` tracking (field exists but not populated)
- Leaderboard pagination
- Weekly/monthly leaderboards
- Display name editing UI

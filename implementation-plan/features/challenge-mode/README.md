# Feature: Challenge Mode (Async Multiplayer)

> **Status**: 📋 Planning
> **Created**: January 2026

## Overview

Challenge Mode enables asynchronous head-to-head matches where players compete against each other without needing to be online at the same time. One player creates a challenge, shares a link/code, and the opponent can join and complete the quiz at their convenience. Results are revealed once both players finish.

---

## Problem Statement

The current daily quiz is a solo experience. Players want to:
- Challenge friends directly
- Compare scores head-to-head
- Compete without coordinating schedules (async play)
- Share challenges easily via link or code

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Active challenges per user** | 1 at a time | Keep it simple, prevent spam |
| **Quiz source** | Today's daily quiz | Simplicity (future: random questions) |
| **Scoring** | Compare scores only | Ties are valid outcomes (draw) |
| **Revoke/cancel** | Yes, creator can revoke | Before opponent joins |
| **Challenge history** | Last 10 visible | Auth0 users only |
| **Lifetime stats** | Win/Loss/Draw record | Track on `users` table (Auth0 only) |
| **Expiry** | 48 hours | Reasonable window for async play |
| **Guest users** | Can play, no persistence | No history or stats stored |
| **Repeat opponents** | No restrictions | Challenge same person unlimited times |

---

## Core User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHALLENGE FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. CREATE (if no active challenge exists)                          │
│     Player A opens "Challenge" tab                                  │
│     Player A taps "Create Challenge"                                │
│     System generates unique code (uses today's quiz)                │
│     Player A receives shareable link/code                           │
│                                                                     │
│  2. SHARE                                                           │
│     Player A shares link via messages/social                        │
│     Link format: pundit.app/c/ABC123 or code: ABC123                │
│                                                                     │
│  3. PLAY (Creator)                                                  │
│     Player A completes the 5-question quiz                          │
│     Score is saved but NOT revealed                                 │
│     UI shows "Waiting for opponent..."                              │
│     (Creator can REVOKE before opponent joins)                      │
│                                                                     │
│  4. JOIN                                                            │
│     Player B opens link or enters code                              │
│     Player B sees challenge details (creator name)                  │
│     Player B taps "Accept Challenge"                                │
│                                                                     │
│  5. PLAY (Challenger)                                               │
│     Player B completes the same 5 questions                         │
│     Score is calculated                                             │
│                                                                     │
│  6. REVEAL                                                          │
│     Both players see final results:                                 │
│     - Winner/loser/draw                                             │
│     - Both scores side-by-side                                      │
│     - Question-by-question comparison                               │
│     Stats updated (wins/losses/draws)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Constraints

- **1 active challenge per user**: Cannot create new challenge while one is pending
- **Today's quiz only**: Challenges use the current day's 5 questions
- **48-hour expiry**: Challenges auto-expire if not completed
- **Revocable**: Creator can cancel before opponent completes
- **History limit**: Show last 10 completed challenges
- **Lifetime stats**: Track win/loss/draw on user profile

---

## UI Mockups

### Challenge Hub (New Screen)

```
┌─────────────────────────────────────────┐
│                Challenge                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │   ⚔️  Create a Challenge            ││
│  │                                      ││
│  │   Challenge a friend to beat your   ││
│  │   score on 5 random questions       ││
│  │                                      ││
│  │   [  Create Challenge  ]            ││
│  └─────────────────────────────────────┘│
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │   🔗  Join a Challenge              ││
│  │                                      ││
│  │   Enter code: [______]    [Join]    ││
│  └─────────────────────────────────────┘│
│                                         │
│  ACTIVE CHALLENGES                      │
│  ┌─────────────────────────────────────┐│
│  │ vs @JohnSmith    ⏳ Waiting         ││
│  │ Created 2h ago   Expires in 46h     ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ vs @FootballFan  ✅ Complete        ││
│  │ You won! 4-3     Tap to view        ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### Share Challenge Screen

```
┌─────────────────────────────────────────┐
│           Challenge Created!             │
├─────────────────────────────────────────┤
│                                         │
│              🎯                          │
│                                         │
│     Your challenge is ready!            │
│                                         │
│     Share this code:                    │
│     ┌───────────────────────────────┐   │
│     │         ABC123                │   │
│     │         [Copy]                │   │
│     └───────────────────────────────┘   │
│                                         │
│     Or share the link:                  │
│     ┌───────────────────────────────┐   │
│     │   [Share Challenge Link]      │   │
│     └───────────────────────────────┘   │
│                                         │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                         │
│     [  Play Your Questions Now  ]       │
│               or                        │
│         Play later (48h to complete)    │
│                                         │
└─────────────────────────────────────────┘
```

### Challenge Results Screen

```
┌─────────────────────────────────────────┐
│           Challenge Complete!            │
├─────────────────────────────────────────┤
│                                         │
│              🏆 YOU WIN!                │
│                                         │
│   ┌─────────────┐   ┌─────────────┐    │
│   │    You      │   │   @John     │    │
│   │  [Avatar]   │   │  [Avatar]   │    │
│   │             │   │             │    │
│   │    4/5      │   │    3/5      │    │
│   │   Winner    │   │             │    │
│   └─────────────┘   └─────────────┘    │
│                                         │
│   QUESTION BREAKDOWN                    │
│   ┌─────────────────────────────────┐   │
│   │ Q1: ✅ vs ✅  Both correct     │   │
│   │ Q2: ✅ vs ❌  You got it       │   │
│   │ Q3: ❌ vs ❌  Both wrong       │   │
│   │ Q4: ✅ vs ✅  Both correct     │   │
│   │ Q5: ✅ vs ❌  You got it       │   │
│   └─────────────────────────────────┘   │
│                                         │
│   [  Rematch  ]    [  New Challenge  ]  │
│                                         │
└─────────────────────────────────────────┘
```

---

## Technical Design

### Database Changes

#### Extend `users` Table (Add Challenge Stats)

```sql
-- Add columns to existing users table
ALTER TABLE users ADD COLUMN challenge_wins INT DEFAULT 0;
ALTER TABLE users ADD COLUMN challenge_losses INT DEFAULT 0;
ALTER TABLE users ADD COLUMN challenge_draws INT DEFAULT 0;
```

#### New `challenges` Table

```sql
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING(6) UNIQUE NOT NULL,           -- Shareable code (ABC123)

  -- Quiz reference (uses daily quiz)
  quiz_id STRING NOT NULL,                  -- e.g., "quiz-2026-01-27"
  quiz_date DATE NOT NULL,

  -- Players
  creator_id STRING NOT NULL,               -- User who created (auth0|xxx or guest_xxx)
  creator_display_name STRING,
  creator_score INT,                        -- NULL until creator completes
  creator_answers JSONB,                    -- [{questionId, selectedIndex, isCorrect}]

  opponent_id STRING,                       -- NULL until someone joins
  opponent_display_name STRING,
  opponent_score INT,                       -- NULL until opponent completes
  opponent_answers JSONB,

  -- Status
  status STRING NOT NULL DEFAULT 'pending', -- pending, active, completed, expired, revoked
  -- pending: created, waiting for creator to play
  -- active: creator played, waiting for opponent
  -- completed: both played
  -- expired: 48h passed without completion
  -- revoked: creator cancelled

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,          -- created_at + 48 hours
  completed_at TIMESTAMPTZ,

  -- Result (set when both complete)
  winner_id STRING                          -- NULL = draw, otherwise winner's user_id
);

-- Indexes
CREATE INDEX idx_challenges_code ON challenges(code);
CREATE INDEX idx_challenges_creator ON challenges(creator_id);
CREATE INDEX idx_challenges_opponent ON challenges(opponent_id);
CREATE INDEX idx_challenges_status ON challenges(status);
```

#### Design Notes

- **Single table approach**: Stores both players' results in one row (simpler than separate results table)
- **Status flow**: `pending` → `active` → `completed` (or `expired`/`revoked`)
- **1 active challenge constraint**: Enforced at API level (check for existing pending/active)
- **History query**: `WHERE (creator_id = ? OR opponent_id = ?) AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`
- **Guest behavior**: Guests can create and join challenges, but:
  - No `users` table row → no stats updated
  - No history shown (getUserChallenges returns empty for guests)
  - Challenge still works and completes normally
- **Future**: Quiz source will change from daily quiz to random question pool

### New API Endpoints

#### POST `/createChallenge`

Creates a new challenge using today's daily quiz. Fails if user already has an active challenge.

**Request**:
```json
{
  "userId": "auth0|xxx",
  "displayName": "John Smith"
}
```

**Response** (201):
```json
{
  "challengeId": "uuid",
  "code": "ABC123",
  "shareUrl": "https://pundit.app/c/ABC123",
  "quizId": "quiz-2026-01-27",
  "expiresAt": "2026-01-29T12:00:00Z",
  "questions": [
    { "id": "q1", "prompt": "...", "options": [...], "correctOptionIndex": 2 }
  ]
}
```

**Errors**:
- `409`: User already has an active challenge
- `404`: No quiz available for today

---

#### GET `/getChallenge?code=ABC123`

Retrieves challenge details. Used for join flow and status checks.

**Response** (200):
```json
{
  "challengeId": "uuid",
  "code": "ABC123",
  "status": "active",
  "creator": {
    "userId": "auth0|xxx",
    "displayName": "John Smith"
  },
  "opponent": null,
  "quizDate": "2026-01-27",
  "expiresAt": "2026-01-29T12:00:00Z",
  "canJoin": true
}
```

**Errors**:
- `404`: Challenge not found or expired

---

#### POST `/joinChallenge`

Join an existing challenge. Returns quiz questions.

**Request**:
```json
{
  "code": "ABC123",
  "userId": "auth0|yyy",
  "displayName": "Jane Doe"
}
```

**Response** (200):
```json
{
  "challengeId": "uuid",
  "creator": {
    "displayName": "John Smith"
  },
  "questions": [...]
}
```

**Errors**:
- `404`: Challenge not found
- `409`: Challenge already has an opponent
- `400`: Cannot join your own challenge

---

#### POST `/submitChallengeAnswers`

Submit answers for a challenge. Works for both creator and opponent.

**Request**:
```json
{
  "challengeId": "uuid",
  "userId": "auth0|xxx",
  "answers": [
    { "questionId": "q1", "selectedOptionIndex": 2 }
  ]
}
```

**Response** (waiting for opponent):
```json
{
  "status": "waiting",
  "yourScore": 4,
  "yourAnswers": [{ "questionId": "q1", "selectedOptionIndex": 2, "isCorrect": true }]
}
```

**Response** (both complete):
```json
{
  "status": "complete",
  "result": "win",
  "yourScore": 4,
  "opponentScore": 3,
  "opponentDisplayName": "Jane Doe",
  "yourAnswers": [...],
  "opponentAnswers": [...],
  "winner": "you"
}
```

`result` values: `"win"`, `"loss"`, `"draw"`

---

#### POST `/revokeChallenge`

Revoke/cancel a challenge. Only works if opponent hasn't joined yet.

**Request**:
```json
{
  "challengeId": "uuid",
  "userId": "auth0|xxx"
}
```

**Response** (200):
```json
{
  "success": true
}
```

**Errors**:
- `404`: Challenge not found
- `403`: Not the creator
- `409`: Cannot revoke - opponent already joined

---

#### GET `/getUserChallenges?userId=xxx`

Get user's challenges (active + last 10 completed) and lifetime stats.

**Response** (200):
```json
{
  "active": {
    "challengeId": "uuid",
    "code": "ABC123",
    "status": "active",
    "creatorDisplayName": "John Smith",
    "opponentDisplayName": null,
    "isCreator": true,
    "createdAt": "2026-01-27T10:00:00Z",
    "expiresAt": "2026-01-29T10:00:00Z"
  },
  "history": [
    {
      "challengeId": "uuid",
      "opponentDisplayName": "Jane Doe",
      "yourScore": 4,
      "opponentScore": 3,
      "result": "win",
      "completedAt": "2026-01-26T15:00:00Z"
    }
  ],
  "stats": {
    "wins": 5,
    "losses": 2,
    "draws": 1
  }
}
```

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `ChallengeScreen.tsx` | Hub for creating/joining/viewing challenges |
| `CreateChallengeModal.tsx` | Challenge creation flow |
| `JoinChallengeScreen.tsx` | Join via link/code |
| `ChallengeQuizScreen.tsx` | Quiz UI for challenge (reuse DailyQuizScreen?) |
| `ChallengeResultsScreen.tsx` | Head-to-head results comparison |
| `ChallengeCard.tsx` | Card component for challenge list |

### State Management

New Zustand store: `useChallengeStore`

```typescript
interface ChallengeStore {
  // Current challenge being played
  activeChallenge: Challenge | null;

  // User's challenge history
  challenges: Challenge[];

  // Actions
  createChallenge: () => Promise<Challenge>;
  joinChallenge: (code: string) => Promise<Challenge>;
  submitAnswers: (answers: Answer[]) => Promise<ChallengeResult>;
  fetchUserChallenges: () => Promise<void>;
}
```

---

## Navigation Changes

### Option A: New Tab

Add "Challenge" as 4th tab in bottom navigation.

```
[ Games ]  [ Challenge ]  [ Leaderboard ]  [ Me ]
```

### Option B: Within Games Tab

Add challenge entry point on Games screen alongside daily quiz.

```
┌─────────────────────────────────┐
│  Today's Quiz                    │
│  [Play Now]                      │
├─────────────────────────────────┤
│  Challenge a Friend              │
│  [Create Challenge]              │
└─────────────────────────────────┘
```

**Recommendation**: Option A for discoverability, but discuss navigation UX.

---

## Deep Linking

For challenge sharing to work, implement deep link handling:

**URL Format**: `https://pundit.app/c/ABC123` or `pundit://challenge/ABC123`

**Expo Linking Config**:
```javascript
{
  prefixes: ['https://pundit.app', 'pundit://'],
  config: {
    screens: {
      JoinChallenge: 'c/:code'
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Database & API Foundation
- [ ] Create `challenges` and `challenge_results` tables
- [ ] Implement `/createChallenge` endpoint
- [ ] Implement `/getChallenge` endpoint
- [ ] Implement `/joinChallenge` endpoint
- [ ] Implement `/submitChallengeAnswers` endpoint
- [ ] Implement `/getUserChallenges` endpoint

### Phase 2: Core UI
- [ ] Create `ChallengeScreen` (hub)
- [ ] Create challenge code input UI
- [ ] Implement share functionality (native share sheet)
- [ ] Create `ChallengeCard` component

### Phase 3: Quiz Flow
- [ ] Adapt quiz flow for challenges (reuse or fork DailyQuizScreen)
- [ ] Implement "waiting for opponent" state
- [ ] Create `ChallengeResultsScreen`

### Phase 4: State & Navigation
- [ ] Implement `useChallengeStore`
- [ ] Add Challenge tab to navigation
- [ ] Implement deep linking for challenge URLs

### Phase 5: Polish
- [ ] Expiry handling (auto-expire old challenges)
- [ ] Rematch functionality
- [ ] Loading states and error handling
- [ ] Guest user prompts

### Future Enhancements (Not MVP)
- Push notifications when opponent completes
- Challenge history and stats
- Public/open challenges
- Best of 3/5 series
- Challenge leaderboard (most wins)

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| Question source | Today's daily quiz (future: random questions) |
| Tie breaker | Draw - both scores equal means a draw |
| Challenge limits | 1 active challenge per user |
| Revocation | Yes, before opponent joins |
| History retention | Last 10 completed (Auth0 users only) |
| Lifetime stats | Win/loss/draw tracked on users table |
| Already played daily | Allow it - future random questions will solve this |
| Guest history | No storage - guests can play but nothing persisted |
| Repeat opponents | No restrictions - challenge same person as often as you like |

---

## Dependencies

- Existing quiz fetching infrastructure
- Auth0 integration (for user identity)
- Native share functionality (expo-sharing)
- Deep linking (expo-linking)
- Database migrations

---

## Notes

- Keep UI simple and aligned with existing design language
- Challenge code should be easy to type/share (6 chars, alphanumeric, no ambiguous chars like 0/O, 1/l)
- Consider accessibility for results comparison screen
- Test cross-timezone scenarios for expiry

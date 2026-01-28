# Challenge Mode - Frontend Implementation Plan

> **Status**: 📋 Ready for Implementation
> **Created**: January 2026
> **Prerequisites**: API endpoints deployed and tested

---

## Overview

This document details the frontend implementation for Challenge Mode. The backend API is complete (6 endpoints). This plan covers the React Native / Expo implementation.

---

## Implementation Phases

### Phase 1: Types & API Service
### Phase 2: Zustand Store
### Phase 3: Challenge Screen (Hub)
### Phase 4: Create Challenge Flow
### Phase 5: Join Challenge Flow
### Phase 6: Challenge Quiz Integration
### Phase 7: Results Screen
### Phase 8: Navigation & Deep Linking

---

## Phase 1: Types & API Service

### 1.1 Add Types

**File**: `app/types/index.ts` (extend existing)

```typescript
// Challenge Types
export interface Challenge {
  challengeId: string;
  code: string;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'revoked';
  quizId?: string;
  quizDate?: string;
  creator: {
    userId: string;
    displayName: string | null;
  };
  opponent: {
    userId: string;
    displayName: string | null;
  } | null;
  expiresAt: string;
  canJoin?: boolean;
  // Scores (only when completed)
  creatorScore?: number;
  opponentScore?: number;
  winnerId?: string | null;
}

export interface ChallengeHistoryItem {
  challengeId: string;
  opponentDisplayName: string | null;
  yourScore: number;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw';
  completedAt: string;
}

export interface ChallengeStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface ActiveChallenge {
  challengeId: string;
  code: string;
  status: 'pending' | 'active';
  creatorDisplayName: string | null;
  opponentDisplayName: string | null;
  isCreator: boolean;
  createdAt: string;
  expiresAt: string;
  hasCreatorPlayed: boolean;
  hasOpponentPlayed: boolean;
}

export interface UserChallenges {
  active: ActiveChallenge | null;
  history: ChallengeHistoryItem[];
  stats: ChallengeStats;
}

export interface ChallengeAnswer {
  questionId: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
}

export interface ChallengeSubmitResult {
  status: 'waiting' | 'complete';
  yourScore: number;
  yourAnswers: ChallengeAnswer[];
  // Only when complete
  result?: 'win' | 'loss' | 'draw';
  opponentScore?: number;
  opponentDisplayName?: string;
  opponentAnswers?: ChallengeAnswer[];
}

export interface CreateChallengeResponse {
  challengeId: string;
  code: string;
  shareUrl: string;
  quizId: string;
  expiresAt: string;
  questions: Question[];
}

export interface JoinChallengeResponse {
  challengeId: string;
  creator: {
    displayName: string | null;
  };
  questions: Question[];
}
```

### 1.2 Create Challenge API Service

**File**: `app/services/challengeApi.ts` (new)

```typescript
import { API_BASE_URL } from '../config';
import type {
  Challenge,
  UserChallenges,
  CreateChallengeResponse,
  JoinChallengeResponse,
  ChallengeSubmitResult,
  QuizAnswerSubmission,
} from '../types';

export const challengeApi = {
  async createChallenge(userId: string, displayName?: string): Promise<CreateChallengeResponse> {
    const response = await fetch(`${API_BASE_URL}/createChallenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create challenge');
    }
    return response.json();
  },

  async getChallenge(code: string): Promise<Challenge> {
    const response = await fetch(`${API_BASE_URL}/getChallenge?code=${code}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Challenge not found');
    }
    return response.json();
  },

  async joinChallenge(code: string, userId: string, displayName?: string): Promise<JoinChallengeResponse> {
    const response = await fetch(`${API_BASE_URL}/joinChallenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, userId, displayName }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join challenge');
    }
    return response.json();
  },

  async submitAnswers(
    challengeId: string,
    userId: string,
    answers: QuizAnswerSubmission[]
  ): Promise<ChallengeSubmitResult> {
    const response = await fetch(`${API_BASE_URL}/submitChallengeAnswers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, userId, answers }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit answers');
    }
    return response.json();
  },

  async revokeChallenge(challengeId: string, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/revokeChallenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke challenge');
    }
  },

  async getUserChallenges(userId: string): Promise<UserChallenges> {
    const response = await fetch(`${API_BASE_URL}/getUserChallenges?userId=${userId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch challenges');
    }
    return response.json();
  },
};
```

---

## Phase 2: Zustand Store

**File**: `app/stores/challengeStore.ts` (new)

```typescript
import { create } from 'zustand';
import { challengeApi } from '../services/challengeApi';
import type {
  Question,
  ActiveChallenge,
  ChallengeHistoryItem,
  ChallengeStats,
  ChallengeSubmitResult,
  QuizAnswerSubmission,
} from '../types';

interface ChallengeState {
  // Current challenge being played
  currentChallenge: {
    challengeId: string;
    code: string;
    questions: Question[];
    isCreator: boolean;
    opponentName: string | null;
  } | null;

  // User's challenges data
  activeChallenge: ActiveChallenge | null;
  history: ChallengeHistoryItem[];
  stats: ChallengeStats;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  createChallenge: (userId: string, displayName?: string) => Promise<string>; // returns code
  joinChallenge: (code: string, userId: string, displayName?: string) => Promise<void>;
  submitAnswers: (userId: string, answers: QuizAnswerSubmission[]) => Promise<ChallengeSubmitResult>;
  revokeChallenge: (userId: string) => Promise<void>;
  fetchUserChallenges: (userId: string) => Promise<void>;
  clearCurrentChallenge: () => void;
  clearError: () => void;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  currentChallenge: null,
  activeChallenge: null,
  history: [],
  stats: { wins: 0, losses: 0, draws: 0 },
  isLoading: false,
  error: null,

  createChallenge: async (userId, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await challengeApi.createChallenge(userId, displayName);
      set({
        currentChallenge: {
          challengeId: response.challengeId,
          code: response.code,
          questions: response.questions,
          isCreator: true,
          opponentName: null,
        },
        isLoading: false,
      });
      return response.code;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create challenge', isLoading: false });
      throw error;
    }
  },

  joinChallenge: async (code, userId, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await challengeApi.joinChallenge(code, userId, displayName);
      set({
        currentChallenge: {
          challengeId: response.challengeId,
          code,
          questions: response.questions,
          isCreator: false,
          opponentName: response.creator.displayName,
        },
        isLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to join challenge', isLoading: false });
      throw error;
    }
  },

  submitAnswers: async (userId, answers) => {
    const { currentChallenge } = get();
    if (!currentChallenge) throw new Error('No active challenge');

    set({ isLoading: true, error: null });
    try {
      const result = await challengeApi.submitAnswers(currentChallenge.challengeId, userId, answers);
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to submit answers', isLoading: false });
      throw error;
    }
  },

  revokeChallenge: async (userId) => {
    const { activeChallenge } = get();
    if (!activeChallenge) throw new Error('No active challenge to revoke');

    set({ isLoading: true, error: null });
    try {
      await challengeApi.revokeChallenge(activeChallenge.challengeId, userId);
      set({ activeChallenge: null, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to revoke challenge', isLoading: false });
      throw error;
    }
  },

  fetchUserChallenges: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await challengeApi.getUserChallenges(userId);
      set({
        activeChallenge: data.active,
        history: data.history,
        stats: data.stats,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch challenges', isLoading: false });
    }
  },

  clearCurrentChallenge: () => set({ currentChallenge: null }),
  clearError: () => set({ error: null }),
}));
```

---

## Phase 3: Challenge Screen (Hub)

**File**: `app/screens/ChallengeScreen.tsx` (new)

This is the main Challenge tab screen showing:
- Create Challenge button (or active challenge status)
- Join Challenge code input
- Challenge history (last 10)
- Win/Loss/Draw stats

### Key Components

```
┌─────────────────────────────────────────┐
│              Challenge                   │
├─────────────────────────────────────────┤
│                                         │
│  [If no active challenge]               │
│  ┌─────────────────────────────────────┐│
│  │   ⚔️  Create a Challenge            ││
│  │   [  Create Challenge  ]            ││
│  └─────────────────────────────────────┘│
│                                         │
│  [If active challenge exists]           │
│  ┌─────────────────────────────────────┐│
│  │   Your Challenge: ABC123            ││
│  │   Status: Waiting for opponent      ││
│  │   [Share] [Play Now] [Cancel]       ││
│  └─────────────────────────────────────┘│
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │   🔗  Join a Challenge              ││
│  │   Enter code: [______]    [Join]    ││
│  └─────────────────────────────────────┘│
│                                         │
│  STATS                 W: 5  L: 2  D: 1 │
│                                         │
│  RECENT CHALLENGES                      │
│  ┌─────────────────────────────────────┐│
│  │ vs @JohnSmith    ✅ Won 4-3         ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ vs @FootballFan  ❌ Lost 2-4        ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### Implementation Notes

- Fetch user challenges on mount and on focus
- Show loading skeleton while fetching
- Handle guest users (show prompt to sign up for history)
- Share button uses `expo-sharing` or `Share` from react-native
- Code input: 6 chars, auto-uppercase, auto-submit when complete

---

## Phase 4: Create Challenge Flow

### 4.1 Create Challenge Modal/Screen

When user taps "Create Challenge":
1. Call `createChallenge` API
2. Show share screen with code and share button
3. Option to "Play Now" or "Play Later"

### 4.2 Share Challenge Component

**File**: `app/components/ShareChallengeModal.tsx` (new)

```typescript
// Props
interface ShareChallengeModalProps {
  visible: boolean;
  code: string;
  onClose: () => void;
  onPlayNow: () => void;
}
```

Features:
- Large, copyable code display
- "Copy Code" button with feedback
- "Share Link" button (native share sheet)
- "Play Now" primary CTA
- "Play Later" secondary option
- Expiry countdown (48h)

---

## Phase 5: Join Challenge Flow

### 5.1 Code Entry Component

**File**: `app/components/ChallengeCodeInput.tsx` (new)

- 6 individual character boxes
- Auto-uppercase
- Auto-advance on input
- Paste support
- Validation feedback

### 5.2 Join Confirmation Screen

After entering valid code:
1. Fetch challenge details (`getChallenge`)
2. Show creator name and challenge info
3. "Accept Challenge" button
4. On accept, call `joinChallenge` and navigate to quiz

---

## Phase 6: Challenge Quiz Integration

### Option A: Reuse DailyQuizScreen

Modify `DailyQuizScreen` to accept a `mode` prop:
- `mode: 'daily' | 'challenge'`
- Pass questions from challenge store
- Different submit handler for challenges

### Option B: Separate ChallengeQuizScreen

Create `ChallengeQuizScreen.tsx` that:
- Reuses quiz components (QuestionCard, Timer, etc.)
- Uses challenge store for questions and submission
- Navigates to ChallengeResultsScreen on complete

**Recommendation**: Option B for cleaner separation.

### Key Differences from Daily Quiz

| Aspect | Daily Quiz | Challenge Quiz |
|--------|------------|----------------|
| Questions source | API fetch | Challenge store |
| Submit endpoint | `/submitQuiz` | `/submitChallengeAnswers` |
| Results | Score, streak, best | Win/loss/draw, comparison |
| Replay | Once per day | One attempt per challenge |

---

## Phase 7: Results Screen

**File**: `app/screens/ChallengeResultsScreen.tsx` (new)

### Waiting State (opponent hasn't played)

```
┌─────────────────────────────────────────┐
│         Waiting for Opponent             │
├─────────────────────────────────────────┤
│                                         │
│              ⏳                          │
│                                         │
│     Your score is locked in!            │
│     Score: 4/5 (340 pts)                │
│                                         │
│     Waiting for @JohnSmith to play...   │
│                                         │
│     Share the code again:               │
│           ABC123                        │
│     [Share] [Copy]                      │
│                                         │
│     [Back to Challenges]                │
│                                         │
└─────────────────────────────────────────┘
```

### Complete State (both played)

```
┌─────────────────────────────────────────┐
│           Challenge Complete!            │
├─────────────────────────────────────────┤
│                                         │
│              🏆 YOU WIN!                │
│                                         │
│   ┌─────────────┐   ┌─────────────┐    │
│   │    You      │   │   @John     │    │
│   │    4/5      │   │    3/5      │    │
│   │   340 pts   │   │   240 pts   │    │
│   │   Winner    │   │             │    │
│   └─────────────┘   └─────────────┘    │
│                                         │
│   QUESTION BREAKDOWN                    │
│   Q1: ✅ vs ✅  Both correct            │
│   Q2: ✅ vs ❌  You got it              │
│   Q3: ❌ vs ❌  Both wrong              │
│   Q4: ✅ vs ✅  Both correct            │
│   Q5: ✅ vs ❌  You got it              │
│                                         │
│   [New Challenge]  [Back to Challenges] │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase 8: Navigation & Deep Linking

### 8.1 Add Challenge Tab

**File**: `app/navigation/BottomTabNavigator.tsx` (modify)

Add 4th tab between Games and Leaderboard:

```typescript
<Tab.Screen
  name="Challenge"
  component={ChallengeScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="flash" size={size} color={color} />
    ),
  }}
/>
```

Tab order: `Games | Challenge | Leaderboard | Me`

### 8.2 Stack Navigator for Challenge Flow

**File**: `app/navigation/ChallengeStack.tsx` (new)

```typescript
const ChallengeStack = createNativeStackNavigator();

export function ChallengeNavigator() {
  return (
    <ChallengeStack.Navigator>
      <ChallengeStack.Screen name="ChallengeHub" component={ChallengeScreen} />
      <ChallengeStack.Screen name="ChallengeQuiz" component={ChallengeQuizScreen} />
      <ChallengeStack.Screen name="ChallengeResults" component={ChallengeResultsScreen} />
    </ChallengeStack.Navigator>
  );
}
```

### 8.3 Deep Linking (Future)

**File**: `app.json` or `app.config.js`

```json
{
  "expo": {
    "scheme": "pundit",
    "web": {
      "bundler": "metro"
    }
  }
}
```

**Linking config**:
```typescript
const linking = {
  prefixes: ['pundit://', 'https://pundit.app'],
  config: {
    screens: {
      Challenge: {
        screens: {
          JoinChallenge: 'c/:code',
        },
      },
    },
  },
};
```

---

## File Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `app/services/challengeApi.ts` | API client for challenge endpoints |
| `app/stores/challengeStore.ts` | Zustand store for challenge state |
| `app/screens/ChallengeScreen.tsx` | Main challenge hub/tab |
| `app/screens/ChallengeQuizScreen.tsx` | Quiz UI for challenges |
| `app/screens/ChallengeResultsScreen.tsx` | Results comparison |
| `app/components/ShareChallengeModal.tsx` | Share code/link UI |
| `app/components/ChallengeCodeInput.tsx` | 6-char code entry |
| `app/components/ChallengeCard.tsx` | History item card |
| `app/navigation/ChallengeStack.tsx` | Stack navigator |

### Files to Modify

| File | Changes |
|------|---------|
| `app/types/index.ts` | Add challenge types |
| `app/navigation/BottomTabNavigator.tsx` | Add Challenge tab |
| `app.json` | Add deep link scheme (future) |

---

## Dependencies

Already installed:
- `zustand` (state management)
- `@react-navigation/*` (navigation)
- `expo-sharing` (native share - check if installed)

May need to install:
- `expo-clipboard` (for copy functionality)

---

## Testing Checklist

### Create Flow
- [ ] Create challenge shows code
- [ ] Code is copyable
- [ ] Share sheet works
- [ ] Cannot create if active challenge exists
- [ ] Play Now navigates to quiz

### Join Flow
- [ ] Code input accepts 6 chars
- [ ] Invalid code shows error
- [ ] Cannot join own challenge
- [ ] Cannot join full challenge
- [ ] Join navigates to quiz

### Quiz Flow
- [ ] Questions display correctly
- [ ] Timer works
- [ ] Submit saves answers
- [ ] Waiting state shows if opponent hasn't played
- [ ] Complete state shows comparison

### Results
- [ ] Win/loss/draw displays correctly
- [ ] Scores show correctly
- [ ] Question breakdown accurate
- [ ] Stats update after completion

### Edge Cases
- [ ] Expired challenge handling
- [ ] Revoked challenge handling
- [ ] Network errors
- [ ] Guest user limitations

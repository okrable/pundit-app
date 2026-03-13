# Performance Bootstrap and Daily-Loop Loading

## Objective
Keep Pundit visually the same while making the Wordle-style daily loop feel instant on warm opens:
- open app
- land in a usable state immediately
- play today’s quiz once
- see the result instantly
- compare against friends without waiting on fresh network data first

## Startup Sequence
1. Load fonts.
2. Hydrate cached auth/session metadata from local storage.
3. Hydrate cached daily-loop resources from storage:
   - today quiz
   - today result
   - profile stats
   - friends leaderboard
   - global leaderboard
4. Render the app shell.
5. Refresh auth and network-backed daily-loop resources in the background.

## Cache Strategy

### Quiz
- Keyed by quiz date.
- Warm opens prefer cached quiz data first.
- Revalidated in the background if stale.

### Same-Day Result
- Stored per user (guest vs authenticated).
- Used to prevent replay and to show the completed state immediately on warm opens.
- Can be marked as `pending`, `synced`, or `failed` to reflect background submit state.

### Profile Stats
- Cached per authenticated user.
- Me screen renders cached stats first, then silently refreshes when possible.

### Leaderboards
- Global leaderboard is cached separately from the friends leaderboard.
- Authenticated users default to the friends leaderboard.
- Both views can render from cache on warm open and refresh in the background.

## Result Submission Model
- After the fifth answer, the app computes a local result immediately from the quiz payload.
- That local result is persisted right away and shown without waiting for the server.
- The actual `submitQuiz` request runs in the background.
- If the app is interrupted before sync completes, the pending submission is retried on the next warm path.
- Authenticated stat finalization remains server-authoritative and continues asynchronously.

## UX Rules
- Generic full-screen spinners are reserved for true cold-miss fallback only.
- Startup loading uses a branded bootstrap screen.
- Games uses inline “warming up” messaging on the welcome screen if today’s quiz is still loading.
- Me and League Tables prefer cached content or placeholder rows over centered loading wheels.

## Source Files
- `App.tsx`
- `app/hooks/useAuthInit.ts`
- `app/hooks/useAppBootstrap.ts`
- `app/services/dailyLoop.ts`
- `app/state/useQuizStore.ts`
- `app/state/useProfileStore.ts`
- `app/state/useLeaderboardStore.ts`
- `app/storage/*`

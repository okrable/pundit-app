# Pundit Trivia v0.1 Implementation Plan

> **Last Updated**: January 2026
> **Status**: MVP Complete - Core features and database persistence working

## What it is
Pundit Trivia v0.1 is a minimalist daily football quiz mobile app. It delivers one 5-question quiz per day, shows results instantly (score, streak, best score), and provides simple leaderboards plus personal stats. Navigation is via a bottom tab bar with Games, Leaderboard, and Me.

## Problem it solves
Provides a fast, single-screen daily football trivia experience with lightweight competition signals (leaderboards, streaks) that resets daily.

## What it explicitly does NOT do
- Multi-quiz days, unlimited quizzes, or custom quiz creation
- Social features (friends, DMs, chat), notifications, or achievements
- Complex analytics, in-depth profiles, or web admin tools
- Full offline multiplayer or real-time sync between players

## Current Implementation Status

### ✅ Completed
- React Native + Expo project setup with TypeScript
- Bottom tab navigation (Games, Leaderboard, Me)
- Daily quiz UI with animated question cards
- Quiz fetching from CockroachDB via Netlify Functions
- Quiz submission and server-side scoring
- Results display with score, streak, best score
- Local caching (quiz data, results, user ID)
- Guest user support with auto-generated IDs
- Auth0 integration (optional, graceful degradation)
- Welcome screen and completed quiz screen
- Theme system with custom fonts (Gotham, UniSans)
- Database tables for users and results (see `db/migrations/`)
- Persistent streak/best score tracking for Auth0 users
- Real leaderboard with daily rankings
- Real user stats from database
- Idempotent quiz submission (duplicate prevention)
- "Me" profile page with auth state handling
- Settings modal (moved from tab to modal)
- Guest prompt on leaderboard to encourage signup
- Tap-and-hold to speed up typewriter effect

### 🚧 Partially Implemented
- London timezone for quiz resets (currently UTC)

### ❌ Not Yet Implemented
- Display name editing UI
- Offline answer queue
- Server-side Auth0 token validation

## Who this plan is for
Claude Code (AI agent) responsible for building and maintaining the app.

## How to use this plan
Follow the documents in this folder in order:
1) `scope.md` - boundaries, non-goals, and current implementation status
2) `architecture.md` and `api-plan.md` - system shape and backend interface
3) `data-contracts.md` and `frontend-plan.md` - data shapes and UI behavior
4) `execution-plan.md` - phase completion status
5) `assumptions-and-todos.md` - resolved items and remaining work
6) `features/` - detailed documentation for individual features

---

## ⚠️ IMPORTANT: Keeping This Plan Updated

**All significant code changes MUST include updates to this implementation plan.**

### When to Update
Update the relevant documentation files when:
- Adding new features or screens
- Creating or modifying API endpoints
- Changing database schema or data models
- Adding new dependencies
- Modifying state management or storage
- Completing items from the TODO list
- Discovering new limitations or requirements

### Which Files to Update

| Change Type | Update These Files |
|-------------|-------------------|
| New feature | `scope.md`, `execution-plan.md`, `frontend-plan.md` |
| New/changed API | `api-plan.md`, `data-contracts.md` |
| Database changes | `data-contracts.md`, `architecture.md` |
| New dependencies | `architecture.md`, `execution-plan.md` |
| Bug fixes | `assumptions-and-todos.md` (if related to known issues) |
| Completed TODOs | `assumptions-and-todos.md`, `execution-plan.md` |
| Architecture changes | `architecture.md`, `scope.md` |

### How to Update
1. Update the "Last Updated" date in this README
2. Mark completed items with ✅ and move from pending to completed sections
3. Add new TODOs to `assumptions-and-todos.md`
4. Keep file references accurate (paths, line numbers)
5. Update status indicators (✅ Done, 🚧 Partial, ❌ Pending)

### Why This Matters
- Future AI agents need accurate context to work effectively
- Prevents duplicate work or conflicting implementations
- Maintains a single source of truth for the project state
- Reduces onboarding time for understanding the codebase


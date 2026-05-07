# Feature: Challenge Mode

> Status: Implemented with ongoing hardening opportunities
> Last updated: v1.1.0 documentation refresh

## Delivered Behavior

- Authenticated users can create a challenge code and share a link/code.
- Opponents can join by code and play the same quiz set.
- Both players submit answers asynchronously.
- Results are revealed as win/loss/draw when both complete.
- Users can view active challenge and recent challenge history.
- Challenge W/L/D counters are persisted for authenticated users.
- Challenge play uses the same refreshed `QuestionCard` gameplay UI as the daily quiz.

## Current Product Rules

- One active created challenge per user at a time.
- Challenges expire after 48 hours.
- Creator can revoke while challenge is still revocable by server rules.
- Challenge quiz payload includes `correctOptionIndex` so answer reveal can remain immediate.
- The shared gameplay surface preserves typewriter pacing, option reveal, timer-after-reveal behavior, and answer reveal animations.

## Implementation Surface

- Backend functions: `createChallenge`, `getChallenge`, `joinChallenge`, `submitChallengeAnswers`, `revokeChallenge`, `getUserChallenges`.
- Client screens/components: `ChallengeScreen`, `ChallengeQuizScreen`, `ChallengeResultsScreen`, sharing modals, and shared `QuestionCard`.
- Data model: `challenges` table plus challenge stat columns on `users`.

## Follow-Up Improvements

1. Improve deep-link UX reliability and attribution.
2. Expand lifecycle observability.
3. Add challenge-specific abuse throttling and anomaly detection.

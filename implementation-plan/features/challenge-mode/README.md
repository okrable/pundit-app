# Feature: Challenge Mode (Async Multiplayer)

> **Status**: ✅ Implemented (with ongoing hardening opportunities)
> **Last Updated**: February 2026

## Delivered Behavior
- Authenticated users can create a challenge code and share a link/code.
- Opponents can join by code and play the same quiz set.
- Both players submit answers asynchronously.
- Results are revealed as win/loss/draw when both complete.
- Users can view active challenge + recent challenge history.
- Challenge W/L/D counters are persisted for authenticated users.

## Current Product Rules
- One active created challenge per user at a time.
- Challenges expire after 48 hours.
- Creator can revoke while challenge is still revocable by server rules.
- Challenge quiz returns `correctOptionIndex` pre-submit by product decision for immediate per-question UX.

## Implementation Surface
- Backend functions: `createChallenge`, `getChallenge`, `joinChallenge`, `submitChallengeAnswers`, `revokeChallenge`, `getUserChallenges`
- Client screens/components: `ChallengeScreen`, `ChallengeQuizScreen`, `ChallengeResultsScreen`, sharing modals
- Data model: `challenges` table + challenge stat columns on `users`

## Follow-up Improvements
1. Improve deep-link UX reliability and attribution.
2. Expand lifecycle observability (completion/expiry/revoke telemetry).
3. Add challenge-specific abuse throttling and anomaly detection.

# Feature: Challenge Mode

> Status: Implemented with ongoing hardening opportunities
> Last updated: username and social identity alignment

## Delivered Behavior

- Authenticated users can create a challenge code and share a link/code.
- Opponents can join by code and play the same quiz set.
- Both players submit answers asynchronously.
- Results are revealed as win/loss/draw when both complete.
- Users can view active challenge and recent challenge history.
- Challenge W/L/D counters are persisted for authenticated users.
- Challenge play uses the same refreshed `QuestionCard` gameplay UI as the daily quiz.
- Create/join/submit/history require a completed authenticated username
  identity.
- Clients do not choose participant names: the server verifies the bearer token,
  resolves current usernames from `users`, and returns compatibility aliases for
  older clients.
- Pre-username guest history remains explicitly labelled as legacy guest
  activity.

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
3. Add operational alerts and anomaly detection on top of the shipped
   database-backed challenge rate limits and structured logs.
4. Add notifications and richer historical challenge summaries when evidence
   supports them.

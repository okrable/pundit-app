# Feature: Challenge Mode

> Status: Implemented with ongoing hardening opportunities
> Last updated: username and social identity alignment

## Delivered Behavior

- Authenticated users can create a challenge code and share a link/code.
- Opponents can join by code and play the same quiz set.
- Both players submit answers asynchronously.
- Results are revealed as win/loss/draw when both complete.
- Users can view active challenge and recent challenge history.
- Shared links open a challenger preview and claim the opponent slot only when
  the recipient selects **Accept & Play**. Signed-out recipients resume the
  pending invitation after authentication and identity synchronization.
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

## Current Social Entry Points

- Challenge contains challenge creation, active-challenge actions, and
  six-character challenge-code entry only.
- League Tables exposes a labelled **Add Friends** action. Its Friends sheet
  supports reusable invite-link sharing, eight-character friend-code entry,
  and friendship management.
- Incoming friend and challenge links share one review flow with explicit
  loading, accepting, success, unavailable, and retry states.

## Follow-Up Improvements

1. Expand lifecycle observability beyond client debug events.
2. Add operational alerts and anomaly detection on top of the shipped
   database-backed challenge rate limits and structured logs.
3. Add notifications and richer historical challenge summaries when evidence
   supports them.

## App Store Universal Links Goal

The current native contract uses the registered custom scheme:

- `pundit-app://add-friend/{code}`
- `pundit-app://challenge/{code}`

Public `https://pundittrivia.com/f/*` and `/c/*` links continue to open the web
app. Before an iOS App Store launch, add Universal Links so those HTTPS links
open the installed app and retain the existing web fallback when it is absent.

That launch-readiness change must:

- enable the Associated Domains capability for `applinks:pundittrivia.com`;
- publish a valid `apple-app-site-association` file covering `/f/*` and `/c/*`;
- bind the final Apple Team ID and App Store bundle identifier;
- update signing and provisioning while preserving the custom scheme;
- validate installed-app cold/warm handoff, signed-out persistence, malformed
  links, and browser fallback.

This work is deliberately deferred until the final App Store identity, Apple
signing capability, and production-domain configuration are available.

# Feature: Users and Results Integration

> Status: Implemented
> Last updated: v1.1.0 documentation refresh

## Delivered

- Authenticated daily quiz submissions persist to the backend.
- User aggregates such as streak, best score, total score, and played-today state are maintained through stats endpoints.
- Leaderboards are driven from persisted authenticated result data.
- Duplicate authenticated quiz submission handling is idempotent.
- Guest daily results are local-only during guest play and migrate/adopt after login when no authenticated result already exists.
- Post-login reconciliation prevents stale guest in-progress quiz UI from flashing.

## Current Caveats

- Guest users do not receive long-term profile/social persistence before login.
- Time-based scoring is active; product copy and analytics should treat zero-timer correct answers as minimum-score answers.
- Abuse controls around submit endpoints remain a hardening priority.

# Feature: Users and Results Integration

> Status: Implemented
> Last updated: identity foundation and delivery reliability

## Delivered

- Authenticated daily quiz submissions persist to the backend.
- User aggregates such as streak, best score, total score, and played-today state are maintained through stats endpoints.
- Leaderboards are driven from persisted authenticated result data.
- Duplicate authenticated quiz submission handling is idempotent.
- Guest daily results are local-only during guest play and migrate/adopt after login when no authenticated result already exists.
- Post-login reconciliation prevents stale guest in-progress quiz UI from flashing.
- Authenticated persistence paths use the shared verified identity guard instead
  of creating partial user rows independently.
- Quiz and challenge submissions have persisted retry paths, and challenge
  completion replay is idempotent.

## Current Caveats

- Guest users do not receive long-term profile/social persistence before login.
- Time-based scoring is active; product copy and analytics should treat zero-timer correct answers as minimum-score answers.
- Submit endpoints use database-backed fixed-window rate limits; alerting and
  anomaly reporting remain operational follow-up work.

# Feature: Users + Results Integration

> **Status**: ✅ Implemented

## Delivered
- Authenticated quiz submissions persist to DB.
- User aggregates (streak, best score, totals) are maintained and returned via stats endpoints.
- Leaderboards are driven from persisted result data.
- Duplicate quiz submission handling is idempotent for authenticated flows.

## Current Caveats
- Guest users intentionally do not receive equivalent long-term persistence semantics.
- Time-based scoring is active; ensure client copy and analytics reflect this scoring model.
- Abuse controls around submit endpoints are the next hardening priority.

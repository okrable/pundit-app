# Challenge Mode Discussion Points

Current challenge mode is shipped. Future discussion should focus on hardening and product depth rather than initial implementation.

## Delivered UX Hardening

- Shared friend and challenge links now open a review flow instead of mutating
  immediately, persist across sign-in, and expose explicit processing and
  unavailable states.
- Challenge acceptance claims the opponent slot only when the recipient taps
  **Accept & Play**.

## Open Topics

- Deeper link attribution and server-side funnel reporting.
- App Store Universal Links for the public friend and challenge URLs. This is
  deferred until the final Apple Team ID, bundle identifier, Associated
  Domains entitlement, provisioning, and production association file can be
  configured and tested together.
- Challenge expiry/revoke messaging.
- Alert thresholds and anomaly detection on top of the existing
  database-backed challenge rate limits.
- Better operational reporting for created, joined, completed, expired, and
  revoked challenges.
- Historical challenge summaries and richer profile integration.

For current behavior, use `implementation-plan/features/challenge-mode/README.md`.

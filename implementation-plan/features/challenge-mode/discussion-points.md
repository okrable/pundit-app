# Challenge Mode Discussion Points

Challenge mode was retired in v2.8.0 because the current experience was not
compelling enough. Future discussion should start from a new product concept,
while the old implementation and historical data remain preserved as reference.

## Preserved Historical Work

- Shared friend and challenge links now open a review flow instead of mutating
  immediately, persist across sign-in, and expose explicit processing and
  unavailable states.
- Challenge acceptance claims the opponent slot only when the recipient taps
  **Accept & Play**.

## Future Redesign Topics

- Deeper link attribution and server-side funnel reporting.
- App Store Universal Links for the public friend and challenge URLs. This is
  deferred until the final Apple Team ID, bundle identifier, Associated
  Domains entitlement, provisioning, and production association file can be
  configured and tested together.
- Define a challenge loop that is appealing before reopening any API.
- Decide whether historical rows should contribute to a future experience.
- Define new notification, expiry, scoring, and profile contracts deliberately.

For current behavior, use `implementation-plan/features/challenge-mode/README.md`.

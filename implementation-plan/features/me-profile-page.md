# Feature: Me Profile Page

> Status: Implemented
> Last updated: v2.4.0 avatar personalisation

## Delivered

- Me tab supports authenticated and guest states.
- Authenticated users see a compact username header with an inline football
  streak indicator, a Best Score and challenge W-L-D row, and account actions.
- Guest users see conversion prompts and limited settings actions.
- Settings modal is accessible from the Me header.
- Authenticated profiles display the canonical username without editable
  display-name or username controls.
- Every authenticated profile has a persisted Pundit avatar. Tapping it opens
  the 58-avatar symbol-and-letter picker; Save remains disabled until the
  selection differs and applies only after server confirmation.
- The inline streak indicator uses the two-tone Microsoft Fluent Emoji flame:
  its original orange colours for active and at-risk streaks, and the identical
  silhouette in greys when no streak is active.
- Required username selection is an app-level gate before the Me screen or
  other authenticated navigation can render.
- Username onboarding previews the server-assigned random football symbol and
  lets the player choose any library avatar before username and avatar are
  confirmed atomically.
- Guest-only options, including clear daily quiz cache, are hidden for authenticated users.
- Login uses the centralized auth flow and shows `AuthSyncScreen` while reconciliation/prefetch runs.
- Completing a quiz publishes the projected post-play streak immediately; the
  authoritative submission result reconciles it in the background.

## Follow-Up

- Improve resilience with error boundaries around profile/settings surfaces.
- Continue UX refinement for first-time username validation and retry messaging.

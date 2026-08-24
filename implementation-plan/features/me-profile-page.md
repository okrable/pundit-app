# Feature: Me Profile Page

> Status: Implemented
> Last updated: v2.13.0 public player profiles

## Delivered

- Me tab supports authenticated and guest states.
- Authenticated users see a compact username header with an inline football
  streak indicator and account actions. The former Best Score and challenge
  W-L-D Stats section is no longer displayed.
- Guest users see conversion prompts and limited settings actions.
- Settings modal is accessible from the Me header.
- Authenticated profiles display the canonical username without editable
  display-name or username controls.
- Every authenticated profile has a persisted Pundit avatar. Tapping it opens
  the 58-avatar symbol-and-letter picker; Save remains disabled until the
  selection differs and applies only after server confirmation.
- The inline streak indicator uses the two-tone Microsoft Fluent Emoji flame:
  its original orange colours only when today's quiz has extended or confirmed
  the streak. An intact streak awaiting today's play keeps its count but uses
  the identical greyscale silhouette, as do inactive and not-started states.
- Required username selection is an app-level gate before the Me screen or
  other authenticated navigation can render.
- Username onboarding previews the server-assigned random football symbol and
  lets the player choose any library avatar before username and avatar are
  confirmed atomically.
- Guest-only options, including clear daily quiz cache, are hidden for authenticated users.
- Authenticated Me shows the eight-card achievement collection below the
  compact profile header. Earned badges sort newest-first, visible milestones
  show progress, and locked easter eggs retain mystery hints.
- Login uses the centralized auth flow and shows `AuthSyncScreen` while reconciliation/prefetch runs.
- Completing a quiz publishes the projected post-play streak immediately; the
  authoritative submission result reconciles it in the background.
- Other players see a separate public preview containing Daily Quiz aggregates
  and earned achievements only; Me-only settings, progress, locked achievements,
  identity claims, and contact fields are not part of that response.

## Follow-Up

- Improve resilience with error boundaries around profile/settings surfaces.
- Continue UX refinement for first-time username validation and retry messaging.

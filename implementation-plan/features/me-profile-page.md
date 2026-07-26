# Feature: Me Profile Page

> Status: Implemented
> Last updated: v2.1.1 streak icon polish

## Delivered

- Me tab supports authenticated and guest states.
- Authenticated users see a compact username header with an inline football
  streak indicator, a Best Score and challenge W-L-D row, and account actions.
- Guest users see conversion prompts and limited settings actions.
- Settings modal is accessible from the Me header.
- Authenticated profiles display the canonical username without editable
  display-name or username controls.
- The inline streak indicator uses the two-tone Microsoft Fluent Emoji flame:
  its original orange colours for active and at-risk streaks, and the identical
  silhouette in greys when no streak is active.
- Required username selection is an app-level gate before the Me screen or
  other authenticated navigation can render.
- Guest-only options, including clear daily quiz cache, are hidden for authenticated users.
- Login uses the centralized auth flow and shows `AuthSyncScreen` while reconciliation/prefetch runs.

## Follow-Up

- Improve resilience with error boundaries around profile/settings surfaces.
- Continue UX refinement for first-time username validation and retry messaging.

# Feature: Me Profile Page

> Status: Implemented
> Last updated: identity foundation and social backend alignment

## Delivered

- Me tab supports authenticated and guest states.
- Authenticated users see cached-first profile stats and account actions.
- Guest users see conversion prompts and limited settings actions.
- Settings modal is accessible from the Me header.
- Authenticated profiles expose the canonical server username alongside
  transitional editable display-name compatibility.
- Username prompt opens only when the authenticated profile explicitly requires it.
- Guest-only options, including clear daily quiz cache, are hidden for authenticated users.
- Login uses the centralized auth flow and shows `AuthSyncScreen` while reconciliation/prefetch runs.

## Follow-Up

- Improve resilience with error boundaries around profile/settings surfaces.
- Complete the v2.0.0 client activation: make post-signup username selection
  blocking, use `@username` on every public surface, remove editable
  display-name UI, and bump social caches.
- Continue UX refinement for username cooldown and validation messaging after
  activation.

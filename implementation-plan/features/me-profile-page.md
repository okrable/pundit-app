# Feature: "Me" Profile Page

> **Status**: ✅ Implemented
> **Created**: January 2026

## Overview

Replace the current "Settings" tab with a "Me" profile page. The Settings functionality moves into a modal accessed via a cog icon in the header. The "Me" page becomes a user-focused profile view that adapts based on authentication state.

---

## Current State

### Settings Tab Currently Contains:
1. Account section (login/logout with Auth0)
2. Stats section (streak, best score)
3. Support section (donation link)
4. About section
5. Guest options (clear quiz)

### Available User Data:
- **Authenticated**: `user.sub`, `user.email`, `user.name`, `user.picture` from Auth0
- **Guest**: Auto-generated `userId` (e.g., `guest_1705849200000_abc123`)
- **Stats**: `streak`, `bestScore` from userStats (currently placeholder data)

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Settings navigation | Modal with "Done" button in top-right to dismiss |
| Recent activity | Not needed for MVP |
| Weekly progress | Future enhancement, not MVP |
| Logged-out display | Only show account promotion - no stats |
| Profile picture | Use Auth0 picture (existing) |

---

## Proposed Design

### Tab Changes
| Before | After |
|--------|-------|
| Settings tab (cog icon) | Me tab (person icon) |
| Header: "Settings" | Header: "Me" with settings cog in top-right |

### "Me" Page - Logged Out State

**Goal**: Incentivize account creation (no stats shown)

**Layout**:
```
┌─────────────────────────────────────┐
│ [⚙️]                        Me      │  ← Header with cog button
├─────────────────────────────────────┤
│                                     │
│              ( 👤 )                 │  ← Generic avatar icon
│                                     │
│      "Create an account to         │
│       track your progress"         │
│                                     │
│  ┌─────────────────────────────────┐│
│  │    Create Free Account          ││  ← Primary CTA (accent color)
│  └─────────────────────────────────┘│
│                                     │
│       Already have an account?      │
│                                     │
│  ┌─────────────────────────────────┐│
│  │           Log In                ││  ← Secondary CTA (outline)
│  └─────────────────────────────────┘│
│                                     │
│   ✓ Track your streak              │
│   ✓ Compete on the leaderboard     │
│   ✓ Never lose your progress       │
│                                     │
└─────────────────────────────────────┘
```

### "Me" Page - Logged In State

**Layout**:
```
┌─────────────────────────────────────┐
│ [⚙️]                        Me      │  ← Header with cog button
├─────────────────────────────────────┤
│                                     │
│         [Profile Picture]           │  ← From Auth0
│          "Display Name"             │  ← From Auth0
│                                     │
│  ┌───────────┐    ┌───────────┐    │
│  │   🔥 5    │    │  ⭐ 5/5   │    │
│  │  Streak   │    │   Best    │    │
│  └───────────┘    └───────────┘    │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                     │
│   Streak Status:                    │
│   "You're on fire! 5 days in a row"│
│                                     │
│   "Play today to keep your streak" │
│                                     │
└─────────────────────────────────────┘
```

### Settings Modal

Accessed via cog icon in header. Dismissed via "Done" button in top-right.

**Layout**:
```
┌─────────────────────────────────────┐
│ Settings                     [Done] │
├─────────────────────────────────────┤
│                                     │
│  ACCOUNT (if logged in)             │
│  ┌─────────────────────────────────┐│
│  │ 👤  John Smith                  ││
│  │     john@example.com            ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Sign Out                        ││
│  └─────────────────────────────────┘│
│                                     │
│  SUPPORT                            │
│  ┌─────────────────────────────────┐│
│  │ Bug Reports & Feedback      →   ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Buy Me a Half Time Pie 🥧   →   ││
│  └─────────────────────────────────┘│
│                                     │
│  ABOUT                              │
│  ┌─────────────────────────────────┐│
│  │ Pundit Trivia v0.1              ││
│  │ Daily football quiz             ││
│  └─────────────────────────────────┘│
│                                     │
│  GUEST OPTIONS (if not logged in)   │
│  ┌─────────────────────────────────┐│
│  │ Clear Today's Quiz              ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

---

## Technical Approach

### Files to Create
- `app/screens/MeScreen.tsx` - New profile page with auth state handling
- `app/components/SettingsModal.tsx` - Modal with list-style settings

### Files to Modify
- `app/navigation/BottomTabNavigator.tsx` - Change tab from Settings to Me
- `app/types/index.ts` - Add any new types if needed

### Files to Delete/Deprecate
- `app/screens/SettingsScreen.tsx` - Content moves to MeScreen + SettingsModal

### State Changes
- No new state required - uses existing `useAuthStore` and `useQuizStore`

---

## Implementation Phases

### Phase 1: Basic Structure ✅
- [x] Create MeScreen with logged-in/logged-out conditional rendering
- [x] Create SettingsModal component
- [x] Update BottomTabNavigator (Settings → Me, cog → person icon)

### Phase 2: Logged-Out State ✅
- [x] Generic avatar placeholder
- [x] "Create Free Account" button (primary)
- [x] "Log In" button (secondary/outline)
- [x] Benefit list (checkmarks)
- [x] Wire up Auth0 flow

### Phase 3: Logged-In State ✅
- [x] Profile picture from Auth0 (with fallback)
- [x] Display name
- [x] Streak and best score stat cards
- [x] Streak status messaging

### Phase 4: Settings Modal ✅
- [x] Modal with "Done" dismiss button
- [x] Account section (name, email, sign out)
- [x] Support section (feedback link, donation)
- [x] About section
- [x] Guest options (clear quiz)

### Phase 5: Polish ✅
- [x] Modal slide-up animation (native pageSheet)
- [x] Loading states for auth actions
- [x] Error handling

---

## Dependencies

- Auth0 integration (existing)
- useAuthStore (existing)
- useQuizStore (existing)
- Theme system (existing)

---

## Notes

- Keep within "single-screen, no scroll" constraint
- Match existing theme (Gotham/UniSans fonts, coral/green colors)
- Settings modal can scroll if needed (it's supplementary)
- Accessibility: alt text for profile picture

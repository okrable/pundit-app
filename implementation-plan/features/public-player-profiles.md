# Feature: Public Player Profiles and Friend Requests

> Status: Implemented in v2.13.0

Leaderboard, existing-friend, and request rows open one root-level player
profile on web, iOS, and Android. Completed players expose only their username,
Pundit avatar, current Daily Quiz streak, best Daily score, total Daily plays,
and earned achievement IDs with unlock dates. Locked achievements, hints,
progress, source events, Auth0 claims, email, and other private content remain
outside the public response.

Public profile data is cached by target player for stale-first offline viewing.
Relationship state is never stored in that public cache: a verified account
revalidates `self`, `none`, outgoing/incoming pending, or friends state. Guests
may view profiles and can preserve the target through login, but must tap Add
Friend again after returning.

Migration 020 adds one pending request per ordered player pair. A duplicate send
is idempotent, a reciprocal send accepts atomically, and accept creates the
existing friendship before deleting the request. Decline and cancel delete the
request. Existing invite links continue to create friendships immediately and
also clear pending requests.

The account-scoped social store rejects late work after logout or account
change. The Friends manager presents incoming, sent, and existing sections;
unresolved incoming requests appear as a plain red dot on the League Tables
navigation destination and Add Friends action. The web hamburger and Friends
sheet title remain unbadged. Request state refreshes after verified login,
foreground resume, League Tables focus, and social mutations, while friendship
changes clear both Daily and Weekly Friends caches.

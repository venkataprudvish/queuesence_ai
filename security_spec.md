# QueueSense Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Isolation (`users/{userId}`, `user_preferences/{userId}`)**: A user profile or preferences document can only be read, created, or updated by the authenticated owner whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Ownership & Relational Integrity (`queue_sessions`, `queue_events`, `prediction_history`)**: Every session, event, and prediction document must carry a `userId` matching `request.auth.uid`. For `queue_events` and `prediction_history`, the referenced `sessionId` must exist in `/queue_sessions/$(incoming().sessionId)` and belong to `request.auth.uid`.
3. **Strict Key & Size Enforcement**: All strings have explicit `.size()` bounds, IDs match `^[a-zA-Z0-9_\-]+$`, and timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
4. **Secure List Queries**: Every `allow list` rule enforces `resource.data.userId == request.auth.uid` so no user can scrape another operator's sessions, events, or predictions.

## 2. The "Dirty Dozen" Payloads (Designed to Fail with PERMISSION_DENIED)
1. **Identity Spoofing on Session Create**: `userId` set to `"victim-uid-999"` while authenticated as `"attacker-uid-111"`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to create a `users/{userId}` document.
3. **Shadow Field Injection on Session Update**: Updating `queue_sessions/{id}` with an undeclared field `isAdminOverride: true`.
4. **Cross-Tenant PII Read**: Authenticated user `"user-A"` attempting `get` on `/users/user-B`.
5. **Blanket List Scraping**: Authenticated user running an unfiltered `list` query on `/queue_sessions` without `where('userId', '==', uid)`.
6. **ID Poisoning Attack**: Creating a document with a 500-character ID or special characters (`../admin`).
7. **Orphaned Queue Event**: Creating a `queue_events/{eventId}` referencing a non-existent `sessionId` or a `sessionId` owned by another user.
8. **Client Timestamp Forgery**: Creating a `queue_sessions` document with a backdated `createdAt` string instead of `request.time`.
9. **Immutable Field Mutation**: Updating `userId` or `createdAt` on an existing `queue_sessions` document.
10. **String Overflow (Denial of Wallet)**: Setting `title` to a 10,000-character string when `maxLength` is 140.
11. **Negative Queue Telemetry**: Creating a `QueueSession` with `maximumQueueLength: -5` or `durationSeconds: -10`.
12. **Invalid Enum Value**: Creating a `QueueEvent` with `eventType: "facial_recognition_scan"` (not in `['entry', 'service_exit', 'abandoned_exit']`).

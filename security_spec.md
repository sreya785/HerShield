# Security Specification & TDD Plan

## 1. Data Invariants
1. **Profile Isolation**: Student PII (`email`, `phone`, `commuteRoute`) is isolated in `/users/{userId}/private/contactInfo`, readable and writable only by the owning authenticated user or a verified Admin.
2. **Self-Role Escalation Prevention**: A user creating `/users/{userId}` can only set `role == 'student'` unless they are already a verified Admin.
3. **Contact Ownership**: Trusted contacts under `/users/{userId}/contacts/{contactId}` must have `ownerUid == request.auth.uid == userId` and bounded string lengths.
4. **Incident Integrity**: Every incident under `/incidents/{incidentId}` must have `reporterUid == request.auth.uid`, valid `id` matching `incidentId`, initial `status == 'Reported'`, valid `category` and `priority` enums, bounded `notifiedContactNames` list (`<= 10`), and server-verified `createdAt == request.time`.
5. **Status Update Separation & Terminal Locking**: Only verified Admins can update incident `status`, `assignedUnit`, and `responderNotes`. Once an incident reaches `Resolved`, non-admins cannot modify it.
6. **Verified Email Mandate**: All writes require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Incident Write**: Creating `/incidents/inc_1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating `/incidents/inc_2` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Admin Role Self-Assignment**: Creating `/users/u1` with `role: "admin"` as a regular student -> `PERMISSION_DENIED`.
4. **Spoofed Reporter UID**: Creating `/incidents/inc_3` with `reporterUid: "other_user"` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Creating `/incidents/inc_4` with extra key `isVerifiedBySystem: true` -> `PERMISSION_DENIED`.
6. **Non-Reported Initial Status**: Creating `/incidents/inc_5` with `status: "Resolved"` directly -> `PERMISSION_DENIED`.
7. **ID Poisoning Attack**: Creating `/incidents/../../bad$id` or 200-char ID -> `PERMISSION_DENIED`.
8. **1MB Description / Denial-of-Wallet**: Creating `/incidents/inc_6` with 50,000-char `description` -> `PERMISSION_DENIED`.
9. **Unbounded Contacts Array**: Creating `/incidents/inc_7` with 25 elements in `notifiedContactNames` -> `PERMISSION_DENIED`.
10. **PII Cross-User Read**: Reading `/users/victim_uid/private/contactInfo` as `attacker_uid` -> `PERMISSION_DENIED`.
11. **Student Status Escalation Update**: Updating `/incidents/inc_1` `status` to `"Resolved"` as the reporting student (non-admin) -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Creating `/incidents/inc_8` with backdated `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.

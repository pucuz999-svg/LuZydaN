# Security Specification (Phase 0 TDD)

## Data Invariants
1. A `UserProfile` at `/users/{userId}` can only be created by the verified authenticated user matching `userId == request.auth.uid`, with server timestamps (`request.time`) and non-admin users strictly forced to `status == 'pending'` and `role == 'user'`.
2. Only the verified administrator (`pucuz999@gmail.com` with `email_verified == true`) can update `status` (`pending` / `approved` / `blocked`) or `role`, or list all `/users` and `/activityLogs` documents.
3. Regular users can only read their own `/users/{uid}` document and their own `/activityLogs` entries; PII (`email`) is never readable across users.
4. `ActivityLog` documents at `/activityLogs/{logId}` are append-only (`update` and `delete` always denied), require an existing `/users/{request.auth.uid}` parent document, bind `userId` and `userEmail` to `request.auth`, and forbid non-admins from forging `admin_approve_user` or `admin_block_user` log actions.
5. `CatalogDevice` documents at `/catalogDevices/{deviceId}` can only be written or deleted by the verified admin (`pucuz999@gmail.com`).

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Approval on Signup**: Non-admin creates `/users/{uid}` with `status: 'approved'`.
2. **Self-Admin Role Escalation**: Non-admin creates `/users/{uid}` with `role: 'admin'`.
3. **UID Spoofing on Create**: User A creates `/users/{userB_uid}` with `uid: userA_uid` or `uid: userB_uid`.
4. **Email Spoofing**: Unverified token (`email_verified: false`) with `email: 'pucuz999@gmail.com'` attempts admin read/write.
5. **Status Update Bypass**: Non-admin updates own `/users/{uid}` changing `status` from `'pending'` to `'approved'`.
6. **Shadow Ghost Field Injection**: User creates or updates `/users/{uid}` with extra field `isSuperAdmin: true`.
7. **Timestamp Backdating**: User creates `/users/{uid}` with `createdAt` or `lastLoginAt` not equal to `request.time`.
8. **Cross-User PII Read**: Non-admin attempts `get(/users/{otherUid})` or unrestricted `list(/users)`.
9. **Cross-User Activity Forgery**: User A writes `/activityLogs/{id}` with `userId: userB_uid`.
10. **Admin Action Log Spoofing**: Non-admin creates `/activityLogs/{id}` with `action: 'admin_approve_user'`.
11. **Activity Log Tampering**: Any user attempts `update` or `delete` on `/activityLogs/{id}`.
12. **Catalog Poisoning / Oversized ID**: Non-admin writes `/catalogDevices/{id}` or injects a >128 char document ID.

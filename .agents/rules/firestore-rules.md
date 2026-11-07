# Firestore Security Rules Policy

1. **Mandatory Subagent Delegation**:
   - Whenever any task involves creating, authoring, auditing, or modifying Cloud Firestore Security Rules (`firestore.rules`), you MUST delegate the task to the `firestore-rules-author` specialist subagent using `invoke_subagent`.
   - Never write or overwrite `firestore.rules` directly from the main agent when the `firestore-rules-author` subagent is available.
   - Instruct the subagent to ensure production-grade security, run rule validation tests, and execute rule deployment via Firebase CLI (`firebase deploy --only firestore:rules`) when requested.

2. **Bundle Voucher Deletion Security Invariant**:
   - In `match /event_vouchers/{voucherDocId}`, `allow delete:` must permit both:
     a. Team access (`hasTeamAccess()`) for organizers and staff.
     b. Authenticated bundle purchasers (`isAuthenticated() && resource.data.purchaser_member_id == request.auth.uid`) deleting unused/unredeemed friend vouchers generated from their cancelled registration (`resource.data.times_used == 0`).

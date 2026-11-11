# Firestore Security Rules Policy & Multi-Agent Collaboration Workflow

1. **Mandatory Subagent Delegation**:
   - Whenever any task involves creating, authoring, auditing, or modifying Cloud Firestore Security Rules (`firestore.rules`), you MUST delegate the task to the `firestore-rules-author` specialist subagent using `invoke_subagent`.
   - Never write or overwrite `firestore.rules` directly from the main agent when the `firestore-rules-author` subagent is available.

2. **Multi-Agent Review, Optimization & Regression Pipeline**:
   - Whenever `firestore-rules-author` creates or adjusts `firestore.rules`, the change must be reviewed alongside `firestore-rules-optimizer`.
   - **`firestore-rules-optimizer` Review**:
     - Inspects the diff of `firestore.rules`.
     - Analyzes whether any existing features, server actions, client hooks, or queries in the codebase are impacted.
   - **Regression Flow (If features are impacted)**:
     - `firestore-rules-optimizer` invokes `qa-tester` to retest and perform regression testing on the impacted features.
     - `qa-tester` executes positive, negative, and edge test scenarios and relays granular execution steps and results to `qa-tester-lead`.
     - `qa-tester-lead` compiles an exhaustive Markdown test report detailing test cases, execution methodology, expected vs actual behavior, pass/fail status, regression log, and go/no-go recommendation before rules deployment.

3. **Bundle Voucher Deletion Security Invariant**:
   - In `match /event_vouchers/{voucherDocId}`, `allow delete:` must permit both:
     a. Team access (`hasTeamAccess()`) for organizers and staff.
     b. Authenticated bundle purchasers (`isAuthenticated() && resource.data.purchaser_member_id == request.auth.uid`) deleting unused/unredeemed friend vouchers generated from their cancelled registration (`resource.data.times_used == 0`).

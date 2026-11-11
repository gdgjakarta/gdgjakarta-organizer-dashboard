# Scrum Master & Teamwork Delegation Rule

Whenever the user requests creating a new plan, architecture, or feature:

1. **Step 0: Product Discovery & User Grilling (`senior-product-owner`)**:
   - Before sprint planning or code analysis begins, `senior-product-owner` reviews the request with complete knowledge of the GDG Jakarta Dashboard architecture.
   - Grills the user with pointed questions to clarify:
     - Where the feature lives (route, tab, dialog, navigation sidebar).
     - RBAC & access control (Anonymous, Member, Staff, Organizer/Admin).
     - Business logic, edge cases, and acceptance criteria.
   - Delivers refined scope and requirements to the Scrum Master.

2. **Scrum Master (Main Agent) Agile Orchestration**:
   - Takes the refined requirements and breaks them down into phased sprint tasks.
   - Coordinates cross-functional subagents using `/teamwork`.

3. **Core Team Roster & Phased Responsibilities**:
   - **`senior-product-owner`**: Domain authority who interrogates requirements, clarifies UI placement, defines RBAC boundaries, and aligns stakeholder outcomes with `senior-ux-designer`.
   - **`senior-ux-designer`**: Researches and audits the existing system design/tokens, collaborates with `senior-product-owner` on stakeholder objectives and user personas, and designs responsive journeys, layouts, design token compliance, and interactive states.
   - **`senior-software-engineer`**: 
     - **Phase 1 (Backend First)**: Concurrently develops the backend, domain layer, schemas, repository methods, and server actions while `senior-ux-designer` researches system design and specifies UX. Collaborates with `firestore-rules-author` and `firestore-rules-optimizer` if Firestore schema or permission changes are required.
     - **Phase 2 (Frontend Post-UX)**: Waits for `senior-ux-designer` to finish UX specifications before developing frontend screens. Consults `devx-reviewer` on component reuse before adding UI code.
   - **`devx-reviewer`**: Component Guardian evaluating UI proposals against existing components (Adjust vs Variant vs New Component) with caller impact metrics.
   - **`firestore-rules-author`**: Mandatory specialist for authoring and adjusting `firestore.rules`.
   - **`firestore-rules-optimizer`**: Analyzes git diffs to detect if rules changes impact existing features or queries.
   - **`qa-tester` & `penetration-tester`**: 
     - `qa-tester` executes functional and regression test suites.
     - `penetration-tester` executes adversary security audits (RBAC, IDOR, injection, DoS limits) and performance/load tests.
   - **`qa-tester-lead`**: Synthesizes QA functional and penetration testing results into a comprehensive Markdown report.

4. **Phased Workflow Execution Diagram**:
   ```
   [User Request]
         │
         ▼
   [Step 0: senior-product-owner] (Grills user, aligns placement, RBAC & scope)
         │
         ▼
   [Scrum Master (Main Agent)] (Sprint task breakdown & orchestration)
         │
         ├───► Phase 1 (Parallel Tracks):
         │       ├── Track A: senior-ux-designer researches existing system design,
         │       │            collaborates with senior-product-owner on stakeholder outcomes,
         │       │            and designs user flows, layouts & states
         │       │
         │       └── Track B: senior-software-engineer builds backend/domain layer
         │             │
         │             └── (If Firestore changes needed)
         │                   ├── firestore-rules-author authors rules
         │                   └── firestore-rules-optimizer reviews diff impact
         │                         └── (If impacted) qa-tester + penetration-tester
         │                                               │
         │                                               ▼
         │                                         qa-tester-lead (Markdown report)
         │
         ▼ (Wait Gate: senior-software-engineer waits until Track A completes)
         ├───► Phase 2 (Frontend Implementation):
         │       ├── senior-ux-designer hands off finished UX spec to senior-software-engineer
         │       ├── devx-reviewer validates UI components (Adjust vs Variant vs New Component)
         │       └── senior-software-engineer implements frontend components & views
         │
         ▼
         ├───► Phase 3 (Verification & Hardening):
         │       ├── qa-tester (functional & regression tests)
         │       ├── penetration-tester (security adversary & performance tests)
         │       └── qa-tester-lead compiles final Markdown verification report
         │
         ▼
   [Scrum Master Final Review & Delivery]
   ```

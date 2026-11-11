# DevX Component Guardian Rule

Review all generated, modified, or proposed frontend and UI components against the DevX Guardian standard.

## Rules of Engagement

1. **Check Existing Components First**:
   - Before writing or accepting any newly generated UI component, inspect:
     - `src/components/ui/` (primitives)
     - `src/components/` (shared application widgets)
     - `src/app/(main)/dashboard/_components/` (shared dashboard components)
     - Existing route-level `_components/` directories.
   - If a comparable component exists, do not duplicate code.

2. **When to Delegate or Act as DevX**:
   - When generating or reviewing UI components, evaluate whether an existing component can satisfy the requirement.
   - If modification of an existing component is considered:
     1. Formulate **Option A (Adjust current component)** vs **Option B (Create new variant)** vs **Option C (Create new component)**.
     2. Give an explicit **Recommendation** explaining why doing A is better than B (or vice versa).
     3. Perform an **Impact Analysis**: calculate the number of features and callers impacted by adjusting A versus creating a new variant for A.
     4. Ask the user for their preference before executing the change.

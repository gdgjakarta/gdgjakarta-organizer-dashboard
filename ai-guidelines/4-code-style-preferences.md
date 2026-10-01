# Code Style & Conventions

This guide documents the coding conventions, formatting standards, and development best practices required across the **GDG Jakarta Organizer Dashboard**.

---

## 1. Biome & Formatter Rules

This project enforces formatting through **Biome** (`biome.json`). Always follow these standards:

- **Indentation**: 2 spaces (no tabs).
- **Line Width**: 120 characters maximum.
- **Quotes**: Double quotes (`"`) for strings and JSX attributes.
- **Semicolons**: Always include semicolons (`;`).
- **Import Sorting**: Imports are organized into logical groups (external packages, internal `@/` aliases, relative paths, types).

Validate or fix formatting using:
```bash
npm run check
npm run check:fix
npm run format
```

---

## 2. TypeScript Strict Mode

TypeScript strict mode is enabled. Adhere strictly to the following rules:

1. **Zero `any`**: Never use `any`. Use precise interface definitions or `unknown` combined with type guards:
   ```typescript
   // ✅ PREFERRED
   function parsePayload(data: unknown): FirestoreRegistration {
     if (typeof data === "object" && data !== null && "id" in data) {
       return data as FirestoreRegistration;
     }
     throw new Error("Invalid registration format");
   }

   // ❌ PROHIBITED
   function parsePayload(data: any): any {
     return data;
   }
   ```
2. **Nullable Handling**: Use optional chaining (`?.`) and nullish coalescing (`??`) rather than non-null assertions (`!`).
3. **Discriminated Unions**: Prefer discriminated unions for action results and status flows:
   ```typescript
   export type ActionResult<T> = 
     | { success: true; data: T } 
     | { success: false; error: string; code?: string };
   ```

---

## 3. Import Aliases

Always use the root `@/` import alias. Never use long relative traversal paths (e.g. `../../../../components/ui/button`):

```typescript
// ✅ PREFERRED
import { Button } from "@/components/ui/button";
import { BEVY_CONFIG } from "@/config/bevy-config";
import { getFirestoreEvents } from "@/lib/firestore/client";

// ❌ AVOID
import { Button } from "../../../components/ui/button";
```

---

## 4. Error Handling & Notifications

1. **User Feedback with Sonner**:
   - Provide visual feedback for asynchronous operations using `toast.success()` and `toast.error()` from `sonner`:
   ```typescript
   import { toast } from "sonner";

   try {
     await checkInAttendeeAction(attendeeId);
     toast.success("Attendee successfully checked in!");
   } catch (error) {
     const message = error instanceof Error ? error.message : "Failed to check in attendee.";
     toast.error(message);
   }
   ```
2. **Server Action Errors**:
   - Server actions must catch unexpected exceptions, log them with descriptive context tags (e.g., `[Bevy API Error]`), and return structured error objects rather than letting raw server errors bubble up unhandled to RSC flights.

---

## 5. Comment Preservation

- Preserve all existing comments, docstrings, and context explanations when modifying files.
- When fixing an issue or refactoring, provide clear inline context for non-obvious design decisions.

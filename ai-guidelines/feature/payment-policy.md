# Payment Policy CMS Feature Guide

The **Payment Policy Content Management System** enables GDG Jakarta organizers to dynamically update, curate, reorder, and configure policy guidelines, commitment fee notices, merchandise distribution terms, anti-fraud warning banners, and verified communication channels published on the public website.

---

## 🏛️ Architecture & Data Layer

1. **Firestore Persistence**:
   - Stored in document: `content_settings/payment_policy`.
   - Security enforced in `firestore.rules`:
     - Public read (`allow read: if true;`).
     - Write restricted to organizers and core team members with schema validation (`isValidContentSettings` ensuring strict bounds on `header`, `notice`, `sections`, `channels`, and `contact`).
2. **Real-time Synchronization & Cache**:
   - Managed via `usePaymentPolicyContent` in `src/lib/content/hooks.ts`.
   - Seeded with default copy in `DEFAULT_PAYMENT_POLICY_CONTENT` (`src/lib/content/defaults.ts`) to prevent layout shifts or empty states prior to initial save.
   - LocalStorage cache key: `gdg_payment_policy_content_cache`.
   - Server revalidation triggers: `/payment-policy`, `/faq`, and `/dashboard/faq`.

---

## 🛠️ Dashboard Management (`/dashboard/faq`)

Organizers configure the policy directly within the **FAQ & Policy** screen under the **Payment Policy Page** tab:

- **Header & Meta**: Page badge, main heading, and intro description.
- **Anti-Fraud Verification Alert**: Prominent callout banner with toggle switch.
- **Structured Policy Sections**: Add, edit, remove, reorder (up/down), and toggle publication of sections. Includes optional alert callouts (Warning, Destructive, Info, Success).
- **Communication Channels & Verification**: Official contact email, Instagram link, and verification help desk box.
- **Dirty State & Safeguards**: Monitored by `FloatingSaveBar` and `useUnsavedChanges` to prevent accidental navigation loss.

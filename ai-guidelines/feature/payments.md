# Transactions & QRIS Payments Feature Guide

## 1. Overview & Purpose
The **Transactions & QRIS Payments** module (`/dashboard/payments`) provides GDG Jakarta organizers with a real-time, unified audit log of incoming DOKU QRIS payments, webhook notifications, and operational email dispatch statuses.

Key Capabilities:
- Real-time ingestion and storage of payment webhook events in Firestore collection `payment_transactions`.
- Operational email dispatch tracking (`email_status`: `"sent" | "not_sent" | "failed" | "pending"`), displaying whether the transaction notification was delivered to `payment@gdgjakarta.org`.
- KPI summary meters: Total Revenue (Rp), Total Transactions, Paid Conversion Rate, and Email Notification Dispatch Rate.
- Multi-parameter search across invoice numbers, customer names, emails, phone numbers, and banking issuers.
- Detailed transaction inspection dialog (`TransactionDetailDialog`) with collapsible raw payload JSON viewer.

---

## 2. Architecture & File Structure

- **Navigation**: `src/navigation/sidebar/sidebar-items.ts` (`id: "transactions"`, group 5 `Payment (DOKU)`).
- **Route**: `src/app/(main)/dashboard/payments/page.tsx` (Server Component protected by `isAuthorizedOrganizerSession`).
- **Dashboard View**: `src/app/(main)/dashboard/payments/_components/payment-transactions-dashboard.tsx`.
- **Detail Modal**: `src/app/(main)/dashboard/payments/_components/transaction-detail-dialog.tsx`.
- **API Webhook Handler**: `src/app/api/webhooks/payment/route.ts` (Validates `PAYMENT_WEBHOOK_SECRET` / `N8N_WEBHOOK_API_KEY`).
- **Data Layer & Server Actions**:
  - `src/server/firestore-admin.ts`: `recordPaymentTransaction()` & `getPaymentTransactionsServer()`.
  - `src/server/payment-actions.ts`: `getPaymentTransactionsAction()`.
  - `src/lib/firestore/types.ts`: `PaymentTransactionRecord`.

---

## 3. Data Model (`PaymentTransactionRecord`)

```typescript
export interface PaymentTransactionRecord {
  id: string; // Document ID: invoiceNumber e.g. "INV-1784377198342"
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  amount: number;
  issuer?: string | null; // e.g. "Krom Bank", "BCA", "GoPay"
  payment_channel?: string | null; // e.g. "QRIS"
  payment_status: "paid" | "pending" | "failed" | "expired" | "refunded" | string;
  email_status: "sent" | "not_sent" | "failed" | "pending";
  email_recipient?: string | null; // e.g. "payment@gdgjakarta.org"
  email_sent_at?: string | null;
  transaction_date: string;
  source_type?: "registration" | "merchandise_order" | "direct_webhook";
  event_id?: string | null;
  registration_id?: string | null;
  order_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
```

---

## 4. n8n QRIS Listener Workflow Mapping

The n8n listener workflow refactors generic node identifiers into self-documenting names:
1. `DOKU Payment Webhook` (`POST /payment/doku/notifications`)
2. `Wait 15s Delay` (15-second grace period)
3. `Check Duplicate Invoice` (Checks if invoice exists in n8n data table `qris-doku-payment-data`)
4. `Save Payment to Data Table` (Upserts transaction row)
5. `Send Internal Payment Email` (Dispatches HTML payment notice to `payment@gdgjakarta.org`)
6. `Prepare Sub-workflow Payload` (Sets `headers`, `body`, and attaches `email_status: "sent"`)
7. `Trigger Dashboard Sync Workflow` (Executes sub-workflow `7YIxfdlcLKo65N6a` calling `/api/webhooks/payment`)

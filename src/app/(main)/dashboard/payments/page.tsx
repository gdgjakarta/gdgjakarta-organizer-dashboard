import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getPaymentTransactionsServer } from "@/server/firestore-admin";

import { PaymentTransactionsDashboard } from "./_components/payment-transactions-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transactions & QRIS Payments | GDG Jakarta",
  description:
    "Monitor real-time incoming DOKU QRIS payments, attendee transactions, and operational email dispatch status.",
};

export default async function PaymentsDashboardPage() {
  const isAuthorized = await isAuthorizedOrganizerSession();
  if (!isAuthorized) {
    redirect("/dashboard/organizer");
  }

  const transactions = await getPaymentTransactionsServer();

  return <PaymentTransactionsDashboard initialTransactions={transactions} />;
}

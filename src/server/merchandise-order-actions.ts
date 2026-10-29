"use server";

import { z } from "zod";

import { normalizeMerchandiseOrder } from "@/lib/firestore/normalization";
import type { MerchandiseOrderStatusLog } from "@/lib/firestore/types";
import { getAuthenticatedSessionUser, isAuthorizedOrganizerSession } from "@/server/auth-guard";
import {
  deleteFirestoreDoc,
  findMerchandiseOrderDoc,
  getFirestoreDoc,
  patchFirestoreDoc,
  updateMerchandiseOrderFromPayment,
} from "@/server/firestore-admin";
import {
  cancelPaymentLinkAction,
  checkDokuPaymentStatusInternal,
  generatePaymentLinkAction,
} from "@/server/payment-actions";
import { revalidateDashboardPath } from "@/server/server-actions";

const orderItemSchema = z.object({
  merchandise_id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  selected_variations: z.record(z.string(), z.string()).optional(),
  image_url: z.string().optional(),
  bundle_id: z.string().optional(),
  bundle_name: z.string().optional(),
});

const createOrderSchema = z.object({
  eventId: z.string().min(1),
  eventTitle: z.string().min(1),
  customer: z.object({
    name: z.string().min(1, "Customer name is required"),
    email: z.string().email("Valid customer email is required"),
    phone: z.string().min(1, "Customer phone is required"),
    registration_id: z.string().nullable().optional(),
    attendee_code: z.string().nullable().optional(),
    bevy_attendee_id: z.number().nullable().optional(),
    is_imported_attendee: z.boolean().default(false),
  }),
  saleType: z.enum(["item", "bundle"]).default("item"),
  bundleId: z.string().nullable().optional(),
  bundleName: z.string().nullable().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().min(0),
  feeAmount: z.number().min(0).default(0),
  feeLabel: z.string().optional(),
  totalAmount: z.number().min(0),
  paymentMethod: z.enum(["qris", "cash_manual"]).default("qris"),
  markCollectedNow: z.boolean().default(false),
  notes: z.string().optional(),
  headerEmailUrl: z.string().optional(),
  paymentDeadlineMinutes: z.number().int().positive().optional().default(60),
  sendEmail: z.boolean().default(true),
  isProduction: z.boolean().optional(),
  actorName: z.string().optional(),
  actorId: z.string().optional(),
  authToken: z.string().optional(),
});

export type CreateOnTheSpotOrderInput = z.input<typeof createOrderSchema>;

/**
 * Server Action: Creates a new on-the-spot merchandise order.
 * Either generates a DOKU QRIS link or marks directly as paid via cash/manual handover.
 */
export async function createOnTheSpotMerchandiseOrderAction(input: CreateOnTheSpotOrderInput) {
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    return { success: false, error: "Unauthorized: Organizer access required to sell merchandise on the spot." };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  // If a fresh ID token is provided by client, refresh session cookie to avoid stale bearer tokens
  if (data.authToken) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.set("auth_token", data.authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    } catch {
      // non-fatal
    }
  }

  const sessionUser = await getAuthenticatedSessionUser();
  const actorName = data.actorName?.trim() || sessionUser?.name || "Event Organizer";
  const actorId = data.actorId?.trim() || sessionUser?.id || "organizer";

  const now = new Date().toISOString();
  const orderId = `OTS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const shortDate = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `OTS-${shortDate}-${randomSuffix}`;

  const cleanEmail = data.customer.email.toLowerCase().trim();
  let formattedPhone = data.customer.phone.trim().replace(/[\s-]/g, "");
  if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1);
  if (formattedPhone.startsWith("0")) formattedPhone = `62${formattedPhone.slice(1)}`;

  const initialLog: MerchandiseOrderStatusLog = {
    id: `log_${Date.now()}_created`,
    action: "order_created",
    timestamp: now,
    actor_id: actorId,
    actor_name: actorName,
    notes:
      data.paymentMethod === "cash_manual"
        ? "Order created and paid via Cash / Direct Handover."
        : "Order created. DOKU QRIS checkout initiated.",
  };

  const statusLogs: MerchandiseOrderStatusLog[] = [initialLog];

  if (data.markCollectedNow) {
    statusLogs.push({
      id: `log_${Date.now()}_collected`,
      action: "merchandise_collected",
      timestamp: now,
      actor_id: actorId,
      actor_name: actorName,
      notes: "Merchandise handed over and marked as collected on the spot.",
    });
  }

  if (data.paymentMethod === "cash_manual") {
    // Immediate paid status
    const orderDocPayload: Record<string, unknown> = {
      id: orderId,
      order_number: orderNumber,
      event_id: data.eventId,
      event_title: data.eventTitle,
      order_type: "on_the_spot",
      sale_type: data.saleType,
      bundle_id: data.bundleId || null,
      bundle_name: data.bundleName || null,
      customer: {
        ...data.customer,
        email: cleanEmail,
        phone: formattedPhone,
      },
      items: data.items,
      subtotal: data.subtotal,
      fee_amount: data.feeAmount,
      fee_label: data.feeLabel || undefined,
      total_amount: data.totalAmount,
      payment_method: "cash_manual",
      payment_status: "paid",
      collection_status: data.markCollectedNow ? "collected" : "uncollected",
      collected_at: data.markCollectedNow ? now : null,
      collected_by_name: data.markCollectedNow ? actorName : null,
      collected_by_id: data.markCollectedNow ? actorId : null,
      payment_channel: "Cash / Manual",
      paid_at: now,
      status_logs: statusLogs,
      created_at: now,
      updated_at: now,
      created_by_id: actorId,
      created_by_name: actorName,
      notes: data.notes || null,
    };

    const saved = await patchFirestoreDoc("event_merchandise_orders", orderId, orderDocPayload, true, data.authToken);
    if (!saved) {
      return { success: false, error: "Failed to save merchandise order to Firestore." };
    }

    void revalidateDashboardPath(`/dashboard/events/${data.eventId}`).catch(() => undefined);
    void revalidateDashboardPath("/dashboard/member/purchases").catch(() => undefined);

    return {
      success: true,
      orderId,
      orderNumber,
      isPaid: true,
      collectionStatus: data.markCollectedNow ? "collected" : "uncollected",
    };
  }

  // QRIS Flow via n8n and DOKU
  // Resolve payment environment
  let isProduction = data.isProduction;
  if (isProduction === undefined) {
    try {
      const eventDoc = await getFirestoreDoc("events", data.eventId);
      if (eventDoc?.payment_environment === "production") isProduction = true;
      else if (eventDoc?.payment_environment === "sandbox") isProduction = false;
      else if (eventDoc?.is_test !== undefined) isProduction = !eventDoc.is_test;
    } catch {
      // default
    }
  }
  if (isProduction === undefined) isProduction = true;

  // Format DOKU line items
  const dokuItems = data.items.map((it) => {
    const varText = it.selected_variations ? Object.values(it.selected_variations).filter(Boolean).join(", ") : "";
    const name = varText ? `${it.name} (${varText})` : it.name;
    return {
      id: it.merchandise_id,
      name,
      quantity: it.quantity,
      price: it.price,
      imageUrl: it.image_url,
      type: "Merchandise",
    };
  });

  const fees =
    data.feeAmount > 0
      ? [
          {
            label: data.feeLabel || "Payment Gateway Fee",
            type: "fixed" as const,
            value: data.feeAmount,
          },
        ]
      : [];

  const paymentLinkRes = await generatePaymentLinkAction({
    customer: {
      name: data.customer.name,
      email: cleanEmail,
      phone: formattedPhone,
    },
    event: {
      id: data.eventId,
      title: data.eventTitle,
      headerEmailUrl: data.headerEmailUrl,
      paymentDeadlineMinutes: data.paymentDeadlineMinutes || 60,
    },
    items: dokuItems,
    fees,
    payment: {
      paymentMethodTypes: ["QRIS"],
      sendEmail: data.sendEmail,
      emailTemplate: "Merchandise On The Spot",
    },
    referenceId: orderId,
    isProduction,
  });

  if (!paymentLinkRes.success || !paymentLinkRes.paymentUrl) {
    return {
      success: false,
      error: paymentLinkRes.error || "Failed to generate DOKU QRIS payment link via n8n.",
    };
  }

  const orderDocPayload: Record<string, unknown> = {
    id: orderId,
    order_number: orderNumber,
    event_id: data.eventId,
    event_title: data.eventTitle,
    order_type: "on_the_spot",
    sale_type: data.saleType,
    bundle_id: data.bundleId || null,
    bundle_name: data.bundleName || null,
    customer: {
      ...data.customer,
      email: cleanEmail,
      phone: formattedPhone,
    },
    items: data.items,
    subtotal: data.subtotal,
    fee_amount: data.feeAmount,
    fee_label: data.feeLabel || undefined,
    total_amount: data.totalAmount,
    payment_method: "qris",
    payment_status: "waiting_for_payment",
    collection_status: data.markCollectedNow ? "collected" : "uncollected",
    collected_at: data.markCollectedNow ? now : null,
    collected_by_name: data.markCollectedNow ? actorName : null,
    collected_by_id: data.markCollectedNow ? actorId : null,
    payment_url: paymentLinkRes.paymentUrl,
    payment_invoice_number: paymentLinkRes.invoiceNumber || null,
    payment_channel: "QRIS",
    status_logs: statusLogs,
    created_at: now,
    updated_at: now,
    created_by_id: actorId,
    created_by_name: actorName,
    notes: data.notes || null,
  };

  const saved = await patchFirestoreDoc("event_merchandise_orders", orderId, orderDocPayload, true, data.authToken);
  if (!saved) {
    return { success: false, error: "Payment link generated but failed to save order to Firestore." };
  }

  void revalidateDashboardPath(`/dashboard/events/${data.eventId}`).catch(() => undefined);
  void revalidateDashboardPath("/dashboard/member/purchases").catch(() => undefined);

  return {
    success: true,
    orderId,
    orderNumber,
    paymentUrl: paymentLinkRes.paymentUrl,
    invoiceNumber: paymentLinkRes.invoiceNumber || orderNumber,
    amount: paymentLinkRes.amount ?? data.totalAmount,
    expiredDatetime: paymentLinkRes.expiredDatetime,
  };
}

/**
 * Server Action: Checks payment status for an on-the-spot merchandise order.
 * Queries DOKU Status API directly and reconciles Firestore order if paid.
 */
export async function checkOnTheSpotPaymentStatusAction(orderId: string, invoiceNumber?: string, token?: string) {
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    return { success: false, error: "Unauthorized: Organizer access required to check payment status." };
  }

  const cleanOrderId = (orderId || "").trim();
  const cleanInvoice = (invoiceNumber || "").trim();
  if (!cleanOrderId && !cleanInvoice) {
    return { success: false, error: "Order ID or invoice number is required." };
  }

  let orderDoc = await findMerchandiseOrderDoc(cleanOrderId || cleanInvoice);
  if (!orderDoc && cleanInvoice) {
    orderDoc = await findMerchandiseOrderDoc(cleanInvoice);
  }

  if (!orderDoc) {
    return { success: false, error: "Merchandise order not found." };
  }

  const order = orderDoc.data;
  if (order.payment_status === "paid") {
    return {
      success: true,
      isPaid: true,
      order,
      message: "Order has already been confirmed as paid.",
    };
  }

  const targetInvoice = order.payment_invoice_number || cleanInvoice || order.order_number;
  if (!targetInvoice) {
    return { success: false, error: "No invoice number associated with this order." };
  }

  // Check with DOKU Status internal
  const statusRes = await checkDokuPaymentStatusInternal(
    {
      invoiceNumber: targetInvoice,
      eventId: order.event_id,
    },
    true,
  );

  if (!statusRes.success) {
    return {
      success: false,
      isPaid: false,
      error: statusRes.error || "Failed to query DOKU payment status.",
      dokuStatus: statusRes.dokuStatus,
    };
  }

  if (statusRes.isPaid) {
    const reconcileRes = await updateMerchandiseOrderFromPayment(
      {
        invoiceNumber: targetInvoice,
        orderId: order.id,
        amount: order.total_amount,
        paymentChannel: "QRIS",
        isTeamAccess: true,
      },
      token,
    );

    try {
      await revalidateDashboardPath(`/dashboard/events/${order.event_id}`);
      await revalidateDashboardPath("/dashboard/member/purchases");
    } catch {
      // Ignore
    }

    return {
      success: true,
      isPaid: true,
      order: reconcileRes.order ?? { ...order, payment_status: "paid" },
      message: "Payment successfully verified! Marked as paid.",
    };
  }

  return {
    success: true,
    isPaid: false,
    dokuStatus: statusRes.dokuStatus,
    message: statusRes.message || "Payment is still pending on DOKU QRIS.",
  };
}

/**
 * Server Action: Manually marks an on-the-spot merchandise order as collected or uncollected.
 */
export async function updateMerchandiseOrderCollectionStatusAction(
  orderId: string,
  isCollected: boolean,
  notes?: string,
  actor?: { id?: string; name?: string },
  token?: string,
) {
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    return { success: false, error: "Unauthorized: Organizer access required to update collection status." };
  }

  const sessionUser = await getAuthenticatedSessionUser();
  const actorName = actor?.name?.trim() || sessionUser?.name || "Event Organizer";
  const actorId = actor?.id?.trim() || sessionUser?.id || "organizer";

  const orderDoc = await getFirestoreDoc("event_merchandise_orders", orderId, token);
  if (!orderDoc) {
    return { success: false, error: `Order ${orderId} not found.` };
  }

  const existing = normalizeMerchandiseOrder(orderDoc, orderId);
  const now = new Date().toISOString();
  const nextStatus = isCollected ? "collected" : "uncollected";

  const existingLogs = Array.isArray(existing.status_logs) ? existing.status_logs : [];
  const nextLogs = [...existingLogs];

  if (isCollected) {
    nextLogs.push({
      id: `log_${Date.now()}_collection`,
      action: "merchandise_collected",
      timestamp: now,
      actor_id: actorId,
      actor_name: actorName,
      notes: notes || "Merchandise handed over and marked as collected on the spot.",
    });
  } else {
    nextLogs.push({
      id: `log_${Date.now()}_uncollected`,
      action: "merchandise_uncollected",
      timestamp: now,
      actor_id: actorId,
      actor_name: actorName,
      notes: notes || "Merchandise marked as uncollected.",
    });
  }

  const patchPayload = {
    collection_status: nextStatus,
    collected_at: isCollected ? now : null,
    collected_by_name: isCollected ? actorName : null,
    collected_by_id: isCollected ? actorId : null,
    status_logs: nextLogs,
    updated_at: now,
  };

  const success = await patchFirestoreDoc("event_merchandise_orders", orderId, patchPayload, true, token);
  if (!success) {
    return { success: false, error: "Failed to update collection status." };
  }

  try {
    await revalidateDashboardPath(`/dashboard/events/${existing.event_id}`);
    await revalidateDashboardPath("/dashboard/member/purchases");
  } catch {
    // Ignore
  }

  return { success: true };
}

/**
 * Server Action: Cancels an on-the-spot order (pending or paid).
 * If the order was paid, setting status to 'cancelled' automatically removes it
 * from the sold metrics and restores merchandise inventory stock.
 */
export async function cancelOnTheSpotOrderAction(
  orderId: string,
  reason?: string,
  actor?: { id?: string; name?: string },
  token?: string,
) {
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    return { success: false, error: "Unauthorized: Organizer access required to cancel order." };
  }

  const sessionUser = await getAuthenticatedSessionUser();
  const actorName = actor?.name?.trim() || sessionUser?.name || "Event Organizer";
  const actorId = actor?.id?.trim() || sessionUser?.id || "organizer";

  const orderDoc = await getFirestoreDoc("event_merchandise_orders", orderId, token);
  if (!orderDoc) {
    return { success: false, error: `Order ${orderId} not found.` };
  }

  const existing = normalizeMerchandiseOrder(orderDoc, orderId);
  const isPaid = existing.payment_status === "paid";

  const now = new Date().toISOString();
  const existingLogs = Array.isArray(existing.status_logs) ? existing.status_logs : [];
  const logEntry: MerchandiseOrderStatusLog = {
    id: `log_${Date.now()}_cancelled`,
    action: "order_cancelled",
    timestamp: now,
    actor_id: actorId,
    actor_name: actorName,
    notes:
      reason ||
      (isPaid
        ? "Order cancelled by organizer at venue (items returned / refunded). Stock restored."
        : "Order cancelled by organizer."),
  };

  // If the order was awaiting payment on DOKU QRIS, cancel the active payment link
  if (
    !isPaid &&
    existing.payment_status !== "cancelled" &&
    (existing.payment_url || existing.payment_method === "qris" || existing.payment_invoice_number)
  ) {
    const targetInvoice = existing.payment_invoice_number || existing.order_number;
    if (targetInvoice) {
      try {
        console.log(
          `[cancelOnTheSpotOrderAction] Cancelling active DOKU payment link for order ${orderId} (Invoice: ${targetInvoice})...`,
        );
        void cancelPaymentLinkAction({
          invoiceNumber: targetInvoice,
          reason: reason || "On-the-spot merchandise order cancelled by organizer",
          customer: {
            name: existing.customer.name,
            email: existing.customer.email,
            phone: existing.customer.phone,
          },
          event: {
            id: existing.event_id,
            title: existing.event_title,
          },
          referenceId: orderId,
        }).catch((err) => {
          console.warn("[cancelOnTheSpotOrderAction] Error cancelling DOKU payment link:", err);
        });
      } catch (cancelErr) {
        console.warn("[cancelOnTheSpotOrderAction] Failed to trigger cancelPaymentLinkAction:", cancelErr);
      }
    }
  }

  const patchPayload = {
    payment_status: "cancelled",
    status_logs: [...existingLogs, logEntry],
    updated_at: now,
  };

  const success = await patchFirestoreDoc("event_merchandise_orders", orderId, patchPayload, true, token);
  if (!success) {
    return { success: false, error: "Failed to cancel order." };
  }

  void revalidateDashboardPath(`/dashboard/events/${existing.event_id}`).catch(() => undefined);
  void revalidateDashboardPath("/dashboard/member/purchases").catch(() => undefined);

  return { success: true };
}

/**
 * Server Action: Permanently removes a customer's on-the-spot merchandise order from the list.
 * If the order was in 'paid' status, removing it decreases the units sold and restores inventory stock.
 * If the order has an active DOKU payment link (unpaid), calls cancelPaymentLinkAction to invalidate the payment link.
 */
export async function deleteOnTheSpotOrderAction(orderId: string, eventId?: string) {
  const isOrganizer = await isAuthorizedOrganizerSession();
  if (!isOrganizer) {
    return { success: false, error: "Unauthorized: Organizer access required to remove customer order." };
  }

  const cleanOrderId = (orderId || "").trim();
  if (!cleanOrderId) {
    return { success: false, error: "Order ID is required." };
  }

  const orderDoc = await getFirestoreDoc("event_merchandise_orders", cleanOrderId);
  const existing = orderDoc ? normalizeMerchandiseOrder(orderDoc, cleanOrderId) : null;
  const targetEventId = eventId || existing?.event_id;

  // If the order has an active DOKU payment link (not yet paid / cancelled), cancel it on DOKU/n8n
  let cancelledPaymentLink = false;
  if (
    existing &&
    existing.payment_status !== "paid" &&
    existing.payment_status !== "cancelled" &&
    (existing.payment_url || existing.payment_method === "qris" || existing.payment_invoice_number)
  ) {
    const targetInvoice = existing.payment_invoice_number || existing.order_number;
    if (targetInvoice) {
      try {
        console.log(
          `[deleteOnTheSpotOrderAction] Cancelling active DOKU payment link for order ${cleanOrderId} (Invoice: ${targetInvoice})...`,
        );
        const cancelRes = await cancelPaymentLinkAction({
          invoiceNumber: targetInvoice,
          reason: "Customer order removed from on-the-spot list by organizer",
          customer: {
            name: existing.customer.name,
            email: existing.customer.email,
            phone: existing.customer.phone,
          },
          event: {
            id: targetEventId,
            title: existing.event_title,
          },
          referenceId: cleanOrderId,
        });

        if (cancelRes.success) {
          cancelledPaymentLink = true;
          console.log(
            "[deleteOnTheSpotOrderAction] Successfully cancelled DOKU payment link:",
            cancelRes.invoiceNumber,
          );
        } else {
          console.warn("[deleteOnTheSpotOrderAction] DOKU cancellation warning:", cancelRes.error);
        }
      } catch (cancelErr) {
        console.warn("[deleteOnTheSpotOrderAction] Failed to trigger cancelPaymentLinkAction:", cancelErr);
      }
    }
  }

  const deleted = await deleteFirestoreDoc("event_merchandise_orders", cleanOrderId);
  if (!deleted) {
    return { success: false, error: "Failed to delete merchandise order from Firestore." };
  }

  if (targetEventId) {
    void revalidateDashboardPath(`/dashboard/events/${targetEventId}`).catch(() => undefined);
  }
  void revalidateDashboardPath("/dashboard/member/purchases").catch(() => undefined);

  return {
    success: true,
    orderId: cleanOrderId,
    deletedOrder: existing,
    cancelledPaymentLink,
  };
}

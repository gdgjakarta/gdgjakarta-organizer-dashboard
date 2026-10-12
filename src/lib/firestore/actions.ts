"use client";

import { revalidateDashboardPath } from "@/server/server-actions";

import type { FirestoreEvent, FirestoreRegistration, RegistrationStatus } from "./types";

/**
 * Triggers a full sync from Bevy into Firestore on the client.
 */
export async function triggerSyncAction() {
  const { syncAllBevyData } = await import("./sync-service");
  const result = await syncAllBevyData();
  await revalidateDashboardPath("/dashboard/organizer");
  await revalidateDashboardPath("/dashboard/events");
  await revalidateDashboardPath("/dashboard/members");
  return result;
}

/**
 * Triggers events-only sync on the client.
 */
export async function triggerEventsSyncAction() {
  const { syncBevyEventsToFirestore } = await import("./sync-service");
  const result = await syncBevyEventsToFirestore();
  await revalidateDashboardPath("/dashboard/events");
  return result;
}

/**
 * Triggers members-only sync on the client.
 */
export async function triggerMembersSyncAction() {
  const { syncBevyMembersToFirestore } = await import("./sync-service");
  const result = await syncBevyMembersToFirestore();
  await revalidateDashboardPath("/dashboard/members");
  return result;
}

/**
 * Fetch registrations for an event.
 */
export async function fetchEventRegistrationsAction(eventId: string) {
  const { getEventRegistrations } = await import("./client");
  return await getEventRegistrations(eventId);
}

/**
 * Check if a specific member/email is registered for an event.
 */
export async function checkEventRegistrationAction(eventId: string, memberId?: string, email?: string) {
  const { checkExistingRegistration } = await import("./client");
  return await checkExistingRegistration(eventId, memberId, email);
}

/**
 * Fetch registrations for a specific member by ID or email.
 */
export async function fetchMemberRegistrationsAction(memberId?: string, email?: string) {
  const { getMemberRegistrations } = await import("./client");
  return await getMemberRegistrations(memberId, email);
}

/**
 * Update registration status (Approve / Reject / Waitlist / Attend)
 */
export async function updateRegistrationStatusAction(
  registrationId: string,
  eventId: string,
  status: RegistrationStatus,
  reviewer?: { id: string; name: string; email?: string },
  notes?: string,
  extraFields?: Partial<FirestoreRegistration>,
) {
  const { updateRegistrationStatus } = await import("./client");
  await updateRegistrationStatus(registrationId, eventId, status, reviewer, notes, extraFields);
  await revalidateDashboardPath("/dashboard/events");
  await revalidateDashboardPath(`/dashboard/events/${eventId}`);
  return { success: true };
}

/**
 * Update answers and session on an existing pending registration.
 */
export async function updateRegistrationAnswersAction(
  registrationId: string,
  eventId: string,
  data: {
    answers: Record<string, unknown>;
    session_id?: string;
    session_title?: string;
  },
) {
  try {
    const { updateRegistrationAnswers } = await import("./client");
    await updateRegistrationAnswers(registrationId, eventId, data);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update registration answers.";
    console.error("[updateRegistrationAnswersAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Register a member for an event.
 */
export async function registerForEventAction(registration: Omit<FirestoreRegistration, "id">) {
  try {
    if (!registration.member_id || !registration.member_email.trim()) {
      return {
        success: false,
        error: "You must join the community by signing in with Google before registering.",
      };
    }
    const { registerMemberForEvent } = await import("./client");
    const regId = await registerMemberForEvent(registration);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath(`/dashboard/events/${registration.event_id}`);
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true, registrationId: regId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register for event.";
    console.error("[registerForEventAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Get sync metadata status.
 */
export async function fetchSyncMetadataAction() {
  const { getSyncMetadata } = await import("./client");
  return await getSyncMetadata();
}

/**
 * Fetch and save FAQ content
 */
export async function fetchFaqContentAction() {
  const { getFaqContentDoc } = await import("./client");
  return await getFaqContentDoc();
}

export async function saveFaqContentAction(content: import("@/lib/content/types").FaqContent) {
  try {
    const { saveFaqContentDoc } = await import("./client");
    await saveFaqContentDoc(content);
    await revalidateDashboardPath("/faq");
    await revalidateDashboardPath("/dashboard/faq");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save FAQ content";
    console.error("[saveFaqContentAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Fetch and save Partnership content
 */
export async function fetchPartnershipContentAction() {
  const { getPartnershipContentDoc } = await import("./client");
  return await getPartnershipContentDoc();
}

export async function savePartnershipContentAction(content: import("@/lib/content/types").PartnershipContent) {
  try {
    const { savePartnershipContentDoc } = await import("./client");
    await savePartnershipContentDoc(content);
    await revalidateDashboardPath("/partnership");
    await revalidateDashboardPath("/dashboard/partnership");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save Partnership content";
    console.error("[savePartnershipContentAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event tickets and per-person purchase limits
 */
export async function updateEventTicketsAction(
  eventId: string,
  tickets: import("./types").EventTicketTier[],
  maxTicketsPerPerson?: number | null,
) {
  try {
    const { updateEventTickets } = await import("./client");
    await updateEventTickets(eventId, tickets, maxTicketsPerPerson);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save tickets.";
    console.error("[updateEventTicketsAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event merchandise items and purchase limits
 */
export async function updateEventMerchandiseAction(
  eventId: string,
  merchandise: import("./types").EventMerchandiseItem[],
  maxMerchandisePerPerson?: number | null,
) {
  try {
    const { updateEventMerchandise } = await import("./client");
    await updateEventMerchandise(eventId, merchandise, maxMerchandisePerPerson);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save merchandise.";
    console.error("[updateEventMerchandiseAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event discount vouchers
 */
export async function updateEventVouchersAction(eventId: string, vouchers: import("./types").EventVoucher[]) {
  try {
    const { updateEventVouchers } = await import("./client");
    await updateEventVouchers(eventId, vouchers);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save vouchers.";
    console.error("[updateEventVouchersAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event email templates for n8n automation
 */
export async function updateEventEmailTemplatesAction(
  eventId: string,
  emailTemplates: import("./types").EventEmailTemplates,
) {
  try {
    const { updateEventEmailTemplates } = await import("./client");
    await updateEventEmailTemplates(eventId, emailTemplates);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save email templates.";
    console.error("[updateEventEmailTemplatesAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update attendee check-in state in Firestore
 */
export async function updateRegistrationCheckInAction(
  registrationId: string,
  eventId: string,
  isCheckedIn: boolean,
  bevyAttendeeId?: number | null,
  checkinDate?: string | null,
) {
  try {
    const { updateRegistrationCheckIn } = await import("./client");
    await updateRegistrationCheckIn(registrationId, eventId, isCheckedIn, bevyAttendeeId, checkinDate);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update check-in status.";
    console.error("[updateRegistrationCheckInAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event highlights and post-event media
 */
export async function updateEventHighlightsMediaAction(
  eventId: string,
  data: {
    highlight_video_url?: string;
    highlight_video_title?: string;
    photo_album_url?: string;
    photo_album_title?: string;
    recap_description?: string;
    sessions?: import("./types").EventSession[];
  },
) {
  try {
    const { updateEventHighlightsMedia } = await import("./client");
    await updateEventHighlightsMedia(eventId, data);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save highlights and media.";
    console.error("[updateEventHighlightsMediaAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Remove an event registration so the attendee can re-register again.
 * Ensures the attendee is removed from Bevy API BEFORE removing it from the dashboard.
 */
export async function deleteEventRegistrationAction(
  registrationId: string,
  eventId: string,
  bevyAttendeeId?: number | string | null,
  attendeeEmail?: string | null,
) {
  try {
    let resolvedAttendeeId = bevyAttendeeId;
    let resolvedEmail = attendeeEmail;

    // Pre-resolve missing attendee info from registration doc if needed
    if (!resolvedAttendeeId || !resolvedEmail) {
      try {
        const { getRegistrationById } = await import("./client");
        const data = await getRegistrationById(registrationId);
        if (data) {
          resolvedAttendeeId = resolvedAttendeeId ?? data.bevy_attendee_id;
          resolvedEmail = resolvedEmail ?? data.member_email;
        }
      } catch (fetchErr) {
        console.warn("[deleteEventRegistrationAction] Could not pre-fetch registration document:", fetchErr);
      }
    }

    // 1. Remove attendee from Bevy API BEFORE removing from dashboard
    try {
      const { removeAttendeeFromBevyAction } = await import("@/server/bevy-actions");
      const bevyRes = await removeAttendeeFromBevyAction({
        eventId,
        attendeeId: resolvedAttendeeId,
        attendeeEmail: resolvedEmail,
      });
      if (!bevyRes.success) {
        console.warn("[deleteEventRegistrationAction] Bevy attendee deletion warning:", bevyRes.error);
      } else {
        console.log("[deleteEventRegistrationAction] Successfully verified/removed attendee from Bevy.");
      }
    } catch (bevyErr) {
      console.warn("[deleteEventRegistrationAction] Failed to remove attendee from Bevy API:", bevyErr);
    }

    // 2. Remove registration from Firestore (dashboard) & recalculate capacity counters
    const { deleteEventRegistration } = await import("./client");
    await deleteEventRegistration(registrationId, eventId);

    // 3. Revalidate dashboard paths
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/organizer");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    await revalidateDashboardPath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove attendee registration.";
    console.error("[deleteEventRegistrationAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Remove multiple event registrations in batch so attendees can re-register again.
 * If bevyAttendeeIds is provided, also removes the attendees from Bevy using session spoofing.
 */
export async function deleteBatchEventRegistrationsAction(
  registrationIds: string[],
  eventId: string,
  bevyAttendeeIds?: (number | string)[],
) {
  try {
    // 1. Remove attendees from Bevy API BEFORE deleting from dashboard
    if (bevyAttendeeIds && bevyAttendeeIds.length > 0) {
      try {
        const { deleteBatchBevyAttendeesAction } = await import("@/server/bevy-actions");
        await deleteBatchBevyAttendeesAction(bevyAttendeeIds, eventId);
      } catch (bevyErr) {
        console.warn("[deleteBatchEventRegistrationsAction] Failed to delete attendees from Bevy:", bevyErr);
      }
    }

    // 2. Remove registrations from Firestore (dashboard)
    const { deleteBatchEventRegistrations } = await import("./client");
    await deleteBatchEventRegistrations(registrationIds, eventId);

    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/organizer");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    await revalidateDashboardPath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove attendee registrations.";
    console.error("[deleteBatchEventRegistrationsAction] error:", message);
    return { success: false, error: message };
  }
}

// ── Merchandise Delivery Actions ──────────────────────────────────────────

export interface SubmitMerchandiseDeliveryInput {
  registrationId: string;
  eventId: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  notes?: string;
  customerEmail: string;
  eventTitle?: string;
  eventPictureUrl?: string;
}

export async function submitMerchandiseDeliveryRequestAction(input: SubmitMerchandiseDeliveryInput) {
  try {
    const { generatePaymentLinkAction } = await import("@/server/payment-actions");
    const { saveMerchandiseDeliveryRequest, getFirestoreEventById } = await import("./client");
    const _typeModule = await import("./types");

    let isProduction: boolean | undefined;
    let paymentWebhookUrl: string | undefined;
    let deliveryPaymentEnv: "production" | "sandbox" = "production";

    try {
      const eventDoc = await getFirestoreEventById(String(input.eventId));
      const configuredEnv = eventDoc?.merchandise_delivery_payment_environment ?? eventDoc?.payment_environment;
      if (configuredEnv === "sandbox" || (!configuredEnv && eventDoc?.is_test)) {
        deliveryPaymentEnv = "sandbox";
        isProduction = false;
      } else {
        deliveryPaymentEnv = "production";
        isProduction = true;
      }
      paymentWebhookUrl = eventDoc?.payment_webhook_url ?? undefined;
    } catch {
      // ignore fallback
    }

    // 1. Generate payment link for Rp 50.000 distribution & commitment cutting fee
    const paymentPayload = {
      customer: {
        name: input.recipientName.trim(),
        email: input.customerEmail.trim(),
        phone: input.recipientPhone.trim(),
      },
      event: {
        id: String(input.eventId),
        title: input.eventTitle ?? "GDG Jakarta Event",
        headerEmailUrl: input.eventPictureUrl,
        paymentDeadlineMinutes: 1440,
      },
      items: [
        {
          name: "Merchandise Delivery Fee (No-Show Commitment Cutting Fee)",
          quantity: 1,
          price: 50000,
          type: "Fee",
          description: "Distribution delivery cost & non-commitment cutting fee for uncollected event merchandise.",
        },
      ],
      fees: [],
      payment: {
        paymentMethodTypes: ["QRIS"],
        sendEmail: true,
      },
      referenceId: `DELIV-${input.registrationId}-${Date.now().toString(36).toUpperCase()}`,
      isProduction,
      webhookUrl: paymentWebhookUrl,
    };

    let payResult: {
      success: boolean;
      paymentUrl?: string;
      invoiceNumber?: string;
      error?: string;
    };

    try {
      payResult = await generatePaymentLinkAction(paymentPayload);
    } catch (payErr) {
      console.warn("[submitMerchandiseDeliveryRequestAction] Payment generation error:", payErr);
      payResult = {
        success: false,
        error: payErr instanceof Error ? payErr.message : "Payment generation failed",
      };
    }

    const now = new Date().toISOString();
    const deliveryRequest: import("./types").MerchandiseDeliveryRequest = {
      id: `del_${input.registrationId}_${Date.now()}`,
      status: "pending_payment",
      recipient_name: input.recipientName.trim(),
      recipient_phone: input.recipientPhone.trim(),
      shipping_address: input.shippingAddress.trim(),
      city: input.city.trim(),
      postal_code: input.postalCode.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      requested_at: now,
      fee_amount: 50000,
      payment_status: payResult.success && payResult.paymentUrl ? "pending" : "unpaid",
      payment_environment: deliveryPaymentEnv,
      payment_url: payResult.paymentUrl,
      payment_invoice_number: payResult.invoiceNumber,
      updated_at: now,
    };

    await saveMerchandiseDeliveryRequest(input.registrationId, deliveryRequest);

    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    await revalidateDashboardPath(`/dashboard/events/${input.eventId}`);
    await revalidateDashboardPath(`/dashboard/member/events/${input.eventId}`);

    return {
      success: true,
      deliveryRequest,
      paymentUrl: payResult.paymentUrl,
      invoiceNumber: payResult.invoiceNumber,
      paymentEnvironment: deliveryPaymentEnv,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit merchandise delivery request.";
    console.error("[submitMerchandiseDeliveryRequestAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Confirms or simulates delivery fee payment, moving status to pending_review.
 */
export async function confirmMerchandiseDeliveryPaymentAction(registrationId: string, eventId: string) {
  try {
    const { updateMerchandiseDeliveryStatus } = await import("./client");
    const now = new Date().toISOString();

    await updateMerchandiseDeliveryStatus(registrationId, "pending_review", {
      payment_status: "paid",
      paid_at: now,
    });

    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm payment.";
    console.error("[confirmMerchandiseDeliveryPaymentAction] error:", message);
    return { success: false, error: message };
  }
}

export interface ApproveMerchandiseDeliveryInput {
  registrationId: string;
  eventId: string;
  courierType: string;
  trackingNumber: string;
  trackingUrl?: string;
  deliveryProofUrl?: string;
  dispatchedAt?: string;
  notes?: string;
  reviewer: { id: string; name: string; email?: string };
}

/**
 * Organizer approves merchandise delivery and submits courier fulfillment details.
 */
export async function approveMerchandiseDeliveryAction(input: ApproveMerchandiseDeliveryInput) {
  try {
    const { updateMerchandiseDeliveryStatus } = await import("./client");
    const now = new Date().toISOString();

    await updateMerchandiseDeliveryStatus(input.registrationId, "approved", {
      courier_type: input.courierType.trim(),
      tracking_number: input.trackingNumber.trim(),
      tracking_url: input.trackingUrl?.trim() ? input.trackingUrl.trim() : undefined,
      delivery_proof_url: input.deliveryProofUrl?.trim() ? input.deliveryProofUrl.trim() : undefined,
      dispatched_at: input.dispatchedAt ?? now,
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      reviewed_by_id: input.reviewer.id,
      reviewed_by_name: input.reviewer.name,
      reviewed_at: now,
    });

    await revalidateDashboardPath(`/dashboard/events/${input.eventId}`);
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${input.eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve delivery request.";
    console.error("[approveMerchandiseDeliveryAction] error:", message);
    return { success: false, error: message };
  }
}

export interface RejectMerchandiseDeliveryInput {
  registrationId: string;
  eventId: string;
  reason: string;
  reviewer: { id: string; name: string; email?: string };
}

/**
 * Organizer rejects merchandise delivery request with a reason.
 */
export async function rejectMerchandiseDeliveryAction(input: RejectMerchandiseDeliveryInput) {
  try {
    const { updateMerchandiseDeliveryStatus } = await import("./client");
    const now = new Date().toISOString();

    await updateMerchandiseDeliveryStatus(input.registrationId, "rejected", {
      rejection_reason: input.reason.trim(),
      reviewed_by_id: input.reviewer.id,
      reviewed_by_name: input.reviewer.name,
      reviewed_at: now,
    });

    await revalidateDashboardPath(`/dashboard/events/${input.eventId}`);
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${input.eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reject delivery request.";
    console.error("[rejectMerchandiseDeliveryAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Organizer marks merchandise as successfully delivered.
 */
export async function markMerchandiseDeliveredAction(registrationId: string, eventId: string) {
  try {
    const { updateMerchandiseDeliveryStatus } = await import("./client");
    const now = new Date().toISOString();

    await updateMerchandiseDeliveryStatus(registrationId, "delivered", {
      delivered_at: now,
    });

    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark as delivered.";
    console.error("[markMerchandiseDeliveredAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Fetches all delivery requests for an event.
 */
export async function fetchEventMerchandiseDeliveryRequestsAction(eventId: string) {
  try {
    const { getEventMerchandiseDeliveryRequests } = await import("./client");
    return await getEventMerchandiseDeliveryRequests(eventId);
  } catch (err) {
    console.error("[fetchEventMerchandiseDeliveryRequestsAction] error:", err);
    return [];
  }
}

/**
 * Updates the event's merchandise delivery payment environment (production vs sandbox).
 */
export async function updateEventMerchandiseDeliveryConfigAction(
  eventId: string,
  environment: "production" | "sandbox",
) {
  try {
    const { updateEventMerchandiseDeliveryConfig } = await import("./client");
    await updateEventMerchandiseDeliveryConfig(eventId, environment);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update delivery environment.";
    console.error("[updateEventMerchandiseDeliveryConfigAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Updates the event's payment gateway environment and webhook URL override.
 */
export async function updateEventPaymentConfigAction(
  eventId: string,
  config: {
    payment_environment: "production" | "sandbox";
    merchandise_delivery_payment_environment?: "production" | "sandbox";
    payment_webhook_url?: string | null;
  },
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventPaymentConfig } = await import("./client");
    await updateEventPaymentConfig(eventId, config, baseEvent);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update payment settings.";
    console.error("[updateEventPaymentConfigAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Tracks a package delivery status and journey history using the CekResi engine.
 */
export async function trackDeliveryPackageAction(input: { trackingNumber: string; courier?: string }) {
  try {
    const { trackPackageWithCekResi } = await import("@/lib/shipping/cek-resi");
    const result = await trackPackageWithCekResi(input.trackingNumber, input.courier);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to track package.";
    console.error("[trackDeliveryPackageAction] error:", message);
    return { valid: false, error: message };
  }
}

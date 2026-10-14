"use client";

import { DEFAULT_PAYMENT_HEADER_EMAIL_URL } from "@/lib/events/doku-payment";
import { revalidateDashboardPath } from "@/server/server-actions";

import type { FirestoreEvent, FirestoreRegistration, ReferralProgramSettings, RegistrationStatus } from "./types";

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
    await revalidateDashboardPath("/dashboard/referrals");
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
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventTickets } = await import("./client");
    await updateEventTickets(eventId, tickets, maxTicketsPerPerson, baseEvent);
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
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventMerchandise } = await import("./client");
    await updateEventMerchandise(eventId, merchandise, maxMerchandisePerPerson, baseEvent);
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
export async function updateEventVouchersAction(
  eventId: string,
  vouchers: import("./types").EventVoucher[],
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventVouchers } = await import("./client");
    await updateEventVouchers(eventId, vouchers, baseEvent);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save vouchers.";
    console.error("[updateEventVouchersAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event referral discount configuration override
 */
export async function updateEventReferralConfigAction(
  eventId: string,
  config: {
    referral_enabled?: boolean;
    referral_discount_type?: "percentage" | "fixed";
    referral_discount_percentage?: number | null;
    referral_discount_amount?: number | null;
  },
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventReferralConfig } = await import("./client");
    await updateEventReferralConfig(eventId, config, baseEvent);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update event referral settings.";
    console.error("[updateEventReferralConfigAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event bundling packages (combining tickets and merchandise)
 */
export async function updateEventBundlesAction(
  eventId: string,
  bundles: import("./types").EventBundlePackage[],
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventBundles } = await import("./client");
    await updateEventBundles(eventId, bundles, baseEvent);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save bundling packages.";
    console.error("[updateEventBundlesAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event email templates for n8n automation
 */
export async function updateEventEmailTemplatesAction(
  eventId: string,
  emailTemplates: import("./types").EventEmailTemplates,
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventEmailTemplates } = await import("./client");
    await updateEventEmailTemplates(eventId, emailTemplates, baseEvent);
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
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventHighlightsMedia } = await import("./client");
    await updateEventHighlightsMedia(eventId, data, baseEvent);
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
    let deliveryFee = 50000;
    let eventDoc: Awaited<ReturnType<typeof getFirestoreEventById>> = null;

    try {
      eventDoc = await getFirestoreEventById(String(input.eventId));
      const configuredEnv = eventDoc?.merchandise_delivery_payment_environment ?? eventDoc?.payment_environment;
      if (configuredEnv === "sandbox" || (!configuredEnv && eventDoc?.is_test)) {
        deliveryPaymentEnv = "sandbox";
        isProduction = false;
      } else {
        deliveryPaymentEnv = "production";
        isProduction = true;
      }
      if (typeof eventDoc?.merchandise_delivery_fee === "number") {
        deliveryFee = eventDoc.merchandise_delivery_fee;
      }
      paymentWebhookUrl = eventDoc?.payment_webhook_url ?? undefined;
    } catch {
      // ignore fallback
    }

    // 1. Generate payment link for distribution & commitment cutting fee
    const paymentPayload = {
      customer: {
        name: input.recipientName.trim(),
        email: input.customerEmail.trim(),
        phone: input.recipientPhone.trim(),
      },
      event: {
        id: String(input.eventId),
        title: input.eventTitle ?? "GDG Jakarta Event",
        headerEmailUrl:
          eventDoc?.headerEmailUrl?.trim() || eventDoc?.header_email_url?.trim() || DEFAULT_PAYMENT_HEADER_EMAIL_URL,
        paymentDeadlineMinutes:
          eventDoc?.paymentDeadlinesInMinutes ??
          eventDoc?.paymentDeadlineMinutes ??
          eventDoc?.payment_deadline_minutes ??
          1440,
      },
      items: [
        {
          name: "Merchandise Delivery Fee (No-Show Commitment Cutting Fee)",
          quantity: 1,
          price: deliveryFee,
          type: "Fee",
          description: "Distribution delivery cost & non-commitment cutting fee for uncollected event merchandise.",
        },
      ],
      fees: [],
      payment: {
        paymentMethodTypes: ["QRIS"],
        sendEmail: true,
        emailTemplate: eventDoc?.payment_email_template ?? eventDoc?.paymentEmailTemplate ?? "Ticketing",
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
      fee_amount: deliveryFee,
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
  baseEvent?: Partial<FirestoreEvent>,
) {
  try {
    const { updateEventMerchandiseDeliveryConfig } = await import("./client");
    await updateEventMerchandiseDeliveryConfig(eventId, environment, baseEvent);
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
    merchandise_delivery_fee?: number;
    payment_webhook_url?: string | null;
    headerEmailUrl?: string | null;
    header_email_url?: string | null;
    paymentDeadlinesInMinutes?: number | null;
    paymentDeadlineMinutes?: number | null;
    payment_deadline_minutes?: number | null;
    payment_email_template?: string | null;
    paymentEmailTemplate?: string | null;
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

// ── Referral Program Actions ────────────────────────────────────────────────

export async function getMemberReferralDataAction(memberId: string, memberEmail: string, name?: string) {
  try {
    const { getOrCreateMemberReferralCode } = await import("./client");
    return await getOrCreateMemberReferralCode(memberId, memberEmail, name);
  } catch (err) {
    console.error("[getMemberReferralDataAction] error:", err);
    return null;
  }
}

export async function validateReferralCodeAction(
  code: string,
  currentMemberId: string,
  currentMemberEmail: string,
  eventId?: string,
  ticketPrice?: number,
) {
  try {
    const { validateReferralCode } = await import("./client");
    return await validateReferralCode(code, currentMemberId, currentMemberEmail, eventId, ticketPrice);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to validate referral code.";
    console.error("[validateReferralCodeAction] error:", message);
    return { valid: false, error: message };
  }
}

export async function getReferralLeaderboardAction(limitCount?: number) {
  try {
    const { getReferralLeaderboard } = await import("./client");
    return await getReferralLeaderboard(limitCount);
  } catch (err) {
    console.error("[getReferralLeaderboardAction] error:", err);
    return [];
  }
}

export async function getReferralProgramSettingsAction() {
  try {
    const { getReferralProgramSettings } = await import("./client");
    return await getReferralProgramSettings();
  } catch (err) {
    console.error("[getReferralProgramSettingsAction] error:", err);
    return null;
  }
}

export async function saveReferralProgramSettingsAction(settings: Partial<ReferralProgramSettings>) {
  try {
    const { saveReferralProgramSettings } = await import("./client");
    await saveReferralProgramSettings(settings);
    await revalidateDashboardPath("/dashboard/referrals");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save referral settings.";
    console.error("[saveReferralProgramSettingsAction] error:", message);
    return { success: false, error: message };
  }
}

export async function getMemberReferralHistoryAction(memberId: string) {
  try {
    const { getMemberReferralHistory } = await import("./client");
    return await getMemberReferralHistory(memberId);
  } catch (err) {
    console.error("[getMemberReferralHistoryAction] error:", err);
    return [];
  }
}

export async function resetMemberReferralAction(memberId: string) {
  try {
    const { resetMemberReferrals } = await import("./client");
    await resetMemberReferrals(memberId);
    await revalidateDashboardPath("/dashboard/referrals");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset member referral.";
    console.error("[resetMemberReferralAction] error:", message);
    return { success: false, error: message };
  }
}

export async function resetAllMembersReferralsAction() {
  try {
    const { resetAllMembersReferrals } = await import("./client");
    const result = await resetAllMembersReferrals();
    await revalidateDashboardPath("/dashboard/referrals");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true, count: result.resetCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset all referrals.";
    console.error("[resetAllMembersReferralsAction] error:", message);
    return { success: false, error: message };
  }
}

export async function getExcludedReferralMembersAction() {
  try {
    const { getExcludedReferralMembers } = await import("./client");
    return await getExcludedReferralMembers();
  } catch (err) {
    console.error("[getExcludedReferralMembersAction] error:", err);
    return [];
  }
}

export async function excludeMemberFromLeaderboardAction(memberId: string) {
  try {
    const { excludeMemberFromLeaderboard } = await import("./client");
    await excludeMemberFromLeaderboard(memberId);
    await revalidateDashboardPath("/dashboard/referrals");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exclude member from leaderboard.";
    console.error("[excludeMemberFromLeaderboardAction] error:", message);
    return { success: false, error: message };
  }
}

export async function includeMemberInLeaderboardAction(memberId: string) {
  try {
    const { includeMemberInLeaderboard } = await import("./client");
    await includeMemberInLeaderboard(memberId);
    await revalidateDashboardPath("/dashboard/referrals");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore member to leaderboard.";
    console.error("[includeMemberInLeaderboardAction] error:", message);
    return { success: false, error: message };
  }
}

export async function searchMembersForExclusionAction(query: string) {
  try {
    const { searchMembersForExclusion } = await import("./client");
    return await searchMembersForExclusion(query);
  } catch (err) {
    console.error("[searchMembersForExclusionAction] error:", err);
    return [];
  }
}

export async function fetchEventsForReferralConfigAction() {
  try {
    const { fetchPublishedEventsAction } = await import(
      "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events"
    );
    const res = await fetchPublishedEventsAction();
    return res.events || [];
  } catch (err) {
    console.error("[fetchEventsForReferralConfigAction] error:", err);
    return [];
  }
}

export async function excludeEventFromReferralsAction(eventId: string) {
  try {
    const { excludeEventFromReferrals } = await import("./client");
    await excludeEventFromReferrals(eventId);
    await revalidateDashboardPath("/dashboard/referrals");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exclude event from referrals.";
    console.error("[excludeEventFromReferralsAction] error:", message);
    return { success: false, error: message };
  }
}

export async function includeEventInReferralsAction(eventId: string) {
  try {
    const { includeEventInReferrals } = await import("./client");
    await includeEventInReferrals(eventId);
    await revalidateDashboardPath("/dashboard/referrals");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to include event in referrals.";
    console.error("[includeEventInReferralsAction] error:", message);
    return { success: false, error: message };
  }
}

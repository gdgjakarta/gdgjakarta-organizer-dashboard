"use server";

import {
  buildApprovedAttendeePayload,
  resolveApprovedAttendeeWebhookUrl,
} from "@/lib/events/approved-attendee-webhook";
import { generateBundleFriendVouchers } from "@/lib/events/bundle-voucher-generator";
import { buildRegistrationPaymentPayload } from "@/lib/events/doku-payment";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import type {
  BundleIssuedVoucher,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  SelectedMerchandiseOrder,
} from "@/lib/firestore/types";
import { getAuthenticatedSessionUser, isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getFirestoreDoc, patchFirestoreDoc } from "@/server/firestore-admin";
import { generatePaymentLinkAction } from "@/server/payment-actions";
import { revalidateDashboardPath } from "@/server/server-actions";

export interface AddManualRegistrantInput {
  eventId: string;
  fullName: string;
  email: string;
  selectionType: "ticket" | "bundle";
  selectionId: string;
  mode: "direct" | "payment_link";
  authToken?: string;
}

export interface AddManualRegistrantResult {
  success: boolean;
  error?: string;
  registration?: FirestoreRegistration;
  paymentUrl?: string;
  invoiceNumber?: string;
}

/**
 * Server action to manually add a registrant to Bevy and Firestore.
 * Supports:
 * - Direct registration (free or paid forced directly, calls Add Bevy Attendee API and creates approved/paid registration)
 * - Payment link generation (paid ticket/bundle -> waiting_for_payment registration + DOKU link emailed)
 */
export async function addManualRegistrantAction(input: AddManualRegistrantInput): Promise<AddManualRegistrantResult> {
  // 1. Verify organizer authorization
  if (!(await isAuthorizedOrganizerSession())) {
    return {
      success: false,
      error: "Unauthorized: Organizer session required to manually add registrants.",
    };
  }

  const { eventId, fullName, email, selectionType, selectionId, mode } = input;
  const trimmedName = (fullName || "").trim();
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!trimmedName) {
    return { success: false, error: "Full Name is required." };
  }
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { success: false, error: "A valid Email Address is required." };
  }
  if (!selectionId) {
    return { success: false, error: "Please select a ticket or bundle package." };
  }

  const sessionUser = await getAuthenticatedSessionUser();
  const reviewerName = sessionUser?.name || "Organizer";
  const reviewerId = sessionUser?.id || "organizer";

  // 2. Fetch event document
  const rawEvent = await getFirestoreDoc("events", String(eventId), input.authToken);
  if (!rawEvent) {
    return { success: false, error: `Event with ID "${eventId}" not found.` };
  }
  const event = rawEvent as unknown as FirestoreEvent;

  // 3. Resolve ticket or bundle selection
  let selectedTicket = event.tickets?.find((t) => t.id === selectionId);
  let selectedBundle = event.bundles?.find((b) => b.id === selectionId);

  if (selectionType === "bundle" && !selectedBundle) {
    selectedBundle = event.bundles?.find((b) => b.id === selectionId);
  }
  if (selectionType === "ticket" && !selectedTicket) {
    selectedTicket = event.tickets?.find((t) => t.id === selectionId);
  }

  if (selectionType === "ticket" && !selectedTicket) {
    // If ticket not found by ID, attempt fallback
    selectedTicket = event.tickets?.[0];
  }

  const ticketId = selectedTicket?.id ?? selectedBundle?.ticket_id ?? "ticket_regular";
  const ticketName = selectedTicket?.name ?? selectedBundle?.name ?? "Event Ticket";
  const ticketType = selectedTicket?.type ?? (selectedBundle ? "paid" : "free");
  const ticketPrice = selectionType === "ticket" ? (selectedTicket?.price ?? 0) : 0;
  const bundlePrice = selectionType === "bundle" ? (selectedBundle?.price ?? 0) : 0;
  const effectivePrice = selectionType === "bundle" ? bundlePrice : ticketPrice;

  // Bundle merchandise mapping
  let selectedMerchandise: SelectedMerchandiseOrder[] | undefined;
  if (selectionType === "bundle" && selectedBundle?.merchandise_items && selectedBundle.merchandise_items.length > 0) {
    selectedMerchandise = selectedBundle.merchandise_items.map((bItem) => {
      const parentMerch = event.merchandise?.find((m) => m.id === bItem.merchandise_id);
      return {
        id: bItem.merchandise_id,
        name: parentMerch?.name || "Bundled Merchandise Item",
        merchandise_id: bItem.merchandise_id,
        merchandise_title: parentMerch?.name || "Bundled Merchandise Item",
        quantity: bItem.quantity ?? 1,
        price: 0, // Included inside bundle price
        selected_variations: bItem.default_variations ?? undefined,
      };
    });
  }

  const nowIso = new Date().toISOString();
  const nowMillis = Date.now();

  // 4. Handle "Direct" Registration (Call Bevy API & Save to Firestore)
  if (mode === "direct") {
    const isPaid = effectivePrice > 0;
    const finalStatus: RegistrationStatus = isPaid ? "paid_and_registered" : "approved";

    // Build partial registration for payload construction
    const regCandidate: FirestoreRegistration = {
      id: `manual_${nowMillis}`,
      event_id: String(eventId),
      event_title: event.title,
      member_id: `manual_${nowMillis}`,
      member_name: trimmedName,
      member_email: normalizedEmail,
      ticket_id: ticketId,
      ticket_name: ticketName,
      ticket_tier: ticketName,
      ticket_type: ticketType,
      ticket_price: ticketPrice,
      bundle_id: selectionType === "bundle" ? selectedBundle?.id : undefined,
      bundle_price: selectionType === "bundle" ? bundlePrice : undefined,
      selected_merchandise: selectedMerchandise,
      status: finalStatus,
      registered_at: nowIso,
      registered_at_millis: nowMillis,
    };

    const webhookPayload = buildApprovedAttendeePayload(regCandidate, event);

    // Call Bevy Attendee API via n8n
    const customBaseUrl = process.env.N8N_WEBHOOK_BASE_URL ?? process.env.N8N_BASE_URL;
    let webhookUrl = resolveApprovedAttendeeWebhookUrl(customBaseUrl);
    if (!customBaseUrl) {
      const legacyUrl =
        process.env.N8N_ADD_BEVY_ATTENDEE_WEBHOOK_URL ??
        process.env.ADD_BEVY_ATTENDEE_WEBHOOK_URL ??
        process.env.N8N_APPROVED_ATTENDEE_WEBHOOK_URL ??
        process.env.APPROVED_ATTENDEE_WEBHOOK_URL;
      if (legacyUrl) {
        webhookUrl = legacyUrl;
      }
    }

    const authHeaderName = process.env.N8N_WEBHOOK_HEADER_NAME ?? process.env.N8N_AUTH_HEADER_NAME ?? "x-api-key";
    const apiKey =
      process.env.N8N_WEBHOOK_API_KEY ??
      process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ??
      process.env.N8N_AUTH_SECRET ??
      "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let bevyAttendeeId: number | null = null;
    let bevyAttendeeCode: string | null = null;
    let bevyStatus: string | null = null;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "GDG-Jakarta-Dashboard/1.0",
      };
      if (apiKey) {
        headers[authHeaderName] = apiKey;
      }

      console.log(`[Manual Registration] Calling Bevy Webhook at ${webhookUrl} for ${normalizedEmail}...`);
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseJson: Record<string, unknown> | null = null;
      try {
        const parsed = JSON.parse(responseText);
        responseJson = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown>;
      } catch {
        // Non-JSON response
      }

      const hasErrorStatus =
        responseJson &&
        (responseJson.status === false ||
          responseJson.status === "false" ||
          responseJson.status === "error" ||
          responseJson.success === false);

      if (!response.ok || hasErrorStatus) {
        console.error(`[Manual Registration] Bevy Webhook returned error (${response.status}):`, responseText);
        const errMsg =
          (typeof responseJson?.message === "string" && responseJson.message) ||
          (typeof responseJson?.error === "string" && responseJson.error) ||
          "Add Attendee to Bevy API rejected the request.";
        return { success: false, error: errMsg };
      }

      const responseData = responseJson?.data as Record<string, unknown> | undefined;
      if (responseData) {
        if (responseData.bevy_attendee_id) {
          bevyAttendeeId = Number(responseData.bevy_attendee_id);
        }
        if (responseData.bevy_attendee_code) {
          bevyAttendeeCode = String(responseData.bevy_attendee_code);
        }
        if (responseData.attendee_status) {
          bevyStatus = String(responseData.attendee_status);
        }
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
      const errMsg = isAbort
        ? "Add Attendee to Bevy API timed out after 20 seconds."
        : fetchErr instanceof Error
          ? fetchErr.message
          : "Failed to connect to Bevy webhook.";
      return { success: false, error: errMsg };
    }

    // Determine Firestore Document ID
    const docId = bevyAttendeeId ? `bevy_${bevyAttendeeId}` : `manual_${nowMillis}`;
    const attendeeCode = bevyAttendeeCode || (bevyAttendeeId ? `GOOGA26${bevyAttendeeId}` : `MAN-${nowMillis}`);
    const resolvedStatus: RegistrationStatus =
      (bevyStatus as RegistrationStatus) || (isPaid ? "paid_and_registered" : "approved");

    // Generate friend vouchers if bundle has multiple tickets
    let issuedBundleVouchers: BundleIssuedVoucher[] | undefined;
    if (selectedBundle && (selectedBundle.ticket_quantity ?? 1) > 1 && selectedBundle.generate_vouchers !== false) {
      const matchingTicketTier = event.tickets?.find((t) => t.id === selectedBundle.ticket_id);
      const generated = generateBundleFriendVouchers({
        bundle: selectedBundle,
        buyerRegistrationId: docId,
        buyerMemberId: String(bevyAttendeeId || docId),
        buyerName: trimmedName,
        buyerEmail: normalizedEmail,
        ticketTier: matchingTicketTier,
        eventStartDate: event.start_date,
      });
      issuedBundleVouchers = generated.registrationVouchers;

      // Save friend vouchers to Firestore
      for (const fv of generated.newEventVouchers) {
        const vDocId = `${eventId}_${fv.code.toUpperCase()}`;
        await patchFirestoreDoc(
          "event_vouchers",
          vDocId,
          fv as unknown as Record<string, unknown>,
          true,
          input.authToken,
        );
      }
    }

    const preEventSessions = (event.sessions ?? []).filter((s) => s.include_in_registration !== false);
    const resolvedSessionTitle =
      preEventSessions.length > 0 ? preEventSessions[0].title : event.default_session_name?.trim() || "Full Session";

    const firestoreRecord: FirestoreRegistration = {
      id: docId,
      event_id: String(eventId),
      event_title: event.title,
      member_id: String(bevyAttendeeId || docId),
      member_name: trimmedName,
      member_email: normalizedEmail,
      ticket_id: ticketId,
      ticket_name: ticketName,
      ticket_tier: ticketName,
      ticket_type: ticketType,
      ticket_price: ticketPrice,
      bundle_id: selectionType === "bundle" ? selectedBundle?.id : undefined,
      bundle_price: selectionType === "bundle" ? bundlePrice : undefined,
      bundle_vouchers: issuedBundleVouchers,
      selected_merchandise: selectedMerchandise,
      session_title: resolvedSessionTitle,
      status: resolvedStatus,
      bevy_attendee_id: bevyAttendeeId ?? undefined,
      attendee_code: attendeeCode,
      registered_at: nowIso,
      registered_at_millis: nowMillis,
      notes: "Manually registered by organizer directly via Add Bevy Attendee API.",
      status_logs: [
        {
          id: `log_${nowMillis}_initial`,
          status: resolvedStatus,
          changed_at: nowIso,
          changed_by_id: reviewerId,
          changed_by_name: reviewerName,
          notes: "Manually registered by organizer directly via Add Bevy Attendee API.",
        },
      ],
    };

    const saved = await patchFirestoreDoc(
      "event_registrations",
      docId,
      firestoreRecord as unknown as Record<string, unknown>,
      true,
      input.authToken,
    );

    if (!saved) {
      console.warn(`[Manual Registration] Failed to patch registration document ${docId}`);
    }

    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return {
      success: true,
      registration: firestoreRecord,
    };
  }

  // 5. Handle "Payment Link" Generation (DOKU & Waiting for Payment)
  if (mode === "payment_link") {
    if (effectivePrice <= 0) {
      return {
        success: false,
        error: "Cannot generate payment link for a free ticket. Please use 'Add Directly' instead.",
      };
    }

    const regId = `manual_pay_${nowMillis}`;
    const preEventSessions = (event.sessions ?? []).filter((s) => s.include_in_registration !== false);
    const resolvedSessionTitle =
      preEventSessions.length > 0 ? preEventSessions[0].title : event.default_session_name?.trim() || "Full Session";

    const baseReg: FirestoreRegistration = {
      id: regId,
      event_id: String(eventId),
      event_title: event.title,
      member_id: regId,
      member_name: trimmedName,
      member_email: normalizedEmail,
      ticket_id: ticketId,
      ticket_name: ticketName,
      ticket_tier: ticketName,
      ticket_type: ticketType,
      ticket_price: ticketPrice,
      bundle_id: selectionType === "bundle" ? selectedBundle?.id : undefined,
      bundle_price: selectionType === "bundle" ? bundlePrice : undefined,
      selected_merchandise: selectedMerchandise,
      session_title: resolvedSessionTitle,
      status: "waiting_for_payment",
      registered_at: nowIso,
      registered_at_millis: nowMillis,
      notes: "Manually registered by organizer directly via Add Bevy Attendee API.",
      status_logs: [
        {
          id: `log_${nowMillis}_initial`,
          status: "waiting_for_payment",
          changed_at: nowIso,
          changed_by_id: reviewerId,
          changed_by_name: reviewerName,
          notes: "Manually added by organizer with payment link generation.",
        },
      ],
    };

    // Calculate fees and generate DOKU payload
    const feeResult = calculatePaymentGatewayFee(effectivePrice, event);
    const isAttendeeCovering = event.payment_fee_bearer !== "organizer";
    const effectiveFeeAmount = isAttendeeCovering ? feeResult.feeAmount : 0;

    const paymentPayload = buildRegistrationPaymentPayload(baseReg, event, { sendEmail: true });
    const payRes = await generatePaymentLinkAction(paymentPayload);

    if (!payRes.success || !payRes.paymentUrl) {
      console.error("[Manual Registration] Failed to generate DOKU payment link:", payRes.error);
      return {
        success: false,
        error: payRes.error || "Failed to generate payment link via DOKU gateway.",
      };
    }

    const finalReg: FirestoreRegistration = {
      ...baseReg,
      payment_status: "unpaid",
      payment_url: payRes.paymentUrl,
      payment_invoice_number: payRes.invoiceNumber,
      payment_request_id: payRes.requestId,
      payment_amount: payRes.amount,
      payment_subtotal_amount: effectivePrice,
      payment_fee_amount: effectiveFeeAmount,
      payment_fee_bearer: isAttendeeCovering ? "attendee" : "organizer",
      payment_environment: event.payment_environment ?? (event.is_test ? "sandbox" : "production"),
      payment_expired_datetime: payRes.expiredDatetime,
    };

    await patchFirestoreDoc(
      "event_registrations",
      regId,
      finalReg as unknown as Record<string, unknown>,
      true,
      input.authToken,
    );

    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return {
      success: true,
      registration: finalReg,
      paymentUrl: payRes.paymentUrl,
      invoiceNumber: payRes.invoiceNumber,
    };
  }

  return { success: false, error: "Invalid registration mode." };
}

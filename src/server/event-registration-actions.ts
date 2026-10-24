"use server";

import { getBundleSalesStatus } from "@/lib/events/bundle-templates";
import { getMerchandiseSalesStatus } from "@/lib/events/merchandise-templates";
import { getTicketSalesStatus } from "@/lib/events/ticket-templates";
import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

export interface ServerTimeResult {
  serverTimeIso: string;
  serverTimeMillis: number;
}

export interface RegistrationEligibilityResult {
  valid: boolean;
  serverTimeIso: string;
  serverTimeMillis: number;
  error?: string;
}

/**
 * Returns the authoritative server time synchronized via NTP.
 * Used to detect client device clock spoofing or drift.
 */
export async function getServerTimeAction(): Promise<ServerTimeResult> {
  const now = Date.now();
  return {
    serverTimeMillis: now,
    serverTimeIso: new Date(now).toISOString(),
  };
}

/**
 * Validates whether the event, selected ticket tier, bundle package, and merchandise
 * are currently open for registration according to the server's authoritative clock.
 * Returns authoritative server timestamps to stamp the registration document securely.
 */
export async function validateRegistrationEligibilityAction(params: {
  eventId: string;
  ticketId?: string | null;
  bundleId?: string | null;
  selectedMerchandise?: Array<{ id: string; quantity?: number }> | null;
}): Promise<RegistrationEligibilityResult> {
  const now = Date.now();
  const serverTimeIso = new Date(now).toISOString();

  const fallbackResult: RegistrationEligibilityResult = {
    valid: false,
    serverTimeIso,
    serverTimeMillis: now,
  };

  if (!params.eventId) {
    return { ...fallbackResult, error: "Event ID is required." };
  }

  const event = await getFirestoreEventByIdServer(params.eventId);
  if (!event) {
    return { ...fallbackResult, error: "Event was not found or is no longer available." };
  }

  // 1. Overall event status & registration status
  if (event.registration_status === "Closed") {
    return { ...fallbackResult, error: "Registration for this event is closed." };
  }
  if (event.registration_status === "Draft") {
    return { ...fallbackResult, error: "This event registration is in draft mode and not open yet." };
  }

  const eventStatus = event.status.toLowerCase();
  if (eventStatus === "draft") {
    return { ...fallbackResult, error: "This event is in draft mode and not open for registration." };
  }
  if (eventStatus === "canceled" || eventStatus === "cancelled") {
    return { ...fallbackResult, error: "This event has been canceled." };
  }
  if (eventStatus === "completed" || eventStatus === "past") {
    return { ...fallbackResult, error: "This event has already ended." };
  }

  // 2. Event-level registration window
  if (event.registration_start_date && event.registration_start_date.trim() !== "") {
    const regStart = new Date(event.registration_start_date).getTime();
    if (!Number.isNaN(regStart) && now < regStart) {
      const formatted = new Date(regStart).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      });
      return {
        ...fallbackResult,
        error: `Registration has not opened yet. It will open on ${formatted} WIB.`,
      };
    }
  }

  if (event.registration_end_date && event.registration_end_date.trim() !== "") {
    const regEnd = new Date(event.registration_end_date).getTime();
    if (!Number.isNaN(regEnd) && now > regEnd) {
      const formatted = new Date(regEnd).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      });
      return {
        ...fallbackResult,
        error: `Registration for this event closed on ${formatted} WIB.`,
      };
    }
  }

  // 3. Ticket sales status check
  if (params.ticketId && Array.isArray(event.tickets) && event.tickets.length > 0) {
    const ticket = event.tickets.find((t) => t.id === params.ticketId);
    if (!ticket) {
      return { ...fallbackResult, error: "The selected ticket tier was not found." };
    }
    const salesStatus = getTicketSalesStatus(ticket, now);
    if (!salesStatus.isOpen) {
      return {
        ...fallbackResult,
        error: salesStatus.message ?? `Sales for ticket "${ticket.name}" are currently not open.`,
      };
    }
  }

  // 4. Bundle sales status check
  if (params.bundleId && Array.isArray(event.bundles) && event.bundles.length > 0) {
    const bundle = event.bundles.find((b) => b.id === params.bundleId);
    if (!bundle) {
      return { ...fallbackResult, error: "The selected bundle package was not found." };
    }
    const bundleStatus = getBundleSalesStatus(bundle, now);
    if (!bundleStatus.isAvailable) {
      return {
        ...fallbackResult,
        error: `Sales for package "${bundle.name}" are currently not open (${bundleStatus.badgeLabel}).`,
      };
    }
  }

  // 5. Merchandise sales status check
  if (
    Array.isArray(params.selectedMerchandise) &&
    params.selectedMerchandise.length > 0 &&
    Array.isArray(event.merchandise) &&
    event.merchandise.length > 0
  ) {
    for (const order of params.selectedMerchandise) {
      const merch = event.merchandise.find((m) => m.id === order.id);
      if (!merch) {
        return { ...fallbackResult, error: `Merchandise item (${order.id}) was not found.` };
      }
      const merchStatus = getMerchandiseSalesStatus(merch, now);
      if (!merchStatus.isOpen) {
        return {
          ...fallbackResult,
          error: merchStatus.message ?? `Sales for merchandise "${merch.name}" are currently not open.`,
        };
      }
    }
  }

  return {
    valid: true,
    serverTimeIso,
    serverTimeMillis: now,
  };
}

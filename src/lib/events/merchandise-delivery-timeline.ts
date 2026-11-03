import type { FirestoreEvent } from "@/lib/firestore/types";

export interface MerchandiseDeliveryTimelineConfig {
  leadTimeWeeks: number;
  shippingTimeWeeks: number;
  customNotes?: string | null;
}

export const DEFAULT_MERCHANDISE_LEAD_TIME_WEEKS = 3;
export const DEFAULT_MERCHANDISE_SHIPPING_TIME_WEEKS = 1;

/**
 * Extracts and normalizes merchandise delivery timeline configuration from an event.
 */
export function getMerchandiseDeliveryTimeline(
  event?: Partial<FirestoreEvent> | null,
): MerchandiseDeliveryTimelineConfig {
  const leadTimeWeeks =
    typeof event?.merchandise_delivery_lead_time_weeks === "number" &&
    !Number.isNaN(event.merchandise_delivery_lead_time_weeks) &&
    event.merchandise_delivery_lead_time_weeks >= 0
      ? event.merchandise_delivery_lead_time_weeks
      : DEFAULT_MERCHANDISE_LEAD_TIME_WEEKS;

  const shippingTimeWeeks =
    typeof event?.merchandise_delivery_shipping_time_weeks === "number" &&
    !Number.isNaN(event.merchandise_delivery_shipping_time_weeks) &&
    event.merchandise_delivery_shipping_time_weeks >= 0
      ? event.merchandise_delivery_shipping_time_weeks
      : DEFAULT_MERCHANDISE_SHIPPING_TIME_WEEKS;

  const customNotes = event?.merchandise_delivery_notes?.trim() || null;

  return {
    leadTimeWeeks,
    shippingTimeWeeks,
    customNotes,
  };
}

/**
 * Generates an attendee-friendly human readable notice explaining the production & shipping timeline.
 */
export function formatMerchandiseDeliveryNotice(timeline: MerchandiseDeliveryTimelineConfig): string {
  const { leadTimeWeeks, shippingTimeWeeks, customNotes } = timeline;

  const leadText = leadTimeWeeks === 1 ? "1 week" : `${leadTimeWeeks} weeks`;

  const shippingText = shippingTimeWeeks === 1 ? "1 week" : `${shippingTimeWeeks} weeks`;

  let notice = `Merchandise creation and quality check takes approximately ${leadText} if items are out of quota or require backorder production, followed by approximately ${shippingText} for courier delivery to your address.`;

  if (customNotes) {
    notice += ` ${customNotes}`;
  }

  return notice;
}

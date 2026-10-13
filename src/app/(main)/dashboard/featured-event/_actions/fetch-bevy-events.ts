"use server";

import {
  fetchPublishedEventsAction,
  type PublishedEventOption,
} from "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events";

export type { PublishedEventOption };

/**
 * Server action to fetch chapter events from Bevy API for the featured event picker.
 * Uses the exact same Bevy data pipeline and formatting as the email manager.
 */
export async function fetchFeaturedEventBevyListAction(): Promise<{
  success: boolean;
  events: PublishedEventOption[];
  error?: string;
}> {
  return await fetchPublishedEventsAction();
}

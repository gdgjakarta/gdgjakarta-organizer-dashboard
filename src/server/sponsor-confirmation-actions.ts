"use server";

import { revalidatePath } from "next/cache";

import { createBevySponsor, getBevyEventSponsorsMapping, patchBevyEventSponsors } from "@/lib/bevy/client";
import type { BevyEventSponsorMappingPayload } from "@/lib/bevy/types";
import {
  EMAIL_TEMPLATES_CONFIG,
  getDefaultTemplateByKey,
  getDefaultTemplateDataForType,
  interpolateTemplateHtml,
  interpolateTemplateSubject,
} from "@/lib/events/email-templates";
import { extractApiMessage } from "@/lib/utils";
import type {
  EventSponsorConfig,
  EventSponsorConfirmation,
  SponsorCategory,
  SponsorProposalStatus,
} from "@/types/sponsor";

import { isAuthorizedOrganizerSession } from "./auth-guard";
import { sendEmailDirectInternal } from "./email-template-actions";
import {
  deleteFirestoreDoc,
  getFirestoreDoc,
  getFirestoreEventByIdServer,
  patchFirestoreDoc,
  queryFirestoreDocs,
} from "./firestore-admin";
import { randomBytes } from "node:crypto";

const generateToken = (prefix: string, bytes = 12) => `${prefix}_${randomBytes(bytes).toString("hex")}`;

function buildSponsorConfirmationDocId(eventId: string | number, email: string): string {
  const sanitized = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 75);
  return `spsconf_${String(eventId)}_${sanitized}`;
}

/**
 * Gets or initializes sponsor configuration for an event.
 */
export async function getOrInitEventSponsorConfigAction(
  eventId: string | number,
): Promise<{ success: boolean; config?: EventSponsorConfig; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized. Organizer access required." };
    }

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (event.sponsor_config && event.sponsor_config.share_token) {
      return { success: true, config: event.sponsor_config };
    }

    const initialConfig: EventSponsorConfig = {
      enabled: true,
      share_token: generateToken("sps", 16),
      allow_company_description: true,
      allow_company_url: true,
      default_tier: "community",
    };

    await patchFirestoreDoc("events", String(event.id), {
      sponsor_config: initialConfig,
      updated_at: new Date().toISOString(),
    });

    return { success: true, config: initialConfig };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to get sponsor config.") };
  }
}

/**
 * Updates event sponsor configuration
 */
export async function updateEventSponsorConfigAction(
  eventId: string | number,
  config: Partial<EventSponsorConfig>,
): Promise<{ success: boolean; config?: EventSponsorConfig; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized. Organizer access required." };
    }

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    const mergedConfig: EventSponsorConfig = {
      ...(event.sponsor_config || {
        enabled: true,
        share_token: generateToken("sps", 16),
        default_tier: "community",
      }),
      ...config,
    };

    await patchFirestoreDoc("events", String(event.id), {
      sponsor_config: mergedConfig,
      updated_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, config: mergedConfig };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update sponsor config.") };
  }
}

/**
 * Regenerates the share token for public sponsor confirmation
 */
export async function regenerateSponsorShareTokenAction(
  eventId: string | number,
): Promise<{ success: boolean; share_token?: string; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    const newToken = generateToken("sps", 16);
    const updatedConfig: EventSponsorConfig = {
      ...(event.sponsor_config || {
        enabled: true,
        default_tier: "community",
      }),
      share_token: newToken,
    };

    await patchFirestoreDoc("events", String(event.id), {
      sponsor_config: updatedConfig,
      updated_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, share_token: newToken };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to regenerate sponsor share token.") };
  }
}

/**
 * Public: Lookup existing sponsor confirmation response by email
 */
export async function lookupSponsorConfirmationByEmailAction(
  eventId: string | number,
  email: string,
  token: string,
): Promise<{ success: boolean; confirmation?: EventSponsorConfirmation | null; error?: string }> {
  try {
    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (!event.sponsor_config?.share_token || event.sponsor_config.share_token !== token) {
      return { success: false, error: "Invalid sponsor confirmation link token." };
    }

    const docId = buildSponsorConfirmationDocId(eventId, email);
    const raw = await getFirestoreDoc("event_sponsor_confirmations", docId);
    const doc = raw as unknown as EventSponsorConfirmation | null;

    return { success: true, confirmation: doc };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to lookup sponsor confirmation.") };
  }
}

/**
 * Public: Submit or update sponsor confirmation response
 */
export async function submitSponsorConfirmationAction(
  eventId: string | number,
  token: string,
  data: {
    email: string;
    company_name: string;
    company_legal_name?: string;
    company_address?: string;
    company_url?: string;
    company_description?: string;
    company_logo_url: string;
    contact_name: string;
    contact_title?: string;
    contact_email: string;
    contact_phone?: string;
    selected_tier?: SponsorCategory;
  },
): Promise<{ success: boolean; confirmation?: EventSponsorConfirmation; error?: string }> {
  try {
    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (!event.sponsor_config?.share_token || event.sponsor_config.share_token !== token) {
      return { success: false, error: "Invalid sponsor confirmation link token." };
    }

    if (event.sponsor_config.enabled === false) {
      return { success: false, error: "Sponsor confirmation submissions are currently closed." };
    }

    if (!data.email?.trim() || !data.company_name?.trim() || !data.company_logo_url?.trim()) {
      return { success: false, error: "Missing required company information or logo." };
    }

    const docId = buildSponsorConfirmationDocId(eventId, data.email);
    const rawExisting = await getFirestoreDoc("event_sponsor_confirmations", docId);
    const existing = rawExisting as unknown as EventSponsorConfirmation | null;

    const now = new Date().toISOString();
    const confirmation: EventSponsorConfirmation = {
      id: docId,
      event_id: String(eventId),
      company_name: data.company_name.trim(),
      company_legal_name: data.company_legal_name?.trim() || existing?.company_legal_name || "",
      company_address: data.company_address?.trim() || existing?.company_address || "",
      company_url: data.company_url?.trim() || "",
      company_description: data.company_description?.trim() || "",
      company_logo_url: data.company_logo_url.trim(),
      contact_name: data.contact_name?.trim() || "",
      contact_title: data.contact_title?.trim() || existing?.contact_title || "",
      contact_email: (data.contact_email?.trim() || data.email.trim()).toLowerCase(),
      contact_phone: data.contact_phone?.trim() || "",
      selected_tier: data.selected_tier || event.sponsor_config.default_tier || "community",
      status: existing?.status || "confirmed",
      submitted_at: existing?.submitted_at || now,
      updated_at: now,
      bevy_synced: existing?.bevy_synced || false,
      bevy_sponsor_id: existing?.bevy_sponsor_id,
    };

    const savedConfirmation = await patchFirestoreDoc(
      "event_sponsor_confirmations",
      docId,
      confirmation as unknown as Record<string, unknown>,
    );
    if (!savedConfirmation) {
      return {
        success: false,
        error: "Failed to save your sponsor confirmation. Please try again or contact the GDG Jakarta team.",
      };
    }

    // Also upsert into chapter_sponsors master collection
    const sponsorDocId = `sps_${data.company_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 60)}`;
    const savedChapterSponsor = await patchFirestoreDoc("chapter_sponsors", sponsorDocId, {
      id: sponsorDocId,
      company: confirmation.company_name,
      company_legal_name: confirmation.company_legal_name,
      company_address: confirmation.company_address,
      url: confirmation.company_url,
      description: confirmation.company_description,
      logo: confirmation.company_logo_url,
      contact_name: confirmation.contact_name,
      contact_title: confirmation.contact_title,
      contact_email: confirmation.contact_email,
      contact_phone: confirmation.contact_phone,
      tier: confirmation.selected_tier,
      status: "confirmed",
      created_at: now,
      updated_at: now,
    });
    if (!savedChapterSponsor) {
      console.warn(`[submitSponsorConfirmationAction] Failed to upsert chapter_sponsors/${sponsorDocId}`);
    }

    // Send automated Partner Confirmation Thank You Email
    const recipientEmail = confirmation.contact_email || data.email.trim();
    if (recipientEmail) {
      try {
        const rawTemplateHtml =
          event.email_templates?.partner_confirmation || getDefaultTemplateByKey("partner_confirmation");
        const defaultMeta = EMAIL_TEMPLATES_CONFIG.find((m) => m.key === "partner_confirmation");
        const rawSubject =
          event.email_templates?.partner_confirmation_subject ||
          defaultMeta?.subjectDefault ||
          "Thank You for Supporting {{ $('event-params').item.json.eventName }}!";

        const baseSimData = getDefaultTemplateDataForType("partner_confirmation", event);
        const confirmationShareUrl = `https://gdgjakarta.com/events/${event.id}/partner-confirmation?token=${token}`;
        const configuredBrandGuideUrl =
          event.email_templates?.templates_data?.partner_confirmation?.brandGuideUrl ||
          event.sponsor_config?.brand_guide_url ||
          "https://gdgjakarta.org/brand-guide";

        const simData = {
          ...baseSimData,
          attendee: {
            name: confirmation.contact_name || confirmation.company_name,
            email: recipientEmail,
          },
          event: {
            ...baseSimData.event,
            eventName: event.title?.trim() || "GDG Jakarta",
          },
          companyName: confirmation.company_name,
          sponsorTier: confirmation.selected_tier,
          confirmationUrl: confirmationShareUrl,
          brandGuideUrl: configuredBrandGuideUrl,
        };

        const bodyHtml = interpolateTemplateHtml(rawTemplateHtml, simData);
        const subjectEmail = interpolateTemplateSubject(rawSubject, simData);

        const [firstName, ...rest] = (confirmation.contact_name || confirmation.company_name).trim().split(/\s+/);
        const lastName = rest.join(" ") || "-";

        await sendEmailDirectInternal({
          first_name: firstName || "Partner",
          last_name: lastName,
          email: recipientEmail,
          subjectEmail,
          bodyEmail: bodyHtml,
        });
      } catch (emailErr) {
        console.warn("[submitSponsorConfirmationAction] Failed to dispatch thank you email:", emailErr);
      }
    }

    return { success: true, confirmation };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to submit sponsor confirmation.") };
  }
}

/**
 * Organizer: List all sponsor confirmations for an event
 */
export async function getEventSponsorConfirmationsAction(
  eventId: string | number,
): Promise<{ success: boolean; confirmations?: EventSponsorConfirmation[]; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const docs =
      (await queryFirestoreDocs<EventSponsorConfirmation>("event_sponsor_confirmations", [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(eventId) },
          },
        },
      ])) || [];

    // Also fetch live event partners mapped in Bevy
    const bevyMapping = await getBevyEventSponsorsMapping(eventId);
    const mergedConfirmations: EventSponsorConfirmation[] = [...docs];
    const docMapByBevyId = new Map<number, EventSponsorConfirmation>();
    const docMapByCompany = new Map<string, EventSponsorConfirmation>();

    for (const doc of docs) {
      if (doc.bevy_sponsor_id != null) {
        docMapByBevyId.set(Number(doc.bevy_sponsor_id), doc);
      }
      if (doc.company_name) {
        docMapByCompany.set(doc.company_name.trim().toLowerCase(), doc);
      }
    }

    const newConfirmationsToPersist: EventSponsorConfirmation[] = [];
    const now = new Date().toISOString();

    if (bevyMapping?.all_event_partners && bevyMapping.all_event_partners.length > 0) {
      for (const bp of bevyMapping.all_event_partners) {
        const companyKey = (bp.company || "").trim().toLowerCase();
        const existing =
          docMapByBevyId.get(Number(bp.id)) || (companyKey ? docMapByCompany.get(companyKey) : undefined);

        const logoUrl =
          typeof bp.logo === "object" && bp.logo !== null
            ? bp.logo.url || bp.logo.thumbnail_url || ""
            : typeof bp.logo === "string"
              ? bp.logo
              : "";

        if (existing) {
          // Update Bevy sync fields if missing
          let changed = false;
          if (!existing.bevy_synced) {
            existing.bevy_synced = true;
            changed = true;
          }
          if (!existing.bevy_sponsor_id) {
            existing.bevy_sponsor_id = bp.id;
            changed = true;
          }
          if (!existing.company_logo_url && logoUrl) {
            existing.company_logo_url = logoUrl;
            changed = true;
          }
          if (changed) {
            newConfirmationsToPersist.push(existing);
          }
        } else {
          // Bevy has this sponsor on the event, but dashboard does not have a confirmation record yet -> synthesize
          const sanitizedKey = companyKey.replace(/[^a-z0-9]/g, "_").slice(0, 50) || String(bp.id);
          const docId = `spsconf_${String(eventId)}_${sanitizedKey}`;
          const newConf: EventSponsorConfirmation = {
            id: docId,
            event_id: String(eventId),
            company_name: bp.company.trim(),
            company_url: bp.url || "",
            company_description: bp.description || "",
            company_logo_url: logoUrl,
            contact_name: "",
            contact_email: "",
            contact_phone: "",
            selected_tier: (bp.tier as SponsorCategory) || "partner",
            bevy_sponsor_id: bp.id,
            bevy_synced: true,
            synced_at: now,
            status: "confirmed",
            submitted_at: now,
            updated_at: now,
          };
          mergedConfirmations.push(newConf);
          newConfirmationsToPersist.push(newConf);
          docMapByBevyId.set(Number(bp.id), newConf);
          docMapByCompany.set(companyKey, newConf);
        }
      }
    }

    if (newConfirmationsToPersist.length > 0) {
      Promise.allSettled(
        newConfirmationsToPersist.map((conf) =>
          patchFirestoreDoc("event_sponsor_confirmations", conf.id, conf as unknown as Record<string, unknown>),
        ),
      ).catch((err) => {
        console.warn("[getEventSponsorConfirmationsAction] Error caching event sponsors:", err);
      });
    }

    // Sort by company name
    mergedConfirmations.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));

    return { success: true, confirmations: mergedConfirmations };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to load sponsor confirmations.") };
  }
}

const TIER_KEY_MAP: Record<SponsorCategory, string> = {
  platinum: "sponsors_platinum-4",
  gold: "sponsors_gold-5",
  silver: "sponsors_silver-4",
  bronze: "sponsors_bronze-4",
  community: "sponsors_community-4",
  partner: "partners_list",
  media_partner: "media_partners",
};

/**
 * Helper to update/move a sponsor ID across Bevy tier arrays atomically.
 * Strips the sponsor ID from any tier they currently reside in and places
 * them into the target tier array.
 */
async function syncBevySponsorTierMapping(
  eventId: string | number,
  bevySponsorId: number,
  targetTier: SponsorCategory,
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentMapping = await getBevyEventSponsorsMapping(eventId);
    if (!currentMapping) {
      return { success: false, error: "Could not retrieve current Bevy event sponsor mapping." };
    }

    const targetKey = TIER_KEY_MAP[targetTier] || "partners_list";
    const filterIds = (arr: any[]) =>
      arr.map((item) => (typeof item === "number" ? item : item.id)).filter((id) => id !== bevySponsorId);

    const patchPayload: Record<string, number[]> = {};

    // Remove from other tiers if present
    if (targetKey !== "partners_list" && currentMapping.partners_list?.some((p) => p.id === bevySponsorId)) {
      patchPayload.partners_list = filterIds(currentMapping.partners_list);
    }
    if (targetKey !== "media_partners" && currentMapping.media_partners?.includes(bevySponsorId)) {
      patchPayload.media_partners = filterIds(currentMapping.media_partners);
    }
    if (targetKey !== "sponsors_platinum-4" && currentMapping.sponsors_platinum?.some((p) => p.id === bevySponsorId)) {
      patchPayload["sponsors_platinum-4"] = filterIds(currentMapping.sponsors_platinum);
    }
    if (targetKey !== "sponsors_gold-5" && currentMapping.sponsors_gold?.some((p) => p.id === bevySponsorId)) {
      patchPayload["sponsors_gold-5"] = filterIds(currentMapping.sponsors_gold);
    }
    if (targetKey !== "sponsors_silver-4" && currentMapping.sponsors_silver?.some((p) => p.id === bevySponsorId)) {
      patchPayload["sponsors_silver-4"] = filterIds(currentMapping.sponsors_silver);
    }
    if (targetKey !== "sponsors_bronze-4" && currentMapping.sponsors_bronze?.some((p) => p.id === bevySponsorId)) {
      patchPayload["sponsors_bronze-4"] = filterIds(currentMapping.sponsors_bronze);
    }
    if (
      targetKey !== "sponsors_community-4" &&
      currentMapping.sponsors_community?.some((p) => p.id === bevySponsorId)
    ) {
      patchPayload["sponsors_community-4"] = filterIds(currentMapping.sponsors_community);
    }

    // Add to target tier array
    let existingTargetIds: number[] = [];
    if (targetKey === "partners_list") {
      existingTargetIds = currentMapping.partners_list?.map((p) => p.id) || [];
    } else if (targetKey === "media_partners") {
      existingTargetIds = currentMapping.media_partners || [];
    } else if (targetKey === "sponsors_platinum-4") {
      existingTargetIds = currentMapping.sponsors_platinum?.map((p) => p.id) || [];
    } else if (targetKey === "sponsors_gold-5") {
      existingTargetIds = currentMapping.sponsors_gold?.map((p) => p.id) || [];
    } else if (targetKey === "sponsors_silver-4") {
      existingTargetIds = currentMapping.sponsors_silver?.map((p) => p.id) || [];
    } else if (targetKey === "sponsors_bronze-4") {
      existingTargetIds = currentMapping.sponsors_bronze?.map((p) => p.id) || [];
    } else if (targetKey === "sponsors_community-4") {
      existingTargetIds = currentMapping.sponsors_community?.map((p) => p.id) || [];
    }

    patchPayload[targetKey] = Array.from(new Set([...existingTargetIds, bevySponsorId]));

    const patchRes = await patchBevyEventSponsors(eventId, patchPayload);
    if (!patchRes.success) {
      return { success: false, error: patchRes.error || "Failed to update sponsor tier in Bevy." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to sync sponsor tier to Bevy.") };
  }
}

/**
 * Organizer: Update details of a sponsor confirmation
 */
export async function updateSponsorConfirmationDetailsAction(
  docId: string,
  eventId: string | number,
  updates: Partial<EventSponsorConfirmation>,
): Promise<{ success: boolean; confirmation?: EventSponsorConfirmation; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const rawExisting = await getFirestoreDoc("event_sponsor_confirmations", docId);
    if (!rawExisting) {
      return { success: false, error: "Confirmation record not found." };
    }

    const existingConf = rawExisting as unknown as EventSponsorConfirmation;
    const previousTier = existingConf.selected_tier;
    const newTier = updates.selected_tier;
    const bevySponsorId = existingConf.bevy_sponsor_id;

    // If tier was updated and sponsor is mapped in Bevy, sync the tier change to Bevy
    if (newTier && newTier !== previousTier && bevySponsorId) {
      const syncRes = await syncBevySponsorTierMapping(eventId, bevySponsorId, newTier);
      if (!syncRes.success) {
        console.warn("[updateSponsorConfirmationDetailsAction] Bevy tier sync warning:", syncRes.error);
      }
    }

    const payload: Partial<EventSponsorConfirmation> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await patchFirestoreDoc("event_sponsor_confirmations", docId, payload as unknown as Record<string, unknown>);

    const updatedConf = {
      ...existingConf,
      ...payload,
    };

    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
    return { success: true, confirmation: updatedConf };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update confirmation details.") };
  }
}

/**
 * Organizer: Update status or tier of a sponsor confirmation
 */
export async function updateSponsorConfirmationStatusAction(
  docId: string,
  eventId: string | number,
  updates: {
    status?: SponsorProposalStatus;
    selected_tier?: SponsorCategory;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const rawExisting = await getFirestoreDoc("event_sponsor_confirmations", docId);
    if (rawExisting && updates.selected_tier) {
      const existingConf = rawExisting as unknown as EventSponsorConfirmation;
      if (existingConf.bevy_sponsor_id && existingConf.selected_tier !== updates.selected_tier) {
        await syncBevySponsorTierMapping(eventId, existingConf.bevy_sponsor_id, updates.selected_tier).catch((err) =>
          console.warn("[updateSponsorConfirmationStatusAction] Bevy sync warning:", err),
        );
      }
    }

    await patchFirestoreDoc("event_sponsor_confirmations", docId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update confirmation status.") };
  }
}

/**
 * Organizer: 1-Click Bevy Sync for a confirmed sponsor
 * 1. Creates sponsor in Bevy via POST /api/sponsor/ (if not already created)
 * 2. Maps sponsor to event category in Bevy via PATCH /api/event/{bevyEventId}/
 */
export async function syncSponsorConfirmationToBevyAction(
  confirmationId: string,
  eventId: string | number,
): Promise<{ success: boolean; bevySponsorId?: number; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const rawConfirmation = await getFirestoreDoc("event_sponsor_confirmations", confirmationId);
    if (!rawConfirmation) {
      return { success: false, error: "Confirmation record not found." };
    }
    const confirmation = rawConfirmation as unknown as EventSponsorConfirmation;

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    let sponsorId = confirmation.bevy_sponsor_id;

    // 1. Create in Bevy if missing
    if (!sponsorId) {
      const createRes = await createBevySponsor({
        company: confirmation.company_name,
        url: confirmation.company_url,
        description: confirmation.company_description,
        contact_name: confirmation.contact_name,
        contact_email: confirmation.contact_email,
        contact_phone: confirmation.contact_phone,
        logo: confirmation.company_logo_url,
      });

      if (!createRes.success || !createRes.data?.id) {
        return { success: false, error: createRes.error || "Failed to create sponsor in Bevy." };
      }
      sponsorId = createRes.data.id;
    }

    // 2. Map sponsor to tier category in Bevy (removing from previous tiers cleanly)
    const tier = confirmation.selected_tier || "community";
    const syncRes = await syncBevySponsorTierMapping(event.id, sponsorId, tier);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || "Failed to link sponsor to event in Bevy." };
    }

    // 3. Mark synced in Firestore
    await patchFirestoreDoc("event_sponsor_confirmations", confirmationId, {
      bevy_synced: true,
      bevy_sponsor_id: sponsorId,
      updated_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
    return { success: true, bevySponsorId: sponsorId };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to sync sponsor to Bevy.") };
  }
}

/**
 * Organizer: Add an existing chapter sponsor directly to an event
 */
export async function addSponsorToEventAction(
  eventId: string | number,
  sponsorData: {
    company_name: string;
    company_legal_name?: string;
    company_address?: string;
    company_url?: string;
    company_description?: string;
    company_logo_url?: string;
    contact_name?: string;
    contact_title?: string;
    contact_email?: string;
    contact_phone?: string;
    selected_tier: SponsorCategory;
    bevy_sponsor_id?: number | null;
  },
): Promise<{ success: boolean; confirmation?: EventSponsorConfirmation; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    const now = new Date().toISOString();
    const sanitizedKey = sponsorData.company_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 50);

    const docId = `spsconf_${String(eventId)}_${sanitizedKey}`;
    let sponsorId = sponsorData.bevy_sponsor_id;

    // 1. If no bevy_sponsor_id, create sponsor in Bevy
    if (!sponsorId) {
      const createRes = await createBevySponsor({
        company: sponsorData.company_name,
        url: sponsorData.company_url || "",
        description: sponsorData.company_description || "",
        contact_name: sponsorData.contact_name || "",
        contact_email: sponsorData.contact_email || "",
        contact_phone: sponsorData.contact_phone || "",
        logo: sponsorData.company_logo_url || null,
      });

      if (createRes.success && createRes.data?.id) {
        sponsorId = createRes.data.id;
      }
    }

    // 2. Fetch current event sponsor mapping from Bevy so we don't clobber existing sponsors in that tier
    const tier = sponsorData.selected_tier || "partner";
    const tierKeyMap: Record<SponsorCategory, string> = {
      platinum: "sponsors_platinum-4",
      gold: "sponsors_gold-5",
      silver: "sponsors_silver-4",
      bronze: "sponsors_bronze-4",
      community: "sponsors_community-4",
      partner: "partners_list",
      media_partner: "media_partners",
    };
    const targetKey = tierKeyMap[tier] || "partners_list";

    let bevySynced = false;
    if (sponsorId) {
      const currentMapping = await getBevyEventSponsorsMapping(eventId);
      let existingIds: number[] = [];

      if (targetKey === "partners_list") {
        existingIds = currentMapping?.partners_list?.map((p) => p.id) || [];
      } else if (targetKey === "media_partners") {
        existingIds = currentMapping?.media_partners || [];
      } else if (targetKey === "sponsors_platinum-4") {
        existingIds = currentMapping?.sponsors_platinum?.map((p) => p.id) || [];
      } else if (targetKey === "sponsors_gold-5") {
        existingIds = currentMapping?.sponsors_gold?.map((p) => p.id) || [];
      } else if (targetKey === "sponsors_silver-4") {
        existingIds = currentMapping?.sponsors_silver?.map((p) => p.id) || [];
      } else if (targetKey === "sponsors_bronze-4") {
        existingIds = currentMapping?.sponsors_bronze?.map((p) => p.id) || [];
      } else if (targetKey === "sponsors_community-4") {
        existingIds = currentMapping?.sponsors_community?.map((p) => p.id) || [];
      }

      const mergedIds = Array.from(new Set([...existingIds, sponsorId]));
      const patchRes = await patchBevyEventSponsors(event.id, {
        [targetKey]: mergedIds,
      });
      if (patchRes.success) {
        bevySynced = true;
      }
    }

    // 3. Persist into Firestore event_sponsor_confirmations
    const confirmationDoc: EventSponsorConfirmation = {
      id: docId,
      event_id: String(eventId),
      company_name: sponsorData.company_name.trim(),
      company_legal_name: sponsorData.company_legal_name?.trim() || "",
      company_address: sponsorData.company_address?.trim() || "",
      company_url: sponsorData.company_url || "",
      company_description: sponsorData.company_description || "",
      company_logo_url: sponsorData.company_logo_url || "",
      contact_name: sponsorData.contact_name || "",
      contact_title: sponsorData.contact_title?.trim() || "",
      contact_email: sponsorData.contact_email || "",
      contact_phone: sponsorData.contact_phone || "",
      selected_tier: tier,
      bevy_sponsor_id: sponsorId,
      bevy_synced: bevySynced,
      synced_at: bevySynced ? now : null,
      status: "confirmed",
      submitted_at: now,
      updated_at: now,
    };

    await patchFirestoreDoc(
      "event_sponsor_confirmations",
      docId,
      confirmationDoc as unknown as Record<string, unknown>,
    );

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, confirmation: confirmationDoc };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to add sponsor to event.") };
  }
}

/**
 * Organizer: Remove a sponsor from an event and disassociate in Bevy
 */
export async function removeSponsorFromEventAction(
  confirmationId: string,
  eventId: string | number,
  bevySponsorId?: number | null,
  tier?: SponsorCategory,
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    // 1. If sponsor was mapped in Bevy, remove its ID from the event tier
    if (bevySponsorId) {
      const currentMapping = await getBevyEventSponsorsMapping(eventId);
      if (currentMapping) {
        const tierKeyMap: Record<SponsorCategory, string> = {
          platinum: "sponsors_platinum-4",
          gold: "sponsors_gold-5",
          silver: "sponsors_silver-4",
          bronze: "sponsors_bronze-4",
          community: "sponsors_community-4",
          partner: "partners_list",
          media_partner: "media_partners",
        };
        const targetKey = tier ? tierKeyMap[tier] || "partners_list" : "partners_list";

        const filterIds = (arr: any[]) =>
          arr.map((item) => (typeof item === "number" ? item : item.id)).filter((id) => id !== bevySponsorId);

        const patchPayload: Record<string, number[]> = {};
        if (targetKey === "partners_list" || currentMapping.partners_list.some((p) => p.id === bevySponsorId)) {
          patchPayload.partners_list = filterIds(currentMapping.partners_list);
        }
        if (targetKey === "media_partners" || currentMapping.media_partners.includes(bevySponsorId)) {
          patchPayload.media_partners = filterIds(currentMapping.media_partners);
        }
        if (
          targetKey === "sponsors_platinum-4" ||
          currentMapping.sponsors_platinum.some((p) => p.id === bevySponsorId)
        ) {
          patchPayload["sponsors_platinum-4"] = filterIds(currentMapping.sponsors_platinum);
        }
        if (targetKey === "sponsors_gold-5" || currentMapping.sponsors_gold.some((p) => p.id === bevySponsorId)) {
          patchPayload["sponsors_gold-5"] = filterIds(currentMapping.sponsors_gold);
        }
        if (targetKey === "sponsors_silver-4" || currentMapping.sponsors_silver.some((p) => p.id === bevySponsorId)) {
          patchPayload["sponsors_silver-4"] = filterIds(currentMapping.sponsors_silver);
        }
        if (targetKey === "sponsors_bronze-4" || currentMapping.sponsors_bronze.some((p) => p.id === bevySponsorId)) {
          patchPayload["sponsors_bronze-4"] = filterIds(currentMapping.sponsors_bronze);
        }
        if (
          targetKey === "sponsors_community-4" ||
          currentMapping.sponsors_community.some((p) => p.id === bevySponsorId)
        ) {
          patchPayload["sponsors_community-4"] = filterIds(currentMapping.sponsors_community);
        }

        if (Object.keys(patchPayload).length > 0) {
          await patchBevyEventSponsors(eventId, patchPayload).catch((e) =>
            console.warn("[removeSponsorFromEventAction] Failed to unmap in Bevy:", e),
          );
        }
      }
    }

    // 2. Delete Firestore record
    await deleteFirestoreDoc("event_sponsor_confirmations", confirmationId);

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to remove sponsor from event.") };
  }
}

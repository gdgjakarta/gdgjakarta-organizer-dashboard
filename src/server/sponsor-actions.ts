"use server";

import { revalidatePath } from "next/cache";

import {
  createBevySponsor,
  deleteBevySponsor,
  getBevyChapterDetails,
  getBevySponsorsList,
  patchBevyEventSponsors,
  updateBevyChapterMediaPartners,
  updateBevySponsor,
} from "@/lib/bevy/client";
import type { BevyEventSponsorMappingPayload, BevySponsor } from "@/lib/bevy/types";
import {
  EMAIL_TEMPLATES_CONFIG,
  getCleanDefaultTemplateDataForType,
  getDefaultTemplateByKey,
  interpolateTemplateHtml,
  interpolateTemplateSubject,
  type TemplateSimulatedData,
} from "@/lib/events/email-templates";
import { extractApiMessage } from "@/lib/utils";
import type {
  ChapterSponsorConfig,
  FirestoreSponsor,
  SponsorCategory,
  SponsorProposalSession,
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

/**
 * Get all chapter sponsors, syncing from Bevy and Firestore
 */
export async function getChapterSponsorsAction(): Promise<{
  success: boolean;
  sponsors?: FirestoreSponsor[];
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    // 1. Fetch live chapter partners & sponsors directly from Bevy API
    let bevySponsors: Awaited<ReturnType<typeof getBevySponsorsList>> = [];
    let chapterDetails: Awaited<ReturnType<typeof getBevyChapterDetails>> = null;

    try {
      const [sponsorsRes, chapterRes] = await Promise.allSettled([
        getBevySponsorsList({
          chapterId: 642,
          global: false,
          pageSize: 500,
          sponsorType: "media_partner",
        }),
        getBevyChapterDetails(642),
      ]);
      if (sponsorsRes.status === "fulfilled") {
        bevySponsors = sponsorsRes.value;
      }
      if (chapterRes.status === "fulfilled") {
        chapterDetails = chapterRes.value;
      }
    } catch (bevyErr) {
      console.warn("[getChapterSponsorsAction] Failed to fetch sponsors/chapter from Bevy:", bevyErr);
    }

    const activeBevyIds = new Set<number>(chapterDetails?.media_partners || []);
    const inactiveBevyIds = new Set<number>(chapterDetails?.media_partners_inactive || []);

    // 2. Fetch locally persisted sponsors from Firestore
    const docs = (await queryFirestoreDocs<FirestoreSponsor>("chapter_sponsors", [])) || [];
    const docMapByBevyId = new Map<number, FirestoreSponsor>();
    const docMapByCompany = new Map<string, FirestoreSponsor>();

    for (const doc of docs) {
      if (doc.bevy_id != null) {
        docMapByBevyId.set(Number(doc.bevy_id), doc);
      }
      if (doc.company) {
        docMapByCompany.set(doc.company.trim().toLowerCase(), doc);
      }
    }

    const mergedList: FirestoreSponsor[] = [...docs];
    const newSponsorsToPersist: FirestoreSponsor[] = [];
    const now = new Date().toISOString();

    if (Array.isArray(bevySponsors) && bevySponsors.length > 0) {
      for (const bSponsor of bevySponsors) {
        if (!bSponsor || !bSponsor.id) continue;
        const companyKey = (bSponsor.company || "").trim().toLowerCase();
        const existing =
          docMapByBevyId.get(Number(bSponsor.id)) || (companyKey ? docMapByCompany.get(companyKey) : undefined);

        const logoUrl =
          typeof bSponsor.logo === "object" && bSponsor.logo !== null
            ? bSponsor.logo.url || bSponsor.logo.thumbnail_url || ""
            : typeof bSponsor.logo === "string"
              ? bSponsor.logo
              : "";

        const numBevyId = Number(bSponsor.id);
        const isActiveInBevy = activeBevyIds.size > 0 ? activeBevyIds.has(numBevyId) : !inactiveBevyIds.has(numBevyId);
        const bevyOrderIndex = chapterDetails?.media_partners?.indexOf(numBevyId) ?? -1;

        if (existing) {
          // Update missing bevy_id or fields on existing doc if needed without overriding tier/status
          let changed = false;
          if (!existing.bevy_id) {
            existing.bevy_id = bSponsor.id;
            changed = true;
          }
          if (!existing.logo && logoUrl) {
            existing.logo = logoUrl;
            changed = true;
          }
          if (existing.is_active === undefined || (chapterDetails && existing.is_active !== isActiveInBevy)) {
            existing.is_active = isActiveInBevy;
            changed = true;
          }
          if (
            bevyOrderIndex >= 0 &&
            (existing.display_order === undefined || existing.display_order !== bevyOrderIndex)
          ) {
            existing.display_order = bevyOrderIndex;
            changed = true;
          }
          if (changed) {
            newSponsorsToPersist.push(existing);
          }
        } else {
          // Sponsor exists in Bevy but not yet in Firestore -> synthesize and backfill
          const docId = `sps_${bSponsor.id}`;
          const newSponsor: FirestoreSponsor = {
            id: docId,
            bevy_id: bSponsor.id,
            company: bSponsor.company?.trim() || `Sponsor #${bSponsor.id}`,
            url: bSponsor.url || "",
            description: bSponsor.description || "",
            logo: logoUrl,
            tier: "partner",
            status: "confirmed",
            contact_name: bSponsor.contact_name || "",
            contact_email: bSponsor.contact_email || "",
            contact_phone: bSponsor.contact_phone || "",
            notes: "",
            is_active: isActiveInBevy,
            display_order: bevyOrderIndex >= 0 ? bevyOrderIndex : 9999,
            created_at: now,
            updated_at: now,
          };
          mergedList.push(newSponsor);
          newSponsorsToPersist.push(newSponsor);
          if (newSponsor.bevy_id) {
            docMapByBevyId.set(Number(newSponsor.bevy_id), newSponsor);
          }
          if (newSponsor.company) {
            docMapByCompany.set(newSponsor.company.trim().toLowerCase(), newSponsor);
          }
        }
      }
    }

    // Backfill any newly discovered Bevy sponsors into Firestore in the background
    if (newSponsorsToPersist.length > 0) {
      Promise.allSettled(
        newSponsorsToPersist.map((sp) =>
          patchFirestoreDoc("chapter_sponsors", sp.id, sp as unknown as Record<string, unknown>),
        ),
      ).catch((err) => {
        console.error("[getChapterSponsorsAction] Error backfilling sponsors to Firestore:", err);
      });
    }

    // Sort: active sponsors first ordered by display_order ascending, then inactive sponsors
    mergedList.sort((a, b) => {
      const aActive = a.is_active ?? true;
      const bActive = b.is_active ?? true;
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aOrder = a.display_order ?? 9999;
      const bOrder = b.display_order ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.company || "").localeCompare(b.company || "");
    });

    return { success: true, sponsors: mergedList };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to load sponsors.") };
  }
}

/**
 * Save or update sponsor in Firestore and optionally create in Bevy
 */
export async function saveChapterSponsorAction(
  data: Partial<FirestoreSponsor> & { company: string },
): Promise<{ success: boolean; sponsor?: FirestoreSponsor; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const docId =
      data.id ||
      (data.bevy_id ? `sps_${data.bevy_id}` : undefined) ||
      `sps_${data.company
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 60)}`;

    const rawExisting = await getFirestoreDoc("chapter_sponsors", docId);
    const existing = rawExisting as unknown as FirestoreSponsor | null;
    const now = new Date().toISOString();

    let bevyId = data.bevy_id != null ? Number(data.bevy_id) : existing?.bevy_id;

    // If no bevy_id yet, create in Bevy. If bevy_id exists, update in Bevy.
    if (!bevyId) {
      const bevyRes = await createBevySponsor({
        company: data.company,
        url: data.url || "",
        description: data.description || "",
        contact_name: data.contact_name || "",
        contact_email: data.contact_email || "",
        contact_phone: data.contact_phone || "",
        logo: data.logo || null,
      });

      if (bevyRes.success && bevyRes.data?.id) {
        bevyId = bevyRes.data.id;
      }
    } else {
      await updateBevySponsor(bevyId, {
        company: data.company,
        url: data.url || "",
        description: data.description || "",
        contact_name: data.contact_name || "",
        contact_email: data.contact_email || "",
        contact_phone: data.contact_phone || "",
        logo: data.logo !== undefined ? data.logo : undefined,
      }).catch((bevyErr) => {
        console.warn(`[saveChapterSponsorAction] Could not update sponsor ${bevyId} in Bevy:`, bevyErr);
      });
    }

    const sponsorData: FirestoreSponsor = {
      id: docId,
      company: data.company.trim(),
      company_legal_name: data.company_legal_name?.trim() ?? existing?.company_legal_name ?? "",
      company_address: data.company_address?.trim() ?? existing?.company_address ?? "",
      url: data.url || "",
      description: data.description || "",
      logo: data.logo || "",
      tier: data.tier || "community",
      status: data.status || "confirmed",
      contact_name: data.contact_name || "",
      contact_title: data.contact_title?.trim() ?? existing?.contact_title ?? "",
      contact_email: data.contact_email || "",
      contact_phone: data.contact_phone || "",
      notes: data.notes || "",
      bevy_id: bevyId,
      is_active: data.is_active ?? existing?.is_active ?? true,
      display_order: data.display_order ?? existing?.display_order ?? 999,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const saveOk = await patchFirestoreDoc(
      "chapter_sponsors",
      docId,
      sponsorData as unknown as Record<string, unknown>,
    );
    if (!saveOk) {
      console.error(`[saveChapterSponsorAction] Failed to persist sponsor ${docId} to database.`);
      return { success: false, error: "Failed to save sponsor details. Please try again." };
    }

    revalidatePath("/dashboard/partnership");
    return { success: true, sponsor: sponsorData };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to save sponsor.") };
  }
}

/**
 * Delete a sponsor from Firestore and Bevy
 */
export async function deleteChapterSponsorAction(
  sponsorId: string,
  bevyId?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    await deleteFirestoreDoc("chapter_sponsors", sponsorId);

    if (bevyId) {
      await deleteBevySponsor(bevyId);
    }

    revalidatePath("/dashboard/partnership");
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to delete sponsor.") };
  }
}

/**
 * Send Sponsor Proposal Email via n8n with tokenized proposal URL
 * Uses saved `event_proposal` email template for the target event
 */
export async function sendSponsorProposalEmailAction(input: {
  eventId: string | number;
  companyName: string;
  recipientEmail: string;
  recipientName?: string;
  sponsorTier?: SponsorCategory;
  proposalDeckUrl?: string;
  customMessage?: string;
}): Promise<{ success: boolean; proposalSession?: SponsorProposalSession; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const event = await getFirestoreEventByIdServer(String(input.eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    const proposalToken = generateToken("prop", 16);
    const proposalUrl = `https://gdgjakarta.com/partnership/proposals/${proposalToken}`;
    const confirmationUrl = event.sponsor_config?.share_token
      ? `https://gdgjakarta.com/events/${event.id}/partner-confirmation?token=${event.sponsor_config.share_token}`
      : `https://gdgjakarta.com/events/${event.id}/partner-confirmation`;

    // 1. Persist proposal session
    const proposalSession: SponsorProposalSession = {
      id: proposalToken,
      token: proposalToken,
      event_id: String(event.id),
      event_title: event.title,
      company_name: input.companyName,
      recipient_email: input.recipientEmail.trim().toLowerCase(),
      recipient_name: input.recipientName || input.companyName,
      status: "proposal_sent",
      deck_url: input.proposalDeckUrl || "",
      tier: input.sponsorTier || "community",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await patchFirestoreDoc("sponsor_proposals", proposalToken, proposalSession as unknown as Record<string, unknown>);

    // 2. Resolve email template
    const templateHtml = event.email_templates?.event_proposal || getDefaultTemplateByKey("event_proposal");

    const templateData = getCleanDefaultTemplateDataForType("event_proposal", event);

    const mergedData: TemplateSimulatedData = {
      ...templateData,
      proposalUrl,
      deckUrl: input.proposalDeckUrl || "",
      confirmationUrl,
      sponsorTier: input.sponsorTier || "community",
      companyName: input.companyName,
      attendee: {
        name: input.recipientName || input.companyName,
        email: input.recipientEmail,
      },
      event: {
        headerEmailUrl: event.banner_url || event.picture_url || templateData.event.headerEmailUrl,
        eventName: event.title,
        eventCtaUrl: `https://gdgjakarta.com/events/${event.id}`,
        eventChecklistItems: templateData.event.eventChecklistItems,
      },
    };

    const interpolatedHtml = interpolateTemplateHtml(templateHtml, mergedData);

    const subject =
      event.email_templates?.event_proposal_subject ||
      `Partnership & Sponsorship Invitation — ${event.title} | GDG Jakarta`;

    // 3. Dispatch email via n8n
    const [firstName, ...rest] = (input.recipientName || input.companyName).trim().split(/\s+/);
    const lastName = rest.join(" ") || "-";

    const sendResult = await sendEmailDirectInternal({
      first_name: firstName || "Partner",
      last_name: lastName,
      email: input.recipientEmail.trim().toLowerCase(),
      subjectEmail: subject,
      bodyEmail: interpolatedHtml,
    });

    if (!sendResult.success) {
      return { success: false, error: sendResult.error || "Failed to dispatch email via n8n." };
    }

    // Update status in chapter_sponsors if exists
    const sponsorDocId = `sps_${input.companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 60)}`;
    const existing = await getFirestoreDoc("chapter_sponsors", sponsorDocId);
    if (existing) {
      await patchFirestoreDoc("chapter_sponsors", sponsorDocId, {
        status: "proposal_sent",
        updated_at: new Date().toISOString(),
      });
    }

    revalidatePath(`/dashboard/events/${event.id}`);
    revalidatePath(`/dashboard/partnership`);
    return { success: true, proposalSession };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to send proposal email.") };
  }
}

/**
 * Reorder chapter sponsors and update active/inactive state, syncing to Bevy and Firestore
 */
export async function reorderChapterSponsorsAction(
  items: Array<{ id: string; bevy_id?: number | null; is_active: boolean; display_order: number }>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { success: true };
    }

    const now = new Date().toISOString();

    // 1. Separate into active and inactive bevy IDs in order
    const activeBevyIds: number[] = [];
    const inactiveBevyIds: number[] = [];

    const activeItems = items.filter((i) => i.is_active).sort((a, b) => a.display_order - b.display_order);
    const inactiveItems = items.filter((i) => !i.is_active).sort((a, b) => a.display_order - b.display_order);

    for (const item of activeItems) {
      if (item.bevy_id != null) {
        activeBevyIds.push(Number(item.bevy_id));
      }
    }
    for (const item of inactiveItems) {
      if (item.bevy_id != null) {
        inactiveBevyIds.push(Number(item.bevy_id));
      }
    }

    // 2. Sync to Bevy chapter media_partners & media_partners_inactive
    const bevyRes = await updateBevyChapterMediaPartners(activeBevyIds, inactiveBevyIds);
    if (!bevyRes.success) {
      console.warn("[reorderChapterSponsorsAction] Could not sync with Bevy chapter endpoint:", bevyRes.error);
    }

    // 3. Persist order and active status to Firestore
    await Promise.allSettled(
      items.map((item) =>
        patchFirestoreDoc("chapter_sponsors", item.id, {
          is_active: item.is_active,
          display_order: item.display_order,
          updated_at: now,
        }),
      ),
    );

    revalidatePath("/dashboard/partnership");
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update sponsor positions.") };
  }
}

/**
 * Gets or initializes chapter-level sponsor configuration
 */
export async function getOrInitChapterSponsorConfigAction(): Promise<{
  success: boolean;
  config?: ChapterSponsorConfig;
  error?: string;
}> {
  try {
    const raw = await getFirestoreDoc("system_settings", "chapter_sponsors");
    const existing = raw as unknown as ChapterSponsorConfig | null;

    if (existing && existing.share_token) {
      return { success: true, config: existing };
    }

    const initialConfig: ChapterSponsorConfig = {
      enabled: true,
      share_token: generateToken("sps_chp", 16),
      default_tier: "partner",
      allow_company_description: true,
      allow_company_url: true,
      updated_at: new Date().toISOString(),
    };

    await patchFirestoreDoc(
      "system_settings",
      "chapter_sponsors",
      initialConfig as unknown as Record<string, unknown>,
      true,
    );

    return { success: true, config: initialConfig };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to load chapter sponsor configuration.") };
  }
}

/**
 * Updates chapter-level sponsor configuration
 */
export async function updateChapterSponsorConfigAction(
  updates: Partial<ChapterSponsorConfig>,
): Promise<{ success: boolean; config?: ChapterSponsorConfig; error?: string }> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized. Organizer access required." };
    }

    const currentRes = await getOrInitChapterSponsorConfigAction();
    const mergedConfig: ChapterSponsorConfig = {
      ...(currentRes.config || {
        enabled: true,
        share_token: generateToken("sps_chp", 16),
        default_tier: "partner",
        allow_company_description: true,
        allow_company_url: true,
      }),
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await patchFirestoreDoc(
      "system_settings",
      "chapter_sponsors",
      mergedConfig as unknown as Record<string, unknown>,
      true,
    );
    revalidatePath("/dashboard/partnership");
    return { success: true, config: mergedConfig };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update chapter sponsor configuration.") };
  }
}

/**
 * Regenerates the share token for chapter sponsor confirmation
 */
export async function regenerateChapterSponsorShareTokenAction(): Promise<{
  success: boolean;
  share_token?: string;
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const newToken = generateToken("sps_chp", 16);
    const now = new Date().toISOString();

    await patchFirestoreDoc(
      "system_settings",
      "chapter_sponsors",
      {
        share_token: newToken,
        updated_at: now,
      },
      true,
    );

    revalidatePath("/dashboard/partnership");
    return { success: true, share_token: newToken };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to regenerate chapter sponsor share token.") };
  }
}

/**
 * Public: Lookup existing chapter sponsor submission by email
 */
export async function lookupChapterSponsorByEmailAction(
  email: string,
  token: string,
): Promise<{ success: boolean; sponsor?: FirestoreSponsor | null; error?: string }> {
  try {
    const configRes = await getOrInitChapterSponsorConfigAction();
    if (!configRes.success || !configRes.config || configRes.config.share_token !== token) {
      return { success: false, error: "Invalid sponsor confirmation link token." };
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const allSponsors = (await queryFirestoreDocs<FirestoreSponsor>("chapter_sponsors", [])) || [];
    const found = allSponsors.find((s) => (s.contact_email || "").trim().toLowerCase() === sanitizedEmail);

    return { success: true, sponsor: found || null };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to lookup sponsor profile.") };
  }
}

/**
 * Public: Submit non-event chapter sponsor confirmation
 * Saves directly into `chapter_sponsors` master directory and revalidates live pages.
 */
export async function submitChapterSponsorConfirmationAction(
  token: string,
  data: {
    email: string;
    company_name: string;
    company_legal_name?: string;
    company_address?: string;
    company_url?: string;
    company_description?: string;
    company_logo_url: string;
    contact_name?: string;
    contact_title?: string;
    contact_email?: string;
    contact_phone?: string;
    selected_tier?: SponsorCategory;
  },
): Promise<{ success: boolean; sponsor?: FirestoreSponsor; error?: string }> {
  try {
    const configRes = await getOrInitChapterSponsorConfigAction();
    if (!configRes.success || !configRes.config || configRes.config.share_token !== token) {
      return { success: false, error: "Invalid sponsor confirmation link token." };
    }

    if (configRes.config.enabled === false) {
      return { success: false, error: "Sponsor confirmations are currently closed." };
    }

    if (!data.company_name?.trim() || !data.company_logo_url?.trim()) {
      return { success: false, error: "Missing required company name or logo." };
    }

    const companyClean = data.company_name.trim();
    const docId = `sps_${companyClean
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60)}`;

    const rawExisting = await getFirestoreDoc("chapter_sponsors", docId);
    const existing = rawExisting as unknown as FirestoreSponsor | null;
    const now = new Date().toISOString();

    const sponsorData: FirestoreSponsor = {
      id: docId,
      company: companyClean,
      company_legal_name: data.company_legal_name?.trim() || existing?.company_legal_name || "",
      company_address: data.company_address?.trim() || existing?.company_address || "",
      url: data.company_url?.trim() || "",
      description: data.company_description?.trim() || "",
      logo: data.company_logo_url.trim(),
      tier: data.selected_tier || existing?.tier || "partner",
      status: "confirmed",
      contact_name: data.contact_name?.trim() || "",
      contact_title: data.contact_title?.trim() || existing?.contact_title || "",
      contact_email: (data.contact_email?.trim() || data.email?.trim() || "").toLowerCase(),
      contact_phone: data.contact_phone?.trim() || "",
      is_active: existing?.is_active ?? true,
      display_order: existing?.display_order ?? 999,
      bevy_id: existing?.bevy_id || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await patchFirestoreDoc("chapter_sponsors", docId, sponsorData as unknown as Record<string, unknown>);

    // Send automated Partner Confirmation Thank You Email (Chapter-wide / Non-event bound)
    const recipientEmail = sponsorData.contact_email || data.email?.trim();
    if (recipientEmail) {
      try {
        const rawTemplateHtml = getDefaultTemplateByKey("partner_confirmation");
        const defaultMeta = EMAIL_TEMPLATES_CONFIG.find((m) => m.key === "partner_confirmation");
        const rawSubject =
          defaultMeta?.subjectDefault || "Thank You for Supporting {{ $('event-params').item.json.eventName }}!";

        const configuredBrandGuideUrl = configRes.config.brand_guide_url || "https://gdgjakarta.org/brand-guide";
        const confirmationShareUrl = `https://gdgjakarta.com/partnership/partner-confirmation?token=${token}`;

        const simData: TemplateSimulatedData = {
          attendee: {
            name: sponsorData.contact_name || sponsorData.company,
            email: recipientEmail,
          },
          event: {
            headerEmailUrl: "https://assets.gdgjakarta.org/gdg-jakarta/gdg-banner.png",
            eventName: "GDG Jakarta Community",
            eventCtaUrl: "https://gdgjakarta.com",
            eventChecklistItems: [
              "Brand & Logo Assets: Review GDG Jakarta's Logo & Brand Guidelines below to coordinate promotional co-branding.",
              "Agreement & Deliverables Coordination: Our partnership team will reach out regarding your Letter of Agreement (LOA) or MOU and promotional timeline.",
              "Update Anytime: If you need to update your logo or contact details, click the Review Submission link above and use Load My Response.",
            ],
          },
          companyName: sponsorData.company,
          sponsorTier: sponsorData.tier,
          confirmationUrl: confirmationShareUrl,
          brandGuideUrl: configuredBrandGuideUrl,
        };

        const bodyHtml = interpolateTemplateHtml(rawTemplateHtml, simData);
        const subjectEmail = interpolateTemplateSubject(rawSubject, simData);

        const [firstName, ...rest] = (sponsorData.contact_name || sponsorData.company).trim().split(/\s+/);
        const lastName = rest.join(" ") || "-";

        await sendEmailDirectInternal({
          first_name: firstName || "Partner",
          last_name: lastName,
          email: recipientEmail,
          subjectEmail,
          bodyEmail: bodyHtml,
        });
      } catch (emailErr) {
        console.warn("[submitChapterSponsorConfirmationAction] Failed to dispatch thank you email:", emailErr);
      }
    }

    // Revalidate live home page, partnership page, and organizer dashboard
    revalidatePath("/");
    revalidatePath("/partnership");
    revalidatePath("/dashboard/partnership");

    return { success: true, sponsor: sponsorData };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to submit sponsor confirmation.") };
  }
}

/**
 * Public: Fetch merged active sponsors for live public pages (Home & /partnership).
 * Combines Bevy chapter sponsors with approved active Firestore sponsors (e.g., from public confirmation).
 */
export async function getLivePublicChapterSponsorsAction(): Promise<BevySponsor[]> {
  try {
    const { getBevyChapterSponsors } = await import("@/lib/bevy/client");
    const { BEVY_CONFIG } = await import("@/config/bevy-config");

    const [bevySponsors, firestoreDocs] = await Promise.all([
      getBevyChapterSponsors(BEVY_CONFIG.chapterSlug || BEVY_CONFIG.chapterId).catch(() => []),
      queryFirestoreDocs<FirestoreSponsor>("chapter_sponsors", []).catch(() => []),
    ]);

    const seenCompanies = new Set<string>();
    const results: BevySponsor[] = [];

    // 1. Add active Firestore sponsors first (ensures custom logo/data takes precedence)
    const activeFirestore = firestoreDocs.filter((s) => s.is_active !== false && s.status === "confirmed" && s.logo);
    activeFirestore.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

    for (const fs of activeFirestore) {
      const norm = fs.company.trim().toLowerCase();
      if (!seenCompanies.has(norm)) {
        seenCompanies.add(norm);
        results.push({
          company: fs.company,
          description: fs.description || null,
          url: fs.url || null,
          logo: fs.logo || null,
          sponsor_type: fs.tier || "media_partner",
          contact_name: fs.contact_name || null,
          contact_email: fs.contact_email || null,
          contact_phone: fs.contact_phone || null,
          isActive: true,
        });
      }
    }

    // 2. Add Bevy chapter sponsors
    for (const bs of bevySponsors) {
      if (!bs.company || !bs.logo) continue;
      const norm = bs.company.trim().toLowerCase();
      if (!seenCompanies.has(norm)) {
        seenCompanies.add(norm);
        results.push(bs);
      }
    }

    return results;
  } catch (err) {
    console.error("[getLivePublicChapterSponsorsAction] Failed to load public sponsors:", err);
    return [];
  }
}

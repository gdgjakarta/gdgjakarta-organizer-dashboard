"use server";

import { revalidatePath } from "next/cache";

import { extractApiMessage } from "@/lib/utils";
import type { SponsorProposalSession, SponsorProposalStatus } from "@/types/sponsor";

import { getFirestoreDoc, patchFirestoreDoc } from "./firestore-admin";

/**
 * Public: Load proposal session data by token
 */
export async function getProposalByTokenAction(
  token: string,
): Promise<{ success: boolean; proposal?: SponsorProposalSession | null; error?: string }> {
  try {
    if (!token) {
      return { success: false, error: "Missing proposal token." };
    }

    const raw = await getFirestoreDoc("sponsor_proposals", token);
    if (!raw) {
      return { success: false, error: "Proposal not found or invalid link." };
    }

    const proposal = raw as unknown as SponsorProposalSession;
    return { success: true, proposal };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to load proposal.") };
  }
}

/**
 * Public: Submit decision on proposal ("confirmed" to tap in or "declined")
 */
export async function submitProposalDecisionAction(
  token: string,
  decision: "confirmed" | "declined",
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!token) {
      return { success: false, error: "Missing proposal token." };
    }

    const rawProposal = await getFirestoreDoc("sponsor_proposals", token);
    if (!rawProposal) {
      return { success: false, error: "Proposal not found." };
    }
    const proposal = rawProposal as unknown as SponsorProposalSession;

    const now = new Date().toISOString();
    await patchFirestoreDoc("sponsor_proposals", token, {
      status: decision,
      notes: notes || proposal.notes || "",
      updated_at: now,
    });

    // Also update chapter_sponsors if matching company exists
    const sponsorDocId = `sps_${proposal.company_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 60)}`;
    const existingSponsor = await getFirestoreDoc("chapter_sponsors", sponsorDocId);
    if (existingSponsor) {
      await patchFirestoreDoc("chapter_sponsors", sponsorDocId, {
        status: decision,
        updated_at: now,
      });
    }

    revalidatePath(`/partnership/proposals/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to record decision.") };
  }
}

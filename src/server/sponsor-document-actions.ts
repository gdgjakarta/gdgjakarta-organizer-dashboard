"use server";

import { revalidatePath } from "next/cache";

import { validateEmailRecipients } from "@/lib/email-recipients";
import { extractApiMessage } from "@/lib/utils";
import type {
  SponsorCategory,
  SponsorDocument,
  SponsorDocumentLineItem,
  SponsorDocumentStatus,
  SponsorDocumentTemplatesConfig,
  SponsorDocumentType,
} from "@/types/sponsor";

import { isAuthorizedOrganizerSession } from "./auth-guard";
import { sendEmailDirectInternal } from "./email-template-actions";
import { deleteFirestoreDoc, getFirestoreDoc, patchFirestoreDoc, queryFirestoreDocs } from "./firestore-admin";
import { randomBytes } from "node:crypto";

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSponsorDocTypeLabel(docType: SponsorDocumentType): string {
  if (docType === "invoice") return "Official Invoice";
  if (docType === "quotation") return "Sponsorship Quotation";
  if (docType === "mou") return "Partnership Memorandum of Understanding (MOU)";
  return "Sponsorship Letter of Agreement (LOA)";
}

export async function getDefaultSponsorDocumentTemplatesConfig(): Promise<SponsorDocumentTemplatesConfig> {
  return {
    org_name: "Google Developer Group Jakarta",
    org_address: "Jl. Rawa Belong 2C no. 3A, Palmerah, Jakarta Barat, DKI Jakarta, 11480",
    org_email: "info@gdgjakarta.org",
    org_phone: "+628559996648",
    bank_name: "Bank Jago",
    bank_account_number: "509332739966",
    bank_account_name: "FACHRIDAN TIO MUAFA",
    bank_swift_code: "JAGBIDJAXXX",
    invoice_signer_name: "Fachridan Tio M.",
    invoice_signer_title: "GDG Jakarta Organizer",
    quotation_signer_name: "Fachridan Tio M.",
    quotation_signer_title: "GDG Jakarta Organizer",
    loa_signer_name: "Fachridan Tio M.",
    loa_signer_title: "GDG Jakarta Organizer",
    mou_signer_name: "Fachridan Tio M.",
    mou_signer_title: "GDG Jakarta Organizer",
    organizer_signature_url: "",
    invoice_number_pattern: "{{year}}/INV/{{seq}}",
    quotation_number_pattern: "{{seq}}/QUO/GDGJKT/{{romanMonth}}/{{year}}",
    loa_number_pattern: "{{seq}}/LOA/GDGJKT/{{romanMonth}}/{{year}}",
    mou_number_pattern: "{{seq}}/MOU/GDGJKT/{{romanMonth}}/{{year}}",
    invoice_tax_note:
      "The applicable tax obligations will be covered in full by the sponsor, ensuring that the beneficiary incurs no additional financial liability in this regard",
    quotation_validity_note: "This quotation valid until 30 days",
    loa_intro_text:
      "Thank you for agreeing to become {{eventName}} Event Sponsor. This letter confirms the sponsorship agreements, which are set out below.",
    loa_payment_term_days: "45 days of the invoice date",
    loa_clause_1_text: "You are sponsoring the event {{eventName}} on {{eventDate}}, as a {{sponsorTier}}.",
    loa_clause_2_text:
      "You agree with the sponsor amount of {{totalAmount}}. You will pay this amount to the organizer within {{paymentTermDays}}.",
    loa_clause_5_text: "The organizer shall give the event’s completion report to the {{sponsorTier}}.",
    loa_term_payment_method:
      "Payment should be made directly to the bank account specified above. All bank charges and transfer fees are the responsibility of the sponsor.",
    loa_term_workshop:
      "The sponsor will receive a 1-hour workshop session during the event. The content and format of the workshop should be aligned with the event theme and subject to organizer approval.",
    loa_term_duration:
      "This agreement is effective immediately upon signing by both parties and will remain in effect until the event has concluded and the post-event report has been delivered.",
    loa_term_termination:
      "Once the agreement is signed by both parties, it is considered final and binding. Due to the proximity of the event date, termination or withdrawal by the sponsor will not be permitted.",
    loa_disclaimer:
      "Sponsorship is accepted on a first-come, first-served basis. By signing below, parties (the Organizer and the Sponsor) agree to meet the obligations listed in the sponsorship terms.",
    mou_intro_text:
      "This Memorandum of Understanding (MOU) is entered into between Google Developer Group (GDG) Jakarta ('Organizer') and {{companyName}} ('{{sponsorTier}}') to establish a mutually beneficial collaboration for {{eventName}}.",
    mou_clause_1_purpose:
      "Both parties agree to collaborate for the event {{eventName}} scheduled on {{eventDate}} at {{eventLocation}}, with {{companyName}} participating officially as a {{sponsorTier}}.",
    mou_clause_4_logo_ip:
      "Each party grants the other a non-exclusive, royalty-free license to use its name, logo, and official brand assets solely for promotional and marketing activities related to {{eventName}}.",
    mou_clause_5_term:
      "This Memorandum of Understanding is effective upon signing by both parties and remains valid until the conclusion of {{eventName}} and completion of post-event reporting.",
    mou_clause_6_non_financial:
      "This collaboration is a non-monetary strategic partnership based on mutual community, promotional, or media value exchange unless otherwise agreed in writing. Either party may amend this understanding by mutual written consent.",
    mou_disclaimer:
      "By signing below, both parties (the Organizer and the Partner) acknowledge and agree to carry out the mutual responsibilities set forth in this Memorandum of Understanding in good faith.",
    default_mou_organizer_commitments: {
      community: [
        "Logo placement on official event website, digital posters, and stage holding slides as Community Partner",
        "Dedicated Community Partner appreciation post/story on GDG Jakarta official social media channels",
        "Complimentary community passes / priority access allocation for partner representatives",
        "Post-event completion & impact report shared after the event concludes",
      ],
      media_partner: [
        "Logo placement on official event website, press releases, and promotional materials as Official Media Partner",
        "Complimentary Media / Press passes with interview and coverage access during the event",
        "Official media kit, event photography, and press assets provided by GDG Jakarta",
        "Social media acknowledgment and post-event coverage summary",
      ],
      partner: [
        "Official Partner logo placement on website and event promotional materials",
        "Dedicated social media mention and community shoutout",
        "Complimentary representative passes to attend the event",
        "Post-event completion report",
      ],
    },
    default_tier_deliverables: {
      platinum: [
        "Dedicated Session Titling",
        "Speaking Opportunities (the title has to meet our criteria)",
        "Sponsor’s Video Looping (max 2 mins)",
        "Brand Booth Space (3m x 2m)",
        "Brand’s Merchandise Placement",
        "Large Brand Visibility",
        "Ad-Libs in every idle (min 2 times)",
        "Dedicated Social Media Content (in our Instagram’s post & stories)",
        "GDG Jakarta’s Newsletter (min 2 times)",
      ],
      gold: [
        "Speaking Opportunities (the title has to meet our criteria)",
        "Brand Booth Space (2m x 2m)",
        "Brand’s Merchandise Placement",
        "Medium Brand Visibility",
        "Ad-Libs in every idle (min 2 times)",
        "Dedicated Social Media Content (in our Instagram’s post & stories)",
        "GDG Jakarta’s Newsletter (min 2 times)",
      ],
      silver: [
        "Brand’s Merchandise Placement",
        "Small Brand Visibility",
        "Ad-Libs in every idle (min 2 times)",
        "Dedicated Social Media Content (in our Instagram’s post & stories)",
        "GDG Jakarta’s Newsletter (min 2 times)",
      ],
      bronze: [
        "Brand’s Merchandise Placement",
        "Small Brand Visibility",
        "Dedicated Social Media Content (in our Instagram’s post & stories)",
      ],
      community: ["Community Partner Logo Placement on Website & Event Materials", "Social Media Mention"],
      partner: ["Official Chapter Partner Logo Placement", "Dedicated Social Media Shoutout"],
      media_partner: ["Media Partner Logo Placement", "Mutual Event Promotion & Coverage"],
    },
    default_tier_prices: {
      platinum: 50000000,
      gold: 35000000,
      silver: 15000000,
      bronze: 7500000,
      community: 0,
      partner: 0,
      media_partner: 0,
    },
  };
}

function formatDocumentNumber(pattern: string, seqNumber: number, dateObj = new Date()): string {
  const year = String(dateObj.getFullYear());
  const monthIdx = dateObj.getMonth();
  const month = String(monthIdx + 1).padStart(2, "0");
  const romanMonth = ROMAN_MONTHS[monthIdx] || "I";
  const seq = String(seqNumber).padStart(3, "0");

  return pattern
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{month\}\}/g, month)
    .replace(/\{\{romanMonth\}\}/g, romanMonth)
    .replace(/\{\{seq\}\}/g, seq);
}

/**
 * Get global sponsor document templates configuration (stored in site_config/sponsor_document_templates)
 */
export async function getSponsorDocumentTemplatesConfigAction(): Promise<{
  success: boolean;
  config?: SponsorDocumentTemplatesConfig;
  error?: string;
}> {
  try {
    const raw = await getFirestoreDoc("site_config", "sponsor_document_templates");
    const defaults = await getDefaultSponsorDocumentTemplatesConfig();
    if (!raw) {
      return { success: true, config: defaults };
    }
    const existing = raw as unknown as Partial<SponsorDocumentTemplatesConfig>;
    if (existing.invoice_number_pattern === "{{year}}/DF/{{seq}}") {
      existing.invoice_number_pattern = "{{year}}/INV/{{seq}}";
    }
    if (existing.bank_name === "Bank Central Asia") existing.bank_name = "Bank Jago";
    if (existing.bank_account_number === "5271522330") existing.bank_account_number = "509332739966";
    if (existing.bank_account_name === "Anggi Maisa Hadaya" || existing.bank_account_name === "Fachridan Tio Mu'afa")
      existing.bank_account_name = "FACHRIDAN TIO MUAFA";
    if (existing.bank_swift_code === "CENAIDJA") existing.bank_swift_code = "JAGBIDJAXXX";
    if (existing.invoice_signer_name === "Anggi Maisa Hadaya") existing.invoice_signer_name = "Fachridan Tio M.";
    if (existing.invoice_signer_title === "Organizer GDG Jakarta")
      existing.invoice_signer_title = "GDG Jakarta Organizer";
    if (existing.quotation_signer_name === "Putranto Adhi N") existing.quotation_signer_name = "Fachridan Tio M.";
    if (existing.quotation_signer_title === "Lead Organizer : GDG Jakarta")
      existing.quotation_signer_title = "GDG Jakarta Organizer";
    if (existing.loa_signer_name === "Anggi Maisa") existing.loa_signer_name = "Fachridan Tio M.";
    if (existing.loa_signer_title === "GDG Jakarta") existing.loa_signer_title = "GDG Jakarta Organizer";
    return {
      success: true,
      config: {
        ...defaults,
        ...existing,
        default_tier_deliverables: {
          ...defaults.default_tier_deliverables,
          ...(existing.default_tier_deliverables || {}),
        },
        default_mou_organizer_commitments: {
          ...defaults.default_mou_organizer_commitments,
          ...(existing.default_mou_organizer_commitments || {}),
        },
        default_tier_prices: {
          ...defaults.default_tier_prices,
          ...(existing.default_tier_prices || {}),
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to load document templates configuration."),
    };
  }
}

/**
 * Save global sponsor document templates configuration (stored in site_config/sponsor_document_templates)
 */
export async function saveSponsorDocumentTemplatesConfigAction(
  config: Partial<SponsorDocumentTemplatesConfig>,
): Promise<{
  success: boolean;
  config?: SponsorDocumentTemplatesConfig;
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const currentRes = await getSponsorDocumentTemplatesConfigAction();
    const defaults = await getDefaultSponsorDocumentTemplatesConfig();
    const merged: SponsorDocumentTemplatesConfig = {
      ...(currentRes.config || defaults),
      ...config,
      updated_at: new Date().toISOString(),
    };

    const ok = await patchFirestoreDoc(
      "site_config",
      "sponsor_document_templates",
      merged as unknown as Record<string, unknown>,
    );

    if (!ok) {
      return { success: false, error: "Failed to save document templates configuration." };
    }

    revalidatePath("/dashboard/partnership");
    return { success: true, config: merged };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to save document templates configuration."),
    };
  }
}

/**
 * List sponsor documents with optional filtering by eventId or sponsorId
 */
export async function getSponsorDocumentsAction(filters?: { eventId?: string; sponsorId?: string }): Promise<{
  success: boolean;
  documents?: SponsorDocument[];
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const queryFilters: Array<{
      fieldFilter: {
        field: { fieldPath: string };
        op: string;
        value: Record<string, unknown>;
      };
    }> = [];

    if (filters?.eventId) {
      queryFilters.push({
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: String(filters.eventId) },
        },
      });
    }

    if (filters?.sponsorId) {
      queryFilters.push({
        fieldFilter: {
          field: { fieldPath: "sponsor_id" },
          op: "EQUAL",
          value: { stringValue: String(filters.sponsorId) },
        },
      });
    }

    const docs = (await queryFirestoreDocs<SponsorDocument>("sponsor_documents", queryFilters)) || [];

    docs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    return { success: true, documents: docs };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to load sponsor documents."),
    };
  }
}

/**
 * Public: Get a sponsor document by its opaque share token for /partnership/documents/[token]
 */
export async function getPublicSponsorDocumentByTokenAction(token: string): Promise<{
  success: boolean;
  document?: SponsorDocument | null;
  templatesConfig?: SponsorDocumentTemplatesConfig;
  error?: string;
}> {
  try {
    if (!token?.trim()) {
      return { success: false, error: "Missing document token." };
    }

    const cleanToken = token.trim();
    const docId = cleanToken.startsWith("spdoc_") ? cleanToken : `spdoc_${cleanToken}`;

    let doc = (await getFirestoreDoc("sponsor_documents", docId)) as unknown as SponsorDocument | null;
    if (!doc) {
      doc = (await getFirestoreDoc("sponsor_documents", cleanToken)) as unknown as SponsorDocument | null;
    }

    if (!doc || (doc.token !== cleanToken && doc.id !== cleanToken)) {
      return { success: false, error: "Document not found or invalid link." };
    }

    const cfgRes = await getSponsorDocumentTemplatesConfigAction();

    return {
      success: true,
      document: doc,
      templatesConfig: cfgRes.config,
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to load sponsor document."),
    };
  }
}

/**
 * Organizer: Create or update a SponsorDocument
 */
export async function saveSponsorDocumentAction(
  docInput: Partial<SponsorDocument> & {
    doc_type: SponsorDocumentType;
    sponsor_id: string;
    company_name: string;
    sponsor_tier: SponsorCategory;
  },
): Promise<{
  success: boolean;
  document?: SponsorDocument;
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const cfgRes = await getSponsorDocumentTemplatesConfigAction();
    const templates = cfgRes.config || (await getDefaultSponsorDocumentTemplatesConfig());

    const now = new Date().toISOString();

    let token = docInput.token?.trim() || "";
    let docId = docInput.id?.trim() || "";

    if (!token) {
      token = randomBytes(16).toString("hex");
    }
    if (!docId) {
      docId = `spdoc_${token}`;
    }

    const existing = (await getFirestoreDoc("sponsor_documents", docId)) as unknown as SponsorDocument | null;

    // Auto-generate document number if empty
    let docNumber = docInput.doc_number?.trim() || existing?.doc_number || "";
    if (!docNumber) {
      const allDocs = (await queryFirestoreDocs<SponsorDocument>("sponsor_documents", [])) || [];
      const sameTypeCount = allDocs.filter((d) => d.doc_type === docInput.doc_type).length;
      const nextSeq = sameTypeCount + 1;
      const pattern =
        docInput.doc_type === "invoice"
          ? templates.invoice_number_pattern
          : docInput.doc_type === "quotation"
            ? templates.quotation_number_pattern
            : docInput.doc_type === "mou"
              ? templates.mou_number_pattern || "{{seq}}/MOU/GDGJKT/{{romanMonth}}/{{year}}"
              : templates.loa_number_pattern;
      docNumber = formatDocumentNumber(pattern, nextSeq);
    }

    const lineItems: SponsorDocumentLineItem[] = Array.isArray(docInput.line_items)
      ? docInput.line_items.map((item, idx) => {
          const qty = Number(item.qty) || 1;
          const unitPrice = Number(item.unit_price) || 0;
          return {
            id: item.id || `item_${idx + 1}`,
            description: item.description || "",
            qty,
            unit_price: unitPrice,
            total: qty * unitPrice,
          };
        })
      : existing?.line_items || [];

    const grandTotal =
      typeof docInput.grand_total === "number"
        ? docInput.grand_total
        : lineItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);

    const defaultSignerName =
      docInput.doc_type === "invoice"
        ? templates.invoice_signer_name
        : docInput.doc_type === "quotation"
          ? templates.quotation_signer_name
          : docInput.doc_type === "mou"
            ? templates.mou_signer_name || templates.loa_signer_name
            : templates.loa_signer_name;

    const defaultSignerTitle =
      docInput.doc_type === "invoice"
        ? templates.invoice_signer_title
        : docInput.doc_type === "quotation"
          ? templates.quotation_signer_title
          : docInput.doc_type === "mou"
            ? templates.mou_signer_title || templates.loa_signer_title
            : templates.loa_signer_title;

    const documentToSave: SponsorDocument = {
      id: docId,
      token,
      doc_type: docInput.doc_type,
      doc_number: docNumber,
      source_quotation_id:
        docInput.source_quotation_id !== undefined
          ? docInput.source_quotation_id.trim()
          : (existing?.source_quotation_id ?? ""),
      source_quotation_number:
        docInput.source_quotation_number !== undefined
          ? docInput.source_quotation_number.trim()
          : (existing?.source_quotation_number ?? ""),
      custom_title: docInput.custom_title !== undefined ? docInput.custom_title.trim() : (existing?.custom_title ?? ""),
      status: docInput.status || existing?.status || "draft",
      event_id: docInput.event_id !== undefined ? docInput.event_id : (existing?.event_id ?? null),
      event_title: docInput.event_title ?? existing?.event_title ?? "",
      event_date: docInput.event_date ?? existing?.event_date ?? "",
      event_location: docInput.event_location ?? existing?.event_location ?? "",
      event_website: docInput.event_website ?? existing?.event_website ?? "https://gdgjakarta.com",
      sponsor_id: docInput.sponsor_id,
      company_name: docInput.company_name.trim(),
      company_legal_name: docInput.company_legal_name?.trim() ?? existing?.company_legal_name ?? "",
      company_address: docInput.company_address?.trim() ?? existing?.company_address ?? "",
      contact_name: docInput.contact_name?.trim() ?? existing?.contact_name ?? "",
      contact_title: docInput.contact_title?.trim() ?? existing?.contact_title ?? "",
      contact_email: docInput.contact_email?.trim() ?? existing?.contact_email ?? "",
      sponsor_tier: docInput.sponsor_tier || existing?.sponsor_tier || "partner",
      currency: docInput.currency || existing?.currency || "IDR",
      line_items: lineItems,
      grand_total: grandTotal,
      deliverables: Array.isArray(docInput.deliverables) ? docInput.deliverables : existing?.deliverables || [],
      organizer_commitments: Array.isArray(docInput.organizer_commitments)
        ? docInput.organizer_commitments
        : existing?.organizer_commitments || [],
      payment_term_days: docInput.payment_term_days ?? existing?.payment_term_days ?? templates.loa_payment_term_days,
      quotation_validity_note:
        docInput.quotation_validity_note ?? existing?.quotation_validity_note ?? templates.quotation_validity_note,
      invoice_tax_note: docInput.invoice_tax_note ?? existing?.invoice_tax_note ?? templates.invoice_tax_note,
      loa_overrides: docInput.loa_overrides ?? existing?.loa_overrides ?? {},
      mou_overrides: docInput.mou_overrides ?? existing?.mou_overrides ?? {},
      bank_name: docInput.bank_name ?? existing?.bank_name ?? templates.bank_name,
      bank_account_number:
        docInput.bank_account_number ?? existing?.bank_account_number ?? templates.bank_account_number,
      bank_account_name: docInput.bank_account_name ?? existing?.bank_account_name ?? templates.bank_account_name,
      bank_swift_code: docInput.bank_swift_code ?? existing?.bank_swift_code ?? templates.bank_swift_code,
      organizer_signer_name: docInput.organizer_signer_name ?? existing?.organizer_signer_name ?? defaultSignerName,
      organizer_signer_title: docInput.organizer_signer_title ?? existing?.organizer_signer_title ?? defaultSignerTitle,
      organizer_signature_url:
        docInput.organizer_signature_url ??
        existing?.organizer_signature_url ??
        templates.organizer_signature_url ??
        "",
      document_date:
        docInput.document_date ||
        existing?.document_date ||
        new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      partner_signer_name: docInput.partner_signer_name ?? existing?.partner_signer_name ?? "",
      partner_signer_title: docInput.partner_signer_title ?? existing?.partner_signer_title ?? "",
      sponsor_signed_name: docInput.sponsor_signed_name ?? existing?.sponsor_signed_name ?? "",
      sponsor_signed_title: docInput.sponsor_signed_title ?? existing?.sponsor_signed_title ?? "",
      sponsor_signed_at: docInput.sponsor_signed_at ?? existing?.sponsor_signed_at ?? "",
      sponsor_signature_data_url: docInput.sponsor_signature_data_url ?? existing?.sponsor_signature_data_url ?? "",
      email_status: docInput.email_status ?? existing?.email_status ?? "not_sent",
      email_sent_at: docInput.email_sent_at ?? existing?.email_sent_at ?? "",
      email_recipient: docInput.email_recipient ?? existing?.email_recipient ?? "",
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const ok = await patchFirestoreDoc(
      "sponsor_documents",
      docId,
      documentToSave as unknown as Record<string, unknown>,
    );

    if (!ok) {
      return { success: false, error: "Failed to save sponsor document." };
    }

    revalidatePath("/dashboard/partnership");
    if (documentToSave.event_id) {
      revalidatePath(`/dashboard/events/${documentToSave.event_id}`);
    }
    revalidatePath(`/partnership/documents/${token}`);

    return { success: true, document: documentToSave };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to save sponsor document."),
    };
  }
}

/**
 * Organizer: Delete a sponsor document
 */
export async function deleteSponsorDocumentAction(docId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    if (!docId?.trim()) {
      return { success: false, error: "Document ID is required." };
    }

    const ok = await deleteFirestoreDoc("sponsor_documents", docId.trim());
    if (!ok) {
      return { success: false, error: "Failed to delete sponsor document." };
    }

    revalidatePath("/dashboard/partnership");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to delete sponsor document."),
    };
  }
}

async function notifyOrganizerDocumentSigned(doc: SponsorDocument): Promise<void> {
  try {
    const configRes = await getSponsorDocumentTemplatesConfigAction();
    const orgEmail = configRes.config?.org_email || "info@gdgjakarta.org";
    const toValidation = validateEmailRecipients(orgEmail, { required: true, label: "Organizer email" });
    if (!toValidation.valid) {
      console.error("[SponsorDocument] Skipping signed notification — invalid org_email:", orgEmail);
      return;
    }

    const docTypeLabel = getSponsorDocTypeLabel(doc.doc_type);
    const orgDisplay = doc.company_legal_name || doc.company_name || "Partner";
    const signerName = doc.sponsor_signed_name || "Partner Representative";
    const signerTitle = doc.sponsor_signed_title || "";
    const signedAtWib = new Date(doc.sponsor_signed_at || new Date().toISOString()).toLocaleString("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const publicUrl = `https://gdgjakarta.com/partnership/documents/${encodeURIComponent(doc.token)}`;
    const subject = `Document Signed: ${docTypeLabel} [${doc.doc_number}] — ${orgDisplay}`;

    const safeDocType = escapeHtml(docTypeLabel);
    const safeDocNumber = escapeHtml(doc.doc_number);
    const safeOrg = escapeHtml(orgDisplay);
    const safeEvent = doc.event_title ? escapeHtml(doc.event_title) : "";
    const safeSigner = escapeHtml(signerName);
    const safeSignerTitle = signerTitle ? escapeHtml(signerTitle) : "";
    const safeSignedAt = escapeHtml(`${signedAtWib} WIB`);

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#0f9d58 0%,#0b8043 100%);color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">GDG Jakarta Partnership</div>
              <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:700;line-height:1.3;">Partner Signed Document</h1>
              <p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;">${safeDocType} · ${safeDocNumber}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#374151;">
                <strong>${safeOrg}</strong> has counter-signed <strong>${safeDocType}</strong> (<code>${safeDocNumber}</code>) online.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.8;">
                      <tr>
                        <td style="color:#64748b;width:36%;">Document:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeDocType} (${safeDocNumber})</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Organization:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeOrg}</td>
                      </tr>
                      ${safeEvent ? `<tr><td style="color:#64748b;">Event:</td><td style="font-weight:600;color:#0f172a;">${safeEvent}</td></tr>` : ""}
                      <tr>
                        <td style="color:#64748b;">Signed By:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeSigner}${safeSignerTitle ? ` (${safeSignerTitle})` : ""}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Signed At:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeSignedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${publicUrl}" target="_blank" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:8px;">
                      View Signed Document
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const sendRes = await sendEmailDirectInternal({
      first_name: "GDG Jakarta",
      last_name: "Organizer",
      email: toValidation.formatted,
      subjectEmail: subject,
      bodyEmail: htmlBody,
    });

    if (!sendRes.success) {
      console.error("[SponsorDocument] Failed to send organizer signed notification:", sendRes.error);
    }
  } catch (err) {
    console.error("[SponsorDocument] Error sending organizer signed notification:", err);
  }
}

/**
 * Public: Counter-sign a Quotation or LOA online via /partnership/documents/[token]
 */
export async function signSponsorDocumentPublicAction(input: {
  token: string;
  signedName: string;
  signedTitle?: string;
  signatureDataUrl?: string;
}): Promise<{
  success: boolean;
  document?: SponsorDocument;
  error?: string;
}> {
  try {
    if (!input.token?.trim()) {
      return { success: false, error: "Missing document token." };
    }
    if (!input.signedName?.trim()) {
      return { success: false, error: "Printed name is required to sign." };
    }

    const cleanToken = input.token.trim();
    const docId = cleanToken.startsWith("spdoc_") ? cleanToken : `spdoc_${cleanToken}`;

    const existing = (await getFirestoreDoc("sponsor_documents", docId)) as unknown as SponsorDocument | null;
    if (!existing || existing.token !== cleanToken) {
      return { success: false, error: "Document not found or invalid link." };
    }

    const now = new Date().toISOString();
    const updates = {
      sponsor_signed_name: input.signedName.trim().slice(0, 150),
      sponsor_signed_title: (input.signedTitle || "").trim().slice(0, 150),
      sponsor_signed_at: now,
      sponsor_signature_data_url: input.signatureDataUrl || "",
      status: "signed" as SponsorDocumentStatus,
      updated_at: now,
    };

    const ok = await patchFirestoreDoc("sponsor_documents", docId, updates);
    if (!ok) {
      return { success: false, error: "Failed to record signature." };
    }

    const signedDocument: SponsorDocument = {
      ...existing,
      ...updates,
    };

    // Await inside try/catch so Cloudflare Workers doesn't drop the webhook before completion
    await notifyOrganizerDocumentSigned(signedDocument);

    revalidatePath(`/partnership/documents/${cleanToken}`);
    revalidatePath("/dashboard/partnership");

    return {
      success: true,
      document: signedDocument,
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to sign document."),
    };
  }
}

/**
 * Organizer: Dispatch official Sponsor Document email via n8n webhook (/webhook/api/send-email)
 */
export async function sendSponsorDocumentEmailAction(
  docId: string,
  recipientEmail?: string,
  customSubject?: string,
  customMessage?: string,
  cc?: string,
  bcc?: string,
): Promise<{
  success: boolean;
  document?: SponsorDocument;
  error?: string;
}> {
  try {
    const isAuth = await isAuthorizedOrganizerSession();
    if (!isAuth) {
      return { success: false, error: "Unauthorized." };
    }

    const rawDoc = await getFirestoreDoc("sponsor_documents", docId);
    if (!rawDoc) {
      return { success: false, error: "Document not found." };
    }
    const doc = rawDoc as unknown as SponsorDocument;

    const toValidation = validateEmailRecipients(recipientEmail || doc.contact_email || "", {
      required: true,
      label: "Recipient email",
    });
    if (!toValidation.valid) {
      return { success: false, error: toValidation.error || "Recipient email is required." };
    }
    const ccValidation = validateEmailRecipients(cc, { required: false, label: "CC" });
    if (!ccValidation.valid) {
      return { success: false, error: ccValidation.error || "Invalid CC email address." };
    }
    const bccValidation = validateEmailRecipients(bcc, { required: false, label: "BCC" });
    if (!bccValidation.valid) {
      return { success: false, error: bccValidation.error || "Invalid BCC email address." };
    }
    const targetEmail = toValidation.formatted;

    const docTypeLabel = getSponsorDocTypeLabel(doc.doc_type);

    const publicUrl = `https://gdgjakarta.com/partnership/documents/${doc.token}`;
    const formattedTotal =
      doc.currency === "USD"
        ? `$${Number(doc.grand_total || 0).toLocaleString("en-US")}`
        : `IDR ${Number(doc.grand_total || 0).toLocaleString("id-ID")}`;

    const subject =
      customSubject?.trim() ||
      `${docTypeLabel} [${doc.doc_number}] — ${doc.event_title ? `${doc.event_title} | ` : ""}GDG Jakarta`;

    const greetingName = doc.contact_name || doc.company_legal_name || doc.company_name;
    const actionButtonLabel =
      doc.doc_type === "invoice" ? "View & Download Official Invoice PDF" : "Review, Counter-Sign & Download PDF";

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">Google Developer Group Jakarta</div>
              <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:700;line-height:1.3;">${docTypeLabel}</h1>
              <p style="margin:4px 0 0 0;font-size:13px;opacity:0.85;">Document No: ${doc.doc_number}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Dear <strong>${greetingName}</strong>,</p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#374151;">
                ${
                  customMessage?.trim()
                    ? customMessage.trim().replace(/\n/g, "<br/>")
                    : `Thank you for partnering with <strong>Google Developer Group Jakarta</strong>${doc.event_title ? ` for <strong>${doc.event_title}</strong>` : ""}. Please find your official <strong>${docTypeLabel}</strong> ready for review.`
                }
              </p>

              <!-- Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.8;">
                      <tr>
                        <td style="color:#64748b;width:40%;">Document Type:</td>
                        <td style="font-weight:600;color:#0f172a;">${docTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Document Number:</td>
                        <td style="font-weight:600;color:#0f172a;font-family:monospace;">${doc.doc_number}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Organization:</td>
                        <td style="font-weight:600;color:#0f172a;">${doc.company_legal_name || doc.company_name}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Sponsorship Tier:</td>
                        <td style="font-weight:600;color:#0f172a;text-transform:capitalize;">${doc.sponsor_tier.replace("_", " ")}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Total Amount:</td>
                        <td style="font-weight:700;color:#1a73e8;font-size:15px;">${formattedTotal}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${publicUrl}" target="_blank" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      ${actionButtonLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:#6b7280;">
                Or copy and paste this direct link into your browser:<br/>
                <a href="${publicUrl}" style="color:#1a73e8;word-break:break-all;">${publicUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                Warm regards,<br/>
                <strong>${doc.organizer_signer_name}</strong><br/>
                ${doc.organizer_signer_title} — Google Developer Group Jakarta
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const [firstName, ...rest] = (doc.contact_name || doc.company_name || "Partner").trim().split(/\s+/);
    const lastName = rest.join(" ") || "-";

    const sendRes = await sendEmailDirectInternal({
      first_name: firstName || "Partner",
      last_name: lastName,
      email: targetEmail,
      cc: ccValidation.formatted || undefined,
      bcc: bccValidation.formatted || undefined,
      subjectEmail: subject,
      bodyEmail: htmlBody,
    });

    const now = new Date().toISOString();
    if (!sendRes.success) {
      await patchFirestoreDoc("sponsor_documents", docId, {
        email_status: "failed",
        updated_at: now,
      });
      return { success: false, error: sendRes.error || "Failed to dispatch email via n8n." };
    }

    const nextStatus: SponsorDocumentStatus = doc.status === "draft" ? "sent" : doc.status;
    const updates = {
      email_status: "sent" as const,
      email_sent_at: now,
      email_recipient: targetEmail,
      status: nextStatus,
      updated_at: now,
    };

    await patchFirestoreDoc("sponsor_documents", docId, updates);

    revalidatePath("/dashboard/partnership");
    if (doc.event_id) {
      revalidatePath(`/dashboard/events/${doc.event_id}`);
    }

    return {
      success: true,
      document: {
        ...doc,
        ...updates,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to send sponsor document email."),
    };
  }
}

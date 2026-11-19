"use server";

import { revalidatePath } from "next/cache";

import { inspectConfiguredCertificate } from "@/lib/pdf/sign-pdf";
import { deleteMediaObject } from "@/lib/r2/client";
import { extractApiMessage } from "@/lib/utils";
import type {
  PartnerSignedDocument,
  PartnerSignedDocumentStatus,
  SigningCertificateStatus,
} from "@/types/partner-signage";

import { isAuthorizedExecutiveOrganizerSession } from "./auth-guard";
import { sendEmailDirectInternal } from "./email-template-actions";
import { deleteFirestoreDoc, getFirestoreDoc, patchFirestoreDoc, queryFirestoreDocs } from "./firestore-admin";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Organizer: Inspects the configured X.509 PKCS#7 e-certificate status (without exposing private key data).
 */
export async function getSigningCertificateStatusAction(): Promise<{
  success: boolean;
  status?: SigningCertificateStatus;
  error?: string;
}> {
  try {
    if (!(await isAuthorizedExecutiveOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }
    return {
      success: true,
      status: inspectConfiguredCertificate(),
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to inspect e-certificate status."),
    };
  }
}

/**
 * Organizer: Lists partner signed PDFs from Firestore with optional filtering by sponsorId or eventId.
 */
export async function getPartnerSignedDocumentsAction(filters?: { sponsorId?: string; eventId?: string }): Promise<{
  success: boolean;
  documents?: PartnerSignedDocument[];
  error?: string;
}> {
  try {
    if (!(await isAuthorizedExecutiveOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const queryFilters: Array<{
      fieldFilter: {
        field: { fieldPath: string };
        op: string;
        value: Record<string, unknown>;
      };
    }> = [];

    if (filters?.sponsorId) {
      queryFilters.push({
        fieldFilter: {
          field: { fieldPath: "sponsor_id" },
          op: "EQUAL",
          value: { stringValue: String(filters.sponsorId) },
        },
      });
    }

    if (filters?.eventId) {
      queryFilters.push({
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: String(filters.eventId) },
        },
      });
    }

    const docs = (await queryFirestoreDocs<PartnerSignedDocument>("partner_signed_documents", queryFilters)) || [];
    docs.sort((a, b) => (b.signed_at || b.created_at || "").localeCompare(a.signed_at || a.created_at || ""));

    return { success: true, documents: docs };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to load signed partner documents."),
    };
  }
}

/**
 * Public: Retrieves a signed document verification record by its opaque token for /partnership/signed-documents/[token].
 */
export async function getPublicPartnerSignedDocumentByTokenAction(token: string): Promise<{
  success: boolean;
  document?: PartnerSignedDocument | null;
  error?: string;
}> {
  try {
    if (!token?.trim()) {
      return { success: false, error: "Missing verification token." };
    }

    const cleanToken = token.trim();
    const docId = cleanToken.startsWith("psgn_") ? cleanToken : `psgn_${cleanToken}`;

    let doc = (await getFirestoreDoc("partner_signed_documents", docId)) as unknown as PartnerSignedDocument | null;
    if (!doc) {
      doc = (await getFirestoreDoc("partner_signed_documents", cleanToken)) as unknown as PartnerSignedDocument | null;
    }

    if (!doc || (doc.token !== cleanToken && doc.id !== cleanToken)) {
      return { success: false, error: "Signed document record not found or invalid verification link." };
    }

    return { success: true, document: doc };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to load signed document verification details."),
    };
  }
}

/**
 * Organizer: Dispatches the signed PDF bucket URL and verification link to a partner via n8n email webhook.
 */
export async function sendPartnerSignedDocumentEmailAction(input: {
  docId: string;
  recipientEmail: string;
  customSubject?: string;
  customMessage?: string;
}): Promise<{
  success: boolean;
  document?: PartnerSignedDocument;
  error?: string;
}> {
  try {
    if (!(await isAuthorizedExecutiveOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const docId = input.docId.trim();
    if (!docId) {
      return { success: false, error: "Document ID is required." };
    }

    const rawDoc = await getFirestoreDoc("partner_signed_documents", docId);
    if (!rawDoc) {
      return { success: false, error: "Signed document record not found." };
    }
    const doc = rawDoc as unknown as PartnerSignedDocument;

    const targetEmail = (input.recipientEmail || doc.contact_email || "").trim().toLowerCase();
    if (!targetEmail || targetEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return { success: false, error: "Valid recipient email (<= 150 chars) is required." };
    }

    const verifyUrl = `https://gdgjakarta.com/partnership/signed-documents/${doc.token}`;
    const subject =
      input.customSubject?.trim() || `Signed Document: ${doc.document_title} — ${doc.company_name} | GDG Jakarta`;

    const greetingName = escapeHtml(doc.contact_name || doc.company_name || "Partner");
    const safeDocTitle = escapeHtml(doc.document_title);
    const safeCompany = escapeHtml(doc.company_name);
    const safeSignerName = escapeHtml(doc.signer_name);
    const safeSignerTitle = escapeHtml(doc.signer_title || "GDG Jakarta Organizer");
    const signedDateFormatted = new Date(doc.signed_at).toLocaleString("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const ecertBadgeText =
      doc.ecert_status === "signed_p12"
        ? "X.509 PKCS#7 Digital E-Certificate"
        : "SHA-256 Tamper-Evident Integrity Seal";
    const shaSnippet = doc.signed_sha256 ? `${doc.signed_sha256.slice(0, 16)}...${doc.signed_sha256.slice(-8)}` : "-";

    const sanitizeEmailNoteHtml = (raw: string): string => {
      const cleaned = raw
        .replace(/<(script|iframe|object|embed|style|form|input|button)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<(script|iframe|object|embed|style|form|input|button)\b[^>]*\/?>/gi, "")
        .replace(/<\/?font\b[^>]*>/gi, "")
        .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "");
      const hasBlockHtml = /<(?:p|div|ul|ol|li|br|table|h[1-6]|blockquote|hr)\b/i.test(cleaned);
      return hasBlockHtml ? cleaned : cleaned.replace(/\r?\n/g, "<br/>");
    };

    const introParagraph = input.customMessage?.trim()
      ? sanitizeEmailNoteHtml(input.customMessage.trim())
      : `Please find the countersigned PDF copy of <strong>${safeDocTitle}</strong> from <strong>Google Developer Group Jakarta</strong>${doc.event_title ? ` regarding <strong>${escapeHtml(doc.event_title)}</strong>` : ""}. The document is cryptographically protected and ready for download via the direct link below.`;

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
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">Google Developer Group Jakarta</div>
              <h1 style="margin:8px 0 0 0;font-size:21px;font-weight:700;line-height:1.3;">Signed Partnership Document</h1>
              <p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;">${safeDocTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Dear <strong>${greetingName}</strong>,</p>
              <div style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#374151;">${introParagraph}</div>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.8;">
                      <tr>
                        <td style="color:#64748b;width:40%;">Document:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeDocTitle}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Partner / Organization:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeCompany}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Signed By:</td>
                        <td style="font-weight:600;color:#0f172a;">${safeSignerName} (${safeSignerTitle})</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">Signed At:</td>
                        <td style="font-weight:600;color:#0f172a;">${escapeHtml(signedDateFormatted)} WIB</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">E-Certificate:</td>
                        <td style="font-weight:600;color:#059669;">${ecertBadgeText}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;">PDF SHA-256:</td>
                        <td style="font-family:monospace;font-size:12px;color:#0f172a;">${shaSnippet}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px 0;">
                <tr>
                  <td align="center">
                    <a href="${doc.signed_pdf_url}" target="_blank" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Download Signed PDF
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" target="_blank" style="display:inline-block;color:#1a73e8;font-weight:600;font-size:13px;text-decoration:underline;">
                      Verify Digital E-Certificate &amp; Authenticity
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:#6b7280;">
                Direct PDF Bucket URL:<br/>
                <a href="${doc.signed_pdf_url}" style="color:#1a73e8;word-break:break-all;">${doc.signed_pdf_url}</a>
              </p>
              <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:#6b7280;">
                Authenticity Verification Portal:<br/>
                <a href="${verifyUrl}" style="color:#1a73e8;word-break:break-all;">${verifyUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                Warm regards,<br/>
                <strong>${safeSignerName}</strong><br/>
                ${safeSignerTitle} — Google Developer Group Jakarta
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
      subjectEmail: subject,
      bodyEmail: htmlBody,
    });

    const now = new Date().toISOString();
    if (!sendRes.success) {
      await patchFirestoreDoc("partner_signed_documents", docId, {
        email_status: "failed",
        updated_at: now,
      });
      return { success: false, error: sendRes.error || "Failed to dispatch email via n8n." };
    }

    const nextStatus: PartnerSignedDocumentStatus = doc.status === "signed" ? "sent" : doc.status;
    const updates = {
      email_status: "sent" as const,
      email_sent_at: now,
      email_recipient: targetEmail,
      status: nextStatus,
      updated_at: now,
    };

    await patchFirestoreDoc("partner_signed_documents", docId, updates);
    revalidatePath("/dashboard/partnership");

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
      error: extractApiMessage(err, "Failed to send signed document email."),
    };
  }
}

/**
 * Organizer: Updates metadata fields (title, partner, contact email, event, signer) on an existing signed document
 * without replacing or re-signing the PDF file in R2.
 */
export async function updatePartnerSignedDocumentMetadataAction(input: {
  docId: string;
  documentTitle: string;
  sponsorId?: string | null;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  eventId?: string | null;
  eventTitle?: string;
  signerName: string;
  signerTitle?: string;
}): Promise<{
  success: boolean;
  document?: PartnerSignedDocument;
  error?: string;
}> {
  try {
    if (!(await isAuthorizedExecutiveOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const docId = input.docId.trim();
    if (!docId) {
      return { success: false, error: "Document ID is required." };
    }

    const rawDoc = await getFirestoreDoc("partner_signed_documents", docId);
    if (!rawDoc) {
      return { success: false, error: "Signed document record not found." };
    }
    const existing = rawDoc as unknown as PartnerSignedDocument;

    const cleanTitle = input.documentTitle.trim().slice(0, 200);
    const cleanCompany = input.companyName.trim().slice(0, 200);
    const cleanSignerName = input.signerName.trim().slice(0, 150);
    const cleanEmail = (input.contactEmail || "").trim().toLowerCase().slice(0, 150);

    if (!cleanTitle || !cleanCompany || !cleanSignerName) {
      return { success: false, error: "Document title, company name, and signer name are required." };
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: "Invalid partner email address." };
    }

    const updates = {
      document_title: cleanTitle,
      sponsor_id: input.sponsorId ?? null,
      company_name: cleanCompany,
      contact_name: (input.contactName || "").trim().slice(0, 150),
      contact_email: cleanEmail,
      event_id: input.eventId ?? null,
      event_title: (input.eventTitle || "").trim().slice(0, 300),
      signer_name: cleanSignerName,
      signer_title: (input.signerTitle || "GDG Jakarta Organizer").trim().slice(0, 150),
      updated_at: new Date().toISOString(),
    };

    const ok = await patchFirestoreDoc("partner_signed_documents", docId, updates);
    if (!ok) {
      return { success: false, error: "Failed to update document metadata." };
    }

    revalidatePath("/dashboard/partnership");
    revalidatePath(`/partnership/signed-documents/${existing.token}`);

    return {
      success: true,
      document: {
        ...existing,
        ...updates,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to update document metadata."),
    };
  }
}

/**
 * Organizer: Deletes both the signed PDF in R2 bucket storage and its Firestore metadata record.
 */
export async function deletePartnerSignedDocumentAction(docId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!(await isAuthorizedExecutiveOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const cleanId = docId.trim();
    if (!cleanId) {
      return { success: false, error: "Document ID is required." };
    }

    const rawDoc = await getFirestoreDoc("partner_signed_documents", cleanId);
    const doc = rawDoc as unknown as PartnerSignedDocument | null;

    if (doc?.signed_pdf_key) {
      await deleteMediaObject(doc.signed_pdf_key).catch((err) => {
        console.warn("[PartnerSignage] Failed to delete R2 object (continuing Firestore cleanup):", err);
      });
    }

    const deletedOk = await deleteFirestoreDoc("partner_signed_documents", cleanId);
    if (!deletedOk) {
      return { success: false, error: "Failed to delete signed document record." };
    }

    revalidatePath("/dashboard/partnership");
    if (doc?.token) {
      revalidatePath(`/partnership/signed-documents/${doc.token}`);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: extractApiMessage(err, "Failed to delete signed document."),
    };
  }
}

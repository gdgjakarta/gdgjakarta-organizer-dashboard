"use server";

import { revalidatePath } from "next/cache";

import {
  buildCertificateCode,
  buildCertificatePlaceholderMap,
  buildCertificateVerifyUrl,
  buildDefaultOverlayFields,
  extractGoogleFileId,
  formatCertificateDate,
  formatPresenterRoleLabel,
  isEventWrappedUpForCertificates,
  isRegistrationEligibleForAttendanceCertificate,
} from "@/lib/events/certificate-utils";
import { callGenerateCertificateWebhook, callSendCertificateEmailWebhook } from "@/lib/events/certificate-webhooks";
import { buildRenderedEmailForAttendee } from "@/lib/events/email-templates";
import type {
  CertificateType,
  EventCertificateConfig,
  EventCertificateRecord,
  EventCertificateTemplateConfig,
  EventSpeakerConfirmation,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import { renderBuiltInCertificatePdf, renderCertificateOverlayPdf } from "@/lib/pdf/certificate-overlay";
import { signRawPdfBytesWithEnvP12 } from "@/lib/pdf/sign-pdf";
import { uploadMediaObject } from "@/lib/r2/client";
import { extractApiMessage } from "@/lib/utils";

import { verifyFirebaseIdToken } from "./auth-actions";
import { getAuthenticatedSessionEmail, isAuthorizedOrganizerSession } from "./auth-guard";
import { getFirestoreDoc, patchFirestoreDoc, queryFirestoreDocs } from "./firestore-admin";
import { createHash, randomBytes } from "node:crypto";

function sanitizeSlug(input: string, maxLen = 40): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLen) || "certificate"
  );
}

function generateCertificateToken(): string {
  return `cert_${randomBytes(16).toString("hex")}`;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function generatePdfBytesForTemplate(params: {
  templateCfg: EventCertificateTemplateConfig;
  type: CertificateType;
  eventTitle: string;
  eventDate?: string | null;
  recipientName: string;
  role: string;
  talkTitle?: string | null;
  certificateCode: string;
  verifyUrl: string;
}): Promise<Uint8Array> {
  const { templateCfg, type } = params;
  const fileId = templateCfg.template_file_id || extractGoogleFileId(templateCfg.template_url)?.fileId;

  const rawPdfBytes = await (async (): Promise<Uint8Array> => {
    // Built-in general GDG Jakarta certificate design when no Google Slides / Google Drawing template is provided
    if (!fileId && !templateCfg.background_pdf_url) {
      return await renderBuiltInCertificatePdf({
        type,
        recipientName: params.recipientName,
        eventTitle: params.eventTitle,
        eventDate: formatCertificateDate(params.eventDate),
        role: params.role,
        talkTitle: params.talkTitle,
        certificateCode: params.certificateCode,
        issuedDate: formatCertificateDate(new Date().toISOString()),
        verifyUrl: params.verifyUrl,
        signerName: templateCfg.signer_name,
        signerTitle: templateCfg.signer_title,
      });
    }

    if (templateCfg.engine === "google_drawing") {
      let backgroundBytes: Uint8Array;
      if (templateCfg.background_pdf_url) {
        const res = await fetch(templateCfg.background_pdf_url, {
          cache: "no-store",
          signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(15_000) : undefined,
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch cached Drawing background PDF (${res.status}). Re-sync background first.`);
        }
        backgroundBytes = new Uint8Array(await res.arrayBuffer());
      } else if (fileId) {
        backgroundBytes = await callGenerateCertificateWebhook({
          mode: "export_drawing_pdf",
          templateFileId: fileId,
          outputFileName: `drawing-bg-${fileId}`,
        });
      } else {
        throw new Error("Google Drawing template URL or synced background PDF is not configured.");
      }

      const fields =
        templateCfg.overlay_fields && templateCfg.overlay_fields.length > 0
          ? templateCfg.overlay_fields
          : buildDefaultOverlayFields(type);

      const placeholderMap = buildCertificatePlaceholderMap({
        recipientName: params.recipientName,
        eventName: params.eventTitle,
        eventDate: params.eventDate,
        role: params.role,
        talkTitle: params.talkTitle,
        certificateCode: params.certificateCode,
        verifyUrl: params.verifyUrl,
      });

      const values: Record<string, string> = {
        ...placeholderMap,
        recipient_name: params.recipientName,
        recipientName: params.recipientName,
        event_name: params.eventTitle,
        eventName: params.eventTitle,
        event_date: formatCertificateDate(params.eventDate),
        eventDate: formatCertificateDate(params.eventDate),
        role: params.role,
        talk_title: params.talkTitle || "",
        talkTitle: params.talkTitle || "",
        certificate_code: params.certificateCode,
        certificateCode: params.certificateCode,
        issued_date: formatCertificateDate(new Date().toISOString()),
        verify_url: params.verifyUrl,
      };

      return await renderCertificateOverlayPdf({
        backgroundPdfBytes: backgroundBytes,
        fields,
        values,
        verifyUrl: params.verifyUrl,
        metadata: {
          title: `${type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance"} - ${params.recipientName}`,
          subject: params.eventTitle,
        },
      });
    }

    // Default: google_slides via n8n
    if (!fileId) {
      throw new Error("Google Slides template URL or File ID is not configured for this certificate type.");
    }

    const replacements = buildCertificatePlaceholderMap({
      recipientName: params.recipientName,
      eventName: params.eventTitle,
      eventDate: params.eventDate,
      role: params.role,
      talkTitle: params.talkTitle,
      certificateCode: params.certificateCode,
      verifyUrl: params.verifyUrl,
    });

    return await callGenerateCertificateWebhook({
      mode: "google_slides",
      templateFileId: fileId,
      outputFileName: `${type}-${sanitizeSlug(params.recipientName)}`,
      tempFolderId: templateCfg.temp_folder_id || undefined,
      replacements,
    });
  })();

  // Cryptographically sign with Cloudflare Worker PKCS#7 X.509 secrets (graceful hash_only fallback if unconfigured)
  const signed = await signRawPdfBytesWithEnvP12(rawPdfBytes, {
    reason: `${type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance"} — ${params.eventTitle}`,
    signerName: templateCfg.signer_name || "GDG Jakarta",
    contactInfo: "info@gdgjakarta.org",
    location: "Jakarta, Indonesia",
  });

  return signed.pdfBytes;
}

/**
 * Organizer: Saves event certificate configuration and computes numeric release_at_millis from event.end_date.
 */
export async function saveEventCertificateConfigAction(
  eventId: string,
  config: EventCertificateConfig,
): Promise<{ success: boolean; config?: EventCertificateConfig; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const eventDoc = (await getFirestoreDoc("events", eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) {
      return { success: false, error: "Event not found." };
    }

    const endMs = eventDoc.end_date ? Date.parse(eventDoc.end_date) : Number.NaN;
    const releaseAtMillis = Number.isFinite(endMs) ? Math.floor(endMs) : null;

    const normalizeTemplate = (tpl?: EventCertificateTemplateConfig): EventCertificateTemplateConfig | undefined => {
      if (!tpl) return undefined;
      const parsed = extractGoogleFileId(tpl.template_url || tpl.template_file_id);
      return {
        ...tpl,
        template_file_id: parsed?.fileId || tpl.template_file_id || null,
      };
    };

    const attendanceTpl = normalizeTemplate(config.attendance);
    const speakerTpl = normalizeTemplate(config.speaker);

    const normalized: EventCertificateConfig = {
      attendance: attendanceTpl
        ? {
            ...attendanceTpl,
            release_mode: config.attendance?.release_mode ?? "auto_on_event_end",
            release_at_millis: config.attendance?.release_at_millis ?? releaseAtMillis,
            released_at: config.attendance?.released_at ?? null,
            released_by_email: config.attendance?.released_by_email ?? null,
            paused: Boolean(config.attendance?.paused),
          }
        : undefined,
      speaker: speakerTpl,
      updated_at: new Date().toISOString(),
    };

    const ok = await patchFirestoreDoc("events", eventId, {
      certificate_config: normalized,
      updated_at: new Date().toISOString(),
    });

    if (!ok) {
      return { success: false, error: "Failed to save certificate configuration." };
    }

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, config: normalized };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to save certificate configuration.") };
  }
}

/**
 * Organizer: Manually releases, pauses, or resumes attendance certificates on wrap-up.
 */
export async function triggerEventWrapUpCertificateReleaseAction(
  eventId: string,
  action: "release" | "pause" | "resume",
): Promise<{ success: boolean; config?: EventCertificateConfig; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const eventDoc = (await getFirestoreDoc("events", eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) {
      return { success: false, error: "Event not found." };
    }

    const email = await getAuthenticatedSessionEmail();
    const existing = eventDoc.certificate_config ?? {};
    const endMs = eventDoc.end_date ? Date.parse(eventDoc.end_date) : Number.NaN;
    const prevAttendance = existing.attendance ?? {
      enabled: true,
      engine: "google_slides" as const,
      release_mode: "auto_on_event_end" as const,
      release_at_millis: Number.isFinite(endMs) ? Math.floor(endMs) : null,
    };

    const nowIso = new Date().toISOString();
    const updatedAttendance = {
      ...prevAttendance,
      enabled: true,
      release_mode: prevAttendance.release_mode ?? ("auto_on_event_end" as const),
      release_at_millis: prevAttendance.release_at_millis ?? (Number.isFinite(endMs) ? Math.floor(endMs) : null),
      released_at: action === "release" ? nowIso : (prevAttendance.released_at ?? null),
      released_by_email: action === "release" ? email || null : (prevAttendance.released_by_email ?? null),
      paused: action === "pause",
    };

    const nextConfig: EventCertificateConfig = {
      ...existing,
      attendance: updatedAttendance,
      updated_at: nowIso,
    };

    const ok = await patchFirestoreDoc("events", eventId, {
      certificate_config: nextConfig,
      updated_at: nowIso,
    });

    if (!ok) {
      return { success: false, error: "Failed to update wrap-up certificate release state." };
    }

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, config: nextConfig };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update wrap-up release state.") };
  }
}

/**
 * Organizer: Exports a Google Drawing PDF via n8n Drive API and caches it in Cloudflare R2 for overlay mode.
 */
export async function syncDrawingBackgroundAction(
  eventId: string,
  type: CertificateType,
  templateUrl: string,
): Promise<{ success: boolean; backgroundPdfUrl?: string; backgroundPdfKey?: string; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const parsed = extractGoogleFileId(templateUrl);
    if (!parsed?.fileId) {
      return { success: false, error: "Please provide a valid Google Drawing URL or File ID." };
    }

    const pdfBytes = await callGenerateCertificateWebhook({
      mode: "export_drawing_pdf",
      templateFileId: parsed.fileId,
      outputFileName: `${type}-drawing-${parsed.fileId}`,
    });

    const prefix = `community-dashboard/events/${eventId}/certificates/templates`;
    const fileName = `${type}-${parsed.fileId}.pdf`;
    const uploaded = await uploadMediaObject(prefix, fileName, pdfBytes, {
      contentType: "application/pdf",
      customMetadata: {
        eventId,
        certificateType: type,
        templateFileId: parsed.fileId,
      },
    });

    if (!uploaded.success || !uploaded.item) {
      return { success: false, error: uploaded.error || "Failed to cache Drawing PDF in Cloudflare R2." };
    }

    return {
      success: true,
      backgroundPdfUrl: uploaded.item.url,
      backgroundPdfKey: uploaded.item.key,
    };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to sync Google Drawing background.") };
  }
}

/**
 * Organizer: Generates a preview PDF without persisting an issued record in Firestore.
 */
export async function testGenerateCertificatePreviewAction(params: {
  eventId: string;
  type: CertificateType;
  templateCfg: EventCertificateTemplateConfig;
  sampleName?: string;
  sampleRole?: string;
  sampleTalkTitle?: string;
}): Promise<{ success: boolean; pdfBase64?: string; fileName?: string; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const eventDoc = (await getFirestoreDoc("events", params.eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) {
      return { success: false, error: "Event not found." };
    }

    const sampleToken = "cert_00000000000000000000000000000000";
    const pdfBytes = await generatePdfBytesForTemplate({
      templateCfg: params.templateCfg,
      type: params.type,
      eventTitle: eventDoc.title || "GDG Jakarta Event",
      eventDate: eventDoc.start_date,
      recipientName: params.sampleName?.trim() || "Veronica Putri A.",
      role: params.sampleRole?.trim() || (params.type === "speaker" ? "Speaker" : "Attendee"),
      talkTitle: params.sampleTalkTitle?.trim() || "Building AI Agents with Gemini",
      certificateCode: buildCertificateCode(params.eventId, sampleToken),
      verifyUrl: buildCertificateVerifyUrl(sampleToken),
    });

    return {
      success: true,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      fileName: `Preview-${params.type === "speaker" ? "Appreciation" : "Attendance"}-${sanitizeSlug(eventDoc.title || params.eventId)}.pdf`,
    };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to generate preview certificate.") };
  }
}

/**
 * Organizer: Lists all issued certificates for an event.
 */
export async function getEventCertificatesAction(
  eventId: string,
): Promise<{ success: boolean; certificates?: EventCertificateRecord[]; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const docs =
      (await queryFirestoreDocs<EventCertificateRecord>("event_certificates", [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: eventId },
          },
        },
      ])) || [];

    docs.sort((a, b) => (b.issued_at_millis || 0) - (a.issued_at_millis || 0));
    return { success: true, certificates: docs };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to load issued certificates.") };
  }
}

/**
 * Organizer: Revokes or regenerates an existing issued certificate.
 */
export async function revokeOrRegenerateCertificateAction(
  eventId: string,
  certId: string,
  mode: "revoke" | "regenerate",
): Promise<{ success: boolean; certificate?: EventCertificateRecord; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const existing = (await getFirestoreDoc("event_certificates", certId)) as unknown as EventCertificateRecord | null;
    if (!existing || existing.event_id !== eventId) {
      return { success: false, error: "Certificate record not found." };
    }

    const nowIso = new Date().toISOString();
    if (mode === "revoke") {
      const ok = await patchFirestoreDoc("event_certificates", certId, {
        status: "revoked",
        revoked_at: nowIso,
        updated_at: nowIso,
      });
      if (!ok) return { success: false, error: "Failed to revoke certificate." };
      return { success: true, certificate: { ...existing, status: "revoked", revoked_at: nowIso, updated_at: nowIso } };
    }

    const eventDoc = (await getFirestoreDoc("events", eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) return { success: false, error: "Event not found." };

    const templateCfg =
      existing.certificate_type === "speaker"
        ? eventDoc.certificate_config?.speaker
        : eventDoc.certificate_config?.attendance;

    if (!templateCfg) {
      return { success: false, error: "Certificate template configuration is missing." };
    }

    const verifyUrl = buildCertificateVerifyUrl(existing.token);
    const certCode = existing.certificate_code || buildCertificateCode(eventId, existing.token);
    const pdfBytes = await generatePdfBytesForTemplate({
      templateCfg,
      type: existing.certificate_type,
      eventTitle: eventDoc.title || existing.event_title,
      eventDate: eventDoc.start_date || existing.event_date,
      recipientName: existing.recipient_name,
      role: existing.presenter_role || (existing.certificate_type === "speaker" ? "Speaker" : "Attendee"),
      talkTitle: existing.talk_title,
      certificateCode: certCode,
      verifyUrl,
    });

    const folder = existing.certificate_type === "speaker" ? "speaker" : "attendance";
    const prefix = `community-dashboard/events/${eventId}/certificates/${folder}`;
    const fileName = `${sanitizeSlug(existing.recipient_name)}-${existing.token.slice(0, 16)}-${Date.now().toString(36)}.pdf`;
    const uploaded = await uploadMediaObject(prefix, fileName, pdfBytes, {
      contentType: "application/pdf",
    });

    if (!uploaded.success || !uploaded.item) {
      return { success: false, error: uploaded.error || "Failed to upload regenerated certificate PDF." };
    }

    const patch: Partial<EventCertificateRecord> = {
      pdf_url: uploaded.item.url,
      pdf_key: uploaded.item.key,
      sha256: sha256Hex(pdfBytes),
      engine: templateCfg.engine,
      status: "active",
      revoked_at: null,
      updated_at: nowIso,
    };

    const ok = await patchFirestoreDoc("event_certificates", certId, patch as Record<string, unknown>);
    if (!ok) return { success: false, error: "Failed to update regenerated certificate record." };

    return { success: true, certificate: { ...existing, ...patch } };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update certificate.") };
  }
}

/**
 * Organizer: Generates (or returns cached) Certificate of Appreciation for a confirmed speaker.
 */
export async function generateSpeakerCertificateAction(
  eventId: string,
  speakerConfirmationId: string,
  options?: { recipientNameOverride?: string; forceRegenerate?: boolean },
): Promise<{ success: boolean; certificate?: EventCertificateRecord; verifyUrl?: string; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const eventDoc = (await getFirestoreDoc("events", eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) return { success: false, error: "Event not found." };

    const templateCfg = eventDoc.certificate_config?.speaker;
    if (!templateCfg?.enabled) {
      return {
        success: false,
        error: "Speaker Appreciation Certificate is not enabled. Configure it in the Certificates tab first.",
      };
    }

    const speaker = (await getFirestoreDoc(
      "event_speaker_confirmations",
      speakerConfirmationId,
    )) as unknown as EventSpeakerConfirmation | null;
    if (!speaker || speaker.event_id !== eventId) {
      return { success: false, error: "Speaker confirmation record not found." };
    }

    const existingList =
      (await queryFirestoreDocs<EventCertificateRecord>("event_certificates", [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: eventId },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "speaker_confirmation_id" },
            op: "EQUAL",
            value: { stringValue: speakerConfirmationId },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: "certificate_type" },
            op: "EQUAL",
            value: { stringValue: "speaker" },
          },
        },
      ])) || [];

    const existing = existingList.find((c) => c.status === "active");
    if (existing && !options?.forceRegenerate) {
      return {
        success: true,
        certificate: existing,
        verifyUrl: buildCertificateVerifyUrl(existing.token),
      };
    }

    const token = existing?.token || generateCertificateToken();
    const certCode = existing?.certificate_code || buildCertificateCode(eventId, token);
    const verifyUrl = buildCertificateVerifyUrl(token);
    const recipientName =
      options?.recipientNameOverride?.trim() || speaker.display_name?.trim() || speaker.full_name?.trim() || "Speaker";
    const roleLabel = formatPresenterRoleLabel(speaker.presenter_role);

    const pdfBytes = await generatePdfBytesForTemplate({
      templateCfg,
      type: "speaker",
      eventTitle: eventDoc.title || "GDG Jakarta Event",
      eventDate: eventDoc.start_date,
      recipientName,
      role: roleLabel,
      talkTitle: speaker.talk_title,
      certificateCode: certCode,
      verifyUrl,
    });

    const prefix = `community-dashboard/events/${eventId}/certificates/speaker`;
    const versionSuffix = options?.forceRegenerate ? `-${Date.now().toString(36)}` : "";
    const fileName = `${sanitizeSlug(recipientName)}-${token.slice(0, 16)}${versionSuffix}.pdf`;
    const uploaded = await uploadMediaObject(prefix, fileName, pdfBytes, {
      contentType: "application/pdf",
      customMetadata: {
        eventId,
        certificateType: "speaker",
        speakerConfirmationId,
      },
    });

    if (!uploaded.success || !uploaded.item) {
      return { success: false, error: uploaded.error || "Failed to upload speaker certificate PDF to R2." };
    }

    const nowIso = new Date().toISOString();
    const record: EventCertificateRecord = {
      id: token,
      token,
      certificate_code: certCode,
      certificate_type: "speaker",
      event_id: eventId,
      event_title: eventDoc.title || "GDG Jakarta Event",
      event_date: eventDoc.start_date || "",
      registration_id: null,
      speaker_confirmation_id: speakerConfirmationId,
      member_id: null,
      recipient_name: recipientName,
      recipient_email: (speaker.speaker_email || speaker.email || "").toLowerCase().trim(),
      presenter_role: roleLabel,
      talk_title: speaker.talk_title || null,
      engine: templateCfg.engine,
      pdf_url: uploaded.item.url,
      pdf_key: uploaded.item.key,
      sha256: sha256Hex(pdfBytes),
      status: "active",
      issued_at: existing?.issued_at || nowIso,
      issued_at_millis: existing?.issued_at_millis || Date.now(),
      revoked_at: null,
      email_status: existing?.email_status || "not_sent",
      email_sent_at: existing?.email_sent_at || null,
      email_sent_count: existing?.email_sent_count || 0,
      email_error: existing?.email_error || null,
      updated_at: nowIso,
    };

    const saved = await patchFirestoreDoc(
      "event_certificates",
      token,
      record as unknown as Record<string, unknown>,
      false,
    );
    if (!saved) {
      return { success: false, error: "Failed to save speaker certificate record in Firestore." };
    }

    return { success: true, certificate: record, verifyUrl };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to generate speaker certificate.") };
  }
}

/**
 * Organizer: Ensures speaker certificate exists, renders speaker_thank_you email with conditional highlights,
 * and dispatches via n8n /webhook/api/send-certificate-email with the PDF attached.
 */
export async function sendSpeakerAppreciationEmailAction(
  eventId: string,
  speakerConfirmationId: string,
  options?: { recipientNameOverride?: string; forceRegenerate?: boolean },
): Promise<{ success: boolean; certificate?: EventCertificateRecord; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized." };
    }

    const genRes = await generateSpeakerCertificateAction(eventId, speakerConfirmationId, options);
    if (!genRes.success || !genRes.certificate || !genRes.verifyUrl) {
      return { success: false, error: genRes.error || "Failed to prepare speaker certificate." };
    }

    const cert = genRes.certificate;
    const recipientEmail = (cert.recipient_email || "").trim();
    if (!recipientEmail) {
      return { success: false, error: "Speaker does not have an email address." };
    }

    const eventDoc = (await getFirestoreDoc("events", eventId)) as unknown as FirestoreEvent | null;
    if (!eventDoc) return { success: false, error: "Event not found." };

    const rendered = buildRenderedEmailForAttendee({
      templateKey: "speaker_thank_you",
      attendee: {
        name: cert.recipient_name,
        email: recipientEmail,
      },
      event: eventDoc,
      presenterRole: cert.presenter_role || "Speaker",
      talkTitle: cert.talk_title || undefined,
      certificateUrl: genRes.verifyUrl,
      certificateCode: cert.certificate_code || cert.token,
    });

    const attachmentFileName = `Certificate of Appreciation - ${cert.recipient_name} - ${eventDoc.title || "GDG Jakarta"}.pdf`;

    try {
      await callSendCertificateEmailWebhook({
        first_name: rendered.firstName,
        last_name: rendered.lastName,
        email: recipientEmail,
        subjectEmail: rendered.subjectEmail,
        bodyEmail: rendered.bodyEmail,
        attachmentUrl: cert.pdf_url,
        attachmentFileName,
      });

      const nowIso = new Date().toISOString();
      const nextCount = (cert.email_sent_count || 0) + 1;
      await patchFirestoreDoc("event_certificates", cert.id, {
        email_status: "sent",
        email_sent_at: nowIso,
        email_sent_count: nextCount,
        email_error: null,
        updated_at: nowIso,
      });

      return {
        success: true,
        certificate: {
          ...cert,
          email_status: "sent",
          email_sent_at: nowIso,
          email_sent_count: nextCount,
          email_error: null,
          updated_at: nowIso,
        },
      };
    } catch (mailErr) {
      const errMsg = extractApiMessage(mailErr, "Failed to send appreciation email.");
      const nowIso = new Date().toISOString();
      await patchFirestoreDoc("event_certificates", cert.id, {
        email_status: "failed",
        email_error: errMsg,
        updated_at: nowIso,
      });
      return { success: false, error: errMsg, certificate: { ...cert, email_status: "failed", email_error: errMsg } };
    }
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to send speaker appreciation email.") };
  }
}

/**
 * Attendee Self-Service: Lazily generates (or returns cached) Attendance Certificate after wrap-up.
 * Cryptographically verifies the Firebase ID token BEFORE calling n8n or Cloudflare R2.
 */
export async function claimAttendanceCertificateAction(params: {
  eventId: string;
  registrationId: string;
  idToken: string;
}): Promise<{ success: boolean; certificate?: EventCertificateRecord; verifyUrl?: string; error?: string }> {
  try {
    if (!params.idToken?.trim()) {
      return { success: false, error: "Please sign in to access your certificate." };
    }

    const verified = await verifyFirebaseIdToken(params.idToken.trim());
    if (!verified.valid || !verified.uid || !verified.email) {
      return { success: false, error: "Your session expired. Please refresh and sign in again." };
    }

    const verifiedEmail = verified.email.toLowerCase().trim();
    const tokenArg = params.idToken.trim();

    const [eventDoc, regDoc] = await Promise.all([
      getFirestoreDoc("events", params.eventId, tokenArg) as Promise<FirestoreEvent | null>,
      getFirestoreDoc("event_registrations", params.registrationId, tokenArg) as Promise<FirestoreRegistration | null>,
    ]);

    if (!eventDoc) {
      return { success: false, error: "Event not found." };
    }
    if (!regDoc || regDoc.event_id !== params.eventId) {
      return { success: false, error: "Registration record not found for this event." };
    }

    const ownsRegistration =
      regDoc.member_id === verified.uid || (regDoc.member_email || "").toLowerCase().trim() === verifiedEmail;
    if (!ownsRegistration) {
      return { success: false, error: "You are not authorized to claim a certificate for this registration." };
    }

    if (!isRegistrationEligibleForAttendanceCertificate(regDoc)) {
      return {
        success: false,
        error: "Attendance certificates are only available for attendees who checked in at the main event.",
      };
    }

    if (!isEventWrappedUpForCertificates(eventDoc)) {
      return {
        success: false,
        error: "Attendance certificates are not yet available for this event.",
      };
    }

    const templateCfg = eventDoc.certificate_config?.attendance;
    if (!templateCfg?.enabled) {
      return { success: false, error: "Attendance certificates are not enabled for this event." };
    }

    // Deduplicate: include recipient_email filter to satisfy Firestore allow list rules
    const existingList =
      (await queryFirestoreDocs<EventCertificateRecord>(
        "event_certificates",
        [
          {
            fieldFilter: {
              field: { fieldPath: "event_id" },
              op: "EQUAL",
              value: { stringValue: params.eventId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "registration_id" },
              op: "EQUAL",
              value: { stringValue: params.registrationId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "recipient_email" },
              op: "EQUAL",
              value: { stringValue: verifiedEmail },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "certificate_type" },
              op: "EQUAL",
              value: { stringValue: "attendance" },
            },
          },
        ],
        10,
        tokenArg,
      )) || [];

    const existing = existingList.find((c) => c.status === "active");
    if (existing) {
      return {
        success: true,
        certificate: existing,
        verifyUrl: buildCertificateVerifyUrl(existing.token),
      };
    }

    const token = generateCertificateToken();
    const certCode = buildCertificateCode(params.eventId, token);
    const verifyUrl = buildCertificateVerifyUrl(token);
    const recipientName = regDoc.member_name || "Attendee";

    const pdfBytes = await generatePdfBytesForTemplate({
      templateCfg,
      type: "attendance",
      eventTitle: eventDoc.title || "GDG Jakarta Event",
      eventDate: eventDoc.start_date,
      recipientName,
      role: "Attendee",
      certificateCode: certCode,
      verifyUrl,
    });

    const prefix = `community-dashboard/events/${params.eventId}/certificates/attendance`;
    const fileName = `${sanitizeSlug(recipientName)}-${token.slice(0, 16)}.pdf`;
    const uploaded = await uploadMediaObject(prefix, fileName, pdfBytes, {
      contentType: "application/pdf",
      customMetadata: {
        eventId: params.eventId,
        certificateType: "attendance",
        registrationId: params.registrationId,
      },
    });

    if (!uploaded.success || !uploaded.item) {
      return { success: false, error: uploaded.error || "Failed to store generated certificate." };
    }

    const nowIso = new Date().toISOString();
    const record: EventCertificateRecord = {
      id: token,
      token,
      certificate_code: certCode,
      certificate_type: "attendance",
      event_id: params.eventId,
      event_title: eventDoc.title || "GDG Jakarta Event",
      event_date: eventDoc.start_date || "",
      registration_id: params.registrationId,
      speaker_confirmation_id: null,
      member_id: verified.uid,
      recipient_name: recipientName,
      recipient_email: verifiedEmail,
      presenter_role: "Attendee",
      talk_title: null,
      engine: templateCfg.engine,
      pdf_url: uploaded.item.url,
      pdf_key: uploaded.item.key,
      sha256: sha256Hex(pdfBytes),
      status: "active",
      issued_at: nowIso,
      issued_at_millis: Date.now(),
      revoked_at: null,
      email_status: "not_sent",
      email_sent_at: null,
      email_sent_count: 0,
      email_error: null,
      updated_at: nowIso,
    };

    const saved = await patchFirestoreDoc(
      "event_certificates",
      token,
      record as unknown as Record<string, unknown>,
      false,
      tokenArg,
    );

    if (!saved) {
      return { success: false, error: "Failed to persist your certificate record. Please try again." };
    }

    return {
      success: true,
      certificate: record,
      verifyUrl,
    };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to generate your attendance certificate.") };
  }
}

/**
 * Public: Retrieves a certificate by opaque token for /certificates/[token].
 * Strips recipient_email so private emails are never exposed publicly.
 */
export async function getPublicCertificateByTokenAction(
  token: string,
): Promise<{ success: boolean; certificate?: Omit<EventCertificateRecord, "recipient_email"> | null; error?: string }> {
  try {
    const clean = token?.trim();
    if (!clean || !/^cert_[a-f0-9]{32}$/.test(clean)) {
      return { success: false, error: "Invalid certificate link." };
    }

    const doc = (await getFirestoreDoc("event_certificates", clean)) as unknown as EventCertificateRecord | null;
    if (!doc) {
      return { success: true, certificate: null };
    }

    const { recipient_email: _redacted, ...publicCert } = doc;
    return { success: true, certificate: publicCert };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to verify certificate.") };
  }
}

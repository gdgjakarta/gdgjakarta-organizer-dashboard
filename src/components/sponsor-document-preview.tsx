"use client";

import type React from "react";

import { GdgLogo } from "@/components/gdg-logo";
import { cn } from "@/lib/utils";
import type { SponsorDocument, SponsorDocumentTemplatesConfig } from "@/types/sponsor";

interface SponsorDocumentPreviewProps {
  document: SponsorDocument;
  templatesConfig?: SponsorDocumentTemplatesConfig;
  className?: string;
}

const DEFAULT_TEMPLATES: SponsorDocumentTemplatesConfig = {
  org_name: "Google Developer Group Jakarta",
  org_address: "Jl. Rawa Belong 2C no. 3A, Palmerah, Jakarta Barat, DKI Jakarta, 11480",
  org_email: "info@gdgjakarta.org",
  org_phone: "+628559996648",
  bank_name: "Bank Jago",
  bank_account_number: "509332739966",
  bank_account_name: "Fachridan Tio Mu'afa",
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
};

function formatCurrencyAmount(amount: number, currency: "IDR" | "USD" = "IDR"): string {
  const num = Number(amount) || 0;
  if (currency === "USD") {
    return `$${num.toLocaleString("en-US")}`;
  }
  return `IDR ${num.toLocaleString("id-ID")}`;
}

function formatNumberPlain(amount: number): string {
  const num = Number(amount) || 0;
  return num.toLocaleString("id-ID");
}

function formatTierDisplay(tier: string): string {
  const map: Record<string, string> = {
    platinum: "Platinum Sponsor",
    gold: "Gold Sponsor",
    silver: "Silver Sponsor",
    bronze: "Bronze Sponsor",
    community: "Community Partner",
    partner: "Official Partner",
    media_partner: "Media Partner",
  };
  return map[tier] || `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Sponsor`;
}

function interpolateLoaTokens(
  text: string,
  tokens: {
    eventName: string;
    eventDate: string;
    eventLocation?: string;
    sponsorTier: string;
    totalAmount: string;
    paymentTermDays: string;
    companyName: string;
  },
): React.ReactNode {
  const replaced = text
    .replace(/\{\{eventName\}\}/g, tokens.eventName)
    .replace(/\{\{eventDate\}\}/g, tokens.eventDate)
    .replace(/\{\{eventLocation\}\}/g, tokens.eventLocation || "Jakarta, Indonesia")
    .replace(/\{\{sponsorTier\}\}/g, tokens.sponsorTier)
    .replace(/\{\{totalAmount\}\}/g, tokens.totalAmount)
    .replace(/\{\{paymentTermDays\}\}/g, tokens.paymentTermDays)
    .replace(/\{\{companyName\}\}/g, tokens.companyName);
  return replaced;
}

export function SponsorDocumentPreview({ document: doc, templatesConfig, className }: SponsorDocumentPreviewProps) {
  const cfg: SponsorDocumentTemplatesConfig = {
    ...DEFAULT_TEMPLATES,
    ...(templatesConfig || {}),
  };

  const orgName = cfg.org_name || DEFAULT_TEMPLATES.org_name;
  const orgAddress = cfg.org_address || DEFAULT_TEMPLATES.org_address;
  const orgEmail = cfg.org_email || DEFAULT_TEMPLATES.org_email;
  const orgPhone = cfg.org_phone || DEFAULT_TEMPLATES.org_phone;

  const bankName = doc.bank_name || cfg.bank_name;
  const bankAccountNumber = doc.bank_account_number || cfg.bank_account_number;
  const bankAccountName = doc.bank_account_name || cfg.bank_account_name;
  const bankSwiftCode = doc.bank_swift_code || cfg.bank_swift_code;

  const companyDisplay = doc.company_legal_name?.trim() || doc.company_name || "Sponsor Company";
  const tierLabel = formatTierDisplay(doc.sponsor_tier || "partner");
  const totalFormatted = formatCurrencyAmount(doc.grand_total, doc.currency);

  const eventName = doc.event_title?.trim() || "GDG Jakarta";
  const eventDate = doc.event_date?.trim() || "November 2026";
  const eventLocation = doc.event_location?.trim() || "Jakarta, Indonesia";
  const eventWebsite = doc.event_website?.trim() || "https://gdgjakarta.com";
  const paymentTermDays = doc.payment_term_days?.trim() || cfg.loa_payment_term_days;

  const loaTokens = {
    eventName,
    eventDate,
    eventLocation,
    sponsorTier: tierLabel,
    totalAmount: totalFormatted,
    paymentTermDays,
    companyName: companyDisplay,
  };

  const loaIntro = doc.loa_overrides?.loa_intro_text || cfg.loa_intro_text;
  const loaClause1 = doc.loa_overrides?.loa_clause_1_text || cfg.loa_clause_1_text;
  const loaClause2 = doc.loa_overrides?.loa_clause_2_text || cfg.loa_clause_2_text;
  const loaClause5 = doc.loa_overrides?.loa_clause_5_text || cfg.loa_clause_5_text;
  const loaTermPayment = doc.loa_overrides?.loa_term_payment_method || cfg.loa_term_payment_method;
  const loaTermWorkshop =
    doc.loa_overrides?.loa_term_workshop !== undefined ? doc.loa_overrides.loa_term_workshop : cfg.loa_term_workshop;
  const loaTermDuration = doc.loa_overrides?.loa_term_duration || cfg.loa_term_duration;
  const loaTermTermination = doc.loa_overrides?.loa_term_termination || cfg.loa_term_termination;
  const loaDisclaimer = doc.loa_overrides?.loa_disclaimer || cfg.loa_disclaimer;

  const mouIntro = doc.mou_overrides?.mou_intro_text || cfg.mou_intro_text || DEFAULT_TEMPLATES.mou_intro_text || "";
  const mouClause1 =
    doc.mou_overrides?.mou_clause_1_purpose || cfg.mou_clause_1_purpose || DEFAULT_TEMPLATES.mou_clause_1_purpose || "";
  const mouClause4 =
    doc.mou_overrides?.mou_clause_4_logo_ip || cfg.mou_clause_4_logo_ip || DEFAULT_TEMPLATES.mou_clause_4_logo_ip || "";
  const mouClause5 =
    doc.mou_overrides?.mou_clause_5_term || cfg.mou_clause_5_term || DEFAULT_TEMPLATES.mou_clause_5_term || "";
  const mouClause6 =
    doc.mou_overrides?.mou_clause_6_non_financial ||
    cfg.mou_clause_6_non_financial ||
    DEFAULT_TEMPLATES.mou_clause_6_non_financial ||
    "";
  const mouDisclaimer =
    doc.mou_overrides?.mou_disclaimer || cfg.mou_disclaimer || DEFAULT_TEMPLATES.mou_disclaimer || "";

  return (
    <div
      className={cn(
        "sponsor-a4-sheet mx-auto w-full max-w-[210mm] bg-white text-zinc-900 shadow-md border border-zinc-200 p-8 sm:p-12 print:max-w-none print:w-full print:shadow-none print:border-none print:p-0 font-sans text-[13px] leading-relaxed",
        className,
      )}
    >
      {/* Print-specific A4 page styling */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm 16mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sponsor-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* ================================================================= */}
      {/* 1. INVOICE V2 LAYOUT                                              */}
      {/* ================================================================= */}
      {doc.doc_type === "invoice" && (
        <div className="flex flex-col justify-between min-h-[255mm]">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-zinc-800 pb-5">
              <div className="flex items-center gap-3">
                <GdgLogo size={54} className="h-9 w-auto shrink-0" />
                <div>
                  <div className="font-bold text-base text-zinc-900 tracking-tight">{orgName}</div>
                  <div className="text-xs text-zinc-600 max-w-md leading-snug mt-0.5">{orgAddress}</div>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs text-zinc-700 space-y-0.5 shrink-0">
                <div>
                  <span className="font-semibold">E-mail:</span> {orgEmail}
                </div>
                <div>
                  <span className="font-semibold">Phone:</span> {orgPhone}
                </div>
              </div>
            </div>

            {/* Centered Title */}
            <div className="text-center py-2">
              <h1 className="text-2xl font-bold tracking-wide uppercase text-zinc-900">
                {doc.custom_title?.trim() || "Invoice"}
              </h1>
            </div>

            {/* 2-Column Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
              <div className="space-y-1">
                <div className="font-bold text-xs uppercase tracking-wider text-zinc-500">To:</div>
                {doc.contact_name && <div className="font-semibold text-sm text-zinc-900">{doc.contact_name}</div>}
                {doc.contact_title && <div className="text-xs text-zinc-600">{doc.contact_title}</div>}
                {doc.contact_email && <div className="text-xs text-zinc-600">{doc.contact_email}</div>}
                <div className="font-bold text-sm text-zinc-900 pt-0.5">{companyDisplay}</div>
                {doc.company_address && (
                  <div className="text-xs text-zinc-600 whitespace-pre-line max-w-xs">{doc.company_address}</div>
                )}
              </div>

              <div className="sm:text-right space-y-2">
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-zinc-500">Date:</div>
                  <div className="font-semibold text-sm text-zinc-900">{doc.document_date}</div>
                </div>
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-zinc-500">Invoice Number:</div>
                  <div className="font-mono font-bold text-sm text-zinc-900">{doc.doc_number}</div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="pt-2">
              <table className="w-full border-collapse border border-zinc-800 text-xs">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-900">
                    <th className="border border-zinc-800 px-3 py-2.5 text-left font-bold">Name</th>
                    <th className="border border-zinc-800 px-3 py-2.5 text-center font-bold w-20">Qty</th>
                    <th className="border border-zinc-800 px-3 py-2.5 text-right font-bold w-36">
                      Price ({doc.currency})
                    </th>
                    <th className="border border-zinc-800 px-3 py-2.5 text-right font-bold w-36">
                      Total ({doc.currency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {doc.line_items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-zinc-800 px-3 py-4 text-center text-zinc-500 italic">
                        No line items added
                      </td>
                    </tr>
                  ) : (
                    doc.line_items.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-zinc-800 px-3 py-2.5 font-medium text-zinc-900">
                          {item.description}
                        </td>
                        <td className="border border-zinc-800 px-3 py-2.5 text-center text-zinc-800">{item.qty}</td>
                        <td className="border border-zinc-800 px-3 py-2.5 text-right font-mono text-zinc-800">
                          {formatCurrencyAmount(item.unit_price, doc.currency)}
                        </td>
                        <td className="border border-zinc-800 px-3 py-2.5 text-right font-mono font-semibold text-zinc-900">
                          {formatCurrencyAmount(item.total, doc.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-zinc-50 font-bold">
                    <td colSpan={3} className="border border-zinc-800 px-3 py-2.5 text-right uppercase">
                      Grand Total
                    </td>
                    <td className="border border-zinc-800 px-3 py-2.5 text-right font-mono text-sm text-zinc-900">
                      {totalFormatted}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom 2-Col: Payment Details & Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="space-y-1.5">
                <div className="font-bold text-xs uppercase tracking-wider text-zinc-900">Payment Details:</div>
                <table className="text-xs w-full">
                  <tbody>
                    <tr>
                      <td className="py-0.5 text-zinc-600 w-40">Bank Name</td>
                      <td className="py-0.5 font-semibold text-zinc-900">: {bankName}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-zinc-600">Bank Account Number</td>
                      <td className="py-0.5 font-mono font-semibold text-zinc-900">: {bankAccountNumber}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-zinc-600">Bank Account Name</td>
                      <td className="py-0.5 font-semibold text-zinc-900">: {bankAccountName}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-zinc-600">Swift Code</td>
                      <td className="py-0.5 font-mono font-semibold text-zinc-900">: {bankSwiftCode}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-xs uppercase tracking-wider text-zinc-900">Note:</div>
                <p className="text-xs text-zinc-700 leading-relaxed italic border-l-2 border-zinc-300 pl-3">
                  {doc.invoice_tax_note || cfg.invoice_tax_note}
                </p>
              </div>
            </div>
          </div>

          {/* Signature & Footer */}
          <div className="pt-12 space-y-8">
            <div className="flex justify-end">
              <div className="w-64 text-center space-y-2">
                <div className="h-20 flex items-end justify-center">
                  {doc.organizer_signature_url ? (
                    <img
                      src={doc.organizer_signature_url}
                      alt="Organizer Signature"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="border-t border-zinc-800 pt-1.5">
                  <div className="font-bold text-sm text-zinc-900">
                    {doc.organizer_signer_name || cfg.invoice_signer_name}
                  </div>
                  <div className="text-xs text-zinc-600">{doc.organizer_signer_title || cfg.invoice_signer_title}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-300 pt-4 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <GdgLogo size={32} className="h-5 w-auto" />
                <span className="font-semibold text-zinc-800">{orgName}</span>
              </div>
              <div>Jakarta | Indonesia, {doc.document_date}</div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. QUOTATION V1 LAYOUT                                            */}
      {/* ================================================================= */}
      {doc.doc_type === "quotation" && (
        <div className="flex flex-col justify-between min-h-[255mm]">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-zinc-800 pb-5">
              <div className="flex items-center gap-3">
                <GdgLogo size={54} className="h-9 w-auto shrink-0" />
                <div>
                  <div className="font-bold text-base text-zinc-900 tracking-tight">{orgName}</div>
                  <div className="text-xs text-zinc-600 max-w-md leading-snug mt-0.5">{orgAddress}</div>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs text-zinc-700 space-y-0.5 shrink-0">
                <div>
                  <span className="font-semibold">E-mail:</span> {orgEmail}
                </div>
                <div>
                  <span className="font-semibold">Phone:</span> {orgPhone}
                </div>
              </div>
            </div>

            {/* Centered Title + Number + Date */}
            <div className="space-y-1">
              <div className="text-center">
                <h1 className="text-2xl font-bold uppercase tracking-wide text-zinc-900">
                  {doc.custom_title?.trim() || "Quotation"}
                </h1>
                <div className="text-xs font-mono font-semibold text-zinc-700 mt-0.5">Number: {doc.doc_number}</div>
              </div>
              <div className="text-right text-xs font-medium text-zinc-800 pt-2">Date: {doc.document_date}</div>
            </div>

            {/* Attention Block */}
            <div className="space-y-1">
              <div className="font-bold text-xs uppercase tracking-wider text-zinc-700">Attention:</div>
              <div className="font-bold text-sm text-zinc-900">{companyDisplay}</div>
              {doc.contact_name && (
                <div className="text-xs text-zinc-700">
                  Attn: {doc.contact_name}
                  {doc.contact_title ? ` (${doc.contact_title})` : ""}
                </div>
              )}
              {doc.company_address && (
                <div className="text-xs text-zinc-600 whitespace-pre-line max-w-md">{doc.company_address}</div>
              )}
            </div>

            {/* Charge Summary Table */}
            <div className="space-y-2 pt-2">
              <div className="font-bold text-xs uppercase tracking-wider text-zinc-900">CHARGE SUMMARY</div>
              <table className="w-full border-collapse border border-zinc-800 text-xs">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-900">
                    <th className="border border-zinc-800 px-2.5 py-2 text-center font-bold w-12">No.</th>
                    <th className="border border-zinc-800 px-3 py-2 text-left font-bold">Description</th>
                    <th className="border border-zinc-800 px-2.5 py-2 text-center font-bold w-16">QTY</th>
                    <th className="border border-zinc-800 px-3 py-2 text-right font-bold w-40">
                      Price per Package ({doc.currency})
                    </th>
                    <th className="border border-zinc-800 px-3 py-2 text-right font-bold w-40">
                      Total Price ({doc.currency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {doc.line_items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="border border-zinc-800 px-3 py-4 text-center text-zinc-500 italic">
                        No charge items listed
                      </td>
                    </tr>
                  ) : (
                    doc.line_items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-zinc-800 px-2.5 py-2 text-center text-zinc-800">{idx + 1}</td>
                        <td className="border border-zinc-800 px-3 py-2 font-medium text-zinc-900">
                          {item.description}
                        </td>
                        <td className="border border-zinc-800 px-2.5 py-2 text-center text-zinc-800">{item.qty}</td>
                        <td className="border border-zinc-800 px-3 py-2 text-right font-mono text-zinc-800">
                          {formatNumberPlain(item.unit_price)}
                        </td>
                        <td className="border border-zinc-800 px-3 py-2 text-right font-mono font-semibold text-zinc-900">
                          {formatNumberPlain(item.total)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-zinc-50 font-bold">
                    <td colSpan={4} className="border border-zinc-800 px-3 py-2 text-right uppercase">
                      Grand Total ({doc.currency})
                    </td>
                    <td className="border border-zinc-800 px-3 py-2 text-right font-mono text-sm text-zinc-900">
                      {formatNumberPlain(doc.grand_total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* NOTES Block */}
            <div className="space-y-1.5 pt-2">
              <div className="font-bold text-xs uppercase tracking-wider text-zinc-900">NOTES:</div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-800">
                <li>
                  <span className="font-semibold">Event info:</span>
                  <ul className="list-circle pl-5 mt-0.5 space-y-0.5 text-zinc-700">
                    <li>
                      <span className="font-medium">Name:</span> {eventName}
                    </li>
                    <li>
                      <span className="font-medium">Date:</span> {eventDate}
                    </li>
                    <li>
                      <span className="font-medium">Location:</span> {eventLocation}
                    </li>
                    <li>
                      <span className="font-medium">Website:</span> {eventWebsite}
                    </li>
                  </ul>
                </li>
                <li>{doc.quotation_validity_note || cfg.quotation_validity_note}</li>
              </ul>
            </div>
          </div>

          {/* Dual Signature Block */}
          <div className="pt-10">
            <div className="grid grid-cols-2 gap-10">
              {/* Sponsor Signature */}
              <div className="space-y-1.5">
                <div className="font-bold text-xs uppercase text-zinc-700">Sponsor</div>
                <div className="h-20 border-b border-zinc-800 flex items-end justify-start pb-1">
                  {doc.sponsor_signature_data_url ? (
                    <img
                      src={doc.sponsor_signature_data_url}
                      alt="Sponsor Signature"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-zinc-400 italic print:hidden">Awaiting signature</span>
                  )}
                </div>
                <div className="text-xs space-y-0.5 pt-1">
                  <div>
                    <span className="text-zinc-500">Date:</span>{" "}
                    <span className="font-medium text-zinc-900">
                      {doc.sponsor_signed_at
                        ? new Date(doc.sponsor_signed_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "____________________"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Printed name:</span>{" "}
                    <span className="font-bold text-zinc-900">
                      {doc.sponsor_signed_name || doc.partner_signer_name || doc.contact_name || "____________________"}
                    </span>
                  </div>
                  <div className="text-zinc-600">
                    {doc.sponsor_signed_title ||
                      doc.partner_signer_title ||
                      doc.contact_title ||
                      `Sponsor : ${companyDisplay}`}
                  </div>
                </div>
              </div>

              {/* Organizer Signature */}
              <div className="space-y-1.5">
                <div className="font-bold text-xs uppercase text-zinc-700">Lead Organizer</div>
                <div className="h-20 border-b border-zinc-800 flex items-end justify-start pb-1">
                  {doc.organizer_signature_url ? (
                    <img
                      src={doc.organizer_signature_url}
                      alt="Organizer Signature"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="text-xs space-y-0.5 pt-1">
                  <div>
                    <span className="text-zinc-500">Date:</span>{" "}
                    <span className="font-medium text-zinc-900">{doc.document_date}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Printed name:</span>{" "}
                    <span className="font-bold text-zinc-900">
                      {doc.organizer_signer_name || cfg.quotation_signer_name}
                    </span>
                  </div>
                  <div className="text-zinc-600">{doc.organizer_signer_title || cfg.quotation_signer_title}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. SPONSORSHIP LETTER OF AGREEMENT (LOA V2) LAYOUT                */}
      {/* ================================================================= */}
      {doc.doc_type === "loa" && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <GdgLogo size={50} className="h-8 w-auto shrink-0" />
              <div>
                <div className="font-bold text-base text-zinc-900">{orgName}</div>
                <div className="text-xs text-zinc-600 max-w-md leading-snug">{orgAddress}</div>
              </div>
            </div>
            <div className="text-left sm:text-right text-xs text-zinc-700 space-y-0.5 shrink-0">
              <div>
                <span className="font-semibold">E-mail:</span> {orgEmail}
              </div>
              <div>
                <span className="font-semibold">Phone:</span> {orgPhone}
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center py-1">
            <h1 className="text-lg font-bold uppercase tracking-wide text-zinc-900">
              {doc.custom_title?.trim() || "SPONSORSHIP LETTER OF AGREEMENT"}
            </h1>
            {doc.doc_number && <div className="text-[11px] font-mono text-zinc-600 mt-0.5">Ref: {doc.doc_number}</div>}
          </div>

          {/* Intro Paragraph */}
          <p className="text-xs text-zinc-800 leading-relaxed">{interpolateLoaTokens(loaIntro, loaTokens)}</p>

          {/* Numbered Clauses 1 - 6 */}
          <ol className="list-decimal pl-5 space-y-2.5 text-xs text-zinc-800 leading-relaxed">
            {/* Clause 1 */}
            <li>{interpolateLoaTokens(loaClause1, loaTokens)}</li>

            {/* Clause 2 */}
            <li>{interpolateLoaTokens(loaClause2, loaTokens)}</li>

            {/* Clause 3 */}
            <li>
              <div className="mb-1">Here is the bank account of the organizer:</div>
              <table className="text-xs ml-2">
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-4 font-medium text-zinc-700">Bank Name</td>
                    <td className="py-0.5 font-semibold text-zinc-900">: {bankName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-4 font-medium text-zinc-700">Account Name</td>
                    <td className="py-0.5 font-semibold text-zinc-900">: {bankAccountName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-4 font-medium text-zinc-700">Account Number</td>
                    <td className="py-0.5 font-mono font-semibold text-zinc-900">: {bankAccountNumber}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-4 font-medium text-zinc-700">Swift code</td>
                    <td className="py-0.5 font-mono font-semibold text-zinc-900">: {bankSwiftCode}</td>
                  </tr>
                </tbody>
              </table>
            </li>

            {/* Clause 4 */}
            <li>
              <div className="mb-1">
                For the event, the <span className="font-semibold">{tierLabel}</span> shall receive:
              </div>
              {doc.deliverables && doc.deliverables.length > 0 ? (
                <ol className="list-[lower-alpha] pl-5 space-y-0.5 text-zinc-800">
                  {doc.deliverables.map((deliv, i) => (
                    <li key={`deliv-${i}`}>{deliv}</li>
                  ))}
                </ol>
              ) : (
                <p className="italic text-zinc-500 ml-2">As detailed in the agreed sponsorship package.</p>
              )}
            </li>

            {/* Clause 5 */}
            <li>{interpolateLoaTokens(loaClause5, loaTokens)}</li>

            {/* Clause 6 */}
            <li>
              <div className="mb-1">For the Sponsorship Terms, we will expect:</div>
              <ol className="list-[lower-alpha] pl-5 space-y-1 text-zinc-800">
                <li>
                  <span className="font-semibold">Payment Method:</span>{" "}
                  {interpolateLoaTokens(loaTermPayment, loaTokens)}
                </li>
                {loaTermWorkshop && (
                  <li>
                    <span className="font-semibold">Workshop Session:</span>{" "}
                    {interpolateLoaTokens(loaTermWorkshop, loaTokens)}
                  </li>
                )}
                <li>
                  <span className="font-semibold">Term:</span> {interpolateLoaTokens(loaTermDuration, loaTokens)}
                </li>
                <li>
                  <span className="font-semibold">Termination:</span>{" "}
                  {interpolateLoaTokens(loaTermTermination, loaTokens)}
                </li>
              </ol>
            </li>
          </ol>

          {/* Invoicing Details */}
          <div className="space-y-1 pt-1">
            <div className="font-bold text-xs text-zinc-900">Invoicing Details</div>
            <ul className="list-disc pl-5 text-xs text-zinc-800 space-y-0.5">
              <li>
                <span className="font-medium">Company name:</span> {companyDisplay}
              </li>
              <li>
                <span className="font-medium">Contact person:</span> {doc.contact_name || "—"}
              </li>
              <li>
                <span className="font-medium">Position/title:</span> {doc.contact_title || "—"}
              </li>
              <li>
                <span className="font-medium">E-mail:</span> {doc.contact_email || "—"}
              </li>
              <li>
                <span className="font-medium">Company address:</span> {doc.company_address || "—"}
              </li>
            </ul>
          </div>

          <hr className="border-zinc-400 my-3" />

          {/* Disclaimer */}
          <p className="text-xs italic text-zinc-700 leading-relaxed">
            {interpolateLoaTokens(loaDisclaimer, loaTokens)}
          </p>

          {/* Dual Signature Block */}
          <div className="grid grid-cols-2 gap-10 pt-3">
            {/* Sponsor */}
            <div className="space-y-1">
              <div className="font-bold text-xs text-zinc-900">Sponsor</div>
              <div className="text-xs text-zinc-600">{companyDisplay}</div>
              <div className="h-16 border-b border-zinc-800 flex items-end justify-start pb-1">
                {doc.sponsor_signature_data_url ? (
                  <img
                    src={doc.sponsor_signature_data_url}
                    alt="Sponsor Signature"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-zinc-400 italic print:hidden">Awaiting counter-signature</span>
                )}
              </div>
              <div className="text-xs pt-1 space-y-0.5">
                <div className="font-bold text-zinc-900">
                  {doc.sponsor_signed_name || doc.partner_signer_name || doc.contact_name || "____________________"}
                </div>
                <div className="text-zinc-600">
                  {doc.sponsor_signed_title || doc.partner_signer_title || doc.contact_title || "Authorized Signatory"}
                </div>
                {doc.sponsor_signed_at && (
                  <div className="text-[11px] text-zinc-500">
                    Signed:{" "}
                    {new Date(doc.sponsor_signed_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Organizer */}
            <div className="space-y-1">
              <div className="font-bold text-xs text-zinc-900">Organizer</div>
              <div className="text-xs text-zinc-600">{orgName}</div>
              <div className="h-16 border-b border-zinc-800 flex items-end justify-start pb-1">
                {doc.organizer_signature_url ? (
                  <img
                    src={doc.organizer_signature_url}
                    alt="Organizer Signature"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="text-xs pt-1 space-y-0.5">
                <div className="font-bold text-zinc-900">{doc.organizer_signer_name || cfg.loa_signer_name}</div>
                <div className="text-zinc-600">{doc.organizer_signer_title || cfg.loa_signer_title}</div>
                <div className="text-[11px] text-zinc-500">Date: {doc.document_date}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-300 pt-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <GdgLogo size={28} className="h-4 w-auto" />
              <span className="font-semibold text-zinc-800">{orgName}</span>
            </div>
            <div>Jakarta | Indonesia, {doc.document_date}</div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. MEMORANDUM OF UNDERSTANDING (MOU) LAYOUT                       */}
      {/* ================================================================= */}
      {doc.doc_type === "mou" && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <GdgLogo size={50} className="h-8 w-auto shrink-0" />
              <div>
                <div className="font-bold text-base text-zinc-900">{orgName}</div>
                <div className="text-xs text-zinc-600 max-w-md leading-snug">{orgAddress}</div>
              </div>
            </div>
            <div className="text-left sm:text-right text-xs text-zinc-700 space-y-0.5 shrink-0">
              <div>
                <span className="font-semibold">E-mail:</span> {orgEmail}
              </div>
              <div>
                <span className="font-semibold">Phone:</span> {orgPhone}
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center py-1">
            <h1 className="text-lg font-bold uppercase tracking-wide text-zinc-900">
              {doc.custom_title?.trim() || "PARTNERSHIP MEMORANDUM OF UNDERSTANDING (MOU)"}
            </h1>
            {doc.doc_number && <div className="text-[11px] font-mono text-zinc-600 mt-0.5">Ref: {doc.doc_number}</div>}
          </div>

          {/* Intro Paragraph */}
          <p className="text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap">
            {interpolateLoaTokens(mouIntro, loaTokens)}
          </p>

          {/* Numbered Clauses 1 - 6 */}
          <ol className="list-decimal pl-5 space-y-2.5 text-xs text-zinc-800 leading-relaxed">
            {/* Clause 1: Purpose & Event Scope */}
            <li>
              <span className="font-semibold">Purpose &amp; Event Scope: </span>
              <span className="whitespace-pre-wrap">{interpolateLoaTokens(mouClause1, loaTokens)}</span>
            </li>

            {/* Clause 2: Organizer Responsibilities / Benefits for Partner */}
            <li>
              <div className="mb-1">
                <span className="font-semibold">Responsibilities of the Organizer ({orgName}):</span> The{" "}
                <span className="font-semibold">{tierLabel}</span> shall receive the following benefits and support:
              </div>
              {doc.organizer_commitments && doc.organizer_commitments.length > 0 ? (
                <ol className="list-[lower-alpha] pl-5 space-y-0.5 text-zinc-800">
                  {doc.organizer_commitments.map((item, i) => (
                    <li key={`org-comm-${i}`}>{item}</li>
                  ))}
                </ol>
              ) : (
                <p className="italic text-zinc-500 ml-2">
                  Official logo placement, social media acknowledgment, and event access passes as mutually agreed.
                </p>
              )}
            </li>

            {/* Clause 3: Partner Responsibilities / Deliverables */}
            <li>
              <div className="mb-1">
                <span className="font-semibold">
                  Responsibilities of the {tierLabel} ({companyDisplay}):
                </span>{" "}
                The partner agrees to provide the following deliverables and support:
              </div>
              {doc.deliverables && doc.deliverables.length > 0 ? (
                <ol className="list-[lower-alpha] pl-5 space-y-0.5 text-zinc-800">
                  {doc.deliverables.map((deliv, i) => (
                    <li key={`mou-deliv-${i}`}>{deliv}</li>
                  ))}
                </ol>
              ) : (
                <p className="italic text-zinc-500 ml-2">
                  Mutual event promotion, community outreach, or media coverage as agreed by both parties.
                </p>
              )}
            </li>

            {/* Clause 4: Brand Assets & Intellectual Property */}
            <li>
              <span className="font-semibold">Brand Assets &amp; Intellectual Property: </span>
              <span className="whitespace-pre-wrap">{interpolateLoaTokens(mouClause4, loaTokens)}</span>
            </li>

            {/* Clause 5: Effective Term & Validity */}
            <li>
              <span className="font-semibold">Term &amp; Validity: </span>
              <span className="whitespace-pre-wrap">{interpolateLoaTokens(mouClause5, loaTokens)}</span>
            </li>

            {/* Clause 6: Non-Financial & Mutual Understanding */}
            <li>
              <span className="font-semibold">General Understanding &amp; Amendments: </span>
              <span className="whitespace-pre-wrap">{interpolateLoaTokens(mouClause6, loaTokens)}</span>
            </li>
          </ol>

          {/* Partner Organization Details */}
          <div className="space-y-1 pt-1">
            <div className="font-bold text-xs text-zinc-900">Partner Organization Details</div>
            <ul className="list-disc pl-5 text-xs text-zinc-800 space-y-0.5">
              <li>
                <span className="font-medium">Organization / Company name:</span> {companyDisplay}
              </li>
              <li>
                <span className="font-medium">Partnership role:</span> {tierLabel}
              </li>
              <li>
                <span className="font-medium">Contact person:</span> {doc.contact_name || "—"}
              </li>
              <li>
                <span className="font-medium">Position/title:</span> {doc.contact_title || "—"}
              </li>
              <li>
                <span className="font-medium">E-mail:</span> {doc.contact_email || "—"}
              </li>
              <li>
                <span className="font-medium">Address:</span> {doc.company_address || "—"}
              </li>
            </ul>
          </div>

          <hr className="border-zinc-400 my-3" />

          {/* Disclaimer */}
          <p className="text-xs italic text-zinc-700 leading-relaxed whitespace-pre-wrap">{mouDisclaimer}</p>

          {/* Dual Signature Block */}
          <div className="grid grid-cols-2 gap-10 pt-3">
            {/* Partner */}
            <div className="space-y-1">
              <div className="font-bold text-xs text-zinc-900">{tierLabel}</div>
              <div className="text-xs text-zinc-600">{companyDisplay}</div>
              <div className="h-16 border-b border-zinc-800 flex items-end justify-start pb-1">
                {doc.sponsor_signature_data_url ? (
                  <img
                    src={doc.sponsor_signature_data_url}
                    alt="Partner Signature"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-zinc-400 italic print:hidden">Awaiting counter-signature</span>
                )}
              </div>
              <div className="text-xs pt-1 space-y-0.5">
                <div className="font-bold text-zinc-900">
                  {doc.sponsor_signed_name || doc.partner_signer_name || doc.contact_name || "____________________"}
                </div>
                <div className="text-zinc-600">
                  {doc.sponsor_signed_title ||
                    doc.partner_signer_title ||
                    doc.contact_title ||
                    "Authorized Representative"}
                </div>
                {doc.sponsor_signed_at && (
                  <div className="text-[11px] text-zinc-500">
                    Signed:{" "}
                    {new Date(doc.sponsor_signed_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Organizer */}
            <div className="space-y-1">
              <div className="font-bold text-xs text-zinc-900">Organizer</div>
              <div className="text-xs text-zinc-600">{orgName}</div>
              <div className="h-16 border-b border-zinc-800 flex items-end justify-start pb-1">
                {doc.organizer_signature_url ? (
                  <img
                    src={doc.organizer_signature_url}
                    alt="Organizer Signature"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="text-xs pt-1 space-y-0.5">
                <div className="font-bold text-zinc-900">
                  {doc.organizer_signer_name || cfg.mou_signer_name || cfg.loa_signer_name}
                </div>
                <div className="text-zinc-600">
                  {doc.organizer_signer_title || cfg.mou_signer_title || cfg.loa_signer_title}
                </div>
                <div className="text-[11px] text-zinc-500">Date: {doc.document_date}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-300 pt-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <GdgLogo size={28} className="h-4 w-auto" />
              <span className="font-semibold text-zinc-800">{orgName}</span>
            </div>
            <div>Jakarta | Indonesia, {doc.document_date}</div>
          </div>
        </div>
      )}
    </div>
  );
}

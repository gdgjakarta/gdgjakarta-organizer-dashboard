export type SignatureInputMode = "initials" | "upload" | "draw" | "template";

export type PdfPlacementKind = "signature" | "initials" | "text_stamp" | "emeterai";

export type EMeteraiStatus = "none" | "queued" | "processing" | "stamped" | "failed";

export type EMeteraiDocumentType =
  | "Surat Perjanjian"
  | "Dokumen Transaksi"
  | "Surat Keterangan"
  | "Surat Kuasa"
  | "Surat Pernyataan"
  | "Dokumen Lainnya";

export const EMETERAI_DOCUMENT_TYPES: readonly EMeteraiDocumentType[] = [
  "Surat Perjanjian",
  "Dokumen Transaksi",
  "Surat Keterangan",
  "Surat Kuasa",
  "Surat Pernyataan",
  "Dokumen Lainnya",
] as const;

export const RESMI_EMETERAI_PRICE_IDR = 10500;

export type EMeteraiCorner = "top_left" | "top_right" | "bottom_left" | "bottom_right";

export interface EMeteraiProviderStatus {
  configured: boolean;
  provider: "resmi_id";
  mode: "live" | "test" | "unconfigured";
  priceIdr: number;
}

export interface EMeteraiPlacementRect {
  page: number; // 1-based page number
  x: number; // PDF points from left
  y: number; // PDF points from bottom
  width: number;
  height: number;
  corner?: EMeteraiCorner;
}

export interface PdfPlacement {
  id: string;
  kind: PdfPlacementKind;
  pageIndex: number; // 0-based
  xPct: number; // 0..1 from rendered viewport left
  yPct: number; // 0..1 from rendered viewport top
  widthPct: number; // 0..1 relative to rendered viewport width
  heightPct: number; // 0..1 relative to rendered viewport height
  assetId?: string; // for signature / initials PNG asset
  signerName?: string; // for text_stamp
  signerTitle?: string; // for text_stamp
  signedDateText?: string; // for text_stamp
  includeCertBadge?: boolean; // for text_stamp
  emeteraiCorner?: EMeteraiCorner; // optional quick-snap preset for emeterai
}

export interface SigningCertificateMetadata {
  subject_cn: string;
  organization?: string;
  issuer_cn: string;
  serial_number: string;
  fingerprint_sha256: string;
  valid_from: string;
  valid_to: string;
  is_self_signed: boolean;
  reason: string;
  location: string;
}

export interface SigningCertificateStatus {
  configured: boolean;
  isExpired: boolean;
  isSelfSigned: boolean;
  subjectCn?: string;
  organization?: string;
  issuerCn?: string;
  serialNumber?: string;
  fingerprintSha256?: string;
  validFrom?: string;
  validTo?: string;
  error?: string;
}

export type PartnerSignedDocumentStatus = "signed" | "sent" | "revoked";

export interface PartnerSignedDocument {
  id: string; // psgn_<token>
  token: string; // 32-char hex
  document_title: string;
  original_file_name: string;
  signed_file_name: string;
  sponsor_id?: string | null;
  company_name: string;
  contact_name?: string;
  contact_email?: string;
  event_id?: string | null;
  event_title?: string;
  signer_name: string;
  signer_title: string;
  signer_email: string;
  signer_uid: string;
  signature_methods_used: SignatureInputMode[];
  page_count: number;
  placement_count: number;
  include_certificate_page: boolean;
  signed_pdf_url: string;
  signed_pdf_key: string;
  signed_pdf_size_bytes: number;
  original_sha256: string;
  signed_sha256: string;
  ecert_status: "signed_p12" | "hash_only";
  ecert_metadata?: SigningCertificateMetadata;
  status: PartnerSignedDocumentStatus;
  email_status: "not_sent" | "sent" | "failed";
  email_sent_at?: string;
  email_recipient?: string;
  emeterai_status?: EMeteraiStatus;
  emeterai_provider?: "resmi_id";
  emeterai_mode?: "live" | "test";
  emeterai_request_id?: string;
  emeterai_serial_number?: string;
  emeterai_doc_type?: EMeteraiDocumentType;
  emeterai_price_idr?: number;
  emeterai_placement?: EMeteraiPlacementRect;
  emeterai_stamped_at?: string;
  emeterai_error?: string;
  signed_at: string;
  created_at: string;
  updated_at: string;
}

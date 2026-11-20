"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import dynamic from "next/dynamic";

import {
  AlertTriangle,
  Bold,
  Building2,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  History,
  Italic,
  Link2,
  List,
  Loader2,
  Mail,
  Pencil,
  PenTool,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Underline,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import type { PublishedEventOption } from "@/app/(main)/dashboard/featured-event/_actions/fetch-bevy-events";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatFileSize } from "@/lib/r2/utils";
import { sanitizeHtml } from "@/lib/utils";
import {
  deletePartnerSignedDocumentAction,
  getPartnerSignedDocumentsAction,
  getSigningCertificateStatusAction,
  sendPartnerSignedDocumentEmailAction,
  updatePartnerSignedDocumentMetadataAction,
} from "@/server/partner-signage-actions";
import { getChapterSponsorsAction } from "@/server/sponsor-actions";
import { getSponsorDocumentTemplatesConfigAction } from "@/server/sponsor-document-actions";
import type {
  PartnerSignedDocument,
  PdfPlacement,
  SignatureInputMode,
  SigningCertificateStatus,
} from "@/types/partner-signage";
import type { FirestoreSponsor } from "@/types/sponsor";

import { type CreatedSignatureAsset, SignatureCreatorStudio } from "./signature-creator-studio";

const DynamicPdfPlacementCanvas = dynamic(() => import("./pdf-placement-canvas").then((m) => m.PdfPlacementCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs">Loading PDF workspace...</p>
    </div>
  ),
});

const MAX_PDF_UPLOAD_BYTES = 15 * 1024 * 1024;

function getVerifyUrl(token: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://gdgjakarta.com";
  return `${baseUrl}/partnership/signed-documents/${token}`;
}

interface SignDocumentsTabProps {
  preselectedPartner?: FirestoreSponsor | null;
  onClearPreselectedPartner?: () => void;
  availableEvents?: PublishedEventOption[];
}

export function SignDocumentsTab({
  preselectedPartner,
  onClearPreselectedPartner,
  availableEvents = [],
}: SignDocumentsTabProps) {
  const [certStatus, setCertStatus] = useState<SigningCertificateStatus | null>(null);
  const [signedDocs, setSignedDocs] = useState<PartnerSignedDocument[]>([]);
  const [sponsors, setSponsors] = useState<FirestoreSponsor[]>([]);
  const [savedTemplateSignatureUrl, setSavedTemplateSignatureUrl] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [showWorkspace, setShowWorkspace] = useState(true);

  // Uploaded PDF & Page State
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Metadata & Signer State
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>("custom");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("none");
  const [signerName, setSignerName] = useState("Fachridan Tio M.");
  const [signerTitle, setSignerTitle] = useState("GDG Jakarta Organizer");
  const [signingReason, setSigningReason] = useState("Authorized Partnership Approval — GDG Jakarta");
  const [signingLocation, setSigningLocation] = useState("Jakarta, Indonesia");
  const [includeCertificatePage, setIncludeCertificatePage] = useState(true);

  // Visual Placements & Assets
  const [placements, setPlacements] = useState<PdfPlacement[]>([]);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [assetsById, setAssetsById] = useState<Record<string, CreatedSignatureAsset>>({});
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [maxPdfFitWidth, setMaxPdfFitWidth] = useState<number>(640);

  // Signing Action State
  const [editingDoc, setEditingDoc] = useState<PartnerSignedDocument | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<PartnerSignedDocument | null>(null);
  const [isSavingMetadata, startSaveMetadataTransition] = useTransition();
  const [isSigningPdf, setIsSigningPdf] = useState(false);
  const [resultDialogDoc, setResultDialogDoc] = useState<PartnerSignedDocument | null>(null);

  // History Filtering & Modals
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [emailDialogDoc, setEmailDialogDoc] = useState<PartnerSignedDocument | null>(null);
  const [emailRecipientInput, setEmailRecipientInput] = useState("");
  const [emailCcInput, setEmailCcInput] = useState("");
  const [emailBccInput, setEmailBccInput] = useState("");
  const [emailSubjectInput, setEmailSubjectInput] = useState("");
  const [emailMessageInput, setEmailMessageInput] = useState("");
  const emailNoteEditorRef = useRef<HTMLDivElement | null>(null);
  const [isSendingEmail, startEmailTransition] = useTransition();

  const applyEmailNoteCommand = (command: string, value?: string) => {
    const el = emailNoteEditorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    setEmailMessageInput(el.innerHTML);
  };

  const [deletingDoc, setDeletingDoc] = useState<PartnerSignedDocument | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const loadInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [certRes, docsRes, sponsorsRes, cfgRes] = await Promise.allSettled([
        getSigningCertificateStatusAction(),
        getPartnerSignedDocumentsAction(),
        getChapterSponsorsAction(),
        getSponsorDocumentTemplatesConfigAction(),
      ]);

      if (certRes.status === "fulfilled" && certRes.value.success && certRes.value.status) {
        setCertStatus(certRes.value.status);
      }
      if (docsRes.status === "fulfilled" && docsRes.value.success && docsRes.value.documents) {
        setSignedDocs(docsRes.value.documents);
      }
      if (sponsorsRes.status === "fulfilled" && sponsorsRes.value.success && sponsorsRes.value.sponsors) {
        setSponsors(sponsorsRes.value.sponsors);
      }
      if (cfgRes.status === "fulfilled" && cfgRes.value.success && cfgRes.value.config) {
        const cfg = cfgRes.value.config;
        if (cfg.mou_signer_name || cfg.loa_signer_name) {
          setSignerName(cfg.mou_signer_name || cfg.loa_signer_name);
        }
        if (cfg.mou_signer_title || cfg.loa_signer_title) {
          setSignerTitle(cfg.mou_signer_title || cfg.loa_signer_title);
        }
        if (cfg.organizer_signature_url) {
          setSavedTemplateSignatureUrl(cfg.organizer_signature_url);
        }
      }
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Compute upper bound for PDF "fit" zoom from the outer workspace width so the PDF column can wrap its content width
  useEffect(() => {
    const el = workspaceRef.current;
    if (!showWorkspace || !el) return;
    const updateMaxPdfFit = () => {
      const totalWidth = el.clientWidth;
      if (totalWidth <= 0) return;
      const isSideBySide = window.innerWidth >= 1024;
      const maxColWidth = isSideBySide ? Math.min(Math.floor(totalWidth * 0.62), totalWidth - 404) : totalWidth;
      setMaxPdfFitWidth(Math.max(280, maxColWidth - 26));
    };
    updateMaxPdfFit();
    const observer = new ResizeObserver(updateMaxPdfFit);
    observer.observe(el);
    window.addEventListener("resize", updateMaxPdfFit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMaxPdfFit);
    };
  }, [showWorkspace]);

  // Apply preselected partner passed from PartnersTab "Sign PDF" quick button
  useEffect(() => {
    if (!preselectedPartner) return;
    setShowWorkspace(true);
    setSelectedSponsorId(preselectedPartner.id);
    setCompanyName(preselectedPartner.company_legal_name || preselectedPartner.company);
    setContactName(preselectedPartner.contact_name || "");
    setContactEmail(preselectedPartner.contact_email || "");
    toast.info(`Partner pre-filled: ${preselectedPartner.company}`, {
      description: "Upload the partner PDF to place your signature and certify.",
    });
    onClearPreselectedPartner?.();
  }, [preselectedPartner, onClearPreselectedPartner]);

  const handleSelectPartner = (value: string) => {
    setSelectedSponsorId(value);
    if (value === "custom") return;
    const match = sponsors.find((s) => s.id === value);
    if (match) {
      setCompanyName(match.company_legal_name || match.company);
      setContactName(match.contact_name || "");
      setContactEmail(match.contact_email || "");
    }
  };

  const acceptPdfFile = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Only PDF files (.pdf) are supported.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PDF_UPLOAD_BYTES) {
      toast.error("PDF file must be between 1 byte and 15 MB.");
      return;
    }

    setPdfFile(file);
    setPlacements([]);
    setSelectedPlacementId(null);
    setAssetsById({});
    setActivePageIndex(0);
    setDocumentTitle(file.name.replace(/\.pdf$/i, ""));
  };

  const handleAddSignatureAsset = (asset: CreatedSignatureAsset) => {
    if (!pdfFile) {
      toast.error("Upload a PDF document first.");
      return;
    }

    setAssetsById((prev) => ({ ...prev, [asset.id]: asset }));

    const pagePlacementsCount = placements.filter((p) => p.pageIndex === activePageIndex).length;
    const stagger = (pagePlacementsCount % 4) * 0.025;

    const widthPct = asset.kind === "initials" ? 0.13 : 0.24;
    const heightPct = Math.min(0.22, Math.max(0.045, (widthPct * 0.707) / asset.aspectRatio));

    const newPlacement: PdfPlacement = {
      id: `plc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: asset.kind,
      pageIndex: activePageIndex,
      xPct: Math.min(1 - widthPct, 0.64 - stagger),
      yPct: Math.min(1 - heightPct, 0.74 - stagger),
      widthPct,
      heightPct,
      assetId: asset.id,
    };

    setPlacements((prev) => [...prev, newPlacement]);
    setSelectedPlacementId(newPlacement.id);
    toast.success(`${asset.label} placed on Page ${activePageIndex + 1}`, {
      description: "Drag to move, use corner handle to resize, or click All Pages.",
    });
  };

  const handleAddTextStamp = (asset?: CreatedSignatureAsset) => {
    if (!pdfFile) {
      toast.error("Upload a PDF document first.");
      return;
    }

    if (asset) {
      setAssetsById((prev) => ({ ...prev, [asset.id]: asset }));
    }

    const pagePlacementsCount = placements.filter((p) => p.pageIndex === activePageIndex).length;
    const stagger = (pagePlacementsCount % 4) * 0.025;
    const widthPct = asset ? 0.36 : 0.31;
    const heightPct = 0.095;

    const newStamp: PdfPlacement = {
      id: `plc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "text_stamp",
      pageIndex: activePageIndex,
      xPct: Math.min(1 - widthPct, 0.58 - stagger),
      yPct: Math.min(1 - heightPct, 0.82 - stagger),
      widthPct,
      heightPct,
      assetId: asset?.id,
      signerName: signerName.trim() || "GDG Jakarta Organizer",
      signerTitle: signerTitle.trim() || "Organizer",
      signedDateText: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      includeCertBadge: true,
    };

    setPlacements((prev) => [...prev, newStamp]);
    setSelectedPlacementId(newStamp.id);
    toast.success(`Signer & E-Cert stamp placed on Page ${activePageIndex + 1}`);
  };

  const handleUpdatePlacement = (id: string, patch: Partial<PdfPlacement>) => {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleDeletePlacement = (id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setSelectedPlacementId((curr) => (curr === id ? null : curr));
  };

  const handleDuplicatePlacement = (id: string) => {
    const source = placements.find((p) => p.id === id);
    if (!source) return;
    const clone: PdfPlacement = {
      ...source,
      id: `plc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      xPct: Math.min(1 - source.widthPct, source.xPct + 0.03),
      yPct: Math.min(1 - source.heightPct, source.yPct + 0.03),
    };
    setPlacements((prev) => [...prev, clone]);
    setSelectedPlacementId(clone.id);
  };

  const handleCopyPlacementToAllPages = (id: string) => {
    const source = placements.find((p) => p.id === id);
    if (!source || pageCount <= 1) return;

    const clones: PdfPlacement[] = [];
    for (let idx = 0; idx < pageCount; idx++) {
      if (idx === source.pageIndex) continue;
      clones.push({
        ...source,
        id: `plc_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        pageIndex: idx,
      });
    }
    setPlacements((prev) => [...prev, ...clones]);
    toast.success(`Copied placement to all ${pageCount} pages!`);
  };

  const handleSignAndUpload = async () => {
    if (!pdfFile) {
      toast.error("Please upload a PDF document first.");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Partner / company name is required.");
      return;
    }
    if (!documentTitle.trim()) {
      toast.error("Document title is required.");
      return;
    }
    if (!signerName.trim()) {
      toast.error("Signer name is required.");
      return;
    }
    if (placements.length === 0) {
      toast.error("Place at least one signature, initial, or stamp on the PDF before certifying.");
      return;
    }

    setIsSigningPdf(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);

      // Deduplicate referenced assets
      const referencedAssetIds = new Set<string>();
      for (const p of placements) {
        if (p.assetId) {
          referencedAssetIds.add(p.assetId);
        }
      }

      const methodsUsed = new Set<SignatureInputMode>();
      for (const assetId of referencedAssetIds) {
        const asset = assetsById[assetId];
        if (!asset) {
          toast.error("One of the placed signature images is missing. Please re-place it.");
          return;
        }
        methodsUsed.add(asset.mode);
        formData.append(`asset_${assetId}`, asset.blob, `${assetId}.png`);
      }

      const linkedEvent = availableEvents.find((ev) => String(ev.id) === selectedEventId);

      const payload = {
        existingDocId: editingDoc?.id,
        documentTitle: documentTitle.trim(),
        sponsorId: selectedSponsorId !== "custom" ? selectedSponsorId : null,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        eventId: linkedEvent ? String(linkedEvent.id) : null,
        eventTitle: linkedEvent ? linkedEvent.title : "",
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || "GDG Jakarta Organizer",
        reason: signingReason.trim() || "Authorized Partnership Approval — GDG Jakarta",
        location: signingLocation.trim() || "Jakarta, Indonesia",
        includeCertificatePage,
        signatureMethodsUsed: Array.from(methodsUsed),
        placements,
      };

      formData.append("payload", JSON.stringify(payload));

      const res = await fetch("/api/partnership/sign-pdf", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        document?: PartnerSignedDocument;
        error?: string;
      };

      if (!res.ok || !json.success || !json.document) {
        throw new Error(json.error || `Signing failed with HTTP ${res.status}`);
      }

      if (editingDoc) {
        setSignedDocs((prev) => prev.map((d) => (d.id === json.document!.id ? json.document! : d)));
        setEditingDoc(null);
      } else {
        setSignedDocs((prev) => [json.document!, ...prev]);
      }
      setResultDialogDoc(json.document);

      // Clear active workspace draft so organizer doesn't accidentally double-sign the same file
      setPdfFile(null);
      setPlacements([]);
      setSelectedPlacementId(null);
      setAssetsById({});

      toast.success(
        editingDoc
          ? "Document updated, re-signed & uploaded to bucket!"
          : "PDF signed, certified & uploaded to bucket!",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign and upload PDF.");
    } finally {
      setIsSigningPdf(false);
    }
  };

  const handleStartEdit = (doc: PartnerSignedDocument) => {
    setEditingDoc(doc);
    setShowWorkspace(true);
    setSelectedSponsorId(doc.sponsor_id || "custom");
    setCompanyName(doc.company_name);
    setContactName(doc.contact_name || "");
    setContactEmail(doc.contact_email || "");
    setDocumentTitle(doc.document_title);
    setSelectedEventId(doc.event_id ? String(doc.event_id) : "none");
    setSignerName(doc.signer_name);
    setSignerTitle(doc.signer_title);
    setSigningReason(doc.ecert_metadata?.reason || "Authorized Partnership Approval — GDG Jakarta");
    setSigningLocation(doc.ecert_metadata?.location || "Jakarta, Indonesia");
    setIncludeCertificatePage(doc.include_certificate_page);
    setPdfFile(null);
    setPlacements([]);
    setSelectedPlacementId(null);
    setAssetsById({});
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info(`Editing "${doc.document_title}"`, {
      description: "Upload the replacement PDF, adjust details or signatures, and save.",
    });
  };

  const handleSaveMetadataOnly = () => {
    if (!editingDoc) return;
    if (!companyName.trim() || !documentTitle.trim() || !signerName.trim()) {
      toast.error("Company name, document title, and signer name are required.");
      return;
    }
    const linkedEvent = availableEvents.find((ev) => String(ev.id) === selectedEventId);

    startSaveMetadataTransition(async () => {
      const res = await updatePartnerSignedDocumentMetadataAction({
        docId: editingDoc.id,
        documentTitle: documentTitle.trim(),
        sponsorId: selectedSponsorId !== "custom" ? selectedSponsorId : null,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        eventId: linkedEvent ? String(linkedEvent.id) : null,
        eventTitle: linkedEvent ? linkedEvent.title : "",
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || "GDG Jakarta Organizer",
      });

      if (res.success && res.document) {
        setSignedDocs((prev) => prev.map((d) => (d.id === res.document!.id ? res.document! : d)));
        setEditingDoc(null);
        toast.success("Document details updated!");
      } else {
        toast.error(res.error || "Failed to update document details.");
      }
    });
  };

  const openSendEmailModal = (doc: PartnerSignedDocument) => {
    setEmailDialogDoc(doc);
    setEmailRecipientInput(doc.contact_email || doc.email_recipient || "");
    setEmailCcInput("");
    setEmailBccInput("");
    setEmailSubjectInput(`Signed Document: ${doc.document_title} — ${doc.company_name} | GDG Jakarta`);
    setEmailMessageInput("");
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailDialogDoc) return;
    if (!emailRecipientInput.trim()) {
      toast.error("Please enter a recipient email address.");
      return;
    }

    startEmailTransition(async () => {
      const res = await sendPartnerSignedDocumentEmailAction({
        docId: emailDialogDoc.id,
        recipientEmail: emailRecipientInput.trim(),
        cc: emailCcInput.trim() || undefined,
        bcc: emailBccInput.trim() || undefined,
        customSubject: emailSubjectInput.trim() || undefined,
        customMessage: emailMessageInput.trim() || undefined,
      });

      if (res.success && res.document) {
        setSignedDocs((prev) => prev.map((d) => (d.id === res.document!.id ? res.document! : d)));
        if (resultDialogDoc?.id === res.document.id) {
          setResultDialogDoc(res.document);
        }
        setEmailDialogDoc(null);
        toast.success(`Signed PDF link emailed to ${res.document.email_recipient}!`);
      } else {
        toast.error(res.error || "Failed to send email.");
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingDoc) return;
    startDeleteTransition(async () => {
      const res = await deletePartnerSignedDocumentAction(deletingDoc.id);
      if (res.success) {
        setSignedDocs((prev) => prev.filter((d) => d.id !== deletingDoc.id));
        toast.success("Signed document and bucket file deleted.");
        setDeletingDoc(null);
      } else {
        toast.error(res.error || "Failed to delete signed document.");
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return signedDocs.filter((doc) => {
      if (statusFilter === "sent" && doc.email_status !== "sent") return false;
      if (statusFilter === "not_sent" && doc.email_status === "sent") return false;
      if (!q) return true;
      return (
        doc.document_title.toLowerCase().includes(q) ||
        doc.company_name.toLowerCase().includes(q) ||
        (doc.contact_email || "").toLowerCase().includes(q) ||
        (doc.original_file_name || "").toLowerCase().includes(q)
      );
    });
  }, [signedDocs, searchQuery, statusFilter]);

  const placementPagesSummary = useMemo(() => {
    const uniquePages = new Set(placements.map((p) => p.pageIndex + 1));
    return {
      count: placements.length,
      pagesCount: uniquePages.size,
    };
  }, [placements]);

  return (
    <div className="space-y-6">
      {/* Top Action & E-Certificate Status Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Partner PDF Signage &amp; E-Certificate</h2>

            {certStatus ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="cursor-pointer focus:outline-hidden">
                    {certStatus.configured && !certStatus.isExpired ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        X.509 E-Cert Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px]"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {certStatus.isExpired ? "X.509 E-Cert Expired" : "SHA-256 Seal Only (.p12 not set)"}
                      </Badge>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 text-xs space-y-2">
                  <PopoverHeader>
                    <PopoverTitle className="flex items-center gap-1.5 text-sm font-semibold">
                      {certStatus.configured && !certStatus.isExpired ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                      )}
                      {certStatus.configured ? "X.509 Signing Certificate" : "X.509 Certificate Not Configured"}
                    </PopoverTitle>
                  </PopoverHeader>
                  {certStatus.configured ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Subject:</span>
                        <span className="font-medium text-right">{certStatus.subjectCn}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Issuer:</span>
                        <span className="font-medium text-right">
                          {certStatus.issuerCn} {certStatus.isSelfSigned ? "(Self-Signed)" : "(CA)"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className={certStatus.isExpired ? "font-semibold text-destructive" : "font-medium"}>
                          {certStatus.validTo?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-border">
                        <span className="text-muted-foreground block mb-0.5">SHA-256 Fingerprint:</span>
                        <code className="block break-all rounded bg-muted p-1.5 font-mono text-[10px]">
                          {certStatus.fingerprintSha256}
                        </code>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] text-muted-foreground">
                      <p>
                        Signed PDFs currently receive visual marks and a SHA-256 integrity seal verifiable on
                        gdgjakarta.com. Contact your chapter tech lead if you need X.509 PKCS#7 e-certificate signing
                        enabled.
                      </p>
                      {certStatus.error && <p className="text-destructive">{certStatus.error}</p>}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            ) : (
              <Skeleton className="h-[22px] w-36 rounded-full" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Upload a partner PDF, place typed initials, drawn, or uploaded signatures across pages, protect with an
            e-certificate, and deliver via Cloudflare R2 bucket URL.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant={showWorkspace ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWorkspace(true)}
            className="gap-1.5 text-xs"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Sign New PDF
          </Button>
          <Button
            type="button"
            variant={!showWorkspace ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWorkspace(false)}
            className="gap-1.5 text-xs"
          >
            <History className="h-3.5 w-3.5" />
            History
            {isLoadingData ? (
              <Skeleton className="h-3.5 w-6 rounded-sm" />
            ) : (
              <span>({signedDocs.length})</span>
            )}
          </Button>
        </div>
      </div>

      {certStatus && (!certStatus.configured || certStatus.isExpired) && showWorkspace && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {certStatus.isExpired ? "X.509 Signing Certificate Expired" : "Running in SHA-256 Tamper-Evident Seal Mode"}
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-700/90 dark:text-amber-300/80">
            Signed PDFs will still be stamped, uploaded to R2, and verifiable via SHA-256 on gdgjakarta.com.
          </AlertDescription>
        </Alert>
      )}

      {editingDoc && showWorkspace && (
        <Alert className="border-primary/40 bg-primary/5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <AlertTitle className="text-xs font-semibold text-primary">
              Editing Signed Document: {editingDoc.document_title}
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Upload a replacement PDF and re-sign to update the bucket file while keeping the same verification link.
            </AlertDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!pdfFile && (
              <Button
                type="button"
                size="sm"
                disabled={isSavingMetadata}
                onClick={handleSaveMetadataOnly}
                className="h-7 text-xs gap-1.5"
              >
                {isSavingMetadata ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Details Only"
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingDoc(null)}
              className="h-7 text-xs"
            >
              Cancel Edit
            </Button>
          </div>
        </Alert>
      )}

      {/* ── SIGNING WORKSPACE ── */}
      {showWorkspace && (
        <div ref={workspaceRef} className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left Column: PDF Upload & Interactive Canvas (wraps rendered PDF width on desktop) */}
          <div
            className={`min-w-0 space-y-3 ${
              pdfFile ? "w-full lg:w-fit lg:max-w-[62%] lg:shrink-0" : "w-full lg:flex-1"
            }`}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) acceptPdfFile(f);
              }}
            />

            {!pdfFile ? (
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={() => setIsDraggingPdf(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) acceptPdfFile(f);
                }}
                onClick={() => pdfInputRef.current?.click()}
                className={`group flex min-h-[460px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDraggingPdf
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/60 hover:bg-primary/5"
                }`}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105 group-hover:bg-primary/15">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Drop partner PDF here, or click to browse</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Upload any partner MOU, NDA, contract, or letter up to 15 MB. Pages render locally in your browser
                  before signing.
                </p>
                <span className="mt-4 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-2xs transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  Select Partner PDF
                </span>
              </button>
            ) : (
              <div className="space-y-2.5">
                <div className="flex w-full lg:w-0 lg:min-w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-xs font-medium text-foreground">{pdfFile.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {formatFileSize(pdfFile.size)}
                    </Badge>
                    {pageCount > 0 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {pageCount} {pageCount === 1 ? "page" : "pages"}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pdfInputRef.current?.click()}
                    className="h-7 px-2.5 text-xs"
                  >
                    Replace PDF
                  </Button>
                </div>

                <DynamicPdfPlacementCanvas
                  file={pdfFile}
                  activePageIndex={activePageIndex}
                  onActivePageChange={setActivePageIndex}
                  onPageCountResolved={setPageCount}
                  placements={placements}
                  selectedPlacementId={selectedPlacementId}
                  onSelectPlacement={setSelectedPlacementId}
                  onUpdatePlacement={handleUpdatePlacement}
                  onDeletePlacement={handleDeletePlacement}
                  onDuplicatePlacement={handleDuplicatePlacement}
                  onCopyPlacementToAllPages={handleCopyPlacementToAllPages}
                  assetsById={assetsById}
                  signerName={signerName}
                  signerTitle={signerTitle}
                  maxFitWidth={maxPdfFitWidth}
                />
              </div>
            )}
          </div>

          {/* Right Column: Partner Info, Signer Settings, Signature Studio & Submit */}
          <div
            className={`min-w-0 space-y-4 ${
              pdfFile ? "w-full lg:flex-1 lg:min-w-[380px]" : "w-full lg:w-[440px] xl:w-[480px] lg:shrink-0"
            }`}
          >
            {/* 1. Partner & Document Metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  Partner &amp; Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Select Chapter Partner (Optional)</Label>
                  <Select value={selectedSponsorId} onValueChange={handleSelectPartner}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choose existing partner or enter custom" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="custom">Custom / Unlisted Partner</SelectItem>
                      {sponsors.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sign-company-name" className="text-[11px]">
                    Partner / Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sign-company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="PT Partner Teknologi Indonesia"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sign-contact-name" className="text-[11px]">
                      Partner PIC Name
                    </Label>
                    <Input
                      id="sign-contact-name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Budi Santoso"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sign-contact-email" className="text-[11px]">
                      Partner Email
                    </Label>
                    <Input
                      id="sign-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="pic@partner.co.id"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sign-doc-title" className="text-[11px]">
                    Document Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sign-doc-title"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Partnership MOU — DevFest Jakarta 2026"
                    className="h-8 text-xs"
                  />
                </div>

                {availableEvents.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Linked Event (Optional)</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="No event linked" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="none">No specific event (Chapter-wide)</SelectItem>
                        {availableEvents.map((ev) => (
                          <SelectItem key={String(ev.id)} value={String(ev.id)}>
                            {ev.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Signer & E-Certificate Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Signer &amp; E-Certificate Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sign-signer-name" className="text-[11px]">
                      Organizer Signer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="sign-signer-name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sign-signer-title" className="text-[11px]">
                      Signer Title / Role
                    </Label>
                    <Input
                      id="sign-signer-title"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sign-reason" className="text-[11px]">
                      E-Cert Reason
                    </Label>
                    <Input
                      id="sign-reason"
                      value={signingReason}
                      onChange={(e) => setSigningReason(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sign-location" className="text-[11px]">
                      E-Cert Location
                    </Label>
                    <Input
                      id="sign-location"
                      value={signingLocation}
                      onChange={(e) => setSigningLocation(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="space-y-0.5 pr-2">
                    <Label htmlFor="append-cert-page" className="text-xs font-medium cursor-pointer">
                      Append E-Certificate &amp; Audit Page
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Adds a final A4 verification sheet with SHA-256 digest &amp; QR code.
                    </p>
                  </div>
                  <Switch
                    id="append-cert-page"
                    checked={includeCertificatePage}
                    onCheckedChange={setIncludeCertificatePage}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 3. Signature Creator Studio */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <PenTool className="h-4 w-4 text-primary" />
                    Signature &amp; Initials Studio
                  </CardTitle>
                  {placementPagesSummary.count > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {placementPagesSummary.count} mark{placementPagesSummary.count > 1 ? "s" : ""} on{" "}
                      {placementPagesSummary.pagesCount} pg
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-[11px]">
                  Create initials from name, draw freehand, or upload/reuse a signature image, then place on the PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SignatureCreatorStudio
                  defaultFullName={signerName}
                  savedTemplateSignatureUrl={savedTemplateSignatureUrl}
                  onAddPlacement={handleAddSignatureAsset}
                  onAddTextStamp={handleAddTextStamp}
                  disabled={!pdfFile || isSigningPdf}
                />

                <div className="pt-2 border-t border-border">
                  <Button
                    type="button"
                    disabled={!pdfFile || placements.length === 0 || isSigningPdf}
                    onClick={() => void handleSignAndUpload()}
                    className="w-full h-9 text-xs font-semibold gap-1.5"
                  >
                    {isSigningPdf ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing, Certifying &amp; Uploading to R2...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Sign, Certify &amp; Upload to Bucket
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── SIGNED DOCUMENTS HISTORY ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Signed Partner Documents
                {isLoadingData ? (
                  <Skeleton className="h-4 w-8 rounded-sm" />
                ) : (
                  <span>({signedDocs.length})</span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                All certified PDFs stored in Cloudflare R2 (`assets.gdgjakarta.org`) with verification links.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, partner, email..."
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Email Sent</SelectItem>
                  <SelectItem value="not_sent">Not Sent</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => void loadInitialData()}
                title="Refresh history"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="space-y-2.5 py-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-lg border border-dashed border-border">
              <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-foreground">No signed partner documents yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload a partner PDF above to add signatures, certify with an e-certificate, and get a bucket URL.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs">Document</TableHead>
                    <TableHead className="text-xs">Partner</TableHead>
                    <TableHead className="text-xs">Signer &amp; Date</TableHead>
                    <TableHead className="text-xs">E-Certificate</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => {
                    const verifyUrl = getVerifyUrl(doc.token);
                    return (
                      <TableRow
                        key={doc.id}
                        onClick={() => setPreviewingDoc(doc)}
                        className="cursor-pointer hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="space-y-0.5 max-w-[240px]">
                            <p className="truncate font-medium text-xs text-foreground" title={doc.document_title}>
                              {doc.document_title}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {doc.signed_file_name} • {formatFileSize(doc.signed_pdf_size_bytes)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 max-w-[180px]">
                            <p className="truncate text-xs font-medium text-foreground">{doc.company_name}</p>
                            {doc.contact_email && (
                              <p className="truncate text-[11px] text-muted-foreground">{doc.contact_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-foreground">{doc.signer_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(doc.signed_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.ecert_status === "signed_p12" ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              X.509 Certified
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px]"
                            >
                              SHA-256 Sealed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {doc.email_status === "sent" ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Sent
                            </Badge>
                          ) : doc.email_status === "failed" ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/30 bg-destructive/10 text-destructive text-[11px]"
                            >
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">
                              Not Sent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(doc.signed_pdf_url, "Bucket PDF URL");
                              }}
                              title="Copy Cloudflare R2 Bucket PDF URL"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              asChild
                              title="Open / Download Signed PDF from Bucket"
                            >
                              <a
                                href={doc.signed_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              asChild
                              title="Open Public Verification Portal"
                            >
                              <a
                                href={verifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(doc);
                              }}
                              title="Edit & Replace Signed Document"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-primary hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSendEmailModal(doc);
                              }}
                              title="Send Signed PDF URL to Partner via Email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingDoc(doc);
                              }}
                              title="Delete Signed Document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DOCUMENT DETAILS & PDF PREVIEW DIALOG ── */}
      <Dialog open={Boolean(previewingDoc)} onOpenChange={(open) => !open && setPreviewingDoc(null)}>
        <DialogContent className="w-[95vw] max-w-6xl sm:max-w-6xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{previewingDoc?.document_title}</span>
              {previewingDoc?.ecert_status === "signed_p12" ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                >
                  <ShieldCheck className="h-3 w-3" />
                  X.509 Certified
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px]"
                >
                  SHA-256 Sealed
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewingDoc?.company_name}
              {previewingDoc?.contact_email ? ` • ${previewingDoc.contact_email}` : ""}
              {previewingDoc
                ? ` • Signed by ${previewingDoc.signer_name} on ${new Date(previewingDoc.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {previewingDoc && (
            <div className="min-w-0 space-y-3">
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="text-muted-foreground">Signed File:</span>{" "}
                  <span className="font-mono text-[11px]">
                    {previewingDoc.signed_file_name} ({formatFileSize(previewingDoc.signed_pdf_size_bytes)},{" "}
                    {previewingDoc.page_count} pages)
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Signed SHA-256:</span>{" "}
                  <span className="font-mono text-[11px]">{previewingDoc.signed_sha256.slice(0, 24)}...</span>
                </div>
              </div>

              <iframe
                src={previewingDoc.signed_pdf_url}
                title={previewingDoc.document_title}
                className="h-[58vh] w-full rounded-lg border border-border bg-muted/20"
              />
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {previewingDoc && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => copyToClipboard(previewingDoc.signed_pdf_url, "Bucket PDF URL")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy PDF URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => copyToClipboard(getVerifyUrl(previewingDoc.token), "Verification URL")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Copy Verify Link
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {previewingDoc && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      const target = previewingDoc;
                      setPreviewingDoc(null);
                      handleStartEdit(target);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit &amp; Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      const target = previewingDoc;
                      setPreviewingDoc(null);
                      openSendEmailModal(target);
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Email
                  </Button>
                  <Button asChild size="sm" className="gap-1.5 text-xs">
                    <a href={previewingDoc.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </a>
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── POST-SIGN SUCCESS DIALOG ── */}
      <Dialog open={Boolean(resultDialogDoc)} onOpenChange={(open) => !open && setResultDialogDoc(null)}>
        <DialogContent className="w-full max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Document Signed &amp; Uploaded to Bucket
            </DialogTitle>
            <DialogDescription>
              {resultDialogDoc?.ecert_status === "signed_p12"
                ? "Your PDF has been digitally signed with GDG Jakarta's X.509 PKCS#7 e-certificate and uploaded to Cloudflare R2."
                : "Your PDF has been visually signed, sealed with a SHA-256 integrity hash, and uploaded to Cloudflare R2."}
            </DialogDescription>
          </DialogHeader>

          {resultDialogDoc && (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bucket PDF URL (Ready to Send Back)</Label>
                <div className="flex items-center gap-1.5">
                  <Input readOnly value={resultDialogDoc.signed_pdf_url} className="h-8 font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1 text-xs"
                    onClick={() => copyToClipboard(resultDialogDoc.signed_pdf_url, "Bucket PDF URL")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" asChild>
                    <a href={resultDialogDoc.signed_pdf_url} target="_blank" rel="noopener noreferrer" title="Open PDF">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Public E-Certificate Verification Portal</Label>
                <div className="flex items-center gap-1.5">
                  <Input readOnly value={getVerifyUrl(resultDialogDoc.token)} className="h-8 font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1 text-xs"
                    onClick={() => copyToClipboard(getVerifyUrl(resultDialogDoc.token), "Verification URL")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Partner:</span>
                  <span className="font-medium">{resultDialogDoc.company_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Pages / Size:</span>
                  <span className="font-medium">
                    {resultDialogDoc.page_count} pages ({formatFileSize(resultDialogDoc.signed_pdf_size_bytes)})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Signed SHA-256:</span>
                  <span className="font-mono text-[11px]">{resultDialogDoc.signed_sha256.slice(0, 20)}...</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setResultDialogDoc(null)}>
              Close
            </Button>
            {resultDialogDoc && (
              <Button
                type="button"
                onClick={() => {
                  const target = resultDialogDoc;
                  setResultDialogDoc(null);
                  openSendEmailModal(target);
                }}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send to Partner via Email
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SEND EMAIL TO PARTNER DIALOG ── */}
      <Dialog open={Boolean(emailDialogDoc)} onOpenChange={(open) => !open && setEmailDialogDoc(null)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Send Signed PDF to Partner
            </DialogTitle>
            <DialogDescription>
              Dispatch an official email via n8n with the direct R2 bucket PDF URL and e-certificate verification link.
            </DialogDescription>
          </DialogHeader>

          {emailDialogDoc && (
            <form onSubmit={handleSendEmail} className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="send-email-to" className="text-xs font-medium">
                  Recipient Email (To) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="send-email-to"
                  type="text"
                  required
                  value={emailRecipientInput}
                  onChange={(e) => setEmailRecipientInput(e.target.value)}
                  placeholder="partner@company.com, legal@company.com"
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Separate multiple emails with commas.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="send-email-cc" className="text-xs font-medium">
                    CC <span className="font-normal text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="send-email-cc"
                    type="text"
                    value={emailCcInput}
                    onChange={(e) => setEmailCcInput(e.target.value)}
                    placeholder="cc1@company.com, cc2@company.com"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-email-bcc" className="text-xs font-medium">
                    BCC <span className="font-normal text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="send-email-bcc"
                    type="text"
                    value={emailBccInput}
                    onChange={(e) => setEmailBccInput(e.target.value)}
                    placeholder="bcc@gdgjakarta.org"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="send-email-subject" className="text-xs font-medium">
                  Email Subject
                </Label>
                <Input
                  id="send-email-subject"
                  value={emailSubjectInput}
                  onChange={(e) => setEmailSubjectInput(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Tabs
                  defaultValue="write"
                  onValueChange={(val) => {
                    if (val === "write") {
                      requestAnimationFrame(() => {
                        if (emailNoteEditorRef.current) {
                          emailNoteEditorRef.current.innerHTML = sanitizeHtml(emailMessageInput);
                        }
                      });
                    }
                  }}
                  className="w-full gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="send-email-message" className="text-xs font-medium">
                      Custom Note (Optional)
                    </Label>
                    <TabsList className="h-7 p-0.5">
                      <TabsTrigger value="write" className="h-6 px-2 text-[11px]">
                        Format
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="h-6 gap-1 px-2 text-[11px]">
                        <Code2 className="h-3 w-3" />
                        Raw HTML
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="write" className="mt-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Bold"
                        className="h-6 w-6 p-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyEmailNoteCommand("bold")}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Italic"
                        className="h-6 w-6 p-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyEmailNoteCommand("italic")}
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Underline"
                        className="h-6 w-6 p-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyEmailNoteCommand("underline")}
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Insert Link"
                        className="h-6 w-6 p-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const url = window.prompt("Enter link URL:", "https://");
                          if (url?.trim()) applyEmailNoteCommand("createLink", url.trim());
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Bullet List"
                        className="h-6 w-6 p-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyEmailNoteCommand("insertUnorderedList")}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div
                      ref={emailNoteEditorRef}
                      id="send-email-message"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => setEmailMessageInput(e.currentTarget.innerHTML)}
                      data-placeholder="Write a formatted note to include above the Download Signed PDF button..."
                      className="min-h-[120px] max-h-[220px] overflow-y-auto rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-2 text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-4"
                    />
                  </TabsContent>

                  <TabsContent value="raw" className="mt-0">
                    <Textarea
                      rows={6}
                      value={emailMessageInput}
                      onChange={(e) => setEmailMessageInput(e.target.value)}
                      placeholder="<p>Optional <strong>HTML</strong> message...</p>"
                      className="font-mono text-xs"
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] space-y-1">
                <p className="font-medium text-foreground">Links included automatically:</p>
                <p className="break-all font-mono text-muted-foreground">PDF: {emailDialogDoc.signed_pdf_url}</p>
                <p className="break-all font-mono text-muted-foreground">
                  Verify: {getVerifyUrl(emailDialogDoc.token)}
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEmailDialogDoc(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSendingEmail} className="gap-1.5">
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending Email...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      <AlertDialog open={Boolean(deletingDoc)} onOpenChange={(open) => !open && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete signed document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{deletingDoc?.document_title}&quot; from Cloudflare R2 bucket storage
              and invalidate its verification link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

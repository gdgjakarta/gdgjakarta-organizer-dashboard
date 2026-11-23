"use client";

import type React from "react";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pencil,
  PenTool,
  Plus,
  Printer,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SignatureCreatorStudio } from "@/app/(main)/dashboard/partnership/_components/signature-creator-studio";
import { SponsorDocumentPreview } from "@/components/sponsor-document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSponsorDocumentAction,
  getDefaultSponsorDocumentTemplatesConfig,
  getSponsorDocumentsAction,
  getSponsorDocumentTemplatesConfigAction,
  saveSponsorDocumentAction,
  sendSponsorDocumentEmailAction,
} from "@/server/sponsor-document-actions";
import type {
  SponsorCategory,
  SponsorDocument,
  SponsorDocumentLineItem,
  SponsorDocumentStatus,
  SponsorDocumentTemplatesConfig,
  SponsorDocumentType,
} from "@/types/sponsor";

export interface SponsorDocumentsContext {
  sponsorId: string;
  companyName: string;
  companyLegalName?: string;
  companyAddress?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  sponsorTier: SponsorCategory;
  eventId?: string | null;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventWebsite?: string;
}

interface SponsorDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsorContext: SponsorDocumentsContext | null;
}

const DOC_TYPE_LABELS: Record<SponsorDocumentType, string> = {
  quotation: "Quotation",
  loa: "LOA",
  mou: "MOU",
  invoice: "Invoice",
};

export function SponsorDocumentsDialog({ open, onOpenChange, sponsorContext }: SponsorDocumentsDialogProps) {
  const [documents, setDocuments] = useState<SponsorDocument[]>([]);
  const [templatesConfig, setTemplatesConfig] = useState<SponsorDocumentTemplatesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mode: "list" vs "editor"
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [editingDoc, setEditingDoc] = useState<SponsorDocument | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  // Sign Document Modal State
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);

  // Send Email Modal State
  const [sendingEmailDoc, setSendingEmailDoc] = useState<SponsorDocument | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [bccEmail, setBccEmail] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSendingEmail, startEmailTransition] = useTransition();

  // Deliverable new item input
  const [newDeliverableText, setNewDeliverableText] = useState("");
  const [newOrganizerCommitmentText, setNewOrganizerCommitmentText] = useState("");

  const sponsorId = sponsorContext?.sponsorId;
  const sponsorEventId = sponsorContext?.eventId;

  const loadDocumentsAndConfig = useCallback(async () => {
    if (!sponsorId) return;
    setIsLoading(true);
    try {
      const [docsRes, cfgRes] = await Promise.all([
        getSponsorDocumentsAction({
          sponsorId,
          eventId: sponsorEventId ? String(sponsorEventId) : undefined,
        }),
        getSponsorDocumentTemplatesConfigAction(),
      ]);

      if (docsRes.success && docsRes.documents) {
        setDocuments(docsRes.documents);
      }
      if (cfgRes.success && cfgRes.config) {
        setTemplatesConfig(cfgRes.config);
      } else {
        setTemplatesConfig(await getDefaultSponsorDocumentTemplatesConfig());
      }
    } catch {
      toast.error("Failed to load sponsor documents.");
    } finally {
      setIsLoading(false);
    }
  }, [sponsorId, sponsorEventId]);

  useEffect(() => {
    if (open && sponsorId) {
      setViewMode("list");
      setEditingDoc(null);
      void loadDocumentsAndConfig();
    }
  }, [open, sponsorId, loadDocumentsAndConfig]);

  const handleStartCreate = async (docType: SponsorDocumentType) => {
    if (!sponsorContext) return;
    const cfg = templatesConfig || (await getDefaultSponsorDocumentTemplatesConfig());

    const tier = sponsorContext.sponsorTier || "partner";
    const defaultPrice = docType === "mou" ? 0 : (cfg.default_tier_prices?.[tier] ?? 0);
    const defaultDeliverables =
      docType === "mou"
        ? tier === "media_partner"
          ? [
              "Publish official pre-event and post-event media coverage / press articles",
              "Share official event banners and registration links across media channels",
              "Assign media representatives for on-site event coverage",
            ]
          : [
              "Share official event poster and registration link across community social media & group channels",
              "Delegate community members / representatives to attend the event",
              "Include GDG Jakarta logo on mutual community announcements",
            ]
        : cfg.default_tier_deliverables?.[tier] || [
            "Brand’s Merchandise Placement",
            "Brand Visibility on Event Materials",
            "Social Media Content & Mention",
          ];

    const defaultOrganizerCommitments = cfg.default_mou_organizer_commitments?.[tier] ||
      cfg.default_mou_organizer_commitments?.community || [
        "Official Partner logo placement on website and event promotional materials",
        "Dedicated social media mention and community shoutout",
        "Complimentary representative passes to attend the event",
        "Post-event completion report",
      ];

    const defaultSignerName =
      docType === "invoice"
        ? cfg.invoice_signer_name
        : docType === "quotation"
          ? cfg.quotation_signer_name
          : docType === "mou"
            ? cfg.mou_signer_name || cfg.loa_signer_name
            : cfg.loa_signer_name;

    const defaultSignerTitle =
      docType === "invoice"
        ? cfg.invoice_signer_title
        : docType === "quotation"
          ? cfg.quotation_signer_title
          : docType === "mou"
            ? cfg.mou_signer_title || cfg.loa_signer_title
            : cfg.loa_signer_title;

    const tierNameCap = tier.charAt(0).toUpperCase() + tier.slice(1).replace("_", " ");
    const itemDesc = sponsorContext.eventTitle
      ? `${sponsorContext.eventTitle} — ${tierNameCap} Sponsorship Package`
      : `GDG Jakarta — ${tierNameCap} Partnership Package`;

    const newDraft: SponsorDocument = {
      id: "",
      token: "",
      doc_type: docType,
      doc_number: "", // Will be auto-generated on save if left blank, or user can type custom
      status: "draft",
      event_id: sponsorContext.eventId || null,
      event_title: sponsorContext.eventTitle || "GDG Jakarta",
      event_date: sponsorContext.eventDate || "November 2026",
      event_location: sponsorContext.eventLocation || "Jakarta, Indonesia",
      event_website: sponsorContext.eventWebsite || "https://gdgjakarta.org/",
      sponsor_id: sponsorContext.sponsorId,
      company_name: sponsorContext.companyName,
      company_legal_name: sponsorContext.companyLegalName || sponsorContext.companyName,
      company_address: sponsorContext.companyAddress || "",
      contact_name: sponsorContext.contactName || "",
      contact_title: sponsorContext.contactTitle || "",
      contact_email: sponsorContext.contactEmail || "",
      sponsor_tier: tier,
      currency: "IDR",
      line_items: [
        {
          id: `item_${Date.now()}`,
          description: itemDesc,
          qty: 1,
          unit_price: defaultPrice,
          total: defaultPrice,
        },
      ],
      grand_total: defaultPrice,
      deliverables: [...defaultDeliverables],
      organizer_commitments: [...defaultOrganizerCommitments],
      payment_term_days: cfg.loa_payment_term_days,
      quotation_validity_note: cfg.quotation_validity_note,
      invoice_tax_note: cfg.invoice_tax_note,
      loa_overrides: {},
      mou_overrides: {},
      bank_name: cfg.bank_name,
      bank_account_number: cfg.bank_account_number,
      bank_account_name: cfg.bank_account_name,
      bank_swift_code: cfg.bank_swift_code,
      organizer_signer_name: defaultSignerName,
      organizer_signer_title: defaultSignerTitle,
      organizer_signature_url: cfg.organizer_signature_url || "",
      document_date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setEditingDoc(newDraft);
    setViewMode("editor");
  };

  const handleEditExisting = (doc: SponsorDocument) => {
    setEditingDoc({
      ...doc,
      line_items: doc.line_items ? [...doc.line_items] : [],
      deliverables: doc.deliverables ? [...doc.deliverables] : [],
      organizer_commitments: doc.organizer_commitments ? [...doc.organizer_commitments] : [],
    });
    setViewMode("editor");
  };

  const handleLineItemChange = (idx: number, field: keyof SponsorDocumentLineItem, val: string | number) => {
    if (!editingDoc) return;
    const updated = [...editingDoc.line_items];
    const current = { ...updated[idx] };

    if (field === "description") {
      current.description = String(val);
    } else if (field === "qty") {
      current.qty = Math.max(1, Number(val) || 1);
      current.total = current.qty * current.unit_price;
    } else if (field === "unit_price") {
      current.unit_price = Math.max(0, Number(val) || 0);
      current.total = current.qty * current.unit_price;
    }

    updated[idx] = current;
    const grandTotal = updated.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    setEditingDoc({
      ...editingDoc,
      line_items: updated,
      grand_total: grandTotal,
    });
  };

  const handleAddLineItem = () => {
    if (!editingDoc) return;
    const newItem: SponsorDocumentLineItem = {
      id: `item_${Date.now()}`,
      description: "Additional Sponsorship Activation",
      qty: 1,
      unit_price: 0,
      total: 0,
    };
    const updated = [...editingDoc.line_items, newItem];
    setEditingDoc({
      ...editingDoc,
      line_items: updated,
    });
  };

  const handleRemoveLineItem = (idx: number) => {
    if (!editingDoc) return;
    const updated = editingDoc.line_items.filter((_, i) => i !== idx);
    const grandTotal = updated.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    setEditingDoc({
      ...editingDoc,
      line_items: updated,
      grand_total: grandTotal,
    });
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    startSaveTransition(async () => {
      try {
        const res = await saveSponsorDocumentAction(editingDoc);
        if (res.success && res.document) {
          toast.success(`${DOC_TYPE_LABELS[res.document.doc_type]} (${res.document.doc_number}) saved!`);
          setEditingDoc(res.document);
          await loadDocumentsAndConfig();
        } else {
          toast.error(res.error || "Failed to save document.");
        }
      } catch {
        toast.error("An error occurred while saving the document.");
      }
    });
  };

  const handleDeleteDocument = async (doc: SponsorDocument) => {
    if (!confirm(`Delete ${DOC_TYPE_LABELS[doc.doc_type]} (${doc.doc_number})?`)) return;
    try {
      const res = await deleteSponsorDocumentAction(doc.id);
      if (res.success) {
        toast.success("Document deleted.");
        await loadDocumentsAndConfig();
      } else {
        toast.error(res.error || "Failed to delete document.");
      }
    } catch {
      toast.error("Error deleting document.");
    }
  };

  const getPublicShareUrl = (token: string) => {
    const origin =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://gdgjakarta.com";
    return `${origin}/partnership/documents/${token}`;
  };

  const handleCopyShareLink = (doc: SponsorDocument) => {
    if (!doc.token) {
      toast.error("Please save the document first to generate its shareable link.");
      return;
    }
    const url = getPublicShareUrl(doc.token);
    navigator.clipboard.writeText(url);
    toast.success("Shareable document link copied to clipboard!");
  };

  const handleOpenSendEmailModal = (doc: SponsorDocument) => {
    if (!doc.id || !doc.token) {
      toast.error("Please save the document first before sending via email.");
      return;
    }
    setSendingEmailDoc(doc);
    setRecipientEmail(doc.contact_email || sponsorContext?.contactEmail || "");
    const label = DOC_TYPE_LABELS[doc.doc_type];
    setCustomSubject(`${label} [${doc.doc_number}] — ${doc.event_title ? `${doc.event_title} | ` : ""}GDG Jakarta`);
    setCustomMessage("");
    setCcEmail("");
    setBccEmail("");
  };

  const handleConfirmSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendingEmailDoc) return;
    if (!recipientEmail.trim()) {
      toast.error("Recipient email is required.");
      return;
    }

    startEmailTransition(async () => {
      try {
        const res = await sendSponsorDocumentEmailAction(
          sendingEmailDoc.id,
          recipientEmail.trim(),
          customSubject.trim(),
          customMessage.trim(),
          ccEmail.trim() || undefined,
          bccEmail.trim() || undefined,
        );

        if (res.success && res.document) {
          toast.success(
            `Official ${DOC_TYPE_LABELS[sendingEmailDoc.doc_type]} dispatched to ${recipientEmail.trim()}!`,
          );
          setSendingEmailDoc(null);
          if (editingDoc && editingDoc.id === res.document.id) {
            setEditingDoc(res.document);
          }
          await loadDocumentsAndConfig();
        } else {
          toast.error(res.error || "Failed to send document email.");
        }
      } catch {
        toast.error("Error dispatching email.");
      }
    });
  };

  if (!sponsorContext) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] w-full max-w-[95vw] sm:max-w-[95vw] xl:max-w-7xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Sponsor Documents — {sponsorContext.companyName}
                </DialogTitle>
                <DialogDescription>
                  Generate, customize, preview, and dispatch official Quotations, Letters of Agreement (LOA),
                  Memorandums of Understanding (MOU), and Invoices.
                </DialogDescription>
              </div>

              {viewMode === "editor" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewMode("list");
                    setEditingDoc(null);
                  }}
                  className="text-xs gap-1.5 w-fit"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Documents List ({documents.length})
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" className="h-8 text-xs gap-1.5 font-semibold shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                      New Document
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleStartCreate("invoice")} className="text-xs gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      New Invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartCreate("quotation")} className="text-xs gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      New Quotation
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartCreate("loa")} className="text-xs gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      New LOA
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartCreate("mou")} className="text-xs gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      New MOU
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>

          {/* =============================================================== */}
          {/* VIEW MODE 1: DOCUMENTS LIST                                     */}
          {/* =============================================================== */}
          {viewMode === "list" && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Document No.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grand Total</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Email Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Loading documents...
                        </TableCell>
                      </TableRow>
                    ) : documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-36 text-center text-muted-foreground p-4">
                          <div className="flex flex-col items-center justify-center py-6 px-4 space-y-2 text-center max-w-full">
                            <FileText className="h-8 w-8 stroke-[1.25] text-muted-foreground/60" />
                            <p className="text-sm font-medium text-foreground">
                              No documents generated for {sponsorContext.companyName} yet
                            </p>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto text-balance break-words">
                              Create an official Quotation, Letter of Agreement (LOA), Memorandum of Understanding
                              (MOU), or Invoice above to share a live PDF link or send directly to the sponsor.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      documents.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleEditExisting(doc)}
                        >
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-semibold">
                              {DOC_TYPE_LABELS[doc.doc_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{doc.doc_number}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                doc.status === "signed" || doc.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : doc.status === "sent"
                                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                    : doc.status === "cancelled"
                                      ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                      : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                              }`}
                            >
                              {doc.status}
                            </Badge>
                            {doc.sponsor_signed_name && (
                              <div className="text-[10px] text-emerald-600 mt-0.5">
                                Signed by {doc.sponsor_signed_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {doc.currency === "USD"
                              ? `$${Number(doc.grand_total || 0).toLocaleString("en-US")}`
                              : `IDR ${Number(doc.grand_total || 0).toLocaleString("id-ID")}`}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{doc.document_date}</TableCell>
                          <TableCell>
                            {doc.email_status === "sent" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Sent ({doc.email_recipient})
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not sent</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit & Preview"
                                onClick={() => handleEditExisting(doc)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={doc.organizer_signature_url ? "Update Organizer Signature" : "Sign Document"}
                                onClick={() => {
                                  handleEditExisting(doc);
                                  setIsSignDialogOpen(true);
                                }}
                              >
                                <PenTool className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Copy Public Shareable Link"
                                onClick={() => handleCopyShareLink(doc)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Open Public Portal / Print PDF"
                                asChild
                              >
                                <a href={`/partnership/documents/${doc.token}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Send Document via Email"
                                onClick={() => handleOpenSendEmailModal(doc)}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Delete Document"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW MODE 2: DOCUMENT EDITOR + LIVE A4 PREVIEW                  */}
          {/* =============================================================== */}
          {viewMode === "editor" && editingDoc && (
            <form onSubmit={handleSaveDocument} className="space-y-4 py-2">
              {/* Top Action Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {DOC_TYPE_LABELS[editingDoc.doc_type]}
                  </Badge>
                  <span className="font-mono text-xs font-semibold">
                    {editingDoc.doc_number || "(Auto-generated on Save)"}
                  </span>
                  {editingDoc.token && (
                    <Badge variant="outline" className="text-[11px] font-mono">
                      Token: {editingDoc.token.slice(0, 10)}...
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {editingDoc.token && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyShareLink(editingDoc)}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Shareable Link
                      </Button>

                      <Button type="button" variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
                        <a href={`/partnership/documents/${editingDoc.token}`} target="_blank" rel="noreferrer">
                          <Printer className="h-3.5 w-3.5" />
                          Open &amp; Print PDF
                        </a>
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenSendEmailModal(editingDoc)}
                        className="h-8 text-xs gap-1.5 font-medium"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Send to Sponsor Email
                      </Button>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSignDialogOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    {editingDoc.organizer_signature_url ? "Update Signature" : "Sign Document"}
                  </Button>

                  <Button type="submit" size="sm" disabled={isSaving} className="h-8 text-xs gap-1.5 font-semibold">
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Document
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Form Fields (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Document Metadata */}
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      1. Document Metadata
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Document Type</Label>
                        <Select
                          value={editingDoc.doc_type}
                          onValueChange={(val) =>
                            setEditingDoc({ ...editingDoc, doc_type: val as SponsorDocumentType })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quotation">Quotation</SelectItem>
                            <SelectItem value="loa">LOA</SelectItem>
                            <SelectItem value="mou">MOU (Community / Media Partner)</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={editingDoc.status}
                          onValueChange={(val) =>
                            setEditingDoc({ ...editingDoc, status: val as SponsorDocumentStatus })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="viewed">Viewed</SelectItem>
                            <SelectItem value="signed">Signed</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Document Number (Auto if empty)</Label>
                        <Input
                          value={editingDoc.doc_number}
                          onChange={(e) => setEditingDoc({ ...editingDoc, doc_number: e.target.value })}
                          placeholder="Auto-generated on save"
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Document Date</Label>
                        <Input
                          value={editingDoc.document_date}
                          onChange={(e) => setEditingDoc({ ...editingDoc, document_date: e.target.value })}
                          placeholder="01 November 2026"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Custom Document Title (Optional)</Label>
                      <Input
                        value={editingDoc.custom_title || ""}
                        onChange={(e) => setEditingDoc({ ...editingDoc, custom_title: e.target.value })}
                        placeholder={
                          editingDoc.doc_type === "loa"
                            ? "Default: SPONSORSHIP LETTER OF AGREEMENT"
                            : editingDoc.doc_type === "mou"
                              ? "Default: PARTNERSHIP MEMORANDUM OF UNDERSTANDING (MOU)"
                              : `Default: ${DOC_TYPE_LABELS[editingDoc.doc_type]}`
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Sponsorship Tier</Label>
                        <Select
                          value={editingDoc.sponsor_tier}
                          onValueChange={(val) => {
                            const nextTier = val as SponsorCategory;
                            const nextDelivs =
                              templatesConfig?.default_tier_deliverables?.[nextTier] || editingDoc.deliverables;
                            setEditingDoc({
                              ...editingDoc,
                              sponsor_tier: nextTier,
                              deliverables: nextDelivs,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="platinum">Platinum</SelectItem>
                            <SelectItem value="gold">Gold</SelectItem>
                            <SelectItem value="silver">Silver</SelectItem>
                            <SelectItem value="bronze">Bronze</SelectItem>
                            <SelectItem value="community">Community</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="media_partner">Media Partner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Currency</Label>
                        <Select
                          value={editingDoc.currency}
                          onValueChange={(val) => setEditingDoc({ ...editingDoc, currency: val as "IDR" | "USD" })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IDR">IDR (Indonesian Rupiah)</SelectItem>
                            <SelectItem value="USD">USD (US Dollar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Sponsor & Billing Details */}
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      2. Sponsor Billing &amp; Signatory Info
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Brand / Display Name</Label>
                        <Input
                          value={editingDoc.company_name}
                          onChange={(e) => setEditingDoc({ ...editingDoc, company_name: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Company Legal Name (PT / Inc.)</Label>
                        <Input
                          value={editingDoc.company_legal_name || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, company_legal_name: e.target.value })}
                          placeholder="PT Acme Indonesia"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Company / Billing Address</Label>
                      <Textarea
                        rows={2}
                        value={editingDoc.company_address || ""}
                        onChange={(e) => setEditingDoc({ ...editingDoc, company_address: e.target.value })}
                        placeholder="Full street address for Invoice & LOA..."
                        className="text-xs resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Contact Person</Label>
                        <Input
                          value={editingDoc.contact_name || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, contact_name: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Position / Title</Label>
                        <Input
                          value={editingDoc.contact_title || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, contact_title: e.target.value })}
                          placeholder="Director / Lead"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contact Email</Label>
                        <Input
                          type="email"
                          value={editingDoc.contact_email || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, contact_email: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        3. Line Items &amp; Pricing ({editingDoc.currency})
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLineItem}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {editingDoc.line_items.map((item, idx) => (
                        <div key={item.id} className="rounded border border-border p-2.5 space-y-2 bg-muted/20">
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              value={item.description}
                              onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                              placeholder="Package description"
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLineItem(idx)}
                              disabled={editingDoc.line_items.length <= 1}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">Qty</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={(e) => handleLineItemChange(idx, "qty", Number(e.target.value))}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">
                                Unit Price ({editingDoc.currency})
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.unit_price}
                                onChange={(e) => handleLineItemChange(idx, "unit_price", Number(e.target.value))}
                                className="h-7 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">Total</Label>
                              <Input
                                value={Number(item.total || 0).toLocaleString("id-ID")}
                                readOnly
                                className="h-7 text-xs font-mono bg-muted"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Event Details & LOA Deliverables (Clause 4) */}
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      4. Event Info &amp; Deliverables
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Event Name</Label>
                        <Input
                          value={editingDoc.event_title || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, event_title: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Event Date</Label>
                        <Input
                          value={editingDoc.event_date || ""}
                          onChange={(e) => setEditingDoc({ ...editingDoc, event_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {(editingDoc.doc_type === "quotation" || editingDoc.doc_type === "mou") && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Event Location</Label>
                          <Input
                            value={editingDoc.event_location || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, event_location: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Event Website</Label>
                          <Input
                            value={editingDoc.event_website || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, event_website: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {editingDoc.doc_type === "mou" && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-semibold">
                          MOU Clause 2 — Organizer Commitments to Partner (a, b, c...)
                        </Label>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {(editingDoc.organizer_commitments || []).map((comm, idx) => (
                            <div key={`oc-${idx}`} className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-muted-foreground w-5">
                                {String.fromCharCode(97 + idx)}.
                              </span>
                              <Input
                                value={comm}
                                onChange={(e) => {
                                  const updated = [...(editingDoc.organizer_commitments || [])];
                                  updated[idx] = e.target.value;
                                  setEditingDoc({ ...editingDoc, organizer_commitments: updated });
                                }}
                                className="h-7 text-xs flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = (editingDoc.organizer_commitments || []).filter((_, i) => i !== idx);
                                  setEditingDoc({ ...editingDoc, organizer_commitments: updated });
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            value={newOrganizerCommitmentText}
                            onChange={(e) => setNewOrganizerCommitmentText(e.target.value)}
                            placeholder="Add organizer commitment to partner..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (!newOrganizerCommitmentText.trim()) return;
                                setEditingDoc({
                                  ...editingDoc,
                                  organizer_commitments: [
                                    ...(editingDoc.organizer_commitments || []),
                                    newOrganizerCommitmentText.trim(),
                                  ],
                                });
                                setNewOrganizerCommitmentText("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!newOrganizerCommitmentText.trim()) return;
                              setEditingDoc({
                                ...editingDoc,
                                organizer_commitments: [
                                  ...(editingDoc.organizer_commitments || []),
                                  newOrganizerCommitmentText.trim(),
                                ],
                              });
                              setNewOrganizerCommitmentText("");
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    {(editingDoc.doc_type === "loa" || editingDoc.doc_type === "mou") && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-semibold">
                          {editingDoc.doc_type === "mou"
                            ? "MOU Clause 3 — Partner Responsibilities & Deliverables (a, b, c...)"
                            : "LOA Clause 4 Deliverables (a, b, c...)"}
                        </Label>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {editingDoc.deliverables.map((deliv, idx) => (
                            <div key={`d-${idx}`} className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-muted-foreground w-5">
                                {String.fromCharCode(97 + idx)}.
                              </span>
                              <Input
                                value={deliv}
                                onChange={(e) => {
                                  const updated = [...editingDoc.deliverables];
                                  updated[idx] = e.target.value;
                                  setEditingDoc({ ...editingDoc, deliverables: updated });
                                }}
                                className="h-7 text-xs flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = editingDoc.deliverables.filter((_, i) => i !== idx);
                                  setEditingDoc({ ...editingDoc, deliverables: updated });
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            value={newDeliverableText}
                            onChange={(e) => setNewDeliverableText(e.target.value)}
                            placeholder="Add custom deliverable item..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (!newDeliverableText.trim()) return;
                                setEditingDoc({
                                  ...editingDoc,
                                  deliverables: [...editingDoc.deliverables, newDeliverableText.trim()],
                                });
                                setNewDeliverableText("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!newDeliverableText.trim()) return;
                              setEditingDoc({
                                ...editingDoc,
                                deliverables: [...editingDoc.deliverables, newDeliverableText.trim()],
                              });
                              setNewDeliverableText("");
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    {editingDoc.doc_type === "loa" && (
                      <details className="pt-2 border-t border-border group">
                        <summary className="cursor-pointer select-none text-xs font-semibold text-foreground flex items-center justify-between py-1">
                          <span>Customize LOA Clauses &amp; Terms (Optional)</span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            Leave blank to use global template
                          </span>
                        </summary>
                        <div className="space-y-2.5 pt-2">
                          <p className="text-[11px] text-muted-foreground">
                            Supported tokens:{" "}
                            <code className="font-mono text-[10px]">
                              {
                                "{{eventName}} {{eventDate}} {{sponsorTier}} {{totalAmount}} {{paymentTermDays}} {{companyName}}"
                              }
                            </code>
                          </p>

                          <div className="space-y-1">
                            <Label className="text-xs">Payment Term ({"{{paymentTermDays}}"})</Label>
                            <Input
                              value={editingDoc.payment_term_days || ""}
                              onChange={(e) => setEditingDoc({ ...editingDoc, payment_term_days: e.target.value })}
                              placeholder={templatesConfig?.loa_payment_term_days || "45 days of the invoice date"}
                              className="h-8 text-xs"
                            />
                          </div>

                          {(
                            [
                              { key: "loa_intro_text", label: "Intro Paragraph", rows: 2 },
                              { key: "loa_clause_1_text", label: "Clause 1 — Agreement Scope", rows: 2 },
                              { key: "loa_clause_2_text", label: "Clause 2 — Fee & Payment", rows: 2 },
                              { key: "loa_clause_5_text", label: "Clause 5 — Completion Report", rows: 2 },
                              { key: "loa_term_payment_method", label: "Clause 6a — Payment Method", rows: 2 },
                              { key: "loa_term_duration", label: "Clause 6c — Term / Duration", rows: 2 },
                              { key: "loa_term_termination", label: "Clause 6d — Termination", rows: 2 },
                              { key: "loa_disclaimer", label: "Disclaimer", rows: 2 },
                            ] as const
                          ).map(({ key, label, rows }) => (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs">{label}</Label>
                              <Textarea
                                rows={rows}
                                value={editingDoc.loa_overrides?.[key] || ""}
                                onChange={(e) => {
                                  const next = { ...(editingDoc.loa_overrides || {}) };
                                  if (e.target.value) {
                                    next[key] = e.target.value;
                                  } else {
                                    delete next[key];
                                  }
                                  setEditingDoc({ ...editingDoc, loa_overrides: next });
                                }}
                                placeholder={templatesConfig?.[key] || ""}
                                className="text-xs"
                              />
                            </div>
                          ))}

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs">Clause 6b — Workshop Session</Label>
                              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={editingDoc.loa_overrides?.loa_term_workshop === ""}
                                  onChange={(e) => {
                                    const next = { ...(editingDoc.loa_overrides || {}) };
                                    if (e.target.checked) {
                                      next.loa_term_workshop = "";
                                    } else {
                                      delete next.loa_term_workshop;
                                    }
                                    setEditingDoc({ ...editingDoc, loa_overrides: next });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                                />
                                Hide Workshop clause
                              </label>
                            </div>
                            {editingDoc.loa_overrides?.loa_term_workshop !== "" && (
                              <Textarea
                                rows={2}
                                value={editingDoc.loa_overrides?.loa_term_workshop || ""}
                                onChange={(e) => {
                                  const next = { ...(editingDoc.loa_overrides || {}) };
                                  if (e.target.value) {
                                    next.loa_term_workshop = e.target.value;
                                  } else {
                                    delete next.loa_term_workshop;
                                  }
                                  setEditingDoc({ ...editingDoc, loa_overrides: next });
                                }}
                                placeholder={templatesConfig?.loa_term_workshop || ""}
                                className="text-xs"
                              />
                            )}
                          </div>
                        </div>
                      </details>
                    )}

                    {editingDoc.doc_type === "mou" && (
                      <div className="space-y-1 pt-2 border-t border-border">
                        <Label className="text-xs font-semibold">
                          MOU Clause 6 — Financial / General Understanding Override (Optional)
                        </Label>
                        <Textarea
                          value={editingDoc.mou_overrides?.mou_clause_6_non_financial || ""}
                          onChange={(e) =>
                            setEditingDoc({
                              ...editingDoc,
                              mou_overrides: {
                                ...(editingDoc.mou_overrides || {}),
                                mou_clause_6_non_financial: e.target.value,
                              },
                            })
                          }
                          placeholder={
                            templatesConfig?.mou_clause_6_non_financial ||
                            "Leave blank for default non-monetary clause, or enter paid fee & bank transfer terms..."
                          }
                          rows={3}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live A4 Document Preview (7 cols) */}
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      Live A4 Document Preview
                    </span>
                    <span>Matches exact print &amp; PDF output</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border bg-zinc-100/80 dark:bg-zinc-900/50 p-3 sm:p-5 max-h-[75vh] overflow-y-auto">
                    <SponsorDocumentPreview document={editingDoc} templatesConfig={templatesConfig || undefined} />
                  </div>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Document Email Dialog */}
      <Dialog open={!!sendingEmailDoc} onOpenChange={(v) => !v && setSendingEmailDoc(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:w-fit sm:min-w-[32rem] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Mail className="h-4 w-4 text-primary" />
              Send {sendingEmailDoc ? DOC_TYPE_LABELS[sendingEmailDoc.doc_type] : "Document"} via Email
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dispatches a branded GDG Jakarta email with the document summary and direct button to view, counter-sign,
              or download the official PDF.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmSendEmail} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Recipient Email (To) *</Label>
              <Input
                type="text"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="partner@company.com, finance@company.com"
                className="h-8 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Separate multiple emails with commas.</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">CC (Optional)</Label>
                <Input
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="cc1@company.com, cc2@company.com"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BCC (Optional)</Label>
                <Input
                  type="text"
                  value={bccEmail}
                  onChange={(e) => setBccEmail(e.target.value)}
                  placeholder="bcc@gdgjakarta.org"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Email Subject *</Label>
              <Input
                required
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Custom Opening Message (Optional)</Label>
              <Textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Leave blank to use the standard GDG Jakarta partnership message..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSendingEmailDoc(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSendingEmail} className="gap-1.5 font-semibold">
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send Official Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign Document Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <PenTool className="h-4 w-4 text-primary" />
              Sign {editingDoc ? DOC_TYPE_LABELS[editingDoc.doc_type] : "Document"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apply the Lead Organizer signature to this document. Changes appear immediately in the live A4 preview.
            </DialogDescription>
          </DialogHeader>

          {editingDoc && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Organizer Signer Name</Label>
                  <Input
                    value={editingDoc.organizer_signer_name || ""}
                    onChange={(e) => setEditingDoc({ ...editingDoc, organizer_signer_name: e.target.value })}
                    placeholder="Fachridan Tio M."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Organizer Signer Title</Label>
                  <Input
                    value={editingDoc.organizer_signer_title || ""}
                    onChange={(e) => setEditingDoc({ ...editingDoc, organizer_signer_title: e.target.value })}
                    placeholder="GDG Jakarta Organizer"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {editingDoc.organizer_signature_url && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded border border-border bg-white px-2 py-1 shrink-0">
                      <img
                        src={editingDoc.organizer_signature_url}
                        alt="Current organizer signature"
                        className="h-10 max-w-[140px] object-contain"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Current signature applied</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive shrink-0"
                    onClick={() => {
                      setEditingDoc({ ...editingDoc, organizer_signature_url: "" });
                      toast.info("Signature removed. Click Save Document to persist.");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              )}

              <SignatureCreatorStudio
                defaultFullName={editingDoc.organizer_signer_name || templatesConfig?.quotation_signer_name || ""}
                savedTemplateSignatureUrl={templatesConfig?.organizer_signature_url}
                primaryActionLabel="Apply Signature to Document"
                hideStampButton
                onAddPlacement={(asset) => {
                  setEditingDoc({ ...editingDoc, organizer_signature_url: asset.dataUrl });
                  setIsSignDialogOpen(false);
                  toast.success("Signature applied to document. Click Save Document to persist.");
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

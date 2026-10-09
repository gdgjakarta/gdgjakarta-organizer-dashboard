"use client";

import { useMemo, useState } from "react";

import { format, parseISO } from "date-fns";
import {
  Briefcase,
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  Layers,
  type LucideIcon,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import type { CustomQuestion, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";

interface ApplicantDetailDialogProps {
  registration: FirestoreRegistration | null;
  onClose: () => void;
  onStatusChange: (registrationId: string, newStatus: RegistrationStatus) => void;
  onToggleCheckIn?: (registration: FirestoreRegistration, isCheckedIn: boolean) => void;
  onDelete?: (registration: FirestoreRegistration) => void;
  customQuestions?: CustomQuestion[];
  isPending?: boolean;
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string; dotClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
};

const SECTION_ORDER = [
  "Personal & Contact Information",
  "Professional Background & Experience",
  "Technical Focus & Event Preferences",
  "Expectations & Community",
  "Payment & Ticket Details",
  "Commitment Fee & Attendance",
  "Consent & Code of Conduct",
  "Additional Questions",
];

const SECTION_ICONS: Record<string, LucideIcon> = {
  "Personal & Contact Information": User,
  "Professional Background & Experience": Briefcase,
  "Technical Focus & Event Preferences": Sparkles,
  "Expectations & Community": Heart,
  "Payment & Ticket Details": FileText,
  "Commitment Fee & Attendance": CheckCircle,
  "Consent & Code of Conduct": ShieldCheck,
  "Additional Questions": FileText,
};

function formatLabel(key: string, labelMap: Map<string, string>): string {
  const trimmed = key.trim();
  const mapped = labelMap.get(trimmed.toLowerCase());
  if (mapped) return mapped;

  if (/[A-Z]/.test(trimmed) && trimmed.includes(" ") && !trimmed.includes("_")) {
    return trimmed;
  }

  const words = trimmed
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "url") return "URL";
      if (lower === "id") return "ID";
      if (lower === "github") return "GitHub";
      if (lower === "linkedin") return "LinkedIn";
      if (lower === "whatsapp") return "WhatsApp";
      if (lower === "ai") return "AI";
      if (lower === "gdg") return "GDG";
      if (lower === "rsvp") return "RSVP";
      if (lower === "faq") return "FAQ";
      if (lower === "ui") return "UI";
      if (lower === "ux") return "UX";
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

  return words.join(" ") || trimmed;
}

export function ApplicantDetailDialog({
  registration,
  onClose,
  onStatusChange,
  onToggleCheckIn,
  onDelete,
  customQuestions = [],
  isPending = false,
}: ApplicantDetailDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedProfile, setCopiedProfile] = useState(false);

  // Label and Section mapping
  const { labelMap, sectionMap } = useMemo(() => {
    const lMap = new Map<string, string>();
    const sMap = new Map<string, string>();

    for (const q of DEFAULT_COMBINED_QUESTIONS) {
      if (q.id && q.label) {
        const idLower = q.id.toLowerCase().trim();
        lMap.set(idLower, q.label);
        if (q.section) {
          sMap.set(idLower, q.section);
        }
      }
    }

    for (const q of customQuestions) {
      if (q.id && q.label) {
        const idLower = q.id.toLowerCase().trim();
        lMap.set(idLower, q.label);
        if (q.section) {
          sMap.set(idLower, q.section);
        }
      }
    }

    return { labelMap: lMap, sectionMap: sMap };
  }, [customQuestions]);

  // Grouped answers
  const groupedSections = useMemo(() => {
    if (!registration?.answers) return [];

    const sections = new Map<string, Array<{ key: string; label: string; value: unknown }>>();

    for (const [key, value] of Object.entries(registration.answers)) {
      if (key === "session_id" || key === "session_title") continue;
      if (value === undefined || value === null || value === "") continue;

      const keyLower = key.toLowerCase().trim();
      let sectionName = sectionMap.get(keyLower);

      if (!sectionName) {
        if (
          keyLower.includes("whatsapp") ||
          keyLower.includes("phone") ||
          keyLower.includes("gender") ||
          keyLower.includes("contact") ||
          keyLower.includes("email")
        ) {
          sectionName = "Personal & Contact Information";
        } else if (
          keyLower.includes("experience") ||
          keyLower.includes("background") ||
          keyLower.includes("company") ||
          keyLower.includes("institution") ||
          keyLower.includes("role") ||
          keyLower.includes("title") ||
          keyLower.includes("github") ||
          keyLower.includes("linkedin") ||
          keyLower.includes("portfolio")
        ) {
          sectionName = "Professional Background & Experience";
        } else if (
          keyLower.includes("interest") ||
          keyLower.includes("hobby") ||
          keyLower.includes("expectation") ||
          keyLower.includes("referral") ||
          keyLower.includes("know_about")
        ) {
          sectionName = "Expectations & Community";
        } else {
          sectionName = "Additional Questions";
        }
      }

      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }

      sections.get(sectionName)?.push({
        key,
        label: formatLabel(key, labelMap),
        value,
      });
    }

    return Array.from(sections.entries()).sort(([a], [b]) => {
      const indexA = SECTION_ORDER.indexOf(a);
      const indexB = SECTION_ORDER.indexOf(b);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [registration?.answers, labelMap, sectionMap]);

  if (!registration) return null;

  const rawStatus = (registration.status as string).toLowerCase().trim();
  const statusMeta =
    STATUS_VARIANTS[rawStatus as RegistrationStatus] ||
    (rawStatus === "confirmed" || rawStatus === "registered" ? STATUS_VARIANTS.approved : STATUS_VARIANTS.pending);

  let formattedDate = registration.registered_at;
  try {
    formattedDate = format(parseISO(registration.registered_at), "dd MMM yyyy, h:mm a");
  } catch {
    // Keep raw
  }

  const handleCopy = (text: string, labelText: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${labelText} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyFullProfile = () => {
    const lines: string[] = [
      `Name: ${registration.member_name}`,
      `Email: ${registration.member_email}`,
      `Status: ${statusMeta.label}`,
      `Registered At: ${formattedDate}`,
    ];

    if (registration.session_title || (registration.answers?.session_title as string)) {
      lines.push(`Session Track: ${registration.session_title ?? String(registration.answers?.session_title ?? "")}`);
    }

    if (registration.answers) {
      lines.push("\nQuestion Responses:");
      for (const [k, v] of Object.entries(registration.answers)) {
        if (k === "session_id" || k === "session_title") continue;
        lines.push(`• ${formatLabel(k, labelMap)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
      }
    }

    void navigator.clipboard.writeText(lines.join("\n"));
    setCopiedProfile(true);
    toast.success("Complete applicant profile copied to clipboard");
    setTimeout(() => setCopiedProfile(false), 2000);
  };

  const renderResponseValue = (key: string, value: unknown) => {
    const keyLower = key.toLowerCase();
    const strVal = String(value);

    // URL / Links
    if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
      return (
        <div className="flex items-center justify-between gap-2">
          <a
            href={strVal}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 break-all font-medium text-primary text-xs hover:underline"
          >
            <Globe className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">{strVal}</span>
            <ExternalLink className="size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy link"
            onClick={() => handleCopy(strVal, "Link", key)}
          >
            {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </Button>
        </div>
      );
    }

    // Phone / WhatsApp
    if (keyLower.includes("whatsapp") || keyLower.includes("phone")) {
      const cleanPhone = strVal.replace(/[^0-9]/g, "");
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-xs tracking-wide sm:text-sm">{strVal}</span>
          <div className="flex items-center gap-1">
            {cleanPhone.length >= 8 && (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <Phone className="size-3" />
                Chat WhatsApp
              </a>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6 text-muted-foreground hover:text-foreground"
              title="Copy phone"
              onClick={() => handleCopy(strVal, "Phone number", key)}
            >
              {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>
      );
    }

    // Email
    if (keyLower.includes("email")) {
      return (
        <div className="flex items-center justify-between gap-2">
          <a href={`mailto:${strVal}`} className="truncate font-medium text-primary text-xs hover:underline">
            {strVal}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy email"
            onClick={() => handleCopy(strVal, "Email", key)}
          >
            {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </Button>
        </div>
      );
    }

    // Multi-select or array
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((item) => {
            const itemKey = String(item);
            if (itemKey.toLowerCase().startsWith("other:")) {
              const customVal = itemKey.slice(itemKey.indexOf(":") + 1).trim();
              return (
                <div
                  key={itemKey}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs"
                >
                  <span className="font-semibold text-primary">Other:</span>
                  <span className="text-foreground">{customVal || "Custom"}</span>
                </div>
              );
            }
            return (
              <Badge key={itemKey} variant="secondary" className="font-medium text-xs">
                {itemKey}
              </Badge>
            );
          })}
        </div>
      );
    }

    // Other write-in response
    if (strVal.toLowerCase().startsWith("other:")) {
      const customVal = strVal.slice(strVal.indexOf(":") + 1).trim();
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 font-medium text-primary text-xs">
            Other
          </Badge>
          <span className="font-medium text-foreground text-xs sm:text-sm">{customVal || "(None specified)"}</span>
        </div>
      );
    }

    // Single choice / short tag
    if (
      strVal.length <= 30 &&
      (keyLower.includes("background") ||
        keyLower.includes("experience") ||
        keyLower.includes("gender") ||
        keyLower.includes("level") ||
        strVal === "Tech" ||
        strVal === "Non-Tech" ||
        strVal === "Yes" ||
        strVal === "No")
    ) {
      return (
        <Badge variant="outline" className="border-border/80 bg-muted/40 font-medium text-foreground text-xs">
          {strVal}
        </Badge>
      );
    }

    // Longer paragraphs / open text
    if (strVal.length > 60 || strVal.includes("\n")) {
      return (
        <div className="whitespace-pre-wrap rounded-md border border-border/50 bg-muted/30 p-2.5 text-foreground text-xs leading-relaxed">
          {strVal}
        </div>
      );
    }

    // Standard string
    return <span className="font-medium text-foreground text-xs sm:text-sm">{strVal}</span>;
  };

  return (
    <Dialog open={Boolean(registration)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] p-0 sm:max-w-xl md:max-w-2xl">
        {/* Header Bar */}
        <div className="border-b bg-muted/20 px-6 pt-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <Avatar className="size-12 rounded-full border border-border shadow-xs">
                <AvatarImage src={registration.member_avatar} alt={registration.member_name} />
                <AvatarFallback className="font-semibold text-sm">
                  {getInitials(registration.member_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <DialogTitle className="font-bold text-foreground text-lg tracking-tight">
                  {registration.member_name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {registration.member_email}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {formattedDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn("gap-1.5 border px-2.5 py-1 font-semibold text-xs", statusMeta.badgeClass)}
              >
                <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                {statusMeta.label}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={handleCopyFullProfile}
                title="Copy attendee dossier"
              >
                {copiedProfile ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copiedProfile ? "Copied" : "Copy Profile"}</span>
              </Button>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Detailed applicant dossier with submitted questions, track selection, and contact details.
          </DialogDescription>

          {/* Session Track Banner if present */}
          {Boolean(registration.session_title ?? registration.session_id ?? registration.answers?.session_title) && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Layers className="size-4 text-primary" />
                <span className="text-muted-foreground">Session Track:</span>
                <span className="font-semibold text-primary">
                  {registration.session_title ??
                    String(registration.answers?.session_title ?? "") ??
                    `Track ID: ${registration.session_id}`}
                </span>
              </div>
              <Badge variant="secondary" className="font-medium text-[10px] uppercase tracking-wider">
                Assigned
              </Badge>
            </div>
          )}

          {/* Bevy On-Site Check-In Status & Action */}
          <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">On-Site Check-In (Bevy):</span>
              {registration.is_checked_in ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-medium text-[11px] text-emerald-600 dark:text-emerald-400"
                >
                  <UserCheck className="size-3" /> Checked In
                  {registration.checked_in_at && ` • ${registration.checked_in_at}`}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Not Checked In
                </Badge>
              )}
            </div>

            {onToggleCheckIn && (
              <Button
                size="sm"
                variant={registration.is_checked_in ? "ghost" : "outline"}
                className={cn(
                  "h-7 gap-1 self-start text-xs sm:self-auto",
                  registration.is_checked_in
                    ? "text-muted-foreground hover:text-destructive"
                    : "border-primary/30 text-primary hover:bg-primary/5",
                )}
                disabled={isPending}
                onClick={() => onToggleCheckIn(registration, !registration.is_checked_in)}
              >
                {registration.is_checked_in ? (
                  <>
                    <RotateCcw className="size-3" />
                    Undo Check-In
                  </>
                ) : (
                  <>
                    <UserCheck className="size-3" />
                    Check In via Bevy
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Questions and Responses */}
        <ScrollArea className="max-h-[55vh] px-6 py-4">
          <div className="space-y-6">
            {groupedSections.length > 0 ? (
              groupedSections.map(([sectionTitle, items]) => {
                const SectionIcon = SECTION_ICONS[sectionTitle] || HelpCircle;

                return (
                  <div key={sectionTitle} className="space-y-3">
                    <div className="flex items-center gap-2 border-border/40 border-b pb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <SectionIcon className="size-3.5 text-primary" />
                      <span>{sectionTitle}</span>
                      <span className="font-normal text-[11px] text-muted-foreground/70">
                        ({items.length} {items.length === 1 ? "response" : "responses"})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {items.map((item) => {
                        const isWide =
                          String(item.value).length > 60 ||
                          String(item.value).includes("\n") ||
                          Array.isArray(item.value) ||
                          item.key.toLowerCase().includes("portfolio") ||
                          item.key.toLowerCase().includes("linkedin") ||
                          item.key.toLowerCase().includes("github");

                        return (
                          <div
                            key={item.key}
                            className={cn(
                              "flex flex-col justify-between rounded-lg border border-border/60 bg-card p-3 shadow-2xs transition-colors hover:border-border",
                              isWide && "sm:col-span-2",
                            )}
                          >
                            <div className="mb-1 font-medium text-muted-foreground text-xs">{item.label}</div>
                            <div className="pt-0.5">{renderResponseValue(item.key, item.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <FileText className="mb-2 size-8 opacity-40" />
                <p className="font-medium text-sm">No custom questionnaire responses recorded.</p>
                <p className="text-muted-foreground/80 text-xs">
                  This attendee registered via Standard RSVP without additional custom questions.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-6 py-3.5">
          <div className="flex items-center gap-2">
            {registration.status !== "waitlisted" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={isPending}
                onClick={() => {
                  onStatusChange(registration.id, "waitlisted");
                  onClose();
                }}
              >
                Waitlist
              </Button>
            )}

            {registration.status !== "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-600 text-xs hover:bg-amber-500/10"
                disabled={isPending}
                onClick={() => {
                  onStatusChange(registration.id, "pending");
                  onClose();
                }}
              >
                <Clock className="mr-1.5 size-3.5" />
                Set Pending
              </Button>
            )}

            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                disabled={isPending}
                onClick={() => {
                  onDelete(registration);
                }}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Remove Attendee
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {registration.status !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive text-xs hover:bg-destructive/10"
                disabled={isPending}
                onClick={() => {
                  onStatusChange(registration.id, "rejected");
                  onClose();
                }}
              >
                <XCircle className="mr-1.5 size-3.5" />
                Reject
              </Button>
            )}

            {registration.status !== "approved" && (
              <Button
                size="sm"
                className="bg-emerald-600 text-white text-xs shadow-xs hover:bg-emerald-700"
                disabled={isPending}
                onClick={() => {
                  onStatusChange(registration.id, "approved");
                  onClose();
                }}
              >
                <CheckCircle className="mr-1.5 size-3.5" />
                Approve Applicant
              </Button>
            )}

            <Button size="sm" variant="secondary" className="text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Loader2,
  ShieldCheck,
  Ticket,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { type ResolvedRecipient, resolveAudienceRecipientsAction } from "../_actions/resolve-audience-recipients";
import { AUDIENCE_OPTIONS, type AudienceType } from "../_types/audience";

interface AudienceSelectorProps {
  eventId?: string;
  selectedAudience?: AudienceType;
  onSelectAudience: (audience: AudienceType, result: { count: number; recipients: ResolvedRecipient[] }) => void;
  onAudienceTypeChange?: (audience: AudienceType) => void;
  onResolvingChange?: (isResolving: boolean) => void;
  isLoadingEvent?: boolean;
  disabled?: boolean;
  error?: boolean;
}

const CATEGORY_ICONS: Record<AudienceType, React.ElementType> = {
  ticket_all: Ticket,
  ticket_in_person: Ticket,
  ticket_virtual: Ticket,
  ticket_hybrid: Ticket,
  waitlist: Clock,
  attendees_checked_in: UserCheck,
  attendees_not_checked_in: UserMinus,
  chapter_members: Users,
  chapter_members_without_ticket: UserX,
  chapter_members_never_registered: UserMinus,
  event_chapter_teams: ShieldCheck,
};

export function AudienceSelector({
  eventId,
  selectedAudience,
  onSelectAudience,
  onAudienceTypeChange,
  onResolvingChange,
  isLoadingEvent = false,
  disabled = false,
  error = false,
}: AudienceSelectorProps) {
  const [internalAudience, setInternalAudience] = useState<AudienceType | undefined>(selectedAudience);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<ResolvedRecipient[]>([]);
  const [sampleRecipients, setSampleRecipients] = useState<ResolvedRecipient[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeAudience = selectedAudience ?? internalAudience;

  const onSelectAudienceRef = useRef(onSelectAudience);
  onSelectAudienceRef.current = onSelectAudience;

  const onResolvingChangeRef = useRef(onResolvingChange);
  onResolvingChangeRef.current = onResolvingChange;

  // Automatically fetch recipients count when eventId or activeAudience changes
  useEffect(() => {
    let isCancelled = false;

    if (!eventId || !activeAudience) {
      setRecipientCount(null);
      setRecipients([]);
      setSampleRecipients([]);
      setIsResolving(false);
      onResolvingChangeRef.current?.(false);
      return;
    }

    setIsResolving(true);
    onResolvingChangeRef.current?.(true);

    void resolveAudienceRecipientsAction(eventId, activeAudience)
      .then((res) => {
        if (isCancelled) return;
        setIsResolving(false);
        onResolvingChangeRef.current?.(false);
        if (res.success) {
          setRecipientCount(res.totalCount);
          setRecipients(res.recipients);
          setSampleRecipients(res.sampleRecipients);
          onSelectAudienceRef.current(activeAudience, { count: res.totalCount, recipients: res.recipients });
        } else {
          setRecipientCount(0);
          setRecipients([]);
          setSampleRecipients([]);
          onSelectAudienceRef.current(activeAudience, { count: 0, recipients: [] });
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Failed to resolve audience recipients:", err);
        setIsResolving(false);
        onResolvingChangeRef.current?.(false);
        setRecipientCount(0);
        setRecipients([]);
        setSampleRecipients([]);
        onSelectAudienceRef.current(activeAudience, { count: 0, recipients: [] });
      });

    return () => {
      isCancelled = true;
    };
  }, [eventId, activeAudience]);

  const handleAudienceChange = (val: string) => {
    const nextAudience = val as AudienceType;
    if (nextAudience === activeAudience) return;

    setIsResolving(true);
    onResolvingChangeRef.current?.(true);

    if (onAudienceTypeChange) {
      onAudienceTypeChange(nextAudience);
    } else {
      setInternalAudience(nextAudience);
    }
  };

  const isEnabled = Boolean(eventId) && !disabled && !isLoadingEvent;
  const showResolvingState = isResolving || isLoadingEvent;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <Select value={activeAudience ?? ""} onValueChange={handleAudienceChange} disabled={!isEnabled}>
            <SelectTrigger
              className={cn(
                "h-auto min-h-10 w-full px-3 py-2 text-left font-normal",
                error && "border-destructive ring-1 ring-destructive",
                !selectedAudience && "text-muted-foreground",
              )}
            >
              <SelectValue
                placeholder={
                  !eventId ? "Select an event above first to choose audience" : "Select audience recipient segment..."
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              {/* Group 1: Event Attendees & Tickets */}
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                  <Ticket className="size-3.5" />
                  Event Attendees & Tickets
                </SelectLabel>
                {AUDIENCE_OPTIONS.filter((o) => o.category === "attendees_tickets").map((opt) => {
                  const Icon = CATEGORY_ICONS[opt.id];
                  return (
                    <SelectItem key={opt.id} value={opt.id} className="cursor-pointer py-2">
                      <div className="flex items-start gap-2.5 text-left">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm">{opt.label}</span>
                          <span className="text-muted-foreground text-xs">{opt.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>

              {/* Group 2: Attendance & Check-in */}
              <SelectGroup className="mt-2 border-t pt-2">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Attendance & Check-in
                </SelectLabel>
                {AUDIENCE_OPTIONS.filter((o) => o.category === "checkin").map((opt) => {
                  const Icon = CATEGORY_ICONS[opt.id];
                  return (
                    <SelectItem key={opt.id} value={opt.id} className="cursor-pointer py-2">
                      <div className="flex items-start gap-2.5 text-left">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm">{opt.label}</span>
                          <span className="text-muted-foreground text-xs">{opt.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>

              {/* Group 3: Chapter & Community */}
              <SelectGroup className="mt-2 border-t pt-2">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-indigo-600 text-xs dark:text-indigo-400">
                  <Users className="size-3.5" />
                  Chapter Community & Team
                </SelectLabel>
                {AUDIENCE_OPTIONS.filter((o) => o.category === "chapter_community").map((opt) => {
                  const Icon = CATEGORY_ICONS[opt.id];
                  return (
                    <SelectItem key={opt.id} value={opt.id} className="cursor-pointer py-2">
                      <div className="flex items-start gap-2.5 text-left">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm">{opt.label}</span>
                          <span className="text-muted-foreground text-xs">{opt.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Recipient Status & Preview Button */}
        {activeAudience && (
          <div className="flex shrink-0 items-center gap-2">
            {showResolvingState && (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
                <Loader2 className="size-3 animate-spin text-primary" />
                <span>Resolving recipients...</span>
              </Badge>
            )}
            {!showResolvingState && recipientCount !== null && (
              <>
                <Badge
                  variant={recipientCount > 0 ? "secondary" : "outline"}
                  className="gap-1 px-2.5 py-1 font-semibold text-xs"
                >
                  <Layers className="size-3 text-primary" />
                  <span>
                    {recipientCount.toLocaleString()} {recipientCount === 1 ? "Recipient" : "Recipients"}
                  </span>
                </Badge>
                {recipientCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Eye className="size-3" />
                    <span>Preview List</span>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Recipient Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Recipient Audience Preview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Showing a sample of verified recipients resolved for this campaign ({recipients.length} total).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-xs">
            {sampleRecipients.map((r) => (
              <div key={r.email} className="flex items-center justify-between rounded-md border bg-muted/30 p-2.5">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{r.name}</span>
                  <span className="text-muted-foreground">{r.email}</span>
                </div>
                {r.ticketType && (
                  <Badge variant="outline" className="text-[10px]">
                    {r.ticketType}
                  </Badge>
                )}
              </div>
            ))}
            {recipients.length > sampleRecipients.length && (
              <p className="pt-2 text-center text-muted-foreground text-xs italic">
                + {recipients.length - sampleRecipients.length} additional recipients queued
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

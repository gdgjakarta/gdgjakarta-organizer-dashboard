"use client";

import { useId, useMemo } from "react";

import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  HelpCircleIcon,
  MapPinIcon,
  RotateCcwIcon,
  SlidersHorizontal,
  TicketIcon,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FirestoreRegistration } from "@/lib/firestore/types";
import type { LabelTemplateData } from "@/lib/printers/types";

export interface ConfigurePrinterTemplateDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleData: LabelTemplateData;
  onSampleDataChange: (patch: Partial<LabelTemplateData>) => void;
  onResetSampleData?: () => void;
  registrations?: FirestoreRegistration[];
  customQuestions?: Array<{ id: string; label: string; placeholder?: string }>;
  eventTitle?: string;
  eventId?: string | number;
}

export function ConfigurePrinterTemplateDataDialog({
  open,
  onOpenChange,
  sampleData,
  onSampleDataChange,
  onResetSampleData,
  registrations = [],
  customQuestions = [],
  eventTitle,
  eventId,
}: ConfigurePrinterTemplateDataDialogProps) {
  const attendeePickerId = useId();

  // Find first attendee with a real ticket code or approved status
  const firstWithTicket = useMemo(() => {
    return (
      registrations.find(
        (r) =>
          Boolean(r.attendee_code || r.bevy_attendee_id) &&
          (r.status === "approved" ||
            r.status === "paid_and_registered" ||
            r.status === "attended" ||
            Boolean(r.is_checked_in)),
      ) ?? registrations.find((r) => Boolean(r.attendee_code || r.bevy_attendee_id))
    );
  }, [registrations]);

  const handleQuickSelectAttendee = (regId: string) => {
    if (!regId) return;
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) return;

    const chosenName =
      reg.member_name ||
      (reg.answers?.full_name as string) ||
      (reg.answers?.["Full Name"] as string) ||
      (reg.answers?.Name as string) ||
      "Attendee";
    const chosenEmail = reg.member_email || "";
    const resolvedTicketCode =
      reg.attendee_code ||
      (reg.answers?.ticket_code as string) ||
      (reg.answers?.ticketCode as string) ||
      (reg.answers?.attendee_code as string) ||
      (reg.bevy_attendee_id ? `#${reg.bevy_attendee_id}` : undefined);
    const resolvedAttendeeId = reg.bevy_attendee_id ? String(reg.bevy_attendee_id) : String(reg.id);

    // Resolve title / role
    const resolvedTitle =
      (reg.answers?.role_or_title as string) ||
      (reg.answers?.job_title as string) ||
      (reg.answers?.current_role as string) ||
      (reg.answers?.role as string) ||
      (reg.answers?.position as string) ||
      (reg.answers?.pekerjaan as string) ||
      (reg.answers?.jabatan as string) ||
      "Participant";

    // Resolve company / institution
    const resolvedCompany =
      (reg.answers?.company_or_institution as string) ||
      (reg.answers?.institution as string) ||
      (reg.answers?.company as string) ||
      (reg.answers?.organization as string) ||
      (reg.answers?.university as string) ||
      (reg.answers?.instansi as string) ||
      (reg.answers?.kampus as string) ||
      "GDG Community";

    const resolvedSessionTrack =
      (reg.answers?.session_title as string) ||
      (reg.answers?.Session as string) ||
      (reg.answers?.session as string) ||
      sampleData.sessionTrack ||
      "Full Session";

    const answersMap: Record<string, unknown> = {
      ...(sampleData.answers || {}),
      ...(reg.answers || {}),
    };

    onSampleDataChange({
      name: chosenName,
      email: chosenEmail,
      title: resolvedTitle,
      company: resolvedCompany,
      sessionTrack: resolvedSessionTrack,
      ticketCode: resolvedTicketCode || sampleData.ticketCode,
      attendeeCode: resolvedTicketCode || sampleData.attendeeCode,
      attendeeId: resolvedAttendeeId || sampleData.attendeeId,
      answers: answersMap,
      ...answersMap,
    });

    toast.success(`Populated template data from attendee: ${chosenName}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <SlidersHorizontal className="size-5 text-primary" />
                <span>Configure Template Data</span>
                <Badge variant="outline" className="font-normal text-xs bg-muted/50">
                  Thermal Badge Label
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Customize simulated variables and answered registration form questions. Changes are reflected
                immediately in the live badge preview and test prints.
              </DialogDescription>
            </div>
            {onResetSampleData && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onResetSampleData();
                  toast.info("Sample template data reset to default.");
                }}
                className="shrink-0 text-xs h-8 gap-1.5 font-medium"
              >
                <RotateCcwIcon className="size-3.5" />
                <span>Reset Default</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Picker from Event Registrants (Only rendered when event registrations exist) */}
          {registrations.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheckIcon className="size-4 text-primary" />
                  <Label htmlFor={attendeePickerId} className="text-sm font-semibold text-foreground">
                    Quick Pick from Event Registrants
                  </Label>
                </div>
                <Badge variant="secondary" className="text-[11px] h-5">
                  {registrations.length} registered
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Select an existing event registrant to automatically populate their name, email, role, company, ticket
                code, and answered form questions.
              </p>
              <div className="pt-1">
                <select
                  id={attendeePickerId}
                  defaultValue=""
                  onChange={(e) => handleQuickSelectAttendee(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" disabled>
                    Choose an existing attendee to populate fields...
                  </option>
                  {registrations.slice(0, 100).map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.member_name || "Attendee"} — {reg.member_email || "No email"}{" "}
                      {reg.attendee_code ? `(${reg.attendee_code})` : ""} [{reg.status}]
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Section 1: Attendee Information */}
          <div className="space-y-4 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <UserIcon className="size-4 text-emerald-500" />
                <h4 className="text-sm font-semibold text-foreground">Attendee &amp; Identity Variables</h4>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                [[Name]], [[title]], [[company]], [[ticketCode]], [[attendeeId]]
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Name ([[Name]])</Label>
                <Input
                  value={sampleData.name || ""}
                  onChange={(e) => onSampleDataChange({ name: e.target.value })}
                  placeholder="e.g. Fachridan Tio"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Attendee Email ([[Email]])</Label>
                <Input
                  type="email"
                  value={sampleData.email || ""}
                  onChange={(e) => onSampleDataChange({ email: e.target.value })}
                  placeholder="e.g. member@example.com"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Job Title / Role ([[title]])</Label>
                <Input
                  value={sampleData.title || ""}
                  onChange={(e) => onSampleDataChange({ title: e.target.value })}
                  placeholder="e.g. Software Engineer / Speaker"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company / Organization ([[company]])</Label>
                <Input
                  value={sampleData.company || ""}
                  onChange={(e) => onSampleDataChange({ company: e.target.value })}
                  placeholder="e.g. Google Developers Group"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ticket / Ref Code ([[ticketCode]], [[refCode]])</Label>
                <Input
                  value={sampleData.ticketCode || ""}
                  onChange={(e) =>
                    onSampleDataChange({
                      ticketCode: e.target.value,
                      attendeeCode: e.target.value,
                    })
                  }
                  placeholder="e.g. GOOGA263443955"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Attendee ID ([[attendeeId]])</Label>
                <Input
                  value={String(sampleData.attendeeId ?? "")}
                  onChange={(e) => onSampleDataChange({ attendeeId: e.target.value })}
                  placeholder="e.g. 263443955"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Session Track ([[sessionTrack]])</Label>
                <Input
                  value={sampleData.sessionTrack || ""}
                  onChange={(e) => onSampleDataChange({ sessionTrack: e.target.value })}
                  placeholder="e.g. Full Session / AI Track"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Check-in Time ([[checkinTime]])</Label>
                <Input
                  value={sampleData.checkinTime || ""}
                  onChange={(e) => onSampleDataChange({ checkinTime: e.target.value })}
                  placeholder="e.g. 09:15"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Answered Registration Form Questions (If questions are available) */}
          {customQuestions.length > 0 && (
            <div className="space-y-4 rounded-xl border bg-card/60 p-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <HelpCircleIcon className="size-4 text-amber-500" />
                  <h4 className="text-sm font-semibold text-foreground">Answered Registration Form Questions</h4>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {customQuestions.length} Questions
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {customQuestions.map((q) => {
                  const currentVal =
                    sampleData.answers?.[q.id] !== undefined
                      ? String(sampleData.answers[q.id] ?? "")
                      : String(sampleData[q.id] ?? "");
                  return (
                    <div key={q.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium truncate" title={q.label}>
                          {q.label}
                        </Label>
                        <code className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">
                          [[{q.id}]]
                        </code>
                      </div>
                      <Input
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          onSampleDataChange({
                            [q.id]: val,
                            answers: {
                              ...(sampleData.answers || {}),
                              [q.id]: val,
                            },
                          });
                        }}
                        placeholder={q.placeholder || `Sample answer for ${q.label}`}
                        className="h-8 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Event Variables */}
          <div className="space-y-4 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-sky-500" />
                <h4 className="text-sm font-semibold text-foreground">Event &amp; QR Parameters</h4>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                [[EventName]], [[eventId]], [[EventDate]], [[EventTime]], [[EventVenue]]
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Event Title ([[EventName]], [[eventTitle]])</Label>
                <Input
                  value={sampleData.eventTitle || ""}
                  onChange={(e) => onSampleDataChange({ eventTitle: e.target.value })}
                  placeholder={eventTitle || "DevFest Jakarta 2026"}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Event ID ([[eventId]])</Label>
                <Input
                  value={String(sampleData.eventId ?? "")}
                  onChange={(e) => onSampleDataChange({ eventId: e.target.value })}
                  placeholder={String(eventId || "132640")}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Event Date ([[EventDate]])</Label>
                <Input
                  value={sampleData.eventDate || ""}
                  onChange={(e) => onSampleDataChange({ eventDate: e.target.value })}
                  placeholder="Sunday, Nov 01, 2026"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Event Time ([[EventTime]])</Label>
                <Input
                  value={sampleData.eventTime || ""}
                  onChange={(e) => onSampleDataChange({ eventTime: e.target.value })}
                  placeholder="09:00 AM - 05:00 PM"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Venue Name ([[EventVenue]])</Label>
                <Input
                  value={sampleData.eventVenue || ""}
                  onChange={(e) => onSampleDataChange({ eventVenue: e.target.value })}
                  placeholder="Gedung Sasono Utomo TMII, Jakarta"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 sm:justify-between items-center gap-2">
          <div className="text-[11px] text-muted-foreground">
            Changes update the thermal badge live preview in real time.
          </div>
          <Button type="button" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

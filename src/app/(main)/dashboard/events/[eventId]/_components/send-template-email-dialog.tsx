"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { CheckCircle2, Loader2, Mail, Send, User, UserX, XCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveSessionInfo } from "@/lib/events/approved-attendee-webhook";
import {
  EMAIL_TEMPLATES_CONFIG,
  type EmailTemplateKey,
  interpolateTemplateHtml,
  interpolateTemplateSubject,
  splitFullName,
  type TemplateSimulatedData,
} from "@/lib/events/email-templates";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { sendTemplateEmailRequestAction } from "@/server/email-template-actions";

interface SendTemplateEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: FirestoreEvent;
  activeKey: EmailTemplateKey;
  templates: Record<EmailTemplateKey, string>;
  simulatedData: TemplateSimulatedData;
  templatesData?: Record<EmailTemplateKey, TemplateSimulatedData>;
  registrations: FirestoreRegistration[];
}

export function SendTemplateEmailDialog({
  open,
  onOpenChange,
  event,
  activeKey: initialActiveKey,
  templates,
  simulatedData,
  templatesData,
  registrations,
}: SendTemplateEmailDialogProps) {
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>(initialActiveKey);
  const [selectedRegId, setSelectedRegId] = useState<string>("custom");
  const [firstName, setFirstName] = useState("Jane");
  const [lastName, setLastName] = useState("Doe");
  const [recipientEmail, setRecipientEmail] = useState("jane.doe@example.com");
  const [customSubject, setCustomSubject] = useState("");
  const [isSending, startTransition] = useTransition();

  // Keep selected key synchronized when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedKey(initialActiveKey);
      if (registrations.length > 0 && selectedRegId === "custom") {
        const first = registrations[0];
        if (first) {
          const { firstName: fName, lastName: lName } = splitFullName(first.member_name || "");
          setFirstName(fName);
          setLastName(lName);
          setRecipientEmail(first.member_email || "");
          setSelectedRegId(first.id);
        }
      }
    }
  }, [open, initialActiveKey, registrations, selectedRegId]);

  // Handle registrant selection from dropdown
  const handleSelectRegistrant = (regId: string) => {
    setSelectedRegId(regId);
    if (regId === "custom") {
      setFirstName("Jane");
      setLastName("Doe");
      setRecipientEmail("jane.doe@example.com");
      return;
    }
    const found = registrations.find((r) => r.id === regId);
    if (found) {
      const { firstName: fName, lastName: lName } = splitFullName(found.member_name || "");
      setFirstName(fName);
      setLastName(lName);
      setRecipientEmail(found.member_email || "");
    }
  };

  const activeMeta = useMemo(() => {
    return EMAIL_TEMPLATES_CONFIG.find((cfg) => cfg.key === selectedKey) ?? EMAIL_TEMPLATES_CONFIG[0];
  }, [selectedKey]);

  // Active base template data (per template key)
  const activeBaseData = useMemo(() => {
    return templatesData?.[selectedKey] ?? simulatedData;
  }, [templatesData, selectedKey, simulatedData]);

  // Build target simulated data for this specific recipient
  const targetData = useMemo<TemplateSimulatedData>(() => {
    const fullName = `${firstName} ${lastName}`.trim() || "Jane Doe";
    return {
      ...activeBaseData,
      attendee: {
        name: fullName,
        email: recipientEmail,
      },
      event: {
        ...activeBaseData.event,
        eventName: activeBaseData.event.eventName || event.title,
      },
    };
  }, [activeBaseData, firstName, lastName, recipientEmail, event.title]);

  // Compute subject and body
  const rawHtml = templates[selectedKey] ?? "";
  const defaultSubject = activeMeta?.subjectDefault ?? "GDG Jakarta Event Update";

  const computedSubject = useMemo(() => {
    if (customSubject.trim()) {
      return customSubject;
    }
    return interpolateTemplateSubject(defaultSubject, targetData);
  }, [customSubject, defaultSubject, targetData]);

  const computedBody = useMemo(() => {
    return interpolateTemplateHtml(rawHtml, targetData);
  }, [rawHtml, targetData]);

  const handleSendRequest = () => {
    if (!recipientEmail?.includes("@")) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }

    startTransition(async () => {
      try {
        const fullName = `${firstName} ${lastName}`.trim() || "Jane Doe";
        const activeReg = registrations.find((r) => r.id === selectedRegId);
        const { sessionName, sessionCapacity } = resolveSessionInfo(
          activeReg ?? {
            member_name: fullName,
            member_email: recipientEmail,
            event_id: String(event.id),
            event_title: event.title,
          },
          event,
        );

        const chapterId = String(
          (event as { chapter?: { id?: string | number }; chapter_id?: string | number }).chapter?.id ??
            (event as { chapter_id?: string | number }).chapter_id ??
            process.env.BEVY_CHAPTER_ID ??
            "642",
        );

        const res = await sendTemplateEmailRequestAction({
          eventId: String(event.id),
          recipientEmail,
          recipientName: fullName,
          subjectEmail: computedSubject,
          bodyEmail: computedBody,
          templateKey: selectedKey,
          eventName: simulatedData.event.eventName || event.title,
          headerEmailUrl: simulatedData.event.headerEmailUrl,
          actionButtonUrl: simulatedData.event.eventCtaUrl,
          bevyEventId: String(event.id),
          bevyChapterId: chapterId,
          sessionName,
          sessionCapacity,
        });

        if (res.success) {
          toast.success(res.message ?? "Email request dispatched successfully!");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to dispatch email request.");
        }
      } catch (err) {
        console.error("[SendTemplateEmailDialog] Exception:", err);
        toast.error("An unexpected error occurred while sending email.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Send Email via Request</DialogTitle>
              <DialogDescription className="text-xs">
                Dispatches pre-constructed <code className="text-primary">subjectEmail</code> and{" "}
                <code className="text-primary">bodyEmail</code> via API webhook request.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template Selector Tabs */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Template to Send
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
              {EMAIL_TEMPLATES_CONFIG.map((cfg) => {
                const isSelected = selectedKey === cfg.key;
                return (
                  <button
                    type="button"
                    key={cfg.key}
                    onClick={() => {
                      setSelectedKey(cfg.key);
                      setCustomSubject("");
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    }`}
                  >
                    {cfg.key === "interest" && <Mail className="size-3 text-blue-500" />}
                    {cfg.key === "accepted" && <CheckCircle2 className="size-3 text-emerald-500" />}
                    {cfg.key.startsWith("cancelled") && <UserX className="size-3 text-red-500" />}
                    {cfg.key.startsWith("rejected") && <XCircle className="size-3 text-red-500" />}
                    <span>{cfg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Endpoint Specification Badge */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
                <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
                  POST
                </Badge>
                {selectedKey === "interest" || selectedKey.startsWith("cancelled") || selectedKey.startsWith("rejected")
                  ? "https://n8n.gdgjakarta.com/webhook/api/send-email"
                  : "https://n8n.gdgjakarta.com/webhook/api/add-bevy-attendee"}
              </div>
              <Badge variant="secondary" className="text-[10px]">
                X-API-Key Authorized
              </Badge>
            </div>
          </div>

          {/* Recipient Attendee Section */}
          <div className="space-y-3 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <User className="size-3.5 text-primary" /> Recipient Attendee Data
              </div>
              {registrations.length > 0 && (
                <span className="text-[11px] text-muted-foreground">{registrations.length} registrants loaded</span>
              )}
            </div>

            {/* Quick Picker from Registrants */}
            {registrations.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Quick Pick Registrant</Label>
                <Select value={selectedRegId} onValueChange={handleSelectRegistrant}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose a registrant or enter custom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom" className="text-xs">
                      ✍️ Custom Attendee (Jane Doe)
                    </SelectItem>
                    {registrations.slice(0, 50).map((reg) => (
                      <SelectItem key={reg.id} value={reg.id} className="text-xs">
                        {reg.member_name} ({reg.member_email || "no email"}) — {reg.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* First Name & Last Name & Email Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px]">First Name (first_name)</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Last Name (last_name)</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">Recipient Email (email)</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Constructed Subject & Payload Preview */}
          <div className="space-y-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-xs">Constructed Subject (subjectEmail)</Label>
              <button
                type="button"
                onClick={() => setCustomSubject("")}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            </div>
            <Input
              value={customSubject || computedSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Email Subject"
              className="h-8 text-xs font-medium"
            />
          </div>

          {/* Body Preview Accordion / Tabs */}
          <Tabs defaultValue="preview" className="w-full">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-xs">Constructed Body (bodyEmail HTML)</Label>
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="preview" className="h-6 px-2 text-[11px]">
                  Visual Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="h-6 px-2 text-[11px]">
                  HTML Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="mt-2">
              <div className="h-44 w-full overflow-hidden rounded-md border bg-white shadow-inner">
                <iframe
                  srcDoc={computedBody}
                  className="h-full w-full border-0 bg-white"
                  title="Body Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-2">
              <textarea
                readOnly
                value={computedBody}
                rows={7}
                className="w-full rounded-md border bg-muted/40 p-2 font-mono text-[11px] text-foreground leading-tight outline-hidden focus:ring-1 focus:ring-primary"
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSendRequest} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Dispatching Request...
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                Send Request via Webhook
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

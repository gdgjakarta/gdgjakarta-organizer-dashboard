"use client";

import { useId, useState } from "react";

import Image from "next/image";

import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  ImageIcon,
  ListChecksIcon,
  MapPinIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
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
import {
  DEFAULT_CHECKLIST_ITEMS_BY_TYPE,
  EMAIL_TEMPLATES_CONFIG,
  type EmailTemplateKey,
  getDefaultTemplateDataForType,
  type TemplateSimulatedData,
} from "@/lib/events/email-templates";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

interface ConfigureTemplateDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
  activeTemplateKey: EmailTemplateKey;
  templatesData: Record<EmailTemplateKey, TemplateSimulatedData>;
  onChangeData: (key: EmailTemplateKey, data: TemplateSimulatedData) => void;
}

export function ConfigureTemplateDataDialog({
  open,
  onOpenChange,
  event,
  registrations,
  activeTemplateKey,
  templatesData,
  onChangeData,
}: ConfigureTemplateDataDialogProps) {
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>(activeTemplateKey);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const attendeePickerId = useId();
  const attendeeNameId = useId();
  const attendeeEmailId = useId();
  const eventNameId = useId();
  const headerUrlId = useId();
  const ctaUrlId = useId();
  const eventDateId = useId();
  const sessionTimeId = useId();
  const checkinDeadlineId = useId();
  const venueLocationId = useId();
  const venueUrlId = useId();
  const attendeeCodeId = useId();
  const checklistInputId = useId();

  // If dialog opens and selectedKey differs, sync once or keep user on active key
  const currentKey = selectedKey ?? activeTemplateKey;
  const currentData = templatesData[currentKey] ?? getDefaultTemplateDataForType(currentKey, event);
  const currentMeta = EMAIL_TEMPLATES_CONFIG.find((c) => c.key === currentKey) ?? EMAIL_TEMPLATES_CONFIG[0];

  const handleUpdate = (updater: (prev: TemplateSimulatedData) => TemplateSimulatedData) => {
    const next = updater(currentData);
    onChangeData(currentKey, next);
  };

  const handleQuickSelectAttendee = (regId: string) => {
    if (!regId) return;
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) return;

    const chosenName = reg.member_name || "Attendee";
    const chosenEmail = reg.member_email || "";

    handleUpdate((prev) => ({
      ...prev,
      attendee: {
        name: chosenName,
        email: chosenEmail,
      },
    }));
    toast.success(`Selected attendee: ${chosenName}`);
  };

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistItem.trim();
    if (!trimmed) return;

    handleUpdate((prev) => ({
      ...prev,
      event: {
        ...prev.event,
        eventChecklistItems: [...prev.event.eventChecklistItems, trimmed],
      },
    }));
    setNewChecklistItem("");
    toast.success("Checklist item added");
  };

  const handleRemoveChecklistItem = (index: number) => {
    handleUpdate((prev) => ({
      ...prev,
      event: {
        ...prev.event,
        eventChecklistItems: prev.event.eventChecklistItems.filter((_, i) => i !== index),
      },
    }));
  };

  const handleResetChecklistDefaults = () => {
    const defaultItems = DEFAULT_CHECKLIST_ITEMS_BY_TYPE[currentKey] ?? [];
    handleUpdate((prev) => ({
      ...prev,
      event: {
        ...prev.event,
        eventChecklistItems: [...defaultItems],
      },
    }));
    toast.info(`Reset checklist items to defaults for ${currentMeta.name}`);
  };

  const handleResetTemplateDefaults = () => {
    const defaultData = getDefaultTemplateDataForType(currentKey, event);
    onChangeData(currentKey, defaultData);
    toast.info(`Reset all data for ${currentMeta.name} to event defaults`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <span>Configure Template Data</span>
                <Badge variant="outline" className="font-normal text-xs bg-muted/50">
                  {currentMeta.badge}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Customize simulated variables and checklist items for each email template. Changes are reflected
                immediately in the live preview.
              </DialogDescription>
            </div>
          </div>

          {/* Template Segmented Switcher */}
          <div className="flex flex-wrap gap-1.5 mt-4 pt-1 border-t">
            {EMAIL_TEMPLATES_CONFIG.map((cfg) => {
              const isSelected = cfg.key === currentKey;
              return (
                <button
                  key={cfg.key}
                  type="button"
                  onClick={() => setSelectedKey(cfg.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Attendee Data */}
          <div className="space-y-4 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Attendee Data (Recipient)</h4>
              </div>
              <span className="text-[11px] text-muted-foreground">Injected into recipient name & email variables</span>
            </div>

            {/* Quick Picker from Event Registrants */}
            {registrations.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor={attendeePickerId} className="text-xs text-muted-foreground">
                  Quick Pick from Event Registrants ({registrations.length} registered):
                </Label>
                <select
                  id={attendeePickerId}
                  value=""
                  onChange={(e) => handleQuickSelectAttendee(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" disabled>
                    Choose an existing attendee to populate fields...
                  </option>
                  {registrations.slice(0, 50).map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.member_name || "Attendee"} — {reg.member_email || "No email"} ({reg.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={attendeeNameId} className="text-xs font-medium">
                  Attendee Full Name
                </Label>
                <Input
                  id={attendeeNameId}
                  value={currentData.attendee.name}
                  onChange={(e) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      attendee: { ...prev.attendee, name: e.target.value },
                    }))
                  }
                  placeholder="e.g. Alex Pratama"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={attendeeEmailId} className="text-xs font-medium">
                  Attendee Email
                </Label>
                <Input
                  id={attendeeEmailId}
                  type="email"
                  value={currentData.attendee.email}
                  onChange={(e) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      attendee: { ...prev.attendee, email: e.target.value },
                    }))
                  }
                  placeholder="e.g. alex.pratama@example.com"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Event Data */}
          <div className="space-y-4 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Event Data & URLs</h4>
              </div>
              <span className="text-[11px] text-muted-foreground">Injected into event parameter nodes</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={eventNameId} className="text-xs font-medium">
                  Event Name ({"{{ eventName }}"})
                </Label>
                <Input
                  id={eventNameId}
                  value={currentData.event.eventName}
                  onChange={(e) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      event: { ...prev.event, eventName: e.target.value },
                    }))
                  }
                  placeholder="e.g. Cloud Community Day Jakarta 2026"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={headerUrlId} className="text-xs font-medium">
                    Header Banner Image URL ({"{{ headerEmailUrl }}"})
                  </Label>
                  {currentData.event.headerEmailUrl && (
                    <a
                      href={currentData.event.headerEmailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open image</span>
                      <ExternalLinkIcon className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <Input
                  id={headerUrlId}
                  value={currentData.event.headerEmailUrl}
                  onChange={(e) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      event: { ...prev.event, headerEmailUrl: e.target.value },
                    }))
                  }
                  placeholder="https://assets.gdgjakarta.org/gdg-jakarta/..."
                  className="h-8 text-xs"
                />
                {currentData.event.headerEmailUrl && (
                  <div className="mt-1.5 relative w-full h-16 rounded-md overflow-hidden border bg-muted/30">
                    <Image
                      src={currentData.event.headerEmailUrl}
                      alt="Email Header Preview"
                      fill
                      sizes="100vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={ctaUrlId} className="text-xs font-medium">
                  CTA / Action Button URL ({"{{ eventCtaUrl }}"})
                </Label>
                <Input
                  id={ctaUrlId}
                  value={currentData.event.eventCtaUrl}
                  onChange={(e) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      event: { ...prev.event, eventCtaUrl: e.target.value },
                    }))
                  }
                  placeholder="https://gdg.community.dev/..."
                  className="h-8 text-xs"
                />
              </div>

              {/* Specific Accepted Pass Parameters */}
              {currentKey === "accepted" && (
                <div className="mt-4 pt-3 border-t space-y-3">
                  <span className="text-xs font-semibold text-primary block">Ticket Confirmation Pass Details:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={eventDateId} className="text-xs font-medium flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        <span>Event Date String</span>
                      </Label>
                      <Input
                        id={eventDateId}
                        value={currentData.eventDate ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            eventDate: e.target.value,
                          }))
                        }
                        placeholder="Saturday, 25 October 2026"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={sessionTimeId} className="text-xs font-medium flex items-center gap-1">
                        <ClockIcon className="h-3 w-3 text-muted-foreground" />
                        <span>Session Time</span>
                      </Label>
                      <Input
                        id={sessionTimeId}
                        value={currentData.sessionTime ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            sessionTime: e.target.value,
                          }))
                        }
                        placeholder="13:00 - 17:00 WIB"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={checkinDeadlineId} className="text-xs font-medium">
                        Check-in Deadline
                      </Label>
                      <Input
                        id={checkinDeadlineId}
                        value={currentData.checkinDeadline ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            checkinDeadline: e.target.value,
                          }))
                        }
                        placeholder="13:30 WIB"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={attendeeCodeId} className="text-xs font-medium">
                        Attendee Ref Code
                      </Label>
                      <Input
                        id={attendeeCodeId}
                        value={currentData.attendeeCode ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            attendeeCode: e.target.value,
                          }))
                        }
                        placeholder="GDG-JKT-89241"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={venueLocationId} className="text-xs font-medium flex items-center gap-1">
                        <MapPinIcon className="h-3 w-3 text-muted-foreground" />
                        <span>Venue Name & Address</span>
                      </Label>
                      <Input
                        id={venueLocationId}
                        value={currentData.venueLocation ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            venueLocation: e.target.value,
                          }))
                        }
                        placeholder="Google Indonesia, Pacific Century Place Level 45, SCBD"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={venueUrlId} className="text-xs font-medium">
                        Venue Google Maps URL
                      </Label>
                      <Input
                        id={venueUrlId}
                        value={currentData.venueLocationUrl ?? ""}
                        onChange={(e) =>
                          handleUpdate((prev) => ({
                            ...prev,
                            venueLocationUrl: e.target.value,
                          }))
                        }
                        placeholder="https://www.google.com/maps/..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Checklist Items */}
          <div className="space-y-4 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <ListChecksIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">
                  Checklist Items ({currentData.event.eventChecklistItems.length})
                </h4>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetChecklistDefaults}
                className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
              >
                <RotateCcwIcon className="h-3 w-3" />
                <span>Reset to Defaults</span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              These items are formatted into HTML with icons and titles, then injected into{" "}
              <code className="text-primary text-[11px] bg-muted px-1 py-0.5 rounded">
                {"{{ $('event-params').item.json.eventCheclistItems }}"}
              </code>
              . Use format: <span className="font-semibold text-foreground">Title: Description</span> for prominent bold
              styling.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {currentData.event.eventChecklistItems.map((item, idx) => (
                <div
                  key={`${item.slice(0, 20)}-${idx}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border bg-background/80 text-xs text-foreground group transition-colors hover:border-primary/40"
                >
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-[11.5px] leading-relaxed break-words whitespace-pre-wrap">{item}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveChecklistItem(idx)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 opacity-80 group-hover:opacity-100"
                    title="Delete item"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {currentData.event.eventChecklistItems.length === 0 && (
                <div className="p-4 text-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  No checklist items configured for this template. Click &quot;Reset to Defaults&quot; or add one below.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                id={checklistInputId}
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                placeholder="Title: Item description (e.g. ID Verification: Bring your physical ID card)..."
                className="h-8 text-xs flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddChecklistItem}
                className="h-8 text-xs gap-1 font-medium"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetTemplateDefaults}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcwIcon className="h-3 w-3" />
            <span>Reset {currentMeta.name} to Defaults</span>
          </Button>

          <Button type="button" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs px-4">
            <CheckCircle2Icon className="h-3.5 w-3.5 mr-1" />
            <span>Done</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

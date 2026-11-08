"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CalendarIcon, Loader2, LocateFixed, MapPin, Pencil, PlusCircle, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { EventTagsInput } from "@/app/(main)/dashboard/events/_components/event-tags-input";
import { DatePicker } from "@/components/date-picker";
import { GoogleMapsPinpointDialog } from "@/components/maps/google-maps-pinpoint-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import type { FirestoreEvent } from "@/lib/firestore/types";
import {
  generateBevyAiEventAction,
  modifyBevyAiEventContentAction,
  updateBevyEventAction,
} from "@/server/bevy-actions";

interface EditEventDialogProps {
  event: FirestoreEvent;
  onEventUpdated?: (updatedEvent: FirestoreEvent) => void;
}

// Helper to format ISO date to datetime-local input value
function toLocalInputValue(isoStr?: string | null) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function EditEventDialog({ event, onEventUpdated }: EditEventDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = React.useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = React.useState(false);
  const router = useRouter();

  // Form states initialized from event
  const [title, setTitle] = React.useState(event.title || "");
  const [description, setDescription] = React.useState(event.description || "");
  const [startDate, setStartDate] = React.useState(toLocalInputValue(event.start_date));
  const [endDate, setEndDate] = React.useState(toLocalInputValue(event.end_date));
  const [audienceType, setAudienceType] = React.useState<"IN_PERSON" | "VIRTUAL" | "HYBRID">(
    (event.audience_type as "IN_PERSON" | "VIRTUAL" | "HYBRID") || "IN_PERSON",
  );
  const [totalCapacity, setTotalCapacity] = React.useState(String(event.total_capacity ?? 50));
  const [isTest, setIsTest] = React.useState(Boolean(event.is_test));
  const [isHidden, setIsHidden] = React.useState(Boolean(event.is_hidden));
  const [visibleOnParentChapterOnly, setVisibleOnParentChapterOnly] = React.useState(
    Boolean(event.visible_on_parent_chapter_only),
  );
  const [sharingDisabled, setSharingDisabled] = React.useState(Boolean(event.sharing_disabled));
  const [allowAutomatedEmailsWhenHidden, setAllowAutomatedEmailsWhenHidden] = React.useState(
    Boolean(event.allow_automated_emails_when_hidden),
  );
  const [status, setStatus] = React.useState<"Draft" | "Published">((event.status as "Draft" | "Published") || "Draft");

  // Tags
  const [tags, setTags] = React.useState<string[]>(event.tags || []);

  // Venue states
  const [venueName, setVenueName] = React.useState(event.venue?.name || "");
  const [venueAddress, setVenueAddress] = React.useState(event.venue?.address || "");
  const [venueCity, setVenueCity] = React.useState(event.venue?.city || "");
  const [venueState, setVenueState] = React.useState(event.venue?.state || "");
  const [venueZipCode, setVenueZipCode] = React.useState(event.venue?.zip_code || "");
  const [venueLatitude, setVenueLatitude] = React.useState<number | undefined>(
    typeof event.venue?.latitude === "number" ? event.venue.latitude : undefined,
  );
  const [venueLongitude, setVenueLongitude] = React.useState<number | undefined>(
    typeof event.venue?.longitude === "number" ? event.venue.longitude : undefined,
  );
  const [isPinpointOpen, setIsPinpointOpen] = React.useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = React.useState(false);

  // Virtual platform states
  const [virtualEventType, setVirtualEventType] = React.useState<"internal" | "external">(
    event.virtual_event_type === "external" ? "external" : "internal",
  );
  const [virtualVenueLink, setVirtualVenueLink] = React.useState(event.attendee_virtual_venue_link || "");
  const [virtualInstructions, setVirtualInstructions] = React.useState(event.virtual_event_instructions || "");
  const [showInstructions, setShowInstructions] = React.useState(Boolean(event.virtual_event_instructions));
  const [autoRecord, setAutoRecord] = React.useState(event.automatically_record_event ?? true);
  const [privateQa, setPrivateQa] = React.useState(event.moderated_qa_enabled ?? false);
  const [disableChat, setDisableChat] = React.useState(event.chat_disabled ?? false);
  const [interactiveMode, setInteractiveMode] = React.useState(event.is_many_to_many_virtual_event ?? false);
  const [updateMeetupEvent, setUpdateMeetupEvent] = React.useState(false);

  // Sync state whenever event prop changes
  const resetFormToEvent = React.useCallback(() => {
    setTitle(event.title || "");
    setDescription(event.description || "");
    setStartDate(toLocalInputValue(event.start_date));
    setEndDate(toLocalInputValue(event.end_date));
    setAudienceType((event.audience_type as "IN_PERSON" | "VIRTUAL" | "HYBRID") || "IN_PERSON");
    setTotalCapacity(String(event.total_capacity ?? 50));
    setIsTest(Boolean(event.is_test));
    setIsHidden(Boolean(event.is_hidden));
    setVisibleOnParentChapterOnly(Boolean(event.visible_on_parent_chapter_only));
    setSharingDisabled(Boolean(event.sharing_disabled));
    setAllowAutomatedEmailsWhenHidden(Boolean(event.allow_automated_emails_when_hidden));
    setStatus((event.status as "Draft" | "Published") || "Draft");
    setTags(event.tags || []);
    setVenueName(event.venue?.name || "");
    setVenueAddress(event.venue?.address || "");
    setVenueCity(event.venue?.city || "");
    setVenueState(event.venue?.state || "");
    setVenueZipCode(event.venue?.zip_code || "");
    setVenueLatitude(typeof event.venue?.latitude === "number" ? event.venue.latitude : undefined);
    setVenueLongitude(typeof event.venue?.longitude === "number" ? event.venue.longitude : undefined);
    setVirtualEventType(event.virtual_event_type === "external" ? "external" : "internal");
    setVirtualVenueLink(event.attendee_virtual_venue_link || "");
    setVirtualInstructions(event.virtual_event_instructions || "");
    setShowInstructions(Boolean(event.virtual_event_instructions));
    setAutoRecord(event.automatically_record_event ?? true);
    setPrivateQa(event.moderated_qa_enabled ?? false);
    setDisableChat(event.chat_disabled ?? false);
    setInteractiveMode(event.is_many_to_many_virtual_event ?? false);
    setUpdateMeetupEvent(false);
  }, [event]);

  React.useEffect(() => {
    if (open) {
      resetFormToEvent();
    }
  }, [open, resetFormToEvent]);

  // Compute dirty (changed) state
  const isDirty = React.useMemo(() => {
    const initialStartDate = toLocalInputValue(event.start_date);
    const initialEndDate = toLocalInputValue(event.end_date);
    const initialAudience = (event.audience_type as "IN_PERSON" | "VIRTUAL" | "HYBRID") || "IN_PERSON";
    const initialCapacity = String(event.total_capacity ?? 50);
    const initialStatus = (event.status as "Draft" | "Published") || "Draft";
    const initialTags = (event.tags || []).slice().sort().join(",");
    const currentTags = (tags || []).slice().sort().join(",");

    return (
      title !== (event.title || "") ||
      description !== (event.description || "") ||
      startDate !== initialStartDate ||
      endDate !== initialEndDate ||
      audienceType !== initialAudience ||
      totalCapacity !== initialCapacity ||
      isTest !== Boolean(event.is_test) ||
      isHidden !== Boolean(event.is_hidden) ||
      visibleOnParentChapterOnly !== Boolean(event.visible_on_parent_chapter_only) ||
      sharingDisabled !== Boolean(event.sharing_disabled) ||
      allowAutomatedEmailsWhenHidden !== Boolean(event.allow_automated_emails_when_hidden) ||
      status !== initialStatus ||
      currentTags !== initialTags ||
      venueName !== (event.venue?.name || "") ||
      venueAddress !== (event.venue?.address || "") ||
      venueCity !== (event.venue?.city || "") ||
      venueState !== (event.venue?.state || "") ||
      venueZipCode !== (event.venue?.zip_code || "") ||
      venueLatitude !== (typeof event.venue?.latitude === "number" ? event.venue.latitude : undefined) ||
      venueLongitude !== (typeof event.venue?.longitude === "number" ? event.venue.longitude : undefined) ||
      virtualEventType !== (event.virtual_event_type === "external" ? "external" : "internal") ||
      virtualVenueLink !== (event.attendee_virtual_venue_link || "") ||
      virtualInstructions !== (event.virtual_event_instructions || "") ||
      autoRecord !== (event.automatically_record_event ?? true) ||
      privateQa !== (event.moderated_qa_enabled ?? false) ||
      disableChat !== (event.chat_disabled ?? false) ||
      interactiveMode !== (event.is_many_to_many_virtual_event ?? false) ||
      updateMeetupEvent !== false
    );
  }, [
    event,
    title,
    description,
    startDate,
    endDate,
    audienceType,
    totalCapacity,
    isTest,
    isHidden,
    visibleOnParentChapterOnly,
    sharingDisabled,
    allowAutomatedEmailsWhenHidden,
    status,
    tags,
    venueName,
    venueAddress,
    venueCity,
    venueState,
    venueZipCode,
    venueLatitude,
    venueLongitude,
    virtualEventType,
    virtualVenueLink,
    virtualInstructions,
    autoRecord,
    privateQa,
    disableChat,
    interactiveMode,
    updateMeetupEvent,
  ]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setShowUnsavedPrompt(true);
      return;
    }
    setOpen(nextOpen);
  };

  const handleDiscardChanges = () => {
    setShowUnsavedPrompt(false);
    resetFormToEvent();
    setOpen(false);
  };

  const handleAiGenerate = async () => {
    const topicPrompt =
      title.trim() ||
      prompt("Enter event topic to generate title and description (e.g. GDG Jakarta Meetup: AI & Cloud):");
    if (!topicPrompt) return;

    try {
      setIsGeneratingAi(true);
      const toastId = toast.loading(`Generating details with Bevy AI for "${topicPrompt}"...`);
      const res = await generateBevyAiEventAction(topicPrompt);

      if (res.success && res.data) {
        if (res.data.title) setTitle(res.data.title);
        if (res.data.description) setDescription(res.data.description);
        toast.success("AI generated title and description successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to generate event details with AI", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating AI content");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleRegenerateTitle = async () => {
    if (!title.trim() && !description.trim()) {
      toast.error("Please enter an existing title or description to regenerate the title.");
      return;
    }

    try {
      setIsRegeneratingTitle(true);
      const toastId = toast.loading("Regenerating title with Bevy AI...");
      const res = await modifyBevyAiEventContentAction({
        field: "title",
        change: "regenerate",
        title: title.trim() || "GDG Jakarta Meetup",
        description: description.trim() || `Event about ${title}`,
        objectId: event.id,
      });

      const rawContent =
        res.data?.title || res.data?.result || res.data?.modified_content || res.data?.text || res.data?.description;
      if (res.success && rawContent) {
        const cleanTitle = rawContent.replace(/<[^>]*>/g, "").trim();
        setTitle(cleanTitle || rawContent);
        toast.success("Title regenerated successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to regenerate title", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error regenerating title");
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!title.trim() && !description.trim()) {
      toast.error("Please enter a title or description first before regenerating.");
      return;
    }

    try {
      setIsRegeneratingDesc(true);
      const toastId = toast.loading("Regenerating description with Bevy AI...");
      const res = await modifyBevyAiEventContentAction({
        field: "description",
        change: "regenerate",
        title: title.trim(),
        description: description.trim() || `Event about ${title}`,
        objectId: event.id,
      });

      const rawContent =
        res.data?.description || res.data?.result || res.data?.modified_content || res.data?.text || res.data?.title;
      if (res.success && rawContent) {
        // Strip wrapper HTML tags like <p>...</p> to plain text for the textarea
        const cleanContent = rawContent
          .replace(/<\/p><p>/gi, "\n\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .trim();
        setDescription(cleanContent || rawContent);
        toast.success("Description regenerated successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to regenerate description", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error regenerating description");
    } finally {
      setIsRegeneratingDesc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please specify both start and end dates");
      return;
    }

    if (audienceType === "HYBRID" || audienceType === "IN_PERSON") {
      if (!venueName.trim() || !venueAddress.trim() || !venueZipCode.trim()) {
        toast.error("Please enter Venue Name, Street Address, and Postal Code");
        return;
      }
    }

    if (
      (audienceType === "HYBRID" || audienceType === "VIRTUAL") &&
      virtualEventType === "external" &&
      !virtualVenueLink.trim()
    ) {
      toast.error("Please provide the External Virtual Venue URL");
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading("Saving and syncing event to Bevy...");

      const formatIsoWithTimezone = (dateTimeStr: string) => {
        if (!dateTimeStr) return "";
        if (dateTimeStr.includes("+") || dateTimeStr.endsWith("Z")) return dateTimeStr;
        return `${dateTimeStr}:00.000+07:00`;
      };

      const formattedStartDate = formatIsoWithTimezone(startDate);
      const formattedEndDate = formatIsoWithTimezone(endDate);

      const targetTicketsUrl = event.custom_tickets_url || `https://gdgjakarta.com/events/${String(event.id).trim()}`;

      const res = await updateBevyEventAction(event.id, {
        title: title.trim(),
        description: description.trim(),
        description_short: description ? description.slice(0, 200) : null,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        timezone: "Asia/Jakarta",
        audience_type: audienceType,
        total_capacity: totalCapacity || "50",
        is_test: isTest,
        is_hidden: isHidden,
        visible_on_parent_chapter_only: isHidden ? visibleOnParentChapterOnly : false,
        sharing_disabled: isHidden ? sharingDisabled : false,
        allow_automated_emails_when_hidden: isHidden ? allowAutomatedEmailsWhenHidden : false,
        status,
        tags,
        custom_tickets_url: targetTicketsUrl,
        meetup_announce: updateMeetupEvent,
        venue_name: audienceType !== "VIRTUAL" ? venueName : "",
        venue_address: audienceType !== "VIRTUAL" ? venueAddress : "",
        venue_city: audienceType !== "VIRTUAL" ? venueCity : "",
        venue_state: audienceType !== "VIRTUAL" ? venueState : "",
        venue_zip_code: audienceType !== "VIRTUAL" ? venueZipCode : "",
        venue_latitude: audienceType !== "VIRTUAL" ? venueLatitude : undefined,
        venue_longitude: audienceType !== "VIRTUAL" ? venueLongitude : undefined,
        virtual_event_type: audienceType !== "IN_PERSON" ? virtualEventType : undefined,
        virtual_venue_link:
          audienceType !== "IN_PERSON" && virtualEventType === "external" ? virtualVenueLink : undefined,
        virtual_event_instructions: audienceType !== "IN_PERSON" ? virtualInstructions : undefined,
        automatically_record_event: audienceType !== "IN_PERSON" ? autoRecord : undefined,
        moderated_qa_enabled: audienceType !== "IN_PERSON" ? privateQa : undefined,
        chat_disabled: audienceType !== "IN_PERSON" ? disableChat : undefined,
        is_many_to_many_virtual_event: audienceType !== "IN_PERSON" ? interactiveMode : undefined,
      });

      if (res.success) {
        toast.success("Event updated and synced to Bevy successfully!", { id: toastId });

        // Optimistically notify parent components with the freshly saved event data
        if (onEventUpdated) {
          onEventUpdated({
            ...event,
            title: title.trim(),
            description: description.trim(),
            description_short: description ? description.slice(0, 200) : undefined,
            start_date: formattedStartDate,
            end_date: formattedEndDate,
            audience_type: audienceType,
            total_capacity: totalCapacity ? Number(totalCapacity) : event.total_capacity,
            is_test: isTest,
            is_hidden: isHidden,
            visible_on_parent_chapter_only: isHidden ? visibleOnParentChapterOnly : false,
            sharing_disabled: isHidden ? sharingDisabled : false,
            allow_automated_emails_when_hidden: isHidden ? allowAutomatedEmailsWhenHidden : false,
            status,
            tags,
            venue:
              audienceType !== "VIRTUAL"
                ? {
                    ...(event.venue ?? {}),
                    name: venueName,
                    address: venueAddress,
                    city: venueCity,
                    state: venueState,
                    zip_code: venueZipCode,
                    latitude: venueLatitude,
                    longitude: venueLongitude,
                  }
                : undefined,
            virtual_event_type: audienceType !== "IN_PERSON" ? virtualEventType : undefined,
            attendee_virtual_venue_link:
              audienceType !== "IN_PERSON" && virtualEventType === "external" ? virtualVenueLink : undefined,
            virtual_event_instructions: audienceType !== "IN_PERSON" ? virtualInstructions : undefined,
            automatically_record_event: audienceType !== "IN_PERSON" ? autoRecord : undefined,
            moderated_qa_enabled: audienceType !== "IN_PERSON" ? privateQa : undefined,
            chat_disabled: audienceType !== "IN_PERSON" ? disableChat : undefined,
            is_many_to_many_virtual_event: audienceType !== "IN_PERSON" ? interactiveMode : undefined,
          });
        }

        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update event", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" />
          <span>Edit Event</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            Edit Event Details
          </DialogTitle>
          <DialogDescription>
            Updates event metadata, tags, format, and venue. Changes will immediately sync to Bevy and Firestore.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-event-title">Event Title *</Label>
              <div className="flex items-center gap-1">
                {title.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateTitle}
                    disabled={isRegeneratingTitle || isSubmitting}
                    className="h-6 gap-1 px-2 text-primary text-xs hover:text-primary"
                    title="Regenerate Title only without touching Description"
                  >
                    {isRegeneratingTitle ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3 text-primary" />
                    )}
                    Regenerate Title
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAiGenerate}
                  disabled={isGeneratingAi || isSubmitting}
                  className="h-6 gap-1 px-2 text-muted-foreground text-xs hover:text-foreground"
                  title="Generate both Title and Description from a topic prompt"
                >
                  {isGeneratingAi ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  Generate with AI
                </Button>
              </div>
            </div>
            <Input
              id="edit-event-title"
              placeholder="e.g. GDG Jakarta Meetup: Innovators Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-event-desc">Description</Label>
              {description.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateDescription}
                  disabled={isRegeneratingDesc || isSubmitting}
                  className="h-6 gap-1 px-2 text-primary text-xs hover:text-primary"
                >
                  {isRegeneratingDesc ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-primary" />
                  )}
                  Regenerate with AI
                </Button>
              )}
            </div>
            <Textarea
              id="edit-event-desc"
              rows={3}
              placeholder="Provide a welcoming description for attendees..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Event Tags Multi-Select */}
          <EventTagsInput tags={tags} onChange={setTags} />

          {/* Dates & Times */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 opacity-70" />
                Start Date & Time (WIB) *
              </Label>
              <DatePicker
                id="edit-start-date"
                withTime
                value={startDate}
                onChange={setStartDate}
                placeholder="Pick start date & time"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 opacity-70" />
                End Date & Time (WIB) *
              </Label>
              <DatePicker
                id="edit-end-date"
                withTime
                value={endDate}
                onChange={setEndDate}
                placeholder="Pick end date & time"
              />
            </div>
          </div>

          {/* Format & Capacity */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Event Format</Label>
              <Select
                value={audienceType}
                onValueChange={(val: "IN_PERSON" | "VIRTUAL" | "HYBRID") => setAudienceType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_PERSON">In-Person</SelectItem>
                  <SelectItem value="VIRTUAL">Virtual</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-capacity">Capacity</Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                placeholder="50"
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val: "Draft" | "Published") => setStatus(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Venue (if In-Person or Hybrid) */}
          {audienceType !== "VIRTUAL" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  <MapPin className="size-3.5" />
                  Venue Details
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPinpointOpen(true)}
                  className="h-6 gap-1 px-2 text-xs"
                >
                  <LocateFixed className="size-3 text-primary" />
                  Pick on Google Maps
                </Button>
              </div>

              {venueLatitude && venueLongitude && (
                <div className="flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <span>
                    Coordinates: {venueLatitude.toFixed(6)}, {venueLongitude.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVenueLatitude(undefined);
                      setVenueLongitude(undefined);
                    }}
                    className="opacity-80 hover:underline"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Venue Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-venue-name" className="text-xs">
                  Venue Name
                </Label>
                <Input
                  id="edit-venue-name"
                  placeholder="e.g. Kopikina Cikini or QX8Q+4QP"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              {/* City and State */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-venue-city" className="text-xs">
                    City
                  </Label>
                  <Input
                    id="edit-venue-city"
                    placeholder="e.g. Kota Jakarta Pusat or Kota Bekasi"
                    value={venueCity}
                    onChange={(e) => setVenueCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-venue-state" className="text-xs">
                    State/Province/Region
                  </Label>
                  <Input
                    id="edit-venue-state"
                    placeholder="e.g. Jawa Barat or DKI Jakarta"
                    value={venueState}
                    onChange={(e) => setVenueState(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-venue-address" className="text-xs">
                    Street Address
                  </Label>
                  <Input
                    id="edit-venue-address"
                    placeholder="No.66 Jalan Raden Saleh Raya"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-venue-zip" className="text-xs">
                    Postal Code
                  </Label>
                  <Input
                    id="edit-venue-zip"
                    placeholder="10330"
                    value={venueZipCode}
                    onChange={(e) => setVenueZipCode(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Virtual Event Options (if Virtual or Hybrid) */}
          {audienceType !== "IN_PERSON" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                <Video className="size-3.5" />
                Virtual Event Platform
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Select virtual event platform</Label>
                <Select
                  value={virtualEventType}
                  onValueChange={(val: "internal" | "external") => setVirtualEventType(val)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Bevy Virtual</SelectItem>
                    <SelectItem value="external">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {virtualEventType === "external" ? (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-virtual-url" className="text-xs">
                      Virtual event URL *
                    </Label>
                    <Input
                      id="edit-virtual-url"
                      placeholder="https://gdgjakarta.com/ or https://meet.google.com/..."
                      value={virtualVenueLink}
                      onChange={(e) => setVirtualVenueLink(e.target.value)}
                    />
                  </div>

                  {event.join_virtual_event_url && (
                    <div className="space-y-1 pt-1">
                      <div className="text-muted-foreground text-xs">Virtual join link for hosts</div>
                      <a
                        href={event.join_virtual_event_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-primary text-xs hover:underline"
                      >
                        {event.join_virtual_event_url}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 text-muted-foreground text-xs">
                    <span className="font-medium text-foreground">Bevy Virtual:</span> Virtual join link for hosts and
                    attendees is automatically managed by Bevy.
                  </div>

                  {event.join_virtual_event_url && (
                    <div className="space-y-1 pt-1">
                      <div className="text-muted-foreground text-xs">Virtual join link for hosts</div>
                      <a
                        href={event.join_virtual_event_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-primary text-xs hover:underline"
                      >
                        {event.join_virtual_event_url}
                      </a>
                    </div>
                  )}

                  {/* Virtual options checkboxes matching Bevy UI (only available for Bevy Virtual) */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-auto-record"
                        checked={autoRecord}
                        onCheckedChange={(checked) => setAutoRecord(Boolean(checked))}
                      />
                      <Label htmlFor="edit-auto-record" className="cursor-pointer font-normal text-xs">
                        Auto record
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-private-qa"
                        checked={privateQa}
                        onCheckedChange={(checked) => setPrivateQa(Boolean(checked))}
                      />
                      <Label htmlFor="edit-private-qa" className="cursor-pointer font-normal text-xs">
                        Private Q&amp;A
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-disable-chat"
                        checked={disableChat}
                        onCheckedChange={(checked) => setDisableChat(Boolean(checked))}
                      />
                      <Label htmlFor="edit-disable-chat" className="cursor-pointer font-normal text-xs">
                        Disable chat
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-interactive-mode"
                        checked={interactiveMode}
                        onCheckedChange={(checked) => setInteractiveMode(Boolean(checked))}
                      />
                      <Label htmlFor="edit-interactive-mode" className="cursor-pointer font-normal text-xs">
                        Interactive mode
                      </Label>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-1">
                {!showInstructions && !virtualInstructions ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInstructions(true)}
                    className="-ml-2 h-7 gap-1 text-primary text-xs hover:text-primary"
                  >
                    <PlusCircle className="size-3.5" />
                    Add instructions
                  </Button>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-virtual-instructions" className="text-xs">
                      Virtual Event Instructions
                    </Label>
                    <Textarea
                      id="edit-virtual-instructions"
                      rows={2}
                      placeholder="Add any instructions, meeting password, or prerequisites for virtual attendees..."
                      value={virtualInstructions}
                      onChange={(e) => setVirtualInstructions(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visibility & Testing Flags */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Test Event</div>
                <div className="text-muted-foreground text-xs">Mark event as test (excluded from public listings)</div>
              </div>
              <Switch checked={isTest} onCheckedChange={setIsTest} />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <div>
                <div className="font-medium text-sm">Hide this event on public pages</div>
                <div className="text-muted-foreground text-xs">You will need the URL to access.</div>
              </div>
              <Switch checked={isHidden} onCheckedChange={setIsHidden} />
            </div>

            {isHidden && (
              <div className="space-y-2.5 border-t pt-2 pl-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="edit-show-on-chapter"
                    checked={visibleOnParentChapterOnly}
                    onCheckedChange={(checked) => setVisibleOnParentChapterOnly(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-show-on-chapter" className="cursor-pointer font-medium text-xs">
                      Show event on chapter page
                    </Label>
                    <div className="text-[11px] text-muted-foreground">
                      People with chapter page access will be able to see the event.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="edit-disable-sharing"
                    checked={sharingDisabled}
                    onCheckedChange={(checked) => setSharingDisabled(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-disable-sharing" className="cursor-pointer font-medium text-xs">
                      Disable social sharing
                    </Label>
                    <div className="text-[11px] text-muted-foreground">
                      Social sharing icons will not appear on event page or emails.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="edit-allow-auto-emails"
                    checked={allowAutomatedEmailsWhenHidden}
                    onCheckedChange={(checked) => setAllowAutomatedEmailsWhenHidden(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-allow-auto-emails" className="cursor-pointer font-medium text-xs">
                      Allow automated emails
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save & Re-publish Meetup notification prompt */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="font-semibold text-foreground text-xs">Save and re-publish</div>
            <div className="flex items-center space-x-2 pt-0.5">
              <Checkbox
                id="edit-update-meetup"
                checked={updateMeetupEvent}
                onCheckedChange={(checked) => setUpdateMeetupEvent(Boolean(checked))}
              />
              <Label htmlFor="edit-update-meetup" className="cursor-pointer font-normal text-xs">
                Update Meetup event
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty} className="gap-1.5">
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowUnsavedPrompt}
        title="Discard Unsaved Changes?"
        description="You have unsaved changes in event details. If you leave without saving, your modifications will be lost."
        onCancel={() => setShowUnsavedPrompt(false)}
        onDiscard={handleDiscardChanges}
        onSave={() => {
          setShowUnsavedPrompt(false);
          // Trigger form submission
          const form = document.querySelector("form");
          if (form) form.requestSubmit();
        }}
        saving={isSubmitting}
      />

      <GoogleMapsPinpointDialog
        isOpen={isPinpointOpen}
        onOpenChange={setIsPinpointOpen}
        title="Pinpoint Venue Location"
        description="Drag the pin or click on the map to set the event venue location."
        initialLat={venueLatitude}
        initialLng={venueLongitude}
        onSelectLocation={(data) => {
          if (data.latitude) setVenueLatitude(data.latitude);
          if (data.longitude) setVenueLongitude(data.longitude);
          if (data.venueName) {
            setVenueName(data.venueName);
          } else if (data.suggestedAddress && (!venueName || venueName.includes("+"))) {
            setVenueName(data.suggestedAddress.split(",")[0] || "Venue");
          }
          if (data.suggestedAddress) {
            setVenueAddress(data.suggestedAddress);
          }
          if (data.city) setVenueCity(data.city);
          if (data.state) setVenueState(data.state);
          if (data.postalCode) setVenueZipCode(data.postalCode);
          toast.success("Location and address selected from Google Maps");
        }}
      />
    </Dialog>
  );
}

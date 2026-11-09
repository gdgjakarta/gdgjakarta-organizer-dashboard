"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CalendarIcon, Loader2, LocateFixed, MapPin, Plus, PlusCircle, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

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
import {
  createBevyEventAction,
  generateBevyAiEventAction,
  modifyBevyAiEventContentAction,
} from "@/server/bevy-actions";

import { EventTagsInput } from "./event-tags-input";

export function CreateEventDialog() {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = React.useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = React.useState(false);
  const router = useRouter();

  // Form states
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [audienceType, setAudienceType] = React.useState<"IN_PERSON" | "VIRTUAL" | "HYBRID">("IN_PERSON");
  const [totalCapacity, setTotalCapacity] = React.useState("50");
  const [isTest, setIsTest] = React.useState(false);
  const [isHidden, setIsHidden] = React.useState(true);
  const [visibleOnParentChapterOnly, setVisibleOnParentChapterOnly] = React.useState(false);
  const [sharingDisabled, setSharingDisabled] = React.useState(false);
  const [allowAutomatedEmailsWhenHidden, setAllowAutomatedEmailsWhenHidden] = React.useState(false);
  const [status, setStatus] = React.useState<"Draft" | "Published">("Draft");
  const [tags, setTags] = React.useState<string[]>([]);

  // Venue states
  const [venueName, setVenueName] = React.useState("");
  const [venueAddress, setVenueAddress] = React.useState("");
  const [venueCity, setVenueCity] = React.useState("");
  const [venueState, setVenueState] = React.useState("");
  const [venueZipCode, setVenueZipCode] = React.useState("");
  const [venueLatitude, setVenueLatitude] = React.useState<number | undefined>();
  const [venueLongitude, setVenueLongitude] = React.useState<number | undefined>();
  const [isPinpointOpen, setIsPinpointOpen] = React.useState(false);

  // Virtual platform states
  const [virtualEventType, setVirtualEventType] = React.useState<"internal" | "external">("internal");
  const [virtualVenueLink, setVirtualVenueLink] = React.useState("");
  const [virtualInstructions, setVirtualInstructions] = React.useState("");
  const [showInstructions, setShowInstructions] = React.useState(false);
  const [autoRecord, setAutoRecord] = React.useState(true);
  const [privateQa, setPrivateQa] = React.useState(false);
  const [disableChat, setDisableChat] = React.useState(false);
  const [interactiveMode, setInteractiveMode] = React.useState(false);

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
      toast.error("Please enter a title or description first before regenerating.");
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

    try {
      setIsSubmitting(true);
      const toastId = toast.loading("Creating event on Bevy with external registration...");

      // Convert local date inputs (YYYY-MM-DDTHH:mm) to ISO with +07:00 timezone
      const formatIsoWithTimezone = (dateTimeStr: string) => {
        if (!dateTimeStr) return "";
        if (dateTimeStr.includes("+") || dateTimeStr.endsWith("Z")) return dateTimeStr;
        return `${dateTimeStr}:00.000+07:00`;
      };

      const formattedStartDate = formatIsoWithTimezone(startDate);
      const formattedEndDate = formatIsoWithTimezone(endDate);

      const res = await createBevyEventAction({
        title,
        description: description || `Join us for ${title}!`,
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
        tags: tags.length > 0 ? tags : undefined,
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

      if (res.success && res.data?.id) {
        toast.success(`Event created successfully! (ID: ${res.data.id})`, { id: toastId });
        setOpen(false);
        router.push(`/dashboard/events/${res.data.id}`);
      } else {
        toast.error(res.error || "Failed to create event", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Create Event with External Registration
          </DialogTitle>
          <DialogDescription>
            Creates the event in Bevy with external registration. Registration and tickets will be managed seamlessly
            from this dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="event-title">Event Title *</Label>
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
              id="event-title"
              placeholder="e.g. GDG Jakarta Meetup: Innovators Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="event-desc">Description</Label>
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
              id="event-desc"
              rows={3}
              placeholder="Provide a welcoming description for attendees..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Event Tags Multi-Select Combobox */}
          <EventTagsInput tags={tags} onChange={setTags} />

          {/* Dates & Times */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 opacity-70" />
                Start Date & Time (WIB) *
              </Label>
              <DatePicker
                id="start-date"
                withTime
                value={startDate}
                onChange={setStartDate}
                placeholder="Pick start date & time"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 opacity-70" />
                End Date & Time (WIB) *
              </Label>
              <DatePicker
                id="end-date"
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
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
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
                <Label htmlFor="venue-name" className="text-xs">
                  Venue Name
                </Label>
                <Input
                  id="venue-name"
                  placeholder="e.g. Kopikina Cikini or QX8Q+4QP"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              {/* City and State */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="venue-city" className="text-xs">
                    City
                  </Label>
                  <Input
                    id="venue-city"
                    placeholder="e.g. Kota Jakarta Pusat or Kota Bekasi"
                    value={venueCity}
                    onChange={(e) => setVenueCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue-state" className="text-xs">
                    State/Province/Region
                  </Label>
                  <Input
                    id="venue-state"
                    placeholder="e.g. Jawa Barat or DKI Jakarta"
                    value={venueState}
                    onChange={(e) => setVenueState(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="venue-address" className="text-xs">
                    Street Address
                  </Label>
                  <Input
                    id="venue-address"
                    placeholder="No.66 Jalan Raden Saleh Raya"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue-zip" className="text-xs">
                    Postal Code
                  </Label>
                  <Input
                    id="venue-zip"
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
                <div className="space-y-1.5">
                  <Label htmlFor="virtual-url" className="text-xs">
                    External Virtual Venue URL *
                  </Label>
                  <Input
                    id="virtual-url"
                    placeholder="https://meet.google.com/xyz-abcd-efg or Zoom / YouTube link"
                    value={virtualVenueLink}
                    onChange={(e) => setVirtualVenueLink(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 text-muted-foreground text-xs">
                    <span className="font-medium text-foreground">Bevy Virtual:</span> Virtual join link for hosts and
                    attendees is automatically generated by Bevy upon event creation.
                  </div>

                  {/* Virtual options checkboxes matching Bevy UI (only available for Bevy Virtual) */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="auto-record"
                        checked={autoRecord}
                        onCheckedChange={(checked) => setAutoRecord(Boolean(checked))}
                      />
                      <Label htmlFor="auto-record" className="cursor-pointer font-normal text-xs">
                        Auto record
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="private-qa"
                        checked={privateQa}
                        onCheckedChange={(checked) => setPrivateQa(Boolean(checked))}
                      />
                      <Label htmlFor="private-qa" className="cursor-pointer font-normal text-xs">
                        Private Q&amp;A
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="disable-chat"
                        checked={disableChat}
                        onCheckedChange={(checked) => setDisableChat(Boolean(checked))}
                      />
                      <Label htmlFor="disable-chat" className="cursor-pointer font-normal text-xs">
                        Disable chat
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="interactive-mode"
                        checked={interactiveMode}
                        onCheckedChange={(checked) => setInteractiveMode(Boolean(checked))}
                      />
                      <Label htmlFor="interactive-mode" className="cursor-pointer font-normal text-xs">
                        Interactive mode
                      </Label>
                    </div>
                  </div>
                </>
              )}

              {/* Instructions Expandable */}
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
                    <Label htmlFor="virtual-instructions" className="text-xs">
                      Virtual Event Instructions
                    </Label>
                    <Textarea
                      id="virtual-instructions"
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

            {/* Sub-options when hidden is active */}
            {isHidden && (
              <div className="space-y-2.5 border-t pt-2 pl-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="show-on-chapter"
                    checked={visibleOnParentChapterOnly}
                    onCheckedChange={(checked) => setVisibleOnParentChapterOnly(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="show-on-chapter" className="cursor-pointer font-medium text-xs">
                      Show event on chapter page
                    </Label>
                    <div className="text-[11px] text-muted-foreground">
                      People with chapter page access will be able to see the event.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="disable-sharing"
                    checked={sharingDisabled}
                    onCheckedChange={(checked) => setSharingDisabled(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="disable-sharing" className="cursor-pointer font-medium text-xs">
                      Disable social sharing
                    </Label>
                    <div className="text-[11px] text-muted-foreground">
                      Social sharing icons will not appear on event page or emails.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="allow-auto-emails"
                    checked={allowAutomatedEmailsWhenHidden}
                    onCheckedChange={(checked) => setAllowAutomatedEmailsWhenHidden(Boolean(checked))}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="allow-auto-emails" className="cursor-pointer font-medium text-xs">
                      Allow automated emails
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md bg-primary/5 p-2.5 text-muted-foreground text-xs">
            <strong>Registration Link:</strong> Upon creation, the event will automatically point to{" "}
            <code className="text-foreground">https://gdgjakarta.com/events/&#123;id&#125;</code>. Generating a short
            link later will automatically synchronize Bevy to use your custom short URL.
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

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

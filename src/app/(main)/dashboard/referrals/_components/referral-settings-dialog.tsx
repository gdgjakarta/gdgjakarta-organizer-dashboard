"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Calendar,
  CalendarX,
  Check,
  ChevronsUpDown,
  Coins,
  CreditCard,
  Loader2,
  Percent,
  Plus,
  Settings,
  Sliders,
  Sparkles,
  Tag,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { PublishedEventOption } from "@/app/(main)/dashboard/email-manager/_actions/fetch-published-events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchEventsForReferralConfigAction, saveReferralProgramSettingsAction } from "@/lib/firestore/actions";
import type { ReferralEnabledCondition, ReferralProgramSettings } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralSettingsDialogProps {
  initialSettings?: ReferralProgramSettings | null;
  onSettingsUpdated?: (settings: ReferralProgramSettings) => void;
}

export function ReferralSettingsDialog({ initialSettings, onSettingsUpdated }: ReferralSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    initialSettings?.default_discount_type === "fixed" ? "fixed" : "percentage",
  );
  const [discountPercent, setDiscountPercent] = useState<number>(initialSettings?.default_discount_percentage ?? 10);
  const [discountAmount, setDiscountAmount] = useState<number>(initialSettings?.default_discount_amount ?? 25000);
  const [pointsPerReferral, setPointsPerReferral] = useState<number>(initialSettings?.points_per_referral ?? 10);
  const [isActive, setIsActive] = useState<boolean>(initialSettings?.is_active ?? true);
  const [enabledCondition, setEnabledCondition] = useState<ReferralEnabledCondition>(
    initialSettings?.enabled_condition ?? "paid_events_only",
  );
  const [autoExcludeRoles, setAutoExcludeRoles] = useState<string[]>(() => {
    if (Array.isArray(initialSettings?.auto_exclude_roles)) {
      return initialSettings.auto_exclude_roles;
    }
    if (initialSettings?.auto_exclude_organizers) {
      return ["googler", "organizer", "team_member"];
    }
    return [];
  });
  const [blockedRedemptionRoles, setBlockedRedemptionRoles] = useState<string[]>(
    () => initialSettings?.blocked_redemption_roles ?? [],
  );
  const [excludedEventIds, setExcludedEventIds] = useState<string[]>(initialSettings?.excluded_event_ids ?? []);
  const [availableEvents, setAvailableEvents] = useState<PublishedEventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventSelectorOpen, setEventSelectorOpen] = useState(false);
  const [prizeDesc, setPrizeDesc] = useState<string>(
    initialSettings?.merch_prize_description ?? "Exclusive GDG Jakarta merchandise bundle",
  );

  // Sync excludedEventIds, enabledCondition, and blockedRedemptionRoles when initialSettings change
  useEffect(() => {
    if (initialSettings?.excluded_event_ids) {
      setExcludedEventIds(initialSettings.excluded_event_ids);
    }
    if (initialSettings?.enabled_condition) {
      setEnabledCondition(initialSettings.enabled_condition);
    }
    if (Array.isArray(initialSettings?.blocked_redemption_roles)) {
      setBlockedRedemptionRoles(initialSettings.blocked_redemption_roles);
    }
  }, [
    initialSettings?.excluded_event_ids,
    initialSettings?.enabled_condition,
    initialSettings?.blocked_redemption_roles,
  ]);

  // Load events when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingEvents(true);
      fetchEventsForReferralConfigAction()
        .then((events) => {
          setAvailableEvents(events || []);
        })
        .catch((err) => {
          console.error("[ReferralSettingsDialog] Error loading events:", err);
        })
        .finally(() => {
          setLoadingEvents(false);
        });
    }
  }, [open]);

  const availableEventsMap = useMemo(() => {
    const map = new Map<string, PublishedEventOption>();
    for (const ev of availableEvents) {
      map.set(String(ev.id), ev);
    }
    return map;
  }, [availableEvents]);

  const handleToggleExcludeEvent = (eventId: string) => {
    setExcludedEventIds((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
  };

  const handleRemoveExcludedEvent = (eventId: string) => {
    setExcludedEventIds((prev) => prev.filter((id) => id !== eventId));
  };

  const handleRoleToggle = (role: "googler" | "organizer" | "team_member", checked: boolean) => {
    setAutoExcludeRoles((prev) => {
      if (checked) {
        return prev.includes(role) ? prev : [...prev, role];
      }
      return prev.filter((r) => r !== role);
    });
  };

  const handleRedemptionRoleToggle = (role: "googler" | "organizer" | "team_member", allowRedemption: boolean) => {
    setBlockedRedemptionRoles((prev) => {
      if (allowRedemption) {
        return prev.filter((r) => r !== role);
      }
      return prev.includes(role) ? prev : [...prev, role];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveReferralProgramSettingsAction({
        default_discount_type: discountType,
        default_discount_percentage: Number(discountPercent) || 0,
        default_discount_amount: Number(discountAmount) || 0,
        points_per_referral: Number(pointsPerReferral) || 0,
        is_active: isActive,
        enabled_condition: enabledCondition,
        auto_exclude_roles: autoExcludeRoles,
        auto_exclude_organizers: autoExcludeRoles.includes("organizer"),
        blocked_redemption_roles: blockedRedemptionRoles,
        excluded_member_ids: initialSettings?.excluded_member_ids ?? [],
        excluded_event_ids: excludedEventIds,
        merch_prize_description: prizeDesc.trim(),
      });

      if (!res.success) {
        toast.error(res.error || "Failed to save referral settings.");
        return;
      }

      toast.success("Referral program settings updated successfully!");
      if (onSettingsUpdated) {
        onSettingsUpdated({
          default_discount_type: discountType,
          default_discount_percentage: Number(discountPercent) || 0,
          default_discount_amount: Number(discountAmount) || 0,
          points_per_referral: Number(pointsPerReferral) || 0,
          is_active: isActive,
          enabled_condition: enabledCondition,
          auto_exclude_roles: autoExcludeRoles,
          auto_exclude_organizers: autoExcludeRoles.includes("organizer"),
          blocked_redemption_roles: blockedRedemptionRoles,
          excluded_member_ids: initialSettings?.excluded_member_ids ?? [],
          excluded_event_ids: excludedEventIds,
          merch_prize_description: prizeDesc.trim(),
          updated_at: new Date().toISOString(),
        });
      }
      setOpen(false);
    } catch {
      toast.error("Failed to update referral settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-medium text-xs">
          <Settings className="size-3.5" />
          Referral Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Referral Program Configuration</DialogTitle>
              <DialogDescription className="text-xs">
                Configure global discount percentages, points rules, exclusions, and merchandise rewards.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Master Toggle */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <p className="font-medium text-foreground text-xs">Program Active Status</p>
              <p className="text-[11px] text-muted-foreground">
                Enable or pause referral redemption and discounts chapter-wide.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Referral Enablement Condition */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sliders className="size-4 text-primary" />
                <p className="font-medium text-foreground text-xs">Referral Enablement Condition</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Define the event and ticket criteria required for referral codes to appear and be redeemable.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* All Events */}
              <button
                type="button"
                onClick={() => setEnabledCondition("all")}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all",
                  enabledCondition === "all"
                    ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/30"
                    : "border-border/80 bg-background/80 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ticket className="size-3.5" />
                    <span className="font-semibold text-xs">All Events</span>
                  </div>
                  {enabledCondition === "all" && <Check className="size-3 text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Available on all active events, free &amp; paid.
                </p>
              </button>

              {/* Paid Events Only */}
              <button
                type="button"
                onClick={() => setEnabledCondition("paid_events_only")}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all",
                  enabledCondition === "paid_events_only"
                    ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/30"
                    : "border-border/80 bg-background/80 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Coins className="size-3.5" />
                    <span className="font-semibold text-xs">Paid Events</span>
                  </div>
                  {enabledCondition === "paid_events_only" && <Check className="size-3 text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Only events with at least 1 paid pass or bundle.
                </p>
              </button>

              {/* Paid Tickets Only */}
              <button
                type="button"
                onClick={() => setEnabledCondition("paid_tickets_only")}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all",
                  enabledCondition === "paid_tickets_only"
                    ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/30"
                    : "border-border/80 bg-background/80 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="size-3.5" />
                    <span className="font-semibold text-xs">Paid Passes</span>
                  </div>
                  {enabledCondition === "paid_tickets_only" && <Check className="size-3 text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Only when attendee selects a paid pass (&gt; Rp 0).
                </p>
              </button>
            </div>
          </div>

          {/* Role Auto-Exclusion Controls */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <p className="font-medium text-foreground text-xs">Auto-Exclude Roles & Permissions</p>
              <p className="text-[11px] text-muted-foreground">
                Configure leaderboard exclusion and attendee discount redemption rules for each chapter role.
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Googler */}
              {(() => {
                const isExcludedLeaderboard = autoExcludeRoles.includes("googler");
                const isRedemptionBlocked = blockedRedemptionRoles.includes("googler");
                return (
                  <div className="space-y-2 rounded-lg border bg-background/80 p-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-center justify-between border-border/50 border-b pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-foreground text-xs">Googler</p>
                        <Badge
                          variant="outline"
                          className="border-red-500/30 bg-red-500/10 text-[10px] text-red-700 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300"
                        >
                          Google
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          !isRedemptionBlocked
                            ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                        }
                      >
                        {!isRedemptionBlocked ? "Discounts Allowed" : "Discounts Blocked"}
                      </Badge>
                    </div>

                    {/* Leaderboard Ranking Toggle */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Exclude from Leaderboard</p>
                        <p className="text-[11px] text-muted-foreground">
                          Filter out Google staff and advisors from leaderboard rankings and prizes.
                        </p>
                      </div>
                      <Switch
                        checked={isExcludedLeaderboard}
                        onCheckedChange={(checked) => handleRoleToggle("googler", checked)}
                        aria-label="Auto-exclude Googlers from leaderboard"
                      />
                    </div>

                    {/* Attendee Discount Redemption Toggle */}
                    <div className="flex items-center justify-between border-border/60 border-t border-dashed pt-2">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Allow Attendee Redemption</p>
                        <p className="text-[11px] text-muted-foreground">
                          {!isRedemptionBlocked
                            ? "Attendees can enter Googler referral codes for ticket discounts."
                            : "Attendees cannot redeem Googler referral codes during checkout."}
                        </p>
                      </div>
                      <Switch
                        checked={!isRedemptionBlocked}
                        onCheckedChange={(checked) => handleRedemptionRoleToggle("googler", checked)}
                        aria-label="Allow attendee redemption for Googler referral codes"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Organizer */}
              {(() => {
                const isExcludedLeaderboard = autoExcludeRoles.includes("organizer");
                const isRedemptionBlocked = blockedRedemptionRoles.includes("organizer");
                return (
                  <div className="space-y-2 rounded-lg border bg-background/80 p-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-center justify-between border-border/50 border-b pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-foreground text-xs">Organizer</p>
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300"
                        >
                          Organizer
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          !isRedemptionBlocked
                            ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                        }
                      >
                        {!isRedemptionBlocked ? "Discounts Allowed" : "Discounts Blocked"}
                      </Badge>
                    </div>

                    {/* Leaderboard Ranking Toggle */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Exclude from Leaderboard</p>
                        <p className="text-[11px] text-muted-foreground">
                          Filter out chapter leads and co-organizers from leaderboard rankings and prizes.
                        </p>
                      </div>
                      <Switch
                        checked={isExcludedLeaderboard}
                        onCheckedChange={(checked) => handleRoleToggle("organizer", checked)}
                        aria-label="Auto-exclude Organizers from leaderboard"
                      />
                    </div>

                    {/* Attendee Discount Redemption Toggle */}
                    <div className="flex items-center justify-between border-border/60 border-t border-dashed pt-2">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Allow Attendee Redemption</p>
                        <p className="text-[11px] text-muted-foreground">
                          {!isRedemptionBlocked
                            ? "Attendees can enter Organizer referral codes for ticket discounts."
                            : "Attendees cannot redeem Organizer referral codes during checkout."}
                        </p>
                      </div>
                      <Switch
                        checked={!isRedemptionBlocked}
                        onCheckedChange={(checked) => handleRedemptionRoleToggle("organizer", checked)}
                        aria-label="Allow attendee redemption for Organizer referral codes"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Team Member */}
              {(() => {
                const isExcludedLeaderboard = autoExcludeRoles.includes("team_member");
                const isRedemptionBlocked = blockedRedemptionRoles.includes("team_member");
                return (
                  <div className="space-y-2 rounded-lg border bg-background/80 p-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-center justify-between border-border/50 border-b pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-foreground text-xs">Team Member</p>
                        <Badge
                          variant="outline"
                          className="border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300"
                        >
                          Core Team
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          !isRedemptionBlocked
                            ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                        }
                      >
                        {!isRedemptionBlocked ? "Discounts Allowed" : "Discounts Blocked"}
                      </Badge>
                    </div>

                    {/* Leaderboard Ranking Toggle */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Exclude from Leaderboard</p>
                        <p className="text-[11px] text-muted-foreground">
                          Filter out core team crew and chapter staff from leaderboard rankings and prizes.
                        </p>
                      </div>
                      <Switch
                        checked={isExcludedLeaderboard}
                        onCheckedChange={(checked) => handleRoleToggle("team_member", checked)}
                        aria-label="Auto-exclude Team Members from leaderboard"
                      />
                    </div>

                    {/* Attendee Discount Redemption Toggle */}
                    <div className="flex items-center justify-between border-border/60 border-t border-dashed pt-2">
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground text-xs">Allow Attendee Redemption</p>
                        <p className="text-[11px] text-muted-foreground">
                          {!isRedemptionBlocked
                            ? "Attendees can enter Team Member referral codes for ticket discounts."
                            : "Attendees cannot redeem Team Member referral codes during checkout."}
                        </p>
                      </div>
                      <Switch
                        checked={!isRedemptionBlocked}
                        onCheckedChange={(checked) => handleRedemptionRoleToggle("team_member", checked)}
                        aria-label="Allow attendee redemption for Team Member referral codes"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Excluded Events Section */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <CalendarX className="size-4 text-amber-600 dark:text-amber-400" />
                  <p className="font-medium text-foreground text-xs">Excluded Events</p>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                  >
                    {excludedEventIds.length} {excludedEventIds.length === 1 ? "event" : "events"} excluded
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prevent attendees from redeeming referral codes and claiming discounts on specific events.
                </p>
              </div>
            </div>

            {/* Event Selector Popover */}
            <Popover open={eventSelectorOpen} onOpenChange={setEventSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingEvents}
                  className="h-8 w-full justify-between px-3 font-normal text-xs"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {loadingEvents ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Loading chapter events...
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5" />
                        Exclude an event from referrals...
                      </>
                    )}
                  </span>
                  <ChevronsUpDown className="size-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search event by name or date..." className="text-xs" />
                  <CommandList className="max-h-60">
                    <CommandEmpty>No events found.</CommandEmpty>
                    <CommandGroup heading={`All Events (${availableEvents.length})`}>
                      {availableEvents.map((ev) => {
                        const isExcluded = excludedEventIds.includes(String(ev.id));
                        return (
                          <CommandItem
                            key={ev.id}
                            value={`${ev.title} ${ev.formattedDate} ${ev.id}`}
                            onSelect={() => {
                              handleToggleExcludeEvent(String(ev.id));
                            }}
                            className="flex cursor-pointer items-center justify-between py-1.5 text-xs"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Avatar className="size-6 shrink-0 rounded-md border bg-muted/40">
                                {ev.thumbnailUrl && (
                                  <AvatarImage src={ev.thumbnailUrl} alt={ev.title} className="object-cover" />
                                )}
                                <AvatarFallback className="rounded-md bg-primary/10 text-[10px] text-primary">
                                  <Calendar className="size-3" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">{ev.title}</span>
                                {ev.formattedDate && (
                                  <span className="text-[10px] text-muted-foreground">{ev.formattedDate}</span>
                                )}
                              </div>
                            </div>
                            <div className="ml-2 flex items-center">
                              {isExcluded ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                                >
                                  <Check className="mr-0.5 size-2.5" /> Excluded
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground hover:text-foreground">
                                  Click to exclude
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Excluded Events List */}
            {excludedEventIds.length > 0 ? (
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {excludedEventIds.map((id) => {
                  const ev = availableEventsMap.get(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between rounded-lg border bg-background/80 p-2 text-xs transition-colors hover:bg-muted/30"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Avatar className="size-7 shrink-0 rounded-md border bg-muted/40">
                          {ev?.thumbnailUrl && (
                            <AvatarImage src={ev.thumbnailUrl} alt={ev.title} className="object-cover" />
                          )}
                          <AvatarFallback className="rounded-md bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                            <Calendar className="size-3.5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground text-xs">{ev?.title || `Event #${id}`}</p>
                          {ev?.formattedDate && <p className="text-[10px] text-muted-foreground">{ev.formattedDate}</p>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveExcludedEvent(id)}
                        className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove exclusion"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border/80 border-dashed bg-background/40 p-3 text-center">
                <p className="text-muted-foreground text-xs">No events excluded from referrals.</p>
                <p className="text-[10px] text-muted-foreground/80">
                  Attendees can redeem referral codes across all chapter events.
                </p>
              </div>
            )}
          </div>

          {/* Discount Configuration: Type & Value */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1">
              <FieldLabel className="font-medium text-xs">Default Discount Type</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType("percentage")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all",
                    discountType === "percentage"
                      ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border",
                      discountType === "percentage" ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Percent className="size-3" />
                  </div>
                  <div className="text-xs">Percentage (%)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all",
                    discountType === "fixed"
                      ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border",
                      discountType === "fixed" ? "border-primary bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Tag className="size-3" />
                  </div>
                  <div className="text-xs">Fixed Amount (Rp)</div>
                </button>
              </div>
            </div>

            {discountType === "percentage" ? (
              <Field>
                <FieldLabel className="font-medium text-xs">Default Ticket Discount Percentage (%)</FieldLabel>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="h-8 pr-8 font-mono text-xs"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-xs">
                    %
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Percentage automatically deducted from tickets purchased using a referral code.
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel className="font-medium text-xs">Default Ticket Fixed Discount (Rp)</FieldLabel>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-medium text-muted-foreground text-xs">
                    Rp
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                    className="h-8 pl-8 font-mono text-xs"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Fixed IDR amount automatically deducted from tickets purchased using a referral code.
                </p>
              </Field>
            )}
          </div>

          {/* Points Per Referral */}
          <Field>
            <FieldLabel className="font-medium text-xs">Points Awarded Per Referred Booking</FieldLabel>
            <Input
              type="number"
              min={1}
              max={1000}
              value={pointsPerReferral}
              onChange={(e) => setPointsPerReferral(Math.max(1, Number(e.target.value)))}
              className="mt-1 h-8 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Leaderboard points awarded to the referrer when an attendee books a ticket.
            </p>
          </Field>

          {/* Merchandise Prize Description */}
          <Field>
            <FieldLabel className="font-medium text-xs">Merchandise Grand Prize Description</FieldLabel>
            <Textarea
              rows={2}
              value={prizeDesc}
              onChange={(e) => setPrizeDesc(e.target.value)}
              placeholder="e.g. Exclusive GDG Jakarta merchandise bundle"
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Displayed on member dashboards and leaderboard as the reward for #1 top rank.
            </p>
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 font-medium text-xs">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

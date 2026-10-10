"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  CalendarCheck,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Layers,
  MapPin,
  Radio,
  Search,
  Sparkles,
  UserX,
  X,
} from "lucide-react";

import { CancelRegistrationDialog } from "@/components/cancel-registration-dialog";
import { EditRegistrationModal } from "@/components/edit-registration-modal";
import { EventCardImage } from "@/components/event-card-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import { fetchMemberRegistrationsAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MyEventsListProps {
  allEvents: FirestoreEvent[];
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "Confirmed / Approved",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Not Selected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
};

function isEventPast(event?: FirestoreEvent): boolean {
  if (!event) return false;
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function MyEventsList({ allEvents }: MyEventsListProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [extraEvents, setExtraEvents] = useState<FirestoreEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingEvents, setIsResolvingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancellingRegistration, setCancellingRegistration] = useState<FirestoreRegistration | null>(null);

  useEffect(() => {
    async function loadRegistrations() {
      if (isAuthLoading) return;
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const list = await fetchMemberRegistrationsAction(user.id, user.email);
        setRegistrations(list);
      } catch (err) {
        console.error("[MyEventsList] Failed to load member registrations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRegistrations();
  }, [user, isAuthLoading]);

  // Resolve events that exist in registrations but are missing from Bevy allEvents
  useEffect(() => {
    let isCancelled = false;

    async function resolveMissingEvents() {
      if (registrations.length === 0) return;

      const knownIds = new Set([...allEvents.map((e) => String(e.id)), ...extraEvents.map((e) => String(e.id))]);
      const missingIds = Array.from(
        new Set(registrations.map((r) => String(r.event_id)).filter((id) => !knownIds.has(id))),
      );

      if (missingIds.length === 0) return;

      try {
        setIsResolvingEvents(true);
        const { getFirestoreEvents, getFirestoreEventById } = await import("@/lib/firestore/client");

        const foundMap = new Map<string, FirestoreEvent>();

        // 1. Fetch top Firestore events
        const fsEvents = await getFirestoreEvents(100);
        for (const fe of fsEvents) {
          foundMap.set(String(fe.id), fe);
        }

        // 2. Fetch specific missing docs individually if not found in batch
        const stillMissing = missingIds.filter((id) => !foundMap.has(id));
        if (stillMissing.length > 0) {
          const singleFetches = await Promise.all(
            stillMissing.map(async (id) => {
              try {
                return await getFirestoreEventById(id);
              } catch {
                return null;
              }
            }),
          );
          for (const item of singleFetches) {
            if (item) {
              foundMap.set(String(item.id), item);
            }
          }
        }

        if (!isCancelled && foundMap.size > 0) {
          setExtraEvents((prev) => {
            const prevMap = new Map(prev.map((e) => [String(e.id), e]));
            for (const [id, event] of foundMap.entries()) {
              prevMap.set(id, event);
            }
            return Array.from(prevMap.values());
          });
        }
      } catch (err) {
        console.warn("[MyEventsList] Failed to resolve missing events from Firestore:", err);
      } finally {
        if (!isCancelled) {
          setIsResolvingEvents(false);
        }
      }
    }

    void resolveMissingEvents();

    return () => {
      isCancelled = true;
    };
  }, [registrations, allEvents, extraEvents]);

  const eventMap = useMemo(() => {
    const map = new Map<string, FirestoreEvent>();
    for (const ev of allEvents) {
      map.set(String(ev.id), ev);
    }
    for (const ev of extraEvents) {
      const existing = map.get(String(ev.id));
      map.set(String(ev.id), {
        ...existing,
        ...ev,
        picture_url: ev.picture_url || ev.banner_url || existing?.picture_url,
        banner_url: ev.banner_url || ev.picture_url || existing?.banner_url,
      });
    }
    return map;
  }, [allEvents, extraEvents]);

  const handleRegistrationUpdated = (updated: FirestoreRegistration) => {
    setRegistrations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // Metrics summary
  const totalCount = registrations.length;
  const pendingCount = registrations.filter((r) => r.status === "pending" || r.status === "waitlisted").length;
  const approvedCount = registrations.filter((r) => r.status === "approved").length;
  const attendedCount = registrations.filter((r) => r.status === "attended").length;

  // Filter registrations by search and status
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      if (statusFilter !== "all" && reg.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = reg.event_title.toLowerCase().includes(query);
        const trackMatch = reg.session_title?.toLowerCase().includes(query);
        if (!titleMatch && !trackMatch) {
          return false;
        }
      }
      return true;
    });
  }, [registrations, statusFilter, searchQuery]);

  // Segment registrations
  const upcomingRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return !isEventPast(ev) && reg.status !== "attended";
    });
  }, [filteredRegistrations, eventMap]);

  const pastRegs = useMemo(() => {
    return filteredRegistrations.filter((reg) => {
      const ev = eventMap.get(String(reg.event_id));
      return isEventPast(ev) || reg.status === "attended";
    });
  }, [filteredRegistrations, eventMap]);

  const renderRegistrationGrid = (items: FirestoreRegistration[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Card key={key} className="overflow-hidden border-border/60">
              <div className="relative aspect-video w-full bg-muted/60">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
              <CardHeader className="space-y-2 p-4">
                <div className="h-5 w-24 rounded-md bg-muted/60" />
                <div className="h-6 w-3/4 rounded-md bg-muted/60" />
                <div className="h-4 w-1/2 rounded-md bg-muted/60" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-4 w-full rounded-md bg-muted/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-border/80 border-dashed p-12 text-center text-muted-foreground">
          <CalendarCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-foreground text-lg">No events found in this category</h3>
          <p className="mt-1 text-sm">
            {searchQuery || statusFilter !== "all"
              ? "No registered events match your active filters."
              : "You haven't registered for any events matching this category yet."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 gap-1.5 text-xs"
            >
              <X className="size-3.5" />
              Clear Filters
            </Button>
          ) : (
            <Button asChild className="mt-4 gap-1.5" size="sm">
              <Link href="/dashboard/member">
                <Sparkles className="size-3.5" />
                Explore Upcoming Events
              </Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((reg) => {
          const ev = eventMap.get(String(reg.event_id));
          const statusMeta = STATUS_VARIANTS[reg.status] || STATUS_VARIANTS.pending;
          const isPending = reg.status === "pending" || reg.status === "waitlisted";
          const isApproved = reg.status === "approved" || reg.status === "attended";
          const selectedTrack =
            reg.session_title ||
            (reg.answers?.session_title as string | undefined) ||
            (reg.session_id ? `Track ID: ${reg.session_id}` : null);

          let formattedDate = ev?.start_date || reg.registered_at;
          try {
            if (ev?.start_date) {
              formattedDate = format(parseISO(ev.start_date), "dd MMM yyyy • h:mm a");
            } else if (reg.registered_at) {
              formattedDate = format(parseISO(reg.registered_at), "dd MMM yyyy");
            }
          } catch {
            // Keep raw string
          }

          const imageUrl = extractEventImageUrl(
            ev as unknown as Record<string, unknown>,
            reg as unknown as Record<string, unknown>,
          );
          const isCardLoading = isResolvingEvents && !ev;

          return (
            <Card
              key={reg.id}
              className={cn(
                "group flex flex-col justify-between overflow-hidden shadow-xs transition-all hover:shadow-md",
                isPending && "border-amber-500/30",
              )}
            >
              <div>
                {/* Event Picture / Banner */}
                <Link href={`/dashboard/member/events/${reg.event_id}`} className="block">
                  <EventCardImage
                    src={imageUrl}
                    alt={reg.event_title}
                    isLoading={isCardLoading}
                    className="transition-transform duration-300 group-hover:scale-105"
                  >
                    <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                        {(() => {
                          const { isVirtual, isHybrid } = resolveEventAudience(ev?.audience_type, ev?.is_virtual);
                          if (isVirtual) {
                            return (
                              <span className="flex items-center gap-1 text-blue-500">
                                <Radio className="size-3" /> Virtual
                              </span>
                            );
                          }
                          if (isHybrid) {
                            return (
                              <span className="flex items-center gap-1 text-purple-500">
                                <Globe className="size-3" /> Hybrid
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <MapPin className="size-3" /> In-Person
                            </span>
                          );
                        })()}
                      </Badge>
                      {ev && isEventPast(ev) && (
                        <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                          Concluded
                        </Badge>
                      )}
                    </div>
                  </EventCardImage>
                </Link>

                <CardHeader className="space-y-2 p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                    >
                      {statusMeta.label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {ev && isEventPast(ev) ? "Concluded" : "Upcoming"}
                    </span>
                  </div>

                  <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
                    <Link
                      href={`/dashboard/member/events/${reg.event_id}`}
                      className="transition-colors hover:text-primary hover:underline"
                    >
                      {reg.event_title}
                    </Link>
                  </CardTitle>

                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {formattedDate}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2.5 px-4 pb-3">
                  {/* Selected Track badge */}
                  {selectedTrack && (
                    <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                      <Layers className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate font-medium text-[11px] text-foreground">Track: {selectedTrack}</span>
                    </div>
                  )}

                  {/* Status Helper Message */}
                  {isPending && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                      ✏️ Form responses can be edited while pending review.
                    </div>
                  )}
                  {isApproved && (
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                      ✓ Confirmed attendee. Responses locked.
                    </div>
                  )}

                  <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                    {ev?.description_short ||
                      ev?.description ||
                      "Registered GDG Jakarta session. Check details for venue access and agenda."}
                  </p>
                </CardContent>
              </div>

              {/* Action Buttons Row */}
              <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t bg-muted/20 p-3.5">
                <div className="flex items-center gap-2">
                  <EditRegistrationModal
                    registration={reg}
                    event={ev}
                    onSuccess={handleRegistrationUpdated}
                    onCancel={() => {
                      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
                    }}
                    triggerButton={
                      isPending ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-amber-500/40 text-amber-700 text-xs hover:bg-amber-500/10 dark:text-amber-300"
                        >
                          <Edit3 className="size-3.5 text-amber-600 dark:text-amber-400" />
                          Edit Responses
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                        >
                          <FileText className="size-3.5" />
                          View Responses
                        </Button>
                      )
                    }
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 gap-1 text-muted-foreground text-xs hover:text-foreground"
                  >
                    <Link href={`/dashboard/member/events/${reg.event_id}`}>Details →</Link>
                  </Button>

                  {!isEventPast(ev) && reg.status !== "attended" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCancellingRegistration(reg)}
                    >
                      <UserX className="size-3.5" />
                      Cancel RSVP
                    </Button>
                  )}
                </div>

                {ev?.url && (
                  <Button variant="outline" size="sm" asChild className="h-8 gap-1 text-xs">
                    <a href={ev.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      Bevy
                    </a>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">My Events & RSVPs 🎟️</h1>
          <p className="text-muted-foreground text-sm">
            Manage GDG Jakarta events you registered for. Edit your form inputs anytime before applications are approved
            or rejected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium text-xs">
            {totalCount} Total Registered
          </Badge>
        </div>
      </div>

      {/* ── Summary Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <p className="text-[11px] text-muted-foreground">Total Applications</p>
          <p className="font-bold text-foreground text-xl">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Pending Review</p>
            <Badge variant="outline" className="h-4 border-amber-500/40 px-1 font-normal text-[9px] text-amber-600">
              Editable
            </Badge>
          </div>
          <p className="font-bold text-amber-700 text-xl dark:text-amber-300">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-2xs">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Confirmed / Approved</p>
          <p className="font-bold text-emerald-700 text-xl dark:text-emerald-300">{approvedCount}</p>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 shadow-2xs">
          <p className="text-[11px] text-purple-700 dark:text-purple-300">Attended</p>
          <p className="font-bold text-purple-700 text-xl dark:text-purple-300">{attendedCount}</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by event title or track..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[170px] text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({totalCount})</SelectItem>
              <SelectItem value="pending">Pending Review ({pendingCount})</SelectItem>
              <SelectItem value="approved">Approved ({approvedCount})</SelectItem>
              <SelectItem value="attended">Attended ({attendedCount})</SelectItem>
              <SelectItem value="rejected">Not Selected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Tabs (All / Upcoming / Past) ──────────────────────────────── */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-[420px]">
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
            All ({filteredRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 text-xs sm:text-sm">
            Upcoming ({upcomingRegs.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5 text-xs sm:text-sm">
            Past & Attended ({pastRegs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderRegistrationGrid(filteredRegistrations)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {renderRegistrationGrid(upcomingRegs)}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {renderRegistrationGrid(pastRegs)}
        </TabsContent>
      </Tabs>

      {cancellingRegistration && (
        <CancelRegistrationDialog
          open={Boolean(cancellingRegistration)}
          onOpenChange={(open) => !open && setCancellingRegistration(null)}
          registration={cancellingRegistration}
          event={eventMap.get(String(cancellingRegistration.event_id))}
          onSuccess={() => {
            const cancelledId = cancellingRegistration.id;
            setRegistrations((prev) => prev.filter((r) => r.id !== cancelledId));
            setCancellingRegistration(null);
          }}
        />
      )}
    </div>
  );
}

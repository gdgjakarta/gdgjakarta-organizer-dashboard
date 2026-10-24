"use client";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  GripVertical,
  Link2,
  Plus,
  Presentation,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BevySpeaker } from "@/lib/bevy/types";
import {
  findSpeakerByNameOrRole,
  getSpeakerAvatar,
  getSpeakerFullName,
  getSpeakerRole,
  normalizeStr,
} from "@/lib/events/agenda-unification";
import type { EventPresentationSlide } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface AgendaActivityOption {
  id: string;
  time: string;
  activity: string;
  speakerName: string;
  speakerRole?: string;
  speakerAvatar?: string;
  description?: string;
}

interface SortableSlideDeckCardProps {
  slide: EventPresentationSlide;
  index: number;
  totalSlides: number;
  agendaActivities?: AgendaActivityOption[];
  speakers?: BevySpeaker[];
  onUpdate: (id: string, updates: Partial<EventPresentationSlide>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddRelatedLink: (slideId: string) => void;
  onUpdateRelatedLink: (slideId: string, linkIndex: number, field: "title" | "url", val: string) => void;
  onRemoveRelatedLink: (slideId: string, linkIndex: number) => void;
}

export function SortableSlideDeckCard({
  slide,
  index,
  totalSlides,
  agendaActivities,
  speakers,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddRelatedLink,
  onUpdateRelatedLink,
  onRemoveRelatedLink,
}: SortableSlideDeckCardProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id: slide.id,
    index,
    type: "presentation-slide",
    accept: "presentation-slide",
    group: "presentation-slides",
    modifiers: [RestrictToVerticalAxis],
  });

  const links = slide.related_links ?? [];

  const matchedActivity = agendaActivities?.find((act) => {
    if (slide.agenda_activity_id) {
      return slide.agenda_activity_id === act.id;
    }
    return normalizeStr(slide.title) === normalizeStr(act.activity);
  });

  // Resolve Bevy Speaker metadata if bound
  const matchedSpeaker = findSpeakerByNameOrRole(slide.speaker_name ?? "", speakers);
  const speakerFullName = matchedSpeaker ? getSpeakerFullName(matchedSpeaker) : slide.speaker_name?.trim();
  const speakerAvatar = matchedSpeaker ? getSpeakerAvatar(matchedSpeaker) : undefined;
  const speakerRole = matchedSpeaker ? getSpeakerRole(matchedSpeaker) : undefined;
  const isSpeakerBoundToBevy = Boolean(matchedSpeaker);

  // Both agenda activity and speaker are bound
  const isFullySynchronized = Boolean(matchedActivity && slide.speaker_name?.trim());

  return (
    <Card
      ref={ref}
      className={cn(
        "border-border/70 bg-card/60 p-4 shadow-2xs transition-all",
        isDragging &&
          "relative z-30 scale-[1.008] border-primary bg-primary/5 opacity-80 shadow-md ring-2 ring-primary/40",
      )}
    >
      <div className="space-y-4">
        {/* Header: Drag Handle, Numbering, Title, Agenda Linking, Controls & Remove */}
        <div className="flex flex-col gap-2 border-border/50 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Draggable Handle */}
            <Button
              ref={handleRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 cursor-grab text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              title="Drag to reorder presentation slides"
              aria-label={`Drag to reorder slide ${index + 1}`}
            >
              <GripVertical className="size-4" />
            </Button>

            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
              {index + 1}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="font-semibold text-foreground text-sm max-w-[280px] sm:max-w-[340px] truncate"
                title={slide.title}
              >
                {slide.title}
              </span>
              {Boolean(matchedActivity ?? slide.time_slot) && (
                <Badge
                  variant="outline"
                  className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400 shrink-0"
                >
                  <Clock className="size-3" />
                  <span>{slide.time_slot ?? matchedActivity?.time} • Agenda</span>
                </Badge>
              )}
              {agendaActivities && agendaActivities.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0 gap-1"
                    >
                      <Calendar className="size-3 text-primary" />
                      <span>{matchedActivity ? "Rebind Agenda" : "Bind to Agenda"}</span>
                      <ChevronDown className="size-2.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-80 max-h-64 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Bind to Bevy Agenda Activity</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {agendaActivities.map((act) => {
                      const isSelected =
                        act.id === slide.agenda_activity_id || normalizeStr(act.activity) === normalizeStr(slide.title);
                      return (
                        <DropdownMenuItem
                          key={act.id}
                          onClick={() => {
                            onUpdate(slide.id, {
                              title: act.activity,
                              time_slot: act.time,
                              speaker_name: act.speakerName || slide.speaker_name,
                              agenda_activity_id: act.id,
                            });
                          }}
                          className={cn(
                            "flex flex-col items-start gap-0.5 py-1.5 cursor-pointer",
                            isSelected && "bg-muted/80 font-medium",
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-xs truncate">{act.activity}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{act.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5 w-full">
                            {act.speakerName ? (
                              <span className="text-[10px] text-primary truncate">Speaker: {act.speakerName}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">No speaker assigned in agenda</span>
                            )}
                            {isSelected && (
                              <Badge
                                variant="secondary"
                                className="ml-auto text-[9px] h-3.5 px-1 bg-emerald-500/15 text-emerald-600"
                              >
                                Current
                              </Badge>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {/* Move Up / Move Down Controls */}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              title="Move slide up"
              aria-label="Move slide up"
            >
              <ChevronUp className="size-3.5" />
            </Button>

            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSlides - 1}
              title="Move slide down"
              aria-label="Move slide down"
            >
              <ChevronDown className="size-3.5" />
            </Button>

            {slide.slides_url && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary">
                <Presentation className="size-3" />
                Slides Attached
              </Badge>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(slide.id)}
              title="Remove slide deck"
              aria-label="Remove slide deck"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Binding Connection Status Indicator */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Agenda Binding Status */}
              {matchedActivity ? (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 font-medium text-blue-700 text-[11px] dark:text-blue-300">
                  <Calendar className="size-3 text-blue-600 dark:text-blue-400" />
                  <span className="truncate max-w-[200px] sm:max-w-[260px]">Agenda: {matchedActivity.activity}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 text-[11px] dark:text-amber-300">
                  <span>No agenda item bound</span>
                </div>
              )}

              <span className="text-muted-foreground text-[10px]">⟷</span>

              {/* Speaker Binding Status */}
              {speakerFullName ? (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-[11px] dark:text-emerald-300">
                  {speakerAvatar ? (
                    <Avatar className="size-3.5 rounded-full">
                      <AvatarImage src={speakerAvatar} alt={speakerFullName} />
                      <AvatarFallback className="text-[8px]">
                        {speakerFullName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="size-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="truncate max-w-[180px]">Speaker: {speakerFullName}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-[11px]">
                  <span>No speaker attached</span>
                </div>
              )}
            </div>

            {/* Synchronized Badge */}
            {isFullySynchronized ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0"
              >
                <CheckCircle2 className="size-3" />
                <span>Bound & Synchronized</span>
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {!matchedActivity ? "Link to an agenda activity above" : "Bind a speaker below"}
              </span>
            )}
          </div>
        </div>

        {/* Speaker & Slides Form Inputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel className="text-xs">Speaker Name</FieldLabel>
              {speakers && speakers.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                    >
                      <UserCheck className="size-3" />
                      <span>{isSpeakerBoundToBevy ? "Change Bevy Speaker" : "Select Bevy Speaker"}</span>
                      <ChevronDown className="size-2.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-h-72 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Bind Bevy Speaker ({speakers.length})</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {speakers.map((spk) => {
                      const fullName = getSpeakerFullName(spk);
                      const roleInfo = getSpeakerRole(spk);
                      const avatarUrl = getSpeakerAvatar(spk);
                      const isSelected = Boolean(
                        slide.speaker_name && normalizeStr(slide.speaker_name) === normalizeStr(fullName),
                      );
                      const isAgendaMatch = Boolean(
                        matchedActivity?.speakerName &&
                          normalizeStr(matchedActivity.speakerName) === normalizeStr(fullName),
                      );

                      return (
                        <DropdownMenuItem
                          key={spk.id ?? fullName}
                          onClick={() => onUpdate(slide.id, { speaker_name: fullName })}
                          className={cn(
                            "cursor-pointer text-xs flex items-center gap-2.5 py-2",
                            isSelected && "bg-muted font-medium",
                          )}
                        >
                          <Avatar className="size-8 rounded-lg shrink-0 border border-border/60">
                            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
                            <AvatarFallback className="rounded-lg bg-primary/10 font-bold text-primary text-[10px]">
                              {(fullName || "SP").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-xs text-foreground truncate">{fullName}</span>
                              {isSelected ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] h-4 px-1.5 bg-emerald-500/15 text-emerald-600 shrink-0"
                                >
                                  ✓ Selected
                                </Badge>
                              ) : isAgendaMatch ? (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1.5 border-blue-500/30 text-blue-600 shrink-0"
                                >
                                  Agenda Match
                                </Badge>
                              ) : null}
                            </div>
                            {roleInfo && <p className="text-[10px] text-muted-foreground truncate">{roleInfo}</p>}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                    {slide.speaker_name && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onUpdate(slide.id, { speaker_name: "" })}
                          className="cursor-pointer text-xs text-destructive flex items-center gap-1.5 py-1.5"
                        >
                          <X className="size-3" />
                          <span>Clear / Unbind Speaker</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="relative">
              <User className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={slide.speaker_name ?? ""}
                onChange={(e) => onUpdate(slide.id, { speaker_name: e.target.value })}
                placeholder="e.g. John Doe"
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Rich Bound Speaker Card */}
            {isSpeakerBoundToBevy && matchedSpeaker && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-7 rounded-lg shrink-0 border border-border/50">
                    {speakerAvatar && <AvatarImage src={speakerAvatar} alt={speakerFullName} />}
                    <AvatarFallback className="rounded-lg bg-emerald-500/15 text-[10px] font-bold text-emerald-600">
                      {(speakerFullName || "SP").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-foreground truncate">{speakerFullName}</span>
                      <Badge
                        variant="outline"
                        className="h-4 border-emerald-500/40 bg-emerald-500/15 px-1 text-[9px] text-emerald-600 dark:text-emerald-400"
                      >
                        ✓ Bevy Speaker
                      </Badge>
                    </div>
                    {speakerRole && <p className="text-[10px] text-muted-foreground truncate">{speakerRole}</p>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onUpdate(slide.id, { speaker_name: "" })}
                  title="Unbind speaker"
                >
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel className="text-xs">Slides Display Title</FieldLabel>
            <Input
              value={slide.slides_title ?? ""}
              onChange={(e) => onUpdate(slide.id, { slides_title: e.target.value })}
              placeholder="e.g. Download Slide Deck (Google Slides)"
              className="h-8 text-xs"
            />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel className="text-xs">Presentation Slides URL</FieldLabel>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Presentation className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={slide.slides_url ?? ""}
                  onChange={(e) => onUpdate(slide.id, { slides_url: e.target.value })}
                  placeholder="https://docs.google.com/presentation/d/... or https://speakerdeck.com/..."
                  className="h-8 pl-8 font-mono text-xs"
                />
              </div>
              {slide.slides_url && (
                <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1 text-xs">
                  <a href={slide.slides_url} target="_blank" rel="noopener noreferrer">
                    <span>Test Link</span>
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>
          </Field>
        </div>

        {/* Related Resource Links Sub-List */}
        <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
              <Link2 className="size-3 text-primary" />
              <span>Additional Resource Links (Codelabs, Repositories, Documentation)</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-[11px] text-primary hover:bg-primary/5"
              onClick={() => onAddRelatedLink(slide.id)}
            >
              <Plus className="size-3" />
              Add Link
            </Button>
          </div>

          {links.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No extra links attached.</p>
          ) : (
            <div className="space-y-2">
              {links.map((link, lIdx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: order of inputs corresponds to array indices
                <div key={`${link.url}-${lIdx}`} className="flex items-center gap-2">
                  <Input
                    value={link.title}
                    onChange={(e) => onUpdateRelatedLink(slide.id, lIdx, "title", e.target.value)}
                    placeholder="Link Title (e.g. GitHub Repository)"
                    className="h-7 w-1/3 text-xs"
                  />
                  <Input
                    value={link.url}
                    onChange={(e) => onUpdateRelatedLink(slide.id, lIdx, "url", e.target.value)}
                    placeholder="https://github.com/..."
                    className="h-7 flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveRelatedLink(slide.id, lIdx)}
                    title="Remove link"
                    aria-label="Remove link"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

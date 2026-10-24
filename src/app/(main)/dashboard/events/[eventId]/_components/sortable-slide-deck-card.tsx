"use client";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Calendar,
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
} from "lucide-react";

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
import { normalizeStr } from "@/lib/events/agenda-unification";
import type { EventPresentationSlide } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface AgendaActivityOption {
  id: string;
  time: string;
  activity: string;
  speakerName: string;
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
                  <DropdownMenuContent align="start" className="w-72 max-h-60 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Bind to Bevy Agenda Activity</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {agendaActivities.map((act) => (
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
                        className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-xs truncate">{act.activity}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{act.time}</span>
                        </div>
                        {act.speakerName && (
                          <span className="text-[10px] text-muted-foreground">Speaker: {act.speakerName}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
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
                      className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                    >
                      Select Bevy Speaker
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-56 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Bind Bevy Speaker</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {speakers.map((spk) => (
                      <DropdownMenuItem
                        key={spk.id ?? spk.full_name}
                        onClick={() => onUpdate(slide.id, { speaker_name: spk.full_name })}
                        className="cursor-pointer text-xs flex flex-col items-start gap-0.5"
                      >
                        <span className="font-medium">{spk.full_name}</span>
                        {spk.title && <span className="text-[10px] text-muted-foreground truncate">{spk.title}</span>}
                      </DropdownMenuItem>
                    ))}
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

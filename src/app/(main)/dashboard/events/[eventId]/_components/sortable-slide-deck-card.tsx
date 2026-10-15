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
import { normalizeStr } from "@/lib/events/agenda-unification";
import type { EventSession } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface AgendaActivityOption {
  id: string;
  time: string;
  activity: string;
  speakerName: string;
  description?: string;
}

interface SortableSlideDeckCardProps {
  session: EventSession;
  index: number;
  totalSessions: number;
  agendaActivities?: AgendaActivityOption[];
  onUpdate: (id: string, updates: Partial<EventSession>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddRelatedLink: (sessionId: string) => void;
  onUpdateRelatedLink: (sessionId: string, linkIndex: number, field: "title" | "url", val: string) => void;
  onRemoveRelatedLink: (sessionId: string, linkIndex: number) => void;
}

export function SortableSlideDeckCard({
  session: sess,
  index,
  totalSessions,
  agendaActivities,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddRelatedLink,
  onUpdateRelatedLink,
  onRemoveRelatedLink,
}: SortableSlideDeckCardProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id: sess.id,
    index,
    type: "session-slide",
    accept: "session-slide",
    group: "session-slides",
    modifiers: [RestrictToVerticalAxis],
  });

  const links = sess.related_links ?? [];

  const matchedActivity = agendaActivities?.find((act) => {
    if (sess.agenda_activity_id) {
      return sess.agenda_activity_id === act.id;
    }
    return normalizeStr(sess.title) === normalizeStr(act.activity);
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
        {/* Session Header: Drag Handle, Numbering, Title, Move Controls, Status Badge & Delete */}
        <div className="flex flex-col gap-2 border-border/50 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Draggable Handle */}
            <Button
              ref={handleRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 cursor-grab text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              title="Drag to reorder slide deck session"
              aria-label={`Drag to reorder session ${index + 1}`}
            >
              <GripVertical className="size-4" />
            </Button>

            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
              {index + 1}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                value={sess.title}
                onChange={(e) => onUpdate(sess.id, { title: e.target.value })}
                placeholder="Session Title (e.g. Building Agents with Gemini)"
                className="h-8 max-w-[280px] sm:max-w-[320px] font-semibold text-sm"
              />
              {Boolean(matchedActivity ?? sess.time_slot) && (
                <Badge
                  variant="outline"
                  className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400 shrink-0"
                >
                  <Clock className="size-3" />
                  <span>{sess.time_slot ?? matchedActivity?.time} • Agenda</span>
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
                      <span>{matchedActivity ? "Re-link" : "Link to Agenda"}</span>
                      <ChevronDown className="size-2.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 max-h-60 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Link to Agenda Activity</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {agendaActivities.map((act) => (
                      <DropdownMenuItem
                        key={act.id}
                        onClick={() => {
                          onUpdate(sess.id, {
                            title: act.activity,
                            time_slot: act.time,
                            speaker_name: act.speakerName || sess.speaker_name,
                            description: act.description || sess.description,
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
              title="Move session up"
              aria-label="Move session up"
            >
              <ChevronUp className="size-3.5" />
            </Button>

            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSessions - 1}
              title="Move session down"
              aria-label="Move session down"
            >
              <ChevronDown className="size-3.5" />
            </Button>

            {sess.slides_url && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary">
                <Presentation className="size-3" />
                Slides Attached
              </Badge>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(sess.id)}
              title="Remove session"
              aria-label="Remove session"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Speaker & Slides Form Inputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel className="text-xs">Speaker Name</FieldLabel>
            <div className="relative">
              <User className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={sess.speaker_name ?? ""}
                onChange={(e) => onUpdate(sess.id, { speaker_name: e.target.value })}
                placeholder="e.g. John Doe, Senior DevRel"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </Field>

          <Field>
            <FieldLabel className="text-xs">Slides Display Title</FieldLabel>
            <Input
              value={sess.slides_title ?? ""}
              onChange={(e) => onUpdate(sess.id, { slides_title: e.target.value })}
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
                  value={sess.slides_url ?? ""}
                  onChange={(e) => onUpdate(sess.id, { slides_url: e.target.value })}
                  placeholder="https://docs.google.com/presentation/d/... or https://speakerdeck.com/..."
                  className="h-8 pl-8 font-mono text-xs"
                />
              </div>
              {sess.slides_url && (
                <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1 text-xs">
                  <a href={sess.slides_url} target="_blank" rel="noopener noreferrer">
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
              onClick={() => onAddRelatedLink(sess.id)}
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
                    onChange={(e) => onUpdateRelatedLink(sess.id, lIdx, "title", e.target.value)}
                    placeholder="Link Title (e.g. GitHub Repository)"
                    className="h-7 w-1/3 text-xs"
                  />
                  <Input
                    value={link.url}
                    onChange={(e) => onUpdateRelatedLink(sess.id, lIdx, "url", e.target.value)}
                    placeholder="https://github.com/..."
                    className="h-7 flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveRelatedLink(sess.id, lIdx)}
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

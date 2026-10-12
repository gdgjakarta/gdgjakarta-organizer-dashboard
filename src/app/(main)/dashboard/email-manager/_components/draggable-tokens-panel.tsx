"use client";

import { Calendar, Code, GripVertical, Sparkles, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DraggableTokenItem {
  id: string;
  tag: string;
  label: string;
  description: string;
  snippet?: string;
}

export const EVENT_DATA_TOKENS: DraggableTokenItem[] = [
  { id: "event_name", tag: "[[EventName]]", label: "Event Title", description: "Name/title of the published event" },
  { id: "event_date", tag: "[[EventDate]]", label: "Event Date", description: "e.g. Friday, Oct 23, 2026" },
  { id: "event_time", tag: "[[EventTime]]", label: "Event Time", description: "e.g. 10:00 AM" },
  { id: "event_venue", tag: "[[EventVenue]]", label: "Venue Location", description: "Venue name and city" },
  { id: "event_address", tag: "[[EventAddress]]", label: "Venue Address", description: "Full street address" },
  { id: "event_url", tag: "[[EventUrl]]", label: "Event Link", description: "URL to the event details page" },
  {
    id: "event_banner",
    tag: "[[EventBannerUrl]]",
    label: "Banner Image URL",
    description: "Direct link to event cover banner",
  },
  { id: "event_desc", tag: "[[EventDescription]]", label: "Description", description: "Brief overview of the event" },
];

export const ATTENDEE_DATA_TOKENS: DraggableTokenItem[] = [
  { id: "name", tag: "[[Name]]", label: "Full Name", description: "Attendee's full name" },
  { id: "first_name", tag: "[[FirstName]]", label: "First Name", description: "Attendee's first name" },
  { id: "last_name", tag: "[[LastName]]", label: "Last Name", description: "Attendee's last name or family name" },
  { id: "email", tag: "[[Email]]", label: "Email Address", description: "Recipient's email address" },
  {
    id: "ticket_type",
    tag: "[[TicketType]]",
    label: "Ticket Category",
    description: "e.g. In-Person Ticket, VIP Pass",
  },
  {
    id: "checkin_status",
    tag: "[[CheckinStatus]]",
    label: "Check-in Status",
    description: "Checked In or Not Checked In",
  },
];

export const PREBUILT_HTML_BLOCKS: DraggableTokenItem[] = [
  {
    id: "block_event_box",
    tag: "Event Details Card",
    label: "Event Details Card",
    description: "Responsive card displaying date, time, and venue location",
    snippet: `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">📅 [[EventName]]</h3>
  <p style="margin: 6px 0; font-size: 14px; color: #475569;"><strong>Date & Time:</strong> [[EventDate]] at [[EventTime]]</p>
  <p style="margin: 6px 0; font-size: 14px; color: #475569;"><strong>Location:</strong> [[EventVenue]]</p>
</div>`,
  },
  {
    id: "block_cta_button",
    tag: "RSVP Action Button",
    label: "RSVP Action Button",
    description: "Google Blue call-to-action button linking to the event page",
    snippet: `<div style="text-align: center; margin: 24px 0;">
  <a href="[[EventUrl]]" style="background-color: #1a73e8; color: #ffffff; padding: 12px 26px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
    View Event & RSVP &rarr;
  </a>
</div>`,
  },
  {
    id: "block_ticket_badge",
    tag: "Attendee Ticket Pass",
    label: "Attendee Ticket Pass",
    description: "Highlighted badge with attendee name and ticket type",
    snippet: `<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #2563eb; padding: 14px; border-radius: 6px; margin: 16px 0;">
  <div style="font-size: 11px; color: #1e40af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Confirmed Ticket Pass</div>
  <div style="font-size: 15px; font-weight: 700; color: #1e3a8a; margin-top: 4px;">[[Name]] &bull; [[TicketType]]</div>
</div>`,
  },
  {
    id: "block_footer_bubble",
    tag: "Footer Bubble Logo",
    label: "Footer Bubble Logo",
    description: "GDG Jakarta bubble logo footer block",
    snippet: `<div class="center">
  <div class="footer">
    <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
  </div>
</div>`,
  },
];

interface DraggableTokensPanelProps {
  onInsertToken: (tokenOrSnippet: string) => void;
  className?: string;
}

export function DraggableTokensPanel({ onInsertToken, className }: DraggableTokensPanelProps) {
  const handleDragStart = (e: React.DragEvent<HTMLElement>, content: string) => {
    e.dataTransfer.setData("text/plain", content);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card/60 p-3 shadow-xs", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-amber-500" />
          <span className="font-semibold text-foreground text-xs tracking-tight">Template Tokens &amp; Components</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Drag &amp; drop into editor or click to insert</span>
      </div>

      <Tabs defaultValue="event" className="w-full">
        <TabsList className="grid h-8 w-full grid-cols-3">
          <TabsTrigger value="event" className="gap-1 text-[11px]">
            <Calendar className="size-3 text-sky-500" />
            Event Data
          </TabsTrigger>
          <TabsTrigger value="attendee" className="gap-1 text-[11px]">
            <User className="size-3 text-emerald-500" />
            Attendee Data
          </TabsTrigger>
          <TabsTrigger value="blocks" className="gap-1 text-[11px]">
            <Code className="size-3 text-indigo-500" />
            HTML Blocks
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Event Data Tokens */}
        <TabsContent value="event" className="mt-2.5 space-y-1.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EVENT_DATA_TOKENS.map((token) => (
              <button
                type="button"
                key={token.id}
                draggable
                onDragStart={(e) => handleDragStart(e, token.tag)}
                onClick={() => onInsertToken(token.tag)}
                title={`${token.description} (Drag to editor or click to insert)`}
                className="group flex cursor-grab items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/5 px-2 py-1.5 text-left transition-all hover:border-sky-500/40 hover:bg-sky-500/10 active:cursor-grabbing"
              >
                <GripVertical className="size-3 text-sky-500/50 group-hover:text-sky-500" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-[11px] text-sky-700 dark:text-sky-300">{token.label}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{token.tag}</span>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Attendee Data Tokens */}
        <TabsContent value="attendee" className="mt-2.5 space-y-1.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ATTENDEE_DATA_TOKENS.map((token) => (
              <button
                type="button"
                key={token.id}
                draggable
                onDragStart={(e) => handleDragStart(e, token.tag)}
                onClick={() => onInsertToken(token.tag)}
                title={`${token.description} (Drag to editor or click to insert)`}
                className="group flex cursor-grab items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 active:cursor-grabbing"
              >
                <GripVertical className="size-3 text-emerald-500/50 group-hover:text-emerald-500" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                    {token.label}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">{token.tag}</span>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Pre-built HTML Blocks */}
        <TabsContent value="blocks" className="mt-2.5 space-y-1.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PREBUILT_HTML_BLOCKS.map((block) => (
              <button
                type="button"
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block.snippet || block.tag)}
                onClick={() => onInsertToken(block.snippet || block.tag)}
                title={`${block.description} (Drag to editor or click to insert)`}
                className="group flex cursor-grab items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-2 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 active:cursor-grabbing"
              >
                <GripVertical className="size-3.5 text-indigo-500/50 group-hover:text-indigo-500" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                      {block.label}
                    </span>
                    <Badge variant="outline" className="px-1 py-0 text-[9px]">
                      HTML
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{block.description}</span>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

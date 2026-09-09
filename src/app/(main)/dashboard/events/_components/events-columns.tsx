"use client";
import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { parse } from "date-fns";
import { ExternalLink, Globe, MapPin, MoreHorizontal, Radio, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn, getInitials } from "@/lib/utils";

import { type EventRow, eventStatusMeta } from "./data";

function StatusBadge({ status }: { status: EventRow["status"] }) {
  const meta = eventStatusMeta[status] || eventStatusMeta.Published;

  return (
    <Badge className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

function AudienceBadge({ audienceType }: { audienceType: string }) {
  if (audienceType === "VIRTUAL") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <Radio className="size-3" /> Virtual
      </Badge>
    );
  }
  if (audienceType === "HYBRID") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
      >
        <Globe className="size-3" /> Hybrid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <MapPin className="size-3" /> In-Person
    </Badge>
  );
}

export const eventsColumns: ColumnDef<DataTableFeatures, EventRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Subscribe
          source={table.atoms.rowSelection}
          selector={() =>
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
          }
        >
          {(checked) => (
            <Checkbox
              aria-label="Select all events"
              checked={checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            />
          )}
        </Subscribe>
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
          {(checked) => (
            <Checkbox
              aria-label={`Select ${row.original.title}`}
              checked={checked}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
          )}
        </Subscribe>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
  {
    id: "search",
    accessorFn: (row) => `${row.title} ${row.eventType} ${row.tags.join(" ")}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="rounded-md after:rounded-md">
          {row.original.pictureUrl ? (
            <AvatarImage src={row.original.pictureUrl} alt={row.original.title} className="rounded-md" />
          ) : null}
          <AvatarFallback className="rounded-md bg-primary/10 text-primary">
            {getInitials(row.original.title)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 max-w-[340px]">
          <Link
            href={`/dashboard/events/${row.original.id}`}
            className="truncate font-medium text-foreground text-sm hover:underline"
            title={row.original.title}
          >
            {row.original.title}
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="truncate">{row.original.eventType}</span>
            {row.original.tags.length > 0 && (
              <>
                <span>•</span>
                <span className="truncate">{row.original.tags.slice(0, 2).join(", ")}</span>
              </>
            )}
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "audienceType",
    header: "Format",
    filterFn: "equalsString",
    cell: ({ row }) => <AudienceBadge audienceType={row.original.audienceType} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue === "All") return true;
      if (filterValue === "Upcoming") return row.original.isUpcoming;
      if (filterValue === "Past") return !row.original.isUpcoming;
      return row.getValue(columnId) === filterValue;
    },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <StatusBadge status={row.original.status} />
        {row.original.isUpcoming ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            Upcoming
          </Badge>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "totalAttendees",
    header: "Attendees / Check-in",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm">
        <Users className="size-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{row.original.totalAttendees}</span>
        {row.original.checkinCount > 0 && (
          <span className="text-muted-foreground text-xs">({row.original.checkinCount} checked in)</span>
        )}
      </div>
    ),
  },
  {
    id: "startDate",
    accessorFn: (row) => {
      try {
        return parse(row.startDate, "dd MMM yyyy, h:mm a", new Date()).getTime();
      } catch {
        return 0;
      }
    },
    header: "Date & Time",
    cell: ({ row }) => (
      <div className="text-xs">
        <div className="font-medium text-foreground">{row.original.startDate}</div>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open actions for ${row.original.title}`}
              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={row.original.url || "https://gdg.community.dev/gdg-jakarta/"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 size-3.5" />
                Manage in Bevy
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
];

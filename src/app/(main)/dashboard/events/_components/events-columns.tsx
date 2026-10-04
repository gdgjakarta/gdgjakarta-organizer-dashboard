"use client";
import * as React from "react";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { parse } from "date-fns";
import { Calendar, ExternalLink, Globe, MapPin, MoreHorizontal, Radio, Users } from "lucide-react";

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
import { getBevyManageEventUrl } from "@/config/remote-config-utils";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";

import { type EventRow, eventStatusMeta } from "./data";

function StatusBadge({ status }: { status: EventRow["status"] }) {
  const meta = eventStatusMeta[status] || eventStatusMeta.Published;

  return (
    <Badge className={cn("shrink-0 gap-1.5 border px-2 py-0.5 font-medium text-xs", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

function AudienceBadge({ audienceType }: { audienceType: string }) {
  if (audienceType === "VIRTUAL") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      >
        <Radio className="size-3" /> Virtual
      </Badge>
    );
  }
  if (audienceType === "HYBRID") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
      >
        <Globe className="size-3" /> Hybrid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <MapPin className="size-3" /> In-Person
    </Badge>
  );
}

function EventThumbnail({ src, title }: { src?: string; title: string }) {
  const [hasError, setHasError] = React.useState(false);

  return (
    <Avatar key={src} size="lg" className="shrink-0 rounded-md border border-border/40 bg-muted/40 after:rounded-md">
      {src && !hasError ? (
        <AvatarImage src={src} alt={title} className="rounded-md object-cover" onError={() => setHasError(true)} />
      ) : null}
      <AvatarFallback className="rounded-md bg-muted/60 text-muted-foreground">
        <Calendar className="size-4.5 text-muted-foreground/60" />
      </AvatarFallback>
    </Avatar>
  );
}

function DropRateBadge({
  totalAttendees,
  checkinCount,
  isUpcoming,
}: {
  totalAttendees: number;
  checkinCount: number;
  isUpcoming: boolean;
}) {
  if (totalAttendees <= 0 || (isUpcoming && checkinCount === 0)) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const dropped = Math.max(0, totalAttendees - checkinCount);
  const dropRate = (dropped / totalAttendees) * 100;
  const formattedRate = `${dropRate % 1 === 0 ? dropRate.toFixed(0) : dropRate.toFixed(1)}%`;

  let badgeStyle = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (dropRate > 60) {
    badgeStyle = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (dropRate > 35) {
    badgeStyle = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Badge variant="outline" className={cn("shrink-0 px-1.5 py-0 font-medium text-xs tabular-nums", badgeStyle)}>
        {formattedRate}
      </Badge>
      <span className="text-muted-foreground text-xs tabular-nums">({dropped} no-show)</span>
    </div>
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
    accessorFn: (row) => `${row.title} ${row.eventType} ${row.tags.join(" ")} ${row.isTest ? "test" : ""}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <EventThumbnail src={row.original.pictureUrl} title={row.original.title} />
        <div className="min-w-0 max-w-md overflow-hidden lg:max-w-xl">
          <Link
            href={`/dashboard/events/${row.original.id}`}
            className="block truncate font-medium text-foreground text-sm hover:underline"
            title={row.original.title}
          >
            {row.original.title}
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="min-w-0 truncate">{row.original.eventType}</span>
            {row.original.tags.length > 0 && (
              <>
                <span className="shrink-0">•</span>
                <span className="min-w-0 truncate">{row.original.tags.slice(0, 2).join(", ")}</span>
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
      if (filterValue === "Test") return Boolean(row.original.isTest);
      if (filterValue === "Published")
        return row.original.status === "Published" || row.original.status === "Completed";
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
        {row.original.isTest ? (
          <Badge
            variant="outline"
            className="border-purple-500/20 bg-purple-500/10 px-1.5 py-0 text-[10px] text-purple-600 dark:text-purple-400"
          >
            Test
          </Badge>
        ) : null}
        {row.original.isHidden ? (
          <Badge
            variant="outline"
            className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
          >
            Hidden
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
    id: "dropRate",
    accessorFn: (row) => {
      if (row.totalAttendees <= 0 || (row.isUpcoming && row.checkinCount === 0)) return -1;
      const dropped = Math.max(0, row.totalAttendees - row.checkinCount);
      return (dropped / row.totalAttendees) * 100;
    },
    header: "Drop Rate",
    cell: ({ row }) => (
      <DropRateBadge
        totalAttendees={row.original.totalAttendees}
        checkinCount={row.original.checkinCount}
        isUpcoming={row.original.isUpcoming}
      />
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
                href={
                  row.original.id
                    ? getBevyManageEventUrl(row.original.id)
                    : row.original.url || "https://gdg.community.dev/gdg-jakarta/"
                }
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

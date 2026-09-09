"use client";
import * as React from "react";
import { useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { Download, ExternalLink, Grid, RefreshCw, Rows3, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";
import { triggerEventsSyncAction } from "@/server/firestore-actions";

import { type EventRow, eventFilters } from "./data";
import { eventsColumns } from "./events-columns";
import { EventsTable } from "./events-table";

function getAudienceLabel(option: string) {
  if (option === "IN_PERSON") return "In-Person";
  if (option === "VIRTUAL") return "Virtual";
  if (option === "HYBRID") return "Hybrid";
  return option;
}

export function Events({ events, totalCount }: { events: EventRow[]; totalCount?: number }) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "startDate", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useTable({
    features: dataTableFeatures,
    data: events,
    columns: eventsColumns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => String(row.id),
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? eventFilters.status[0];
  const eventTypeFilter =
    (table.getColumn("eventType")?.getFilterValue() as string | undefined) ?? eventFilters.eventType[0];
  const audienceFilter =
    (table.getColumn("audienceType")?.getFilterValue() as string | undefined) ?? eventFilters.audienceType[0];

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSyncFromBevy = () => {
    startTransition(async () => {
      toast.loading("Syncing events from Bevy...", { id: "sync-bevy" });
      try {
        const result = await triggerEventsSyncAction();
        if (result.success) {
          toast.success(`Successfully synced ${result.totalSynced} events into Firestore!`, { id: "sync-bevy" });
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to sync events.", { id: "sync-bevy" });
        }
      } catch (_err) {
        toast.error("An unexpected error occurred during sync.", { id: "sync-bevy" });
      }
    });
  };

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const countToDisplay = totalCount ?? events.length;

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="text-xl leading-none">
          Events <span className="font-normal text-muted-foreground">({countToDisplay.toLocaleString()})</span>
        </CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Manage and monitor GDG Jakarta meetups, devlabs, and conferences.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
            <InputGroupAddon align="inline-end">
              <Kbd className="h-4 text-[10px]">⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" size="sm" onClick={handleSyncFromBevy} disabled={isPending} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
            {isPending ? "Syncing..." : "Sync Bevy"}
          </Button>
          <Button variant="outline" size="sm">
            <SlidersHorizontal /> Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download /> Export
          </Button>
          <Button size="sm" asChild>
            <a
              href="https://gdg.community.dev/gdg-jakarta/"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5"
            >
              <ExternalLink className="size-3.5" />
              Create in Bevy
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={(value) => setColumnSelectFilter("status", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Status:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {eventFilters.status.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={audienceFilter} onValueChange={(value) => setColumnSelectFilter("audienceType", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Format:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {eventFilters.audienceType.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getAudienceLabel(option)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={eventTypeFilter} onValueChange={(value) => setColumnSelectFilter("eventType", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Type:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {eventFilters.eventType.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4">
          <div className="text-muted-foreground text-sm tabular-nums">{selectedCount} selected</div>

          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list" aria-label="List view">
                <Rows3 />
              </TabsTrigger>
              <TabsTrigger value="grid" aria-label="Grid view">
                <Grid />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <EventsTable table={table} />
      </CardContent>
    </Card>
  );
}

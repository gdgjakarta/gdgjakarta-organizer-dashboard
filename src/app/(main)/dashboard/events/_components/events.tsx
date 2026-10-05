"use client";
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";
import { dataTableFeatures } from "@/lib/data-table-features";

import { type EventRow, eventFilters } from "./data";
import { EventsBulkActions } from "./events-bulk-actions";
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
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "All";
  const eventTypeFilter =
    (table.getColumn("eventType")?.getFilterValue() as string | undefined) ?? eventFilters.eventType[0];
  const audienceFilter =
    (table.getColumn("audienceType")?.getFilterValue() as string | undefined) ?? eventFilters.audienceType[0];

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const filteredRows = table.getFilteredRowModel().rows;
  const totalFilteredCount = filteredRows.length;
  const selectedEvents = React.useMemo(() => selectedRows.map((r) => r.original), [selectedRows]);
  const countToDisplay = totalCount ?? events.length;

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const handleSelectAll = React.useCallback(() => {
    const newSelection: Record<string, boolean> = {};
    for (const row of filteredRows) {
      newSelection[row.id] = true;
    }
    setRowSelection(newSelection);
  }, [filteredRows]);

  const handleCopyLinks = React.useCallback(() => {
    if (selectedEvents.length === 0) return;
    const links = selectedEvents
      .map((e) => e.url || (e.staticUrl ? `https://gdg.community.dev${e.staticUrl}` : null))
      .filter(Boolean) as string[];

    if (links.length === 0) {
      toast.error("No valid event URLs found in selected events.");
      return;
    }

    navigator.clipboard.writeText(links.join("\n"));
    toast.success(`Copied ${links.length} event link${links.length > 1 ? "s" : ""} to clipboard`);
  }, [selectedEvents]);

  const handleExportCsv = React.useCallback(() => {
    if (selectedEvents.length === 0) {
      toast.error("No events selected to export");
      return;
    }

    const headers = [
      "Event ID",
      "Title",
      "Start Date",
      "End Date",
      "Status",
      "Test Event",
      "Format",
      "Event Type",
      "Registered Attendees",
      "Checked In",
      "Drop Rate",
      "URL",
    ];

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const csvRows = selectedEvents.map((e) => {
      const dropRateStr =
        e.totalAttendees > 0
          ? `${((Math.max(0, e.totalAttendees - e.checkinCount) / e.totalAttendees) * 100).toFixed(1)}%`
          : "—";

      return [
        escapeCsv(e.id),
        escapeCsv(e.title),
        escapeCsv(e.startDate),
        escapeCsv(e.endDate),
        escapeCsv(e.status),
        escapeCsv(e.isTest ? "Yes" : "No"),
        escapeCsv(e.audienceType),
        escapeCsv(e.eventType),
        escapeCsv(e.totalAttendees),
        escapeCsv(e.checkinCount),
        escapeCsv(dropRateStr),
        escapeCsv(e.url || ""),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `gdg-jakarta_events_selected_${selectedEvents.length}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedEvents.length} event${selectedEvents.length > 1 ? "s" : ""} to ${filename}`);
  }, [selectedEvents]);

  const handleExportJson = React.useCallback(() => {
    if (selectedEvents.length === 0) {
      toast.error("No events selected to export");
      return;
    }

    const exportData = selectedEvents.map((e) => {
      const dropRate =
        e.totalAttendees > 0
          ? Number(((Math.max(0, e.totalAttendees - e.checkinCount) / e.totalAttendees) * 100).toFixed(1))
          : null;

      return {
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        isTest: Boolean(e.isTest),
        audienceType: e.audienceType,
        eventType: e.eventType,
        totalAttendees: e.totalAttendees,
        checkinCount: e.checkinCount,
        dropRate,
        url: e.url || null,
        tags: e.tags,
      };
    });

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `gdg-jakarta_events_selected_${selectedEvents.length}.json`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedEvents.length} event${selectedEvents.length > 1 ? "s" : ""} to ${filename}`);
  }, [selectedEvents]);

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <Card>
      <CardHeader className="has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
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
          <Button size="sm" variant="outline" asChild>
            <a href={getBevyDashboardUrl("events")} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <ExternalLink className="size-3.5" />
              Open in Bevy
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              defaultValue="All"
              onValueChange={(value) => setColumnSelectFilter("status", value)}
            >
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Status:</span>
                <SelectValue placeholder="All">{statusFilter}</SelectValue>
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

            <Select
              value={audienceFilter}
              defaultValue="All"
              onValueChange={(value) => setColumnSelectFilter("audienceType", value)}
            >
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Format:</span>
                <SelectValue placeholder="All">{getAudienceLabel(audienceFilter)}</SelectValue>
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

            <Select
              value={eventTypeFilter}
              defaultValue="All"
              onValueChange={(value) => setColumnSelectFilter("eventType", value)}
            >
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Type:</span>
                <SelectValue placeholder="All">{eventTypeFilter}</SelectValue>
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

        <EventsBulkActions
          selectedCount={selectedCount}
          totalFilteredCount={totalFilteredCount}
          selectedEvents={selectedEvents}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onExportCsv={handleExportCsv}
          onExportJson={handleExportJson}
          onCopyLinks={handleCopyLinks}
        />

        <EventsTable table={table} />
      </CardContent>
    </Card>
  );
}

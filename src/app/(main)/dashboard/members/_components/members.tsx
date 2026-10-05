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
import { Download, Grid, Plus, RefreshCw, Rows3, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";
import { triggerMembersSyncAction } from "@/lib/firestore/actions";
import { cn, splitFullName } from "@/lib/utils";

import type { MemberRow } from "./data";
import { membersColumns } from "./members-columns";
import { MembersTable } from "./members-table";

export function Members({ members, totalCount }: { members: MemberRow[]; totalCount?: number }) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "joinedDate", desc: true }]);
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
    data: members,
    columns: membersColumns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => (row.id ? String(row.id) : row.email),
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSyncFromBevy = () => {
    startTransition(async () => {
      toast.loading("Syncing members from Bevy...", { id: "sync-members" });
      try {
        const result = await triggerMembersSyncAction();
        if (result.success) {
          toast.success(`Successfully synced ${result.totalSynced} members into Firestore!`, { id: "sync-members" });
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to sync members.", { id: "sync-members" });
        }
      } catch (_err) {
        toast.error("An unexpected error occurred during sync.", { id: "sync-members" });
      }
    });
  };

  const handleExportCsv = () => {
    const headers = ["first_name", "last_name", "email", "company", "title", "created_date", "events_registered_count"];

    const targetRows = table.getFilteredRowModel().rows;
    if (targetRows.length === 0) {
      toast.error("No members to export");
      return;
    }

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = targetRows.map(({ original: m }) => {
      const { firstName, lastName } =
        m.firstName !== undefined && m.lastName !== undefined
          ? { firstName: m.firstName, lastName: m.lastName }
          : splitFullName(m.name);

      return [
        escapeCsv(firstName),
        escapeCsv(lastName),
        escapeCsv(m.email),
        escapeCsv(m.company || ""),
        escapeCsv(m.title || ""),
        escapeCsv(m.rawCreatedDate || m.joinedDate),
        escapeCsv(m.eventsCount ?? 0),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "gdg-jakarta_members.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${targetRows.length} members to gdg-jakarta_members.csv`);
  };

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const countToDisplay = totalCount ?? members.length;

  return (
    <Card>
      <CardHeader className="has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="text-xl leading-none">
          Community Members{" "}
          <span className="font-normal text-muted-foreground">({countToDisplay.toLocaleString()})</span>
        </CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Manage GDG Jakarta community members, attendees, and organizers.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search members..."
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
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
            <Download className="size-3.5" /> Export
          </Button>
          <Button size="sm">
            <Plus /> Add Member
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
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

        <MembersTable table={table} />
      </CardContent>
    </Card>
  );
}

"use client";
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { dataTableFeatures } from "@/lib/data-table-features";
import { splitFullName } from "@/lib/utils";

import type { MemberRow, MemberStatus } from "./data";
import { getMembersColumns } from "./members-columns";
import { MembersTable } from "./members-table";

export function Members({ members, totalCount }: { members: MemberRow[]; totalCount?: number }) {
  const [data, setData] = React.useState<MemberRow[]>(members);
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

  // Sync state if initial props change
  React.useEffect(() => {
    setData(members);
  }, [members]);

  // Load Firestore members and merge with Bevy chapter members on client
  React.useEffect(() => {
    async function loadFirestoreMembers() {
      try {
        const { getFirestoreMembers } = await import("@/lib/firestore/client");
        const fsMembers = await getFirestoreMembers(200);
        if (!fsMembers || fsMembers.length === 0) return;

        setData((prev) => {
          const existingMap = new Map<string, MemberRow>();
          for (const m of prev) {
            existingMap.set(m.email.toLowerCase(), m);
          }

          const merged = [...prev];

          for (const fs of fsMembers) {
            const emailKey = fs.email.toLowerCase();
            const existing = existingMap.get(emailKey);
            const isSynced = Boolean(fs.bevy_user_id || existing);

            if (existing) {
              existing.syncStatus = isSynced ? "synced" : "not_synced";
              if (fs.bevy_user_id) {
                existing.bevyUserId = fs.bevy_user_id;
              }
            } else {
              let joinedDateFormatted = "Recent";
              if (fs.joined_date) {
                try {
                  joinedDateFormatted = format(parseISO(fs.joined_date), "dd MMM yyyy, h:mm a");
                } catch {
                  joinedDateFormatted = fs.joined_date;
                }
              }

              const newRow: MemberRow = {
                id: fs.id,
                bevyUserId: fs.bevy_user_id ?? undefined,
                name: fs.name || fs.email.split("@")[0] || "Community Member",
                firstName: fs.first_name ?? undefined,
                lastName: fs.last_name ?? undefined,
                email: fs.email,
                role: fs.role || "Member",
                status: (fs.status as MemberStatus) || "Active",
                team: fs.team || "Community",
                joinedDate: joinedDateFormatted,
                rawCreatedDate: fs.joined_date ?? undefined,
                avatarUrl: fs.avatar_url ?? undefined,
                eventsCount: fs.events_registered_count ?? 0,
                syncStatus: fs.bevy_user_id ? "synced" : "not_synced",
              };

              merged.push(newRow);
              existingMap.set(emailKey, newRow);
            }
          }

          return merged;
        });
      } catch (err) {
        console.warn("[Members] Error loading Firestore members:", err);
      }
    }

    void loadFirestoreMembers();
  }, []);

  const handleSyncSingleMember = React.useCallback(async (member: MemberRow) => {
    const toastId = toast.loading(`Checking Bevy membership for ${member.email}...`);
    try {
      const { syncSingleMemberToBevyAction } = await import("@/server/auth-actions");
      const { updateFirestoreMemberBevyId } = await import("@/lib/firestore/client");

      const result = await syncSingleMemberToBevyAction({
        email: member.email,
        name: member.name,
        firstName: member.firstName,
        lastName: member.lastName,
      });

      if (result.success && result.bevyUserId) {
        if (member.id) {
          await updateFirestoreMemberBevyId(String(member.id), result.bevyUserId);
        }
        setData((prev) =>
          prev.map((m) =>
            m.email.toLowerCase() === member.email.toLowerCase()
              ? { ...m, syncStatus: "synced", bevyUserId: result.bevyUserId }
              : m,
          ),
        );
        toast.success(
          result.isAlreadyMember
            ? `Member is already verified in Bevy chapter (ID: ${result.bevyUserId}).`
            : `Member successfully imported and synced to Bevy (ID: ${result.bevyUserId})!`,
          { id: toastId },
        );
      } else {
        toast.error(result.error ?? "Failed to sync member with Bevy.", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error syncing member with Bevy.", { id: toastId });
    }
  }, []);

  const columns = React.useMemo(() => getMembersColumns(handleSyncSingleMember), [handleSyncSingleMember]);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
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
  const countToDisplay = totalCount ?? data.length;

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
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
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
            <Download className="size-3.5" /> Export
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center justify-between gap-3 px-4">
          <div className="text-muted-foreground text-sm tabular-nums">{selectedCount} selected</div>
        </div>

        <MembersTable table={table} />
      </CardContent>
    </Card>
  );
}

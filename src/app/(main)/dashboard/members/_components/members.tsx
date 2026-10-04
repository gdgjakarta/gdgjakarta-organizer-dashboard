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
import { ChevronDown, Download, ExternalLink, FileJson, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";
import { dataTableFeatures } from "@/lib/data-table-features";
import { splitFullName } from "@/lib/utils";

import type { MemberRow, MemberStatus } from "./data";
import { MembersBulkActions } from "./members-bulk-actions";
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
  const [isBulkSyncing, setIsBulkSyncing] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

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

  // Shortcut for ⌘K to focus search input
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
  const filteredRows = table.getFilteredRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const countToDisplay = totalCount ?? data.length;

  const handleExportCsv = React.useCallback(
    (onlySelected = false) => {
      const targetRows = onlySelected ? selectedRows : filteredRows;

      if (targetRows.length === 0) {
        toast.error(onlySelected ? "No members selected to export" : "No members to export");
        return;
      }

      const headers = [
        "name",
        "first_name",
        "last_name",
        "email",
        "company",
        "title",
        "role",
        "team",
        "status",
        "bevy_user_id",
        "sync_status",
        "events_registered_count",
        "joined_date",
      ];

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
          escapeCsv(m.name),
          escapeCsv(firstName),
          escapeCsv(lastName),
          escapeCsv(m.email),
          escapeCsv(m.company || ""),
          escapeCsv(m.title || ""),
          escapeCsv(m.role || "Member"),
          escapeCsv(m.team || "Community"),
          escapeCsv(m.status || "Active"),
          escapeCsv(m.bevyUserId ?? ""),
          escapeCsv(m.syncStatus || (m.bevyUserId ? "synced" : "not_synced")),
          escapeCsv(m.eventsCount ?? 0),
          escapeCsv(m.rawCreatedDate || m.joinedDate),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = onlySelected
        ? `gdg-jakarta_members_selected_${targetRows.length}.csv`
        : "gdg-jakarta_members.csv";
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${targetRows.length} member${targetRows.length > 1 ? "s" : ""} to ${filename}`);
    },
    [selectedRows, filteredRows],
  );

  const handleExportJson = React.useCallback(
    (onlySelected = false) => {
      const targetRows = onlySelected ? selectedRows : filteredRows;

      if (targetRows.length === 0) {
        toast.error(onlySelected ? "No members selected to export" : "No members to export");
        return;
      }

      const exportData = targetRows.map(({ original: m }) => {
        const { firstName, lastName } =
          m.firstName !== undefined && m.lastName !== undefined
            ? { firstName: m.firstName, lastName: m.lastName }
            : splitFullName(m.name);

        return {
          id: m.id,
          name: m.name,
          firstName,
          lastName,
          email: m.email,
          company: m.company || null,
          title: m.title || null,
          role: m.role || "Member",
          team: m.team || "Community",
          status: m.status || "Active",
          bevyUserId: m.bevyUserId || null,
          syncStatus: m.syncStatus || (m.bevyUserId ? "synced" : "not_synced"),
          eventsCount: m.eventsCount ?? 0,
          joinedDate: m.joinedDate,
          rawCreatedDate: m.rawCreatedDate,
        };
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = onlySelected
        ? `gdg-jakarta_members_selected_${exportData.length}.json`
        : "gdg-jakarta_members.json";
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportData.length} member${exportData.length > 1 ? "s" : ""} to ${filename}`);
    },
    [selectedRows, filteredRows],
  );

  const handleCopySelectedEmails = React.useCallback(() => {
    if (selectedRows.length === 0) return;
    const emails = selectedRows.map((r) => r.original.email).filter(Boolean);

    if (emails.length === 0) {
      toast.error("No valid email addresses found.");
      return;
    }

    navigator.clipboard.writeText(emails.join(", "));
    toast.success(`Copied ${emails.length} email address${emails.length > 1 ? "es" : ""} to clipboard`);
  }, [selectedRows]);

  const handleEmailSelected = React.useCallback(() => {
    if (selectedRows.length === 0) return;
    const emails = selectedRows.map((r) => r.original.email).filter(Boolean);

    if (emails.length === 0) {
      toast.error("No valid email addresses found.");
      return;
    }

    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
  }, [selectedRows]);

  const handleBulkSyncBevy = React.useCallback(async () => {
    if (selectedRows.length === 0) return;

    const toSync = selectedRows.map((r) => r.original);
    setIsBulkSyncing(true);
    const toastId = toast.loading(`Checking & syncing ${toSync.length} selected member(s) with Bevy...`);

    let successCount = 0;
    let failCount = 0;

    try {
      const { syncSingleMemberToBevyAction } = await import("@/server/auth-actions");
      const { updateFirestoreMemberBevyId } = await import("@/lib/firestore/client");

      for (const member of toSync) {
        try {
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
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success(`Successfully verified/synced all ${successCount} member(s) with Bevy!`, { id: toastId });
      } else {
        toast.info(`Synced ${successCount} member(s), ${failCount} could not be updated.`, { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error syncing members with Bevy.", { id: toastId });
    } finally {
      setIsBulkSyncing(false);
    }
  }, [selectedRows]);

  const handleSelectAll = React.useCallback(() => {
    table.toggleAllRowsSelected(true);
  }, [table]);

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="text-xl leading-none">
          Members <span className="font-normal text-muted-foreground">({countToDisplay.toLocaleString()})</span>
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
              ref={searchInputRef}
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

          {/* Header Export Dropdown: dynamic based on selection */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="size-3.5" />
                {selectedCount > 0 ? `Export (${selectedCount})` : "Export"}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {selectedCount > 0 ? (
                <>
                  <DropdownMenuItem onClick={() => handleExportCsv(true)} className="gap-2">
                    <FileSpreadsheet className="size-3.5" />
                    Export selected ({selectedCount}) as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportJson(true)} className="gap-2">
                    <FileJson className="size-3.5" />
                    Export selected ({selectedCount}) as JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportCsv(false)} className="gap-2">
                    <FileSpreadsheet className="size-3.5" />
                    Export all ({filteredRows.length}) as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportJson(false)} className="gap-2">
                    <FileJson className="size-3.5" />
                    Export all ({filteredRows.length}) as JSON
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => handleExportCsv(false)} className="gap-2">
                    <FileSpreadsheet className="size-3.5" />
                    Export all as CSV ({filteredRows.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportJson(false)} className="gap-2">
                    <FileJson className="size-3.5" />
                    Export all as JSON ({filteredRows.length})
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" asChild>
            <a href={getBevyDashboardUrl("members")} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <ExternalLink className="size-3.5" />
              Open in Bevy
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <MembersBulkActions
          selectedCount={selectedCount}
          totalFilteredCount={filteredRows.length}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onExportCsv={handleExportCsv}
          onExportJson={handleExportJson}
          onCopyEmails={handleCopySelectedEmails}
          onBulkSyncBevy={handleBulkSyncBevy}
          onEmailSelected={handleEmailSelected}
          isBulkSyncing={isBulkSyncing}
        />

        <MembersTable table={table} />
      </CardContent>
    </Card>
  );
}

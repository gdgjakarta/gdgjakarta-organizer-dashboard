"use client";
import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  GitMerge,
  Loader2,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBevyDashboardUrl } from "@/config/remote-config-utils";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { dataTableFeatures } from "@/lib/data-table-features";
import { toTimezoneDate } from "@/lib/date-utils";
import { splitFullName } from "@/lib/utils";

import { BulkMergeDialog } from "./bulk-merge-dialog";
import { ChapterTeamTab } from "./chapter-team-tab";
import type { MemberRow } from "./data";
import { MembersBulkActions } from "./members-bulk-actions";
import { getMembersColumns } from "./members-columns";
import { MembersTable } from "./members-table";
import { MergeMemberDialog } from "./merge-member-dialog";

export function Members({
  members,
  totalCount,
  teamMembers = [],
}: {
  members: MemberRow[];
  totalCount?: number;
  teamMembers?: BevyChapterTeamMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = React.useState<"members" | "team">(tabParam === "team" ? "team" : "members");

  // Keep state in sync if URL changes externally (e.g. browser back/forward or direct link)
  React.useEffect(() => {
    setActiveTab(tabParam === "team" ? "team" : "members");
  }, [tabParam]);

  const [hasVisitedTeam, setHasVisitedTeam] = React.useState(tabParam === "team");
  const [isTabComposing, setIsTabComposing] = React.useState(false);
  const [isFetchingPage, setIsFetchingPage] = React.useState(false);
  const [serverTotalCount, setServerTotalCount] = React.useState<number>(totalCount ?? members.length);
  const firestoreMembersRef = React.useRef<unknown[] | null>(null);

  const handleTabChange = (value: string) => {
    if (value === activeTab) return;
    const nextTab = value === "team" ? "team" : "members";

    // 1. Immediately change active tab state to switch the UI instantly without delay
    setActiveTab(nextTab);
    if (nextTab === "team") setHasVisitedTeam(true);

    // 2. Trigger brief composition shimmer while tab contents compose
    setIsTabComposing(true);
    React.startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "team") {
        params.set("tab", "team");
      } else {
        params.delete("tab");
      }
      const query = params.toString();
      window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
    });

    const timer = setTimeout(() => {
      setIsTabComposing(false);
    }, 150);
    return () => clearTimeout(timer);
  };

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
  const [isSearchingRemote, setIsSearchingRemote] = React.useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);
  const [bulkMergeDialogOpen, setBulkMergeDialogOpen] = React.useState(false);
  const [memberToMerge, setMemberToMerge] = React.useState<MemberRow | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Helper to merge Bevy member rows with cached Firestore records
  const mergeWithFirestore = React.useCallback((bevyRows: MemberRow[], fsMembers: unknown[]): MemberRow[] => {
    if (!fsMembers || fsMembers.length === 0) return bevyRows;

    const existingMap = new Map<string, MemberRow>();
    const existingById = new Map<string, MemberRow>();
    for (const m of bevyRows) {
      if (m.email) existingMap.set(m.email.toLowerCase(), m);
      if (m.id != null) existingById.set(String(m.id), m);
      if (m.bevyUserId != null) existingById.set(String(m.bevyUserId), m);
    }

    const merged = bevyRows.map((row) => ({ ...row }));

    for (const rawFs of fsMembers) {
      const fs = rawFs as Record<string, string | number | boolean | null | undefined>;
      const emailKey = (fs.email || "").trim().toLowerCase();
      if (!emailKey && !fs.bevy_user_id && !fs.id) continue;
      const existing =
        (emailKey ? existingMap.get(emailKey) : undefined) ||
        (fs.id ? existingById.get(String(fs.id)) : undefined) ||
        (fs.bevy_user_id ? existingById.get(String(fs.bevy_user_id)) : undefined) ||
        (fs.bevy_member_id ? existingById.get(String(fs.bevy_member_id)) : undefined);
      const isSynced = Boolean(fs.bevy_user_id || existing);

      if (existing) {
        existing.syncStatus = isSynced ? "synced" : "not_synced";
        if (
          fs.email &&
          !fs.email.includes("*") &&
          (!existing.email || existing.email.includes("*") || existing.email.startsWith("user_"))
        ) {
          existing.email = fs.email;
        }
        if (fs.bevy_user_id) {
          existing.bevyUserId = fs.bevy_user_id;
          existingById.set(String(fs.bevy_user_id), existing);
        }
        if (fs.id) existingById.set(String(fs.id), existing);
        if (fs.bevy_member_id) existingById.set(String(fs.bevy_member_id), existing);
      }
    }

    return merged;
  }, []);

  // Sync state if initial props change without wiping cached Firestore members
  React.useEffect(() => {
    if (totalCount !== undefined) {
      setServerTotalCount(totalCount);
    }
    if (firestoreMembersRef.current) {
      setData(mergeWithFirestore(members, firestoreMembersRef.current));
    } else {
      setData(members);
    }
  }, [members, totalCount, mergeWithFirestore]);

  // Load Firestore members on client and cache in ref
  React.useEffect(() => {
    async function loadFirestoreMembers() {
      try {
        const { getFirestoreMembers } = await import("@/lib/firestore/client");
        const fsMembers = await getFirestoreMembers();
        if (!fsMembers || fsMembers.length === 0) return;

        firestoreMembersRef.current = fsMembers;
        setData((prev) => mergeWithFirestore(prev, fsMembers));
      } catch (err) {
        console.warn("[Members] Error loading Firestore members:", err);
      }
    }

    void loadFirestoreMembers();
  }, [mergeWithFirestore]);

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

  const handleOpenMergeDialog = React.useCallback((member: MemberRow) => {
    setMemberToMerge(member);
    setMergeDialogOpen(true);
  }, []);

  const handleMergedSuccess = React.useCallback(() => {
    // Reload firestore members to refresh local table state
    void (async () => {
      try {
        const { getFirestoreMembers } = await import("@/lib/firestore/client");
        const fsMembers = await getFirestoreMembers();
        if (!fsMembers) return;
        setData((prev) => {
          const removedDupId = memberToMerge ? String(memberToMerge.id) : null;
          return prev.filter((m) => String(m.id) !== removedDupId);
        });
      } catch {
        // non-blocking
      }
    })();
  }, [memberToMerge]);

  const columns = React.useMemo(
    () => getMembersColumns(handleSyncSingleMember, handleOpenMergeDialog),
    [handleSyncSingleMember, handleOpenMergeDialog],
  );

  const searchQuery = (columnFilters.find((f) => f.id === "search")?.value as string | undefined) ?? "";
  const syncStatusFilter = (columnFilters.find((f) => f.id === "syncStatus")?.value as string | undefined) ?? "all";
  const isSearchActive = searchQuery.trim().length >= 2;
  const pageCount = isSearchActive
    ? Math.max(Math.ceil(data.length / pagination.pageSize), 1)
    : Math.max(Math.ceil(serverTotalCount / pagination.pageSize), 1);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    pageCount,
    manualPagination: !isSearchActive,
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

  // Fetch paginated members from Bevy whenever pageIndex or pageSize changes (and not actively searching)
  React.useEffect(() => {
    if (isSearchActive) return;

    let cancelled = false;
    setIsFetchingPage(true);

    const currentPageNum = pagination.pageIndex + 1;
    const currentPageSize = pagination.pageSize;

    void (async () => {
      try {
        const { fetchBevyChapterMembersAction } = await import("@/server/bevy-actions");
        const res = await fetchBevyChapterMembersAction(currentPageSize, currentPageNum, "-created_date");
        if (cancelled || !res) return;

        if (res.count !== undefined) {
          setServerTotalCount(res.count);
        }

        const rawResults = res.results as MemberRow[];
        if (rawResults.length > 0) {
          if (firestoreMembersRef.current) {
            setData(mergeWithFirestore(rawResults, firestoreMembersRef.current));
          } else {
            setData(rawResults);
          }
        }
      } catch (err) {
        console.warn("[Members] Error loading paginated Bevy members:", err);
      } finally {
        if (!cancelled) {
          setIsFetchingPage(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, pagination.pageSize, isSearchActive, mergeWithFirestore]);

  // Debounced server-side search across all Bevy chapter members (via Algolia)
  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setIsSearchingRemote(false);
      return;
    }

    let cancelled = false;
    setIsSearchingRemote(true);

    const timer = setTimeout(async () => {
      try {
        const { searchBevyChapterMembersAction } = await import("@/server/bevy-actions");
        const hits = await searchBevyChapterMembersAction(trimmed);
        if (cancelled || !hits || hits.length === 0) return;

        setData((prev) => {
          const existingByEmail = new Map<string, MemberRow>();
          const existingById = new Map<string, MemberRow>();
          for (const m of prev) {
            if (m.email) existingByEmail.set(m.email.toLowerCase(), m);
            if (m.id != null) existingById.set(String(m.id), m);
            if (m.bevyUserId != null) existingById.set(String(m.bevyUserId), m);
          }

          const merged = [...prev];

          for (const hit of hits) {
            const email = hit.user.email || `user_${hit.user.id}@community.dev`;
            const hitId = String(hit.id);
            const userId = String(hit.user.id);
            const matchedExisting =
              (email ? existingByEmail.get(email.toLowerCase()) : undefined) ||
              existingById.get(hitId) ||
              existingById.get(userId);

            if (matchedExisting) {
              // Ensure real unmasked email replaces placeholder/masked email if available
              if (
                email &&
                !email.includes("*") &&
                (!matchedExisting.email ||
                  matchedExisting.email.includes("*") ||
                  matchedExisting.email.startsWith("user_"))
              ) {
                matchedExisting.email = email;
              }
              continue;
            }

            const tm = teamMembers.find(
              (t) =>
                (t.user?.email && t.user.email.toLowerCase() === email.toLowerCase()) ||
                String(t.user?.id || t.user_id || "") === userId,
            );
            let organizerRole: string | null = null;
            if (tm) {
              if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
                organizerRole = tm.role.name;
              } else if (typeof tm.role === "string" && tm.role) {
                organizerRole = tm.role;
              } else {
                organizerRole = tm.title || "Organizer";
              }
            }

            const displayName = hit.user.full_name?.trim() || email.split("@")[0] || "Community Member";
            const { firstName, lastName } = splitFullName(displayName);

            let joinedDateFormatted = "Recent";
            if (hit.created_date) {
              try {
                joinedDateFormatted = format(toTimezoneDate(parseISO(hit.created_date)), "dd MMM yyyy, h:mm a");
              } catch {
                joinedDateFormatted = hit.created_date;
              }
            }

            const newRow: MemberRow = {
              id: hit.id || hit.user.id,
              bevyUserId: hit.user.id,
              name: displayName,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              email,
              role: organizerRole || "Member",
              status: "Active",
              team: organizerRole ? "Core Team" : "Community",
              joinedDate: joinedDateFormatted,
              rawCreatedDate: hit.created_date,
              avatarUrl: tm?.user?.avatar?.url || hit.user.avatar?.url,
              eventsCount: hit.events_registered_count ?? 0,
              profileUrl: hit.user.profile_url,
              isEmailVerified: Boolean(hit.user.is_email_verified),
              company: tm?.user?.company,
              syncStatus: "synced",
            };

            merged.push(newRow);
            existingByEmail.set(email.toLowerCase(), newRow);
            existingById.set(hitId, newRow);
            existingById.set(userId, newRow);
          }

          return merged;
        });
      } catch (err) {
        console.warn("[Members] Error searching remote Bevy members:", err);
      } finally {
        if (!cancelled) setIsSearchingRemote(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, teamMembers]);

  const filteredRows = table.getFilteredRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const countToDisplay = isSearchActive ? filteredRows.length : serverTotalCount;

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
    let isRateLimited = false;

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
            // Check if Bevy returned rate limiting (429)
            const errStr = String(result.error || "");
            if (errStr.includes("429") || errStr.toLowerCase().includes("rate limit")) {
              isRateLimited = true;
              break;
            }
            failCount++;
          }
        } catch (innerErr) {
          const errStr = String(innerErr instanceof Error ? innerErr.message : innerErr);
          if (errStr.includes("429") || errStr.toLowerCase().includes("rate limit")) {
            isRateLimited = true;
            break;
          }
          failCount++;
        }
      }

      if (isRateLimited) {
        toast.warning(
          `Bevy API rate limit (429) reached. Sync paused. Successfully synced ${successCount} member(s) before stopping.`,
          { id: toastId, duration: 6000 },
        );
      } else if (failCount === 0) {
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="w-full rounded-xl border border-border/70 bg-white p-1 shadow-xs dark:bg-card">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-transparent p-0">
            <TabsTrigger
              value="members"
              className="gap-2 rounded-md font-medium text-xs transition-all data-active:border-border/60 data-active:bg-background data-active:text-foreground data-active:shadow-xs sm:text-sm dark:data-active:border-border dark:data-active:bg-muted"
            >
              <Users className="size-4 shrink-0" />
              <span className="truncate">Community Members</span>
              <Badge variant="secondary" className="ml-1 h-5 rounded-md px-1.5 font-normal text-[11px]">
                {countToDisplay.toLocaleString()}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="gap-2 rounded-md font-medium text-xs transition-all data-active:border-border/60 data-active:bg-background data-active:text-foreground data-active:shadow-xs sm:text-sm dark:data-active:border-border dark:data-active:bg-muted"
            >
              <Shield className="size-4 shrink-0" />
              <span className="truncate">Chapter Team</span>
              <Badge variant="secondary" className="ml-1 h-5 rounded-md px-1.5 font-normal text-[11px]">
                {teamMembers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="members" className="space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader className="has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
              <CardTitle className="text-xl leading-none">
                Members <span className="font-normal text-muted-foreground">({countToDisplay.toLocaleString()})</span>
              </CardTitle>
              <CardDescription className="max-w-sm leading-snug">
                Manage GDG Jakarta community members, attendees, and organizers.
              </CardDescription>
              <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
                <InputGroup className="h-7 w-full md:w-56 lg:w-64">
                  <InputGroupAddon align="inline-start">
                    {isSearchingRemote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
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

                <Select
                  value={syncStatusFilter}
                  onValueChange={(val) => {
                    table.getColumn("syncStatus")?.setFilterValue(val === "all" ? undefined : val);
                    table.setPageIndex(0);
                  }}
                >
                  <SelectTrigger size="sm" className="h-7 min-w-[130px] text-xs">
                    <SelectValue placeholder="Sync status" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all" className="text-xs">
                      All sync statuses
                    </SelectItem>
                    <SelectItem value="synced" className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        <span>Synced</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="not_synced" className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        <span>Not sync</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

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

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkMergeDialogOpen(true)}
                  className="gap-1.5"
                  title="Scan for duplicate members across Firestore and bulk merge them"
                >
                  <GitMerge className="size-3.5 text-primary" />
                  Bulk merge duplicates
                </Button>

                <Button variant="outline" size="sm" asChild>
                  <a
                    href={getBevyDashboardUrl("members")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1.5"
                  >
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

              <MembersTable
                table={table}
                isLoading={
                  isSearchingRemote ||
                  (!isSearchActive && isFetchingPage) ||
                  (isTabComposing && activeTab === "members")
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 focus-visible:outline-none">
          {!hasVisitedTeam || (isTabComposing && activeTab === "team") ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {["team-skel-1", "team-skel-2", "team-skel-3", "team-skel-4", "team-skel-5", "team-skel-6"].map((key) => (
                <Card key={key} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <ChapterTeamTab initialTeamMembers={teamMembers} />
          )}
        </TabsContent>
      </Tabs>

      <MergeMemberDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        primaryMember={memberToMerge}
        allMembers={data}
        onMerged={handleMergedSuccess}
      />

      <BulkMergeDialog
        open={bulkMergeDialogOpen}
        onOpenChange={setBulkMergeDialogOpen}
        onMergedSuccess={() => {
          // Re-fetch all Firestore members to clean up merged duplicates from UI
          void (async () => {
            try {
              const { getFirestoreMembers } = await import("@/lib/firestore/client");
              const fsMembers = await getFirestoreMembers();
              if (fsMembers) {
                // Trigger page refresh to synchronize server & client states
                router.refresh();
              }
            } catch {
              // non-blocking
            }
          })();
        }}
      />
    </div>
  );
}

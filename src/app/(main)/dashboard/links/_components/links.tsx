"use client";

import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  Archive,
  ExternalLink,
  Folder,
  FolderCog,
  FolderPlus,
  Globe,
  Link2,
  Loader2,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";
import type { ShortDomain, ShortFolder, ShortLinkItem, ShortlinkProviderName } from "@/lib/shortio/types";
import { fetchShortLinksAction } from "@/server/shortio-actions";
import { archiveShortLinksAction, unarchiveShortLinksAction } from "@/server/shortio-advanced-actions";

import { AnalyticsTab } from "./analytics-tab";
import { BulkDeleteLinksDialog } from "./bulk-delete-links-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";
import { BulkMoveFolderDialog } from "./bulk-move-folder-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateLinkDialog } from "./create-link-dialog";
import { findFolderById, getFolderColor, getLinkCountByFolder } from "./data";
import { DeleteLinkDialog } from "./delete-link-dialog";
import { DomainsTab } from "./domains-tab";
import { EditLinkDialog } from "./edit-link-dialog";
import { LinkAnalyticsSheet } from "./link-analytics-sheet";
import { formatArchiveToast } from "./link-form-helpers";
import { LinksBulkActions } from "./links-bulk-actions";
import { createLinksColumns } from "./links-columns";
import { LinksTable } from "./links-table";
import { ManageFolderDialog } from "./manage-folder-dialog";
import { MoveFolderDialog } from "./move-folder-dialog";
import { QrCodeDialog } from "./qr-code-dialog";

interface LinksProps {
  initialLinks: ShortLinkItem[];
  initialFolders: ShortFolder[];
  initialDomains?: ShortDomain[];
  provider: ShortlinkProviderName;
  primaryDomain: string;
  primaryDomainId: number;
  initialTotalCount?: number;
  initialNextPageToken?: string;
}

export function Links({
  initialLinks,
  initialFolders,
  initialDomains = [],
  provider,
  primaryDomain,
  primaryDomainId,
  initialTotalCount,
  initialNextPageToken,
}: LinksProps) {
  const [links, setLinks] = React.useState<ShortLinkItem[]>(initialLinks);
  const [folders, setFolders] = React.useState<ShortFolder[]>(initialFolders);
  const [totalCount, setTotalCount] = React.useState<number>(initialTotalCount ?? initialLinks.length);
  const [nextPageToken, setNextPageToken] = React.useState<string | undefined>(initialNextPageToken);
  const [showArchived, setShowArchived] = React.useState(false);
  const [isFetchingList, setIsFetchingList] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = React.useState(false);

  const [tab, setTab] = React.useState("links");
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [analyticsLink, setAnalyticsLink] = React.useState<ShortLinkItem | null>(null);
  const [activeFolderFilter, setActiveFolderFilter] = React.useState<string>("all");

  // Modals state
  const [isCreateLinkOpen, setIsCreateLinkOpen] = React.useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [managingFolder, setManagingFolder] = React.useState<ShortFolder | null>(null);
  const [editingLink, setEditingLink] = React.useState<ShortLinkItem | null>(null);
  const [movingLink, setMovingLink] = React.useState<ShortLinkItem | null>(null);
  const [deletingLink, setDeletingLink] = React.useState<ShortLinkItem | null>(null);
  const [qrCodeLink, setQrCodeLink] = React.useState<ShortLinkItem | null>(null);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = React.useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);

  // Table state
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // ⌘K focus shortcut
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

  // Update folder filter in table columnFilters
  const handleSelectFolder = (folderId: string) => {
    setActiveFolderFilter(folderId);
    setColumnFilters((prev) => {
      const next = prev.filter((f) => f.id !== "FolderId");
      if (folderId !== "all") {
        next.push({ id: "FolderId", value: folderId });
      }
      return next;
    });
  };

  const reloadLinks = React.useCallback(async (archivedView: boolean) => {
    setIsFetchingList(true);
    try {
      const res = await fetchShortLinksAction({ archived: archivedView, limit: 150 });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Failed to fetch short links");
        return;
      }
      setLinks(res.data);
      setTotalCount(res.count ?? res.data.length);
      setNextPageToken(res.nextPageToken);
      setShowArchived(archivedView);
      setRowSelection({});
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch short links");
    } finally {
      setIsFetchingList(false);
    }
  }, []);

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchShortLinksAction({
        archived: showArchived,
        limit: 150,
        pageToken: nextPageToken,
      });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Failed to load more links");
        return;
      }
      setLinks((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const appended = res.data?.filter((l) => !seen.has(l.id)) ?? [];
        return [...prev, ...appended];
      });
      if (typeof res.count === "number") setTotalCount(res.count);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load more links");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const columns = React.useMemo(
    () =>
      createLinksColumns({
        folders,
        provider,
        onEdit: (link) => setEditingLink(link),
        onMoveFolder: (link) => setMovingLink(link),
        onDelete: (link) => setDeletingLink(link),
        onQrCode: (link) => setQrCodeLink(link),
        onAnalytics: (link) => setAnalyticsLink(link),
        onArchive: async (link) => {
          const res = await archiveShortLinksAction([link.id]);
          if (!res.success) return void toast.error(res.error ?? "Failed to archive link");
          setLinks((prev) => prev.filter((l) => l.id !== link.id));
          setTotalCount((c) => Math.max(0, c - 1));
          toast.success(formatArchiveToast(provider, 1));
        },
        onUnarchive: async (link) => {
          const res = await unarchiveShortLinksAction([link.id]);
          if (!res.success) return void toast.error(res.error ?? "Failed to restore link");
          setLinks((prev) => prev.filter((l) => l.id !== link.id));
          setTotalCount((c) => Math.max(0, c - 1));
          toast.success("Link restored to active links.");
        },
      }),
    [folders, provider],
  );

  const table = useTable({
    features: dataTableFeatures,
    data: links,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const filteredRows = table.getFilteredRowModel().rows;
  const selectedLinks = React.useMemo(() => selectedRows.map((r) => r.original), [selectedRows]);

  const handleSelectAll = React.useCallback(() => {
    const newSelection: Record<string, boolean> = {};
    for (const row of filteredRows) {
      newSelection[row.id] = true;
    }
    setRowSelection(newSelection);
  }, [filteredRows]);

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const handleCopySelectedLinks = React.useCallback(() => {
    if (selectedLinks.length === 0) return;
    const urls = selectedLinks.map((l) => l.shortURL).join("\n");
    void navigator.clipboard.writeText(urls);
    toast.success(`Copied ${selectedLinks.length} short link${selectedLinks.length > 1 ? "s" : ""} to clipboard`);
  }, [selectedLinks]);

  const handleBulkArchive = async () => {
    const ids = selectedLinks.map((l) => l.id);
    if (ids.length === 0) return;
    setIsBulkArchiving(true);
    try {
      const res = await archiveShortLinksAction(ids);
      if (!res.success) {
        toast.error(res.error ?? "Failed to archive selected links");
        return;
      }
      const idSet = new Set(ids);
      setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
      setTotalCount((c) => Math.max(0, c - ids.length));
      setRowSelection({});
      toast.success(formatArchiveToast(provider, ids.length));
    } finally {
      setIsBulkArchiving(false);
    }
  };

  const handleBulkUnarchive = async () => {
    const ids = selectedLinks.map((l) => l.id);
    if (ids.length === 0) return;
    setIsBulkArchiving(true);
    try {
      const res = await unarchiveShortLinksAction(ids);
      if (!res.success) {
        toast.error(res.error ?? "Failed to restore selected links");
        return;
      }
      const idSet = new Set(ids);
      setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
      setTotalCount((c) => Math.max(0, c - ids.length));
      setRowSelection({});
      toast.success(`Restored ${ids.length} link${ids.length > 1 ? "s" : ""} to active links.`);
    } finally {
      setIsBulkArchiving(false);
    }
  };

  const handleBulkLinksMoved = (updatedLinks: ShortLinkItem[]) => {
    const updatedMap = new Map(updatedLinks.map((l) => [l.id, l]));
    setLinks((prev) => prev.map((l) => updatedMap.get(l.id) ?? l));
    setRowSelection({});
  };

  const handleBulkLinksDeleted = (deletedIds: string[]) => {
    const idSet = new Set(deletedIds);
    setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
    setTotalCount((c) => Math.max(0, c - deletedIds.length));
    setRowSelection({});
  };

  const handleLinkCreated = (newLink: ShortLinkItem) => {
    if (!showArchived) {
      setLinks((prev) => [newLink, ...prev]);
      setTotalCount((c) => c + 1);
    }
  };

  const handleLinkUpdated = (updatedLink: ShortLinkItem) => {
    setLinks((prev) => prev.map((l) => (l.id === updatedLink.id ? updatedLink : l)));
  };

  const handleLinkDeleted = (deletedLinkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== deletedLinkId));
    setTotalCount((c) => Math.max(0, c - 1));
  };

  const handleFolderCreated = (newFolder: ShortFolder) => {
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleFolderUpdated = (updatedFolder: ShortFolder) => {
    setFolders((prev) => prev.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)));
  };

  const handleFolderDeleted = (deletedFolderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== deletedFolderId));
    setLinks((prev) => prev.map((l) => (l.FolderId === deletedFolderId ? { ...l, FolderId: undefined } : l)));
    if (activeFolderFilter === deletedFolderId) {
      handleSelectFolder("all");
    }
  };

  const activeFolder = findFolderById(folders, activeFolderFilter);

  // KPI Calculations
  const loadedLinksCount = links.length;
  const totalFoldersCount = folders.length;
  const uncategorizedCount = getLinkCountByFolder(links);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">Short Links</h1>
            <span className="rounded-md border bg-muted/60 px-2 py-0.5 font-medium text-muted-foreground text-xs">
              Organizer Only
            </span>
            <Badge variant="secondary" className="text-xs">
              {provider === "cloudflare" ? "Cloudflare Edge" : "Short.io"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage, categorize, generate, edit, and delete branded short links on {primaryDomain}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {provider === "shortio" && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href="https://app.short.io/users/dashboard/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Short.io Dashboard
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCreateFolderOpen(true)}
            className="gap-1.5"
          >
            <FolderPlus className="size-4" />
            New Folder
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-1.5">
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button type="button" size="sm" onClick={() => setIsCreateLinkOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Create Short Link
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
        </TabsList>
        <TabsContent value="links" className="flex flex-col gap-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>{showArchived ? "Archived Links" : "Total Links"}</span>
                  <Link2 className="size-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="font-bold text-2xl tracking-tight">{totalCount.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-muted-foreground text-xs">
                {showArchived ? `Archived links on ${primaryDomain}` : `Live redirects active on ${primaryDomain}`}
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Category Folders</span>
                  <Folder className="size-4 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="font-bold text-2xl tracking-tight">{totalFoldersCount}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-muted-foreground text-xs">
                {uncategorizedCount} loaded link{uncategorizedCount === 1 ? "" : "s"} uncategorized
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardDescription className="flex items-center justify-between text-xs">
                  <span>Primary Domain</span>
                  <Globe className="size-4 text-emerald-500" />
                </CardDescription>
                <CardTitle className="font-bold font-mono text-lg tracking-tight sm:text-xl">{primaryDomain}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-muted-foreground text-xs">
                {provider === "cloudflare"
                  ? `Configured on Cloudflare Edge (ID: ${primaryDomainId})`
                  : `Configured in Short.io (ID: ${primaryDomainId})`}
              </CardContent>
            </Card>
          </div>

          {/* Main Container Card: Folder Bar, Search, and Table */}
          <Card className="flex flex-col gap-4 p-4 sm:p-6">
            {/* Folder Organization Chips / Tabs */}
            <div className="flex flex-col gap-2 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Filter by Category Folder
                </span>
                {activeFolderFilter !== "all" &&
                  activeFolderFilter !== "uncategorized" &&
                  (provider === "cloudflare" ? (
                    activeFolder && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setManagingFolder(activeFolder)}
                      >
                        <FolderCog className="size-3.5" />
                        Edit / Delete Folder
                      </Button>
                    )
                  ) : (
                    // Short.io's public API has no rename/recolor/delete folder endpoint, so deep-link to its settings.
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
                      <a
                        href={`https://app.short.io/users/dashboard/${primaryDomainId}/folders/${activeFolderFilter}/settings/general`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-3" />
                        Manage folder in Short.io
                      </a>
                    </Button>
                  ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Button
                  type="button"
                  variant={activeFolderFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectFolder("all")}
                  className="h-8 gap-1.5 rounded-full text-xs"
                >
                  All Links
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeFolderFilter === "all"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {loadedLinksCount}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={activeFolderFilter === "uncategorized" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectFolder("uncategorized")}
                  className="h-8 gap-1.5 rounded-full text-xs"
                >
                  Uncategorized
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeFolderFilter === "uncategorized"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {uncategorizedCount}
                  </span>
                </Button>

                {folders.map((folder) => {
                  const count = getLinkCountByFolder(links, folder.id);
                  const color = getFolderColor(folder);
                  const isActive = activeFolderFilter === folder.id;

                  return (
                    <Button
                      type="button"
                      key={folder.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectFolder(folder.id)}
                      className="h-8 gap-1.5 rounded-full text-xs"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: isActive ? "currentColor" : color }}
                      />
                      {folder.name}
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Search Bar & Active/Archived Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <InputGroup className="w-full sm:max-w-md">
                <InputGroupAddon>
                  <Search className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={searchInputRef}
                  placeholder="Search by title, slug, or destination..."
                  value={searchQuery}
                  onChange={(event) => table.getColumn("search")?.setFilterValue(event.target.value)}
                />
                <InputGroupAddon>
                  <Kbd>⌘K</Kbd>
                </InputGroupAddon>
              </InputGroup>

              {provider === "cloudflare" && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={!showArchived ? "default" : "outline"}
                    aria-pressed={!showArchived}
                    disabled={isFetchingList}
                    onClick={() => void reloadLinks(false)}
                    className="h-8 text-xs"
                  >
                    Active
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={showArchived ? "default" : "outline"}
                    aria-pressed={showArchived}
                    disabled={isFetchingList}
                    onClick={() => void reloadLinks(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Archive className="size-3.5" />
                    Archived
                  </Button>
                </div>
              )}
            </div>

            {/* Bulk Actions Bar */}
            <LinksBulkActions
              selectedCount={selectedCount}
              totalFilteredCount={filteredRows.length}
              selectedLinks={selectedLinks}
              isArchivedView={showArchived}
              canUnarchive={provider === "cloudflare"}
              isArchiving={isBulkArchiving}
              onClearSelection={handleClearSelection}
              onSelectAll={handleSelectAll}
              onMoveFolder={() => setIsBulkMoveOpen(true)}
              onDelete={() => setIsBulkDeleteOpen(true)}
              onCopyLinks={handleCopySelectedLinks}
              onArchive={() => void handleBulkArchive()}
              onUnarchive={() => void handleBulkUnarchive()}
            />

            {/* Links Data Table */}
            <div className={isFetchingList ? "opacity-60 transition-opacity" : undefined}>
              <LinksTable table={table} />
            </div>

            {nextPageToken && (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoadingMore}
                  onClick={() => void handleLoadMore()}
                  className="gap-2"
                >
                  {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
                  Load More Links
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab primaryDomain={primaryDomain} provider={provider} />
        </TabsContent>
        <TabsContent value="domains">
          <DomainsTab primaryDomainId={primaryDomainId} provider={provider} />
        </TabsContent>
      </Tabs>

      <BulkImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImported={() => void reloadLinks(showArchived)}
      />
      <LinkAnalyticsSheet link={analyticsLink} provider={provider} onOpenChange={(o) => !o && setAnalyticsLink(null)} />

      <CreateLinkDialog
        open={isCreateLinkOpen}
        onOpenChange={setIsCreateLinkOpen}
        folders={folders}
        domains={initialDomains}
        primaryDomain={primaryDomain}
        provider={provider}
        defaultFolderId={
          activeFolderFilter !== "all" && activeFolderFilter !== "uncategorized" ? activeFolderFilter : undefined
        }
        onLinkCreated={handleLinkCreated}
      />

      <CreateFolderDialog
        open={isCreateFolderOpen}
        onOpenChange={setIsCreateFolderOpen}
        onFolderCreated={handleFolderCreated}
      />

      <ManageFolderDialog
        open={Boolean(managingFolder)}
        onOpenChange={(open) => !open && setManagingFolder(null)}
        folder={managingFolder}
        onFolderUpdated={handleFolderUpdated}
        onFolderDeleted={handleFolderDeleted}
      />

      <EditLinkDialog
        open={Boolean(editingLink)}
        onOpenChange={(open) => !open && setEditingLink(null)}
        link={editingLink}
        folders={folders}
        primaryDomain={primaryDomain}
        provider={provider}
        onLinkUpdated={handleLinkUpdated}
      />

      <MoveFolderDialog
        open={Boolean(movingLink)}
        onOpenChange={(open) => !open && setMovingLink(null)}
        link={movingLink}
        folders={folders}
        onLinkMoved={handleLinkUpdated}
      />

      <DeleteLinkDialog
        open={Boolean(deletingLink)}
        onOpenChange={(open) => !open && setDeletingLink(null)}
        link={deletingLink}
        onLinkDeleted={handleLinkDeleted}
      />

      <BulkMoveFolderDialog
        open={isBulkMoveOpen}
        onOpenChange={setIsBulkMoveOpen}
        links={selectedLinks}
        folders={folders}
        onLinksMoved={handleBulkLinksMoved}
      />

      <BulkDeleteLinksDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        links={selectedLinks}
        onLinksDeleted={handleBulkLinksDeleted}
      />

      <QrCodeDialog
        open={Boolean(qrCodeLink)}
        onOpenChange={(open) => !open && setQrCodeLink(null)}
        link={qrCodeLink}
      />
    </div>
  );
}

"use client";

import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { Folder, FolderPlus, Globe, Link2, Plus, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { SHORTIO_CONFIG } from "@/config/shortio-config";
import { dataTableFeatures } from "@/lib/data-table-features";
import type { ShortFolder, ShortLinkItem } from "@/lib/shortio/types";

import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateLinkDialog } from "./create-link-dialog";
import { getFolderColor, getLinkCountByFolder } from "./data";
import { DeleteLinkDialog } from "./delete-link-dialog";
import { EditLinkDialog } from "./edit-link-dialog";
import { createLinksColumns } from "./links-columns";
import { LinksTable } from "./links-table";
import { MoveFolderDialog } from "./move-folder-dialog";
import { QrCodeDialog } from "./qr-code-dialog";

interface LinksProps {
  initialLinks: ShortLinkItem[];
  initialFolders: ShortFolder[];
}

export function Links({ initialLinks, initialFolders }: LinksProps) {
  const [links, setLinks] = React.useState<ShortLinkItem[]>(initialLinks);
  const [folders, setFolders] = React.useState<ShortFolder[]>(initialFolders);
  const [activeFolderFilter, setActiveFolderFilter] = React.useState<string>("all");

  // Modals state
  const [isCreateLinkOpen, setIsCreateLinkOpen] = React.useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [editingLink, setEditingLink] = React.useState<ShortLinkItem | null>(null);
  const [movingLink, setMovingLink] = React.useState<ShortLinkItem | null>(null);
  const [deletingLink, setDeletingLink] = React.useState<ShortLinkItem | null>(null);
  const [qrCodeLink, setQrCodeLink] = React.useState<ShortLinkItem | null>(null);

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

  const columns = React.useMemo(
    () =>
      createLinksColumns({
        folders,
        onEdit: (link) => setEditingLink(link),
        onMoveFolder: (link) => setMovingLink(link),
        onDelete: (link) => setDeletingLink(link),
        onQrCode: (link) => setQrCodeLink(link),
      }),
    [folders],
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

  const handleLinkCreated = (newLink: ShortLinkItem) => {
    setLinks((prev) => [newLink, ...prev]);
  };

  const handleLinkUpdated = (updatedLink: ShortLinkItem) => {
    setLinks((prev) => prev.map((l) => (l.id === updatedLink.id ? updatedLink : l)));
  };

  const handleLinkDeleted = (deletedLinkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== deletedLinkId));
  };

  const handleFolderCreated = (newFolder: ShortFolder) => {
    setFolders((prev) => [...prev, newFolder]);
  };

  // KPI Calculations
  const totalLinksCount = links.length;
  const totalFoldersCount = folders.length;
  const devfestFolder = folders.find((f) => f.name.toLowerCase().includes("devfest"));
  const devfestLinksCount = devfestFolder ? getLinkCountByFolder(links, devfestFolder.id) : 0;
  const uncategorizedCount = getLinkCountByFolder(links);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">Short Links</h1>
            <span className="rounded-md border bg-muted/60 px-2 py-0.5 font-medium text-muted-foreground text-xs">
              Organizer Only
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage, categorize, generate, edit, and delete branded short links on {SHORTIO_CONFIG.domain}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)} className="gap-1.5">
            <FolderPlus className="size-4" />
            New Folder
          </Button>
          <Button size="sm" onClick={() => setIsCreateLinkOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Create Short Link
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>Total Links</span>
              <Link2 className="size-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="font-bold text-2xl tracking-tight">{totalLinksCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-muted-foreground text-xs">
            Live redirects active on {SHORTIO_CONFIG.domain}
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
            {uncategorizedCount} link{uncategorizedCount === 1 ? "" : "s"} uncategorized
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>DevFest Links</span>
              <Sparkles className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="font-bold text-2xl tracking-tight">{devfestLinksCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-muted-foreground text-xs">Organized under the DevFest category</CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="flex items-center justify-between text-xs">
              <span>Primary Domain</span>
              <Globe className="size-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="font-bold font-mono text-lg tracking-tight sm:text-xl">
              {SHORTIO_CONFIG.domain}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-muted-foreground text-xs">
            Configured in Short.io (ID: {SHORTIO_CONFIG.domainId})
          </CardContent>
        </Card>
      </div>

      {/* Main Container Card: Folder Bar, Search, and Table */}
      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        {/* Folder Organization Chips / Tabs */}
        <div className="flex flex-col gap-2 border-b pb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Filter by Category Folder
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
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
                {totalLinksCount}
              </span>
            </Button>

            <Button
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
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
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
        </div>

        {/* Links Data Table */}
        <LinksTable table={table} />
      </Card>

      {/* Modals & Dialogs */}
      <CreateLinkDialog
        open={isCreateLinkOpen}
        onOpenChange={setIsCreateLinkOpen}
        folders={folders}
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

      <EditLinkDialog
        open={Boolean(editingLink)}
        onOpenChange={(open) => !open && setEditingLink(null)}
        link={editingLink}
        folders={folders}
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

      <QrCodeDialog
        open={Boolean(qrCodeLink)}
        onOpenChange={(open) => !open && setQrCodeLink(null)}
        link={qrCodeLink}
      />
    </div>
  );
}

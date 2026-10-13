"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  FileArchive,
  FileText,
  FileVideo,
  FolderPlus,
  Grid,
  HardDrive,
  ImageIcon,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import type { FolderItem, MediaItem, R2DirectoryContent } from "@/lib/r2/types";
import { formatFileSize } from "@/lib/r2/utils";
import { fetchMediaDirectoryAction } from "@/server/media-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { DeleteMediaDialog } from "./delete-media-dialog";
import { MediaBreadcrumbs } from "./media-breadcrumbs";
import { MediaDetailSheet } from "./media-detail-sheet";
import { FolderCard, MediaCard } from "./media-grid-item";
import { MediaListTable } from "./media-list-table";
import { MoveMediaDialog } from "./move-media-dialog";
import { RenameMediaDialog } from "./rename-media-dialog";
import { UploadMediaDialog } from "./upload-media-dialog";

interface MediaViewProps {
  initialContent: R2DirectoryContent;
}

export function MediaView({ initialContent }: MediaViewProps) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  React.useEffect(() => {
    if (user && !isExecutiveOrganizer(user)) {
      router.replace("/dashboard/member");
    }
  }, [user, router]);

  const [content, setContent] = React.useState<R2DirectoryContent>(initialContent);
  const [currentPrefix, setCurrentPrefix] = React.useState<string>(initialContent.currentPrefix);
  const [isLoading, setIsLoading] = React.useState(false);

  // Filters & display
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  // Selection
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  // Dialog triggers
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<MediaItem | null>(null);
  const [renamingItem, setRenamingItem] = React.useState<MediaItem | null>(null);
  const [movingItem, setMovingItem] = React.useState<MediaItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<MediaItem | null>(null);
  const [deletingFolder, setDeletingFolder] = React.useState<FolderItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut (⌘K) to focus search
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

  const refreshDirectory = React.useCallback(
    async (prefixToLoad = currentPrefix) => {
      setIsLoading(true);
      try {
        const res = await fetchMediaDirectoryAction(prefixToLoad);
        if (res.success && res.data) {
          setContent(res.data);
          setCurrentPrefix(prefixToLoad);
          setSelectedKeys(new Set());
        } else {
          toast.error(res.error ?? "Failed to load R2 directory");
        }
      } catch {
        toast.error("Network error while loading files");
      } finally {
        setIsLoading(false);
      }
    },
    [currentPrefix],
  );

  const handleNavigate = (prefix: string) => {
    void refreshDirectory(prefix);
  };

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedKeys.size === filteredItems.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredItems.map((i) => i.key)));
    }
  };

  // Filtered files based on search and category
  const filteredItems = React.useMemo(() => {
    return content.items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [content.items, searchQuery, categoryFilter]);

  const filteredFolders = React.useMemo(() => {
    if (categoryFilter !== "all") return [];
    return content.folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  }, [content.folders, searchQuery, categoryFilter]);

  // Aggregate stats
  const totalSizeBytes = React.useMemo(() => {
    return content.items.reduce((acc, it) => acc + it.size, 0);
  }, [content.items]);

  if (user && !isExecutiveOrganizer(user)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">Bucket Storage</h1>
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
              Cloudflare R2
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage directory folders, upload assets, organize media, and distribute GDG Jakarta CDN links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshDirectory(currentPrefix)}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)} className="gap-1.5">
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
          <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-1.5">
            <UploadCloud className="h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-xs">Active Directory</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate font-bold font-mono text-foreground text-lg" title={currentPrefix || "/ (Root)"}>
              {currentPrefix ? `/${currentPrefix}` : "/ (Root)"}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">Current storage location</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-xs">Total Subfolders</CardTitle>
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-foreground">{content.folders.length}</div>
            <p className="mt-1 text-muted-foreground text-xs">Folders in this directory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-xs">Total Files</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-foreground">{content.items.length}</div>
            <p className="mt-1 text-muted-foreground text-xs">{filteredItems.length} files displayed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-xs">Total File Size</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold font-mono text-2xl text-foreground">{formatFileSize(totalSizeBytes)}</div>
            <p className="mt-1 text-muted-foreground text-xs">Accumulated size of this directory</p>
          </CardContent>
        </Card>
      </div>

      {/* Directory Navigation & Action Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          {/* Breadcrumb row */}
          <div className="border-b pb-3">
            <MediaBreadcrumbs currentPrefix={currentPrefix} onNavigate={handleNavigate} />
          </div>

          {/* Search, Filter & View Mode controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <InputGroup className="w-full sm:max-w-xs">
                <InputGroupAddon>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={searchInputRef}
                  placeholder="Search files or folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <InputGroupAddon>
                  <Kbd>⌘K</Kbd>
                </InputGroupAddon>
              </InputGroup>

              {/* Category Filter Tabs */}
              <div className="hidden lg:block">
                <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="image" className="gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> Images
                    </TabsTrigger>
                    <TabsTrigger value="video" className="gap-1">
                      <FileVideo className="h-3.5 w-3.5" /> Videos
                    </TabsTrigger>
                    <TabsTrigger value="document" className="gap-1">
                      <FileText className="h-3.5 w-3.5" /> Documents
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="gap-1">
                      <FileArchive className="h-3.5 w-3.5" /> Archives
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border bg-muted/40 p-0.5">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating/Sticky Bulk Selection Bar */}
      {selectedKeys.size > 0 && (
        <div className="sticky top-4 z-20 flex items-center justify-between rounded-xl border border-primary/20 bg-background/95 p-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-xs">
              {selectedKeys.size} Selected
            </Badge>
            <span className="text-muted-foreground text-xs">Actions for selected items:</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" onClick={() => setSelectedKeys(new Set())} className="text-xs">
              Deselect All
            </Button>
            <Button variant="destructive" size="xs" onClick={() => setIsBulkDeleteOpen(true)} className="gap-1 text-xs">
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedKeys.size}) Files
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {(() => {
        if (isLoading) {
          return (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border bg-card p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 font-medium text-foreground text-sm">Loading files from Cloudflare R2...</p>
            </div>
          );
        }

        if (filteredFolders.length === 0 && filteredItems.length === 0) {
          return (
            <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HardDrive className="h-8 w-8" />
              </div>
              <CardTitle className="mt-4 text-base">This directory is empty</CardTitle>
              <CardDescription className="mt-1 max-w-sm text-xs">
                There are no files or folders in this directory yet. Start by creating a new folder or uploading media.
              </CardDescription>
              <div className="mt-5 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)} className="gap-1.5">
                  <FolderPlus className="h-4 w-4" /> New Folder
                </Button>
                <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-1.5">
                  <UploadCloud className="h-4 w-4" /> Upload Files
                </Button>
              </div>
            </Card>
          );
        }

        if (viewMode === "grid") {
          return (
            <div className="space-y-6">
              {/* Folders Section in Grid */}
              {filteredFolders.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    Folders ({filteredFolders.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {filteredFolders.map((folder) => (
                      <FolderCard
                        key={folder.prefix}
                        folder={folder}
                        onOpen={handleNavigate}
                        onDelete={(f) => setDeletingFolder(f)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Media Items in Grid */}
              {filteredItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Media Files ({filteredItems.length})
                    </h2>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleToggleSelectAll}
                      className="text-muted-foreground text-xs hover:text-foreground"
                    >
                      {selectedKeys.size === filteredItems.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {filteredItems.map((item) => (
                      <MediaCard
                        key={item.key}
                        item={item}
                        isSelected={selectedKeys.has(item.key)}
                        onToggleSelect={toggleSelectKey}
                        onPreview={(it) => setPreviewItem(it)}
                        onRename={(it) => setRenamingItem(it)}
                        onMove={(it) => setMovingItem(it)}
                        onDelete={(it) => setDeletingItem(it)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }

        return (
          /* List / Table Mode */
          <MediaListTable
            folders={filteredFolders}
            items={filteredItems}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelectKey}
            onToggleSelectAll={handleToggleSelectAll}
            onOpenFolder={handleNavigate}
            onDeleteFolder={(f) => setDeletingFolder(f)}
            onPreview={(it) => setPreviewItem(it)}
            onRename={(it) => setRenamingItem(it)}
            onMove={(it) => setMovingItem(it)}
            onDelete={(it) => setDeletingItem(it)}
          />
        );
      })()}

      {/* Modal Dialogs and Inspection Sheet */}
      <CreateFolderDialog
        currentPrefix={currentPrefix}
        isOpen={isCreateFolderOpen}
        onOpenChange={setIsCreateFolderOpen}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />

      <UploadMediaDialog
        currentPrefix={currentPrefix}
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />

      <MediaDetailSheet
        item={previewItem}
        isOpen={Boolean(previewItem)}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        onRename={(it) => setRenamingItem(it)}
        onMove={(it) => setMovingItem(it)}
        onDelete={(it) => setDeletingItem(it)}
      />

      <RenameMediaDialog
        item={renamingItem}
        isOpen={Boolean(renamingItem)}
        onOpenChange={(open) => !open && setRenamingItem(null)}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />

      <MoveMediaDialog
        item={movingItem}
        availableFolders={content.folders}
        isOpen={Boolean(movingItem)}
        onOpenChange={(open) => !open && setMovingItem(null)}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />

      <DeleteMediaDialog
        item={deletingItem}
        folder={deletingFolder}
        isOpen={Boolean(deletingItem || deletingFolder)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
            setDeletingFolder(null);
          }
        }}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />

      <BulkDeleteDialog
        selectedKeys={Array.from(selectedKeys)}
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onSuccess={() => void refreshDirectory(currentPrefix)}
      />
    </div>
  );
}

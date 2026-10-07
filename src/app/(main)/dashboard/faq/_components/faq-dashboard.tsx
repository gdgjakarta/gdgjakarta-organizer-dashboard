"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useFaqContent } from "@/lib/content/hooks";
import type { FaqCategory, FaqItem } from "@/lib/content/types";
import { cn } from "@/lib/utils";

import { FaqItemDialog } from "./faq-item-dialog";

export function FaqDashboard() {
  const { content, setContent, hasChanges, discardChanges, loading, saving, saveContent, resetToDefaults } =
    useFaqContent();

  const {
    showPrompt: showUnsavedPrompt,
    setShowPrompt: setShowUnsavedPrompt,
    isSaving: isSavingAndLeaving,
    cancelNavigation,
    confirmDiscardAndLeave,
    confirmSaveAndLeave,
  } = useUnsavedChanges({
    hasChanges,
    onSave: async () => saveContent(content),
    onDiscard: discardChanges,
  });

  const [activeTab, setActiveTab] = useState("questions");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Item modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);

  // Reset confirmation state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Delete item confirmation state
  const [itemToDelete, setItemToDelete] = useState<FaqItem | null>(null);

  // New category state
  const [newCatKey, setNewCatKey] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");

  const filteredItems = useMemo(() => {
    return content.items.filter((item) => {
      const matchCat = selectedCategory === "all" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const matchText =
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [content.items, selectedCategory, searchQuery]);

  const handleSaveItem = (item: FaqItem) => {
    const existingIndex = content.items.findIndex((i) => i.id === item.id);
    let updated: FaqItem[];
    if (existingIndex >= 0) {
      updated = [...content.items];
      updated[existingIndex] = item;
    } else {
      updated = [...content.items, { ...item, order: content.items.length + 1 }];
    }
    setContent({ ...content, items: updated });
  };

  const handleDeleteItem = (id: string) => {
    const updated = content.items.filter((i) => i.id !== id);
    setContent({ ...content, items: updated });
    setItemToDelete(null);
  };

  const handleMoveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.items.length) return;

    const reordered = [...content.items];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // re-assign orders
    const withOrders = reordered.map((item, idx) => ({ ...item, order: idx + 1 }));
    setContent({ ...content, items: withOrders });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatKey.trim() || !newCatLabel.trim()) return;
    const cleanKey = newCatKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (content.categories.some((c) => c.key === cleanKey)) return;

    const updatedCategories: FaqCategory[] = [
      ...content.categories,
      { key: cleanKey, label: newCatLabel.trim(), iconName: "HelpCircle" },
    ];
    setContent({ ...content, categories: updatedCategories });
    setNewCatKey("");
    setNewCatLabel("");
  };

  const handleDeleteCategory = (catKey: string) => {
    if (catKey === "all" || catKey === "general") return;
    const updatedCategories = content.categories.filter((c) => c.key !== catKey);
    // reassigned items in deleted category to general
    const updatedItems = content.items.map((item) =>
      item.category === catKey ? { ...item, category: "general", categoryLabel: "General" } : item,
    );
    setContent({ ...content, categories: updatedCategories, items: updatedItems });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl lg:text-3xl">
              FAQ & Policy Configuration
            </h1>
            <Badge variant="outline" className="hidden text-xs sm:inline-flex">
              Live Editor
            </Badge>
            {hasChanges && (
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium animate-in fade-in duration-200"
              >
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
                Unsaved Changes
              </Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Adjust FAQ questions, payment policies, verified anti-fraud emails, and contact options for public display.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button variant="outline" size="sm" asChild className="justify-center gap-1.5 text-xs">
            <Link href="/faq" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              <span>Preview Live FAQ</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="justify-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            variant={hasChanges ? "default" : "secondary"}
            onClick={() => saveContent(content)}
            disabled={!hasChanges || saving || loading}
            title={hasChanges ? "Save FAQ changes" : "No unsaved changes"}
            className={cn(
              "col-span-2 justify-center gap-1.5 font-semibold text-xs sm:col-span-1 transition-all",
              !hasChanges &&
                "bg-muted text-muted-foreground/70 border border-border/50 shadow-none cursor-not-allowed hover:bg-muted opacity-60",
              hasChanges && "ring-1 ring-primary/20 shadow-xs hover:ring-primary/40",
            )}
          >
            {saving ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                {hasChanges && (
                  <span className="relative flex size-1.5 mr-0.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
                  </span>
                )}
                <Save className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1">
          <TabsList className="inline-flex h-9 w-auto min-w-full justify-start gap-1 p-1 sm:min-w-0 sm:justify-center">
            <TabsTrigger value="questions" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Questions ({content.items.length})
            </TabsTrigger>
            <TabsTrigger value="notice" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Critical Payment Notice
            </TabsTrigger>
            <TabsTrigger value="categories" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Categories ({content.categories.length - 1})
            </TabsTrigger>
            <TabsTrigger value="header" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Header & Support
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── 1. Questions Tab ── */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search questions or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full pl-8 text-xs"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
              >
                {content.categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
              className="w-full justify-center gap-1.5 font-semibold text-xs sm:w-auto"
            >
              <Plus className="size-3.5" />
              <span>Add FAQ Question</span>
            </Button>
          </div>

          {/* Mobile Card List View (visible on small screens) */}
          <div className="space-y-3 md:hidden">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => (
                <Card key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono font-semibold text-muted-foreground text-xs">
                        #{item.order ?? index + 1}
                      </span>
                      <Badge variant="secondary" className="font-normal text-[11px]">
                        {item.categoryLabel}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {(item.isActive ?? true) ? "Active" : "Hidden"}
                      </span>
                      <Switch
                        checked={item.isActive ?? true}
                        onCheckedChange={(checked) => {
                          const updated = content.items.map((i) =>
                            i.id === item.id ? { ...i, isActive: checked } : i,
                          );
                          setContent({ ...content, items: updated });
                        }}
                        aria-label={`Toggle active state for ${item.question}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground text-sm leading-snug">{item.question}</h3>
                    <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">{item.answer}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        disabled={index === 0}
                        onClick={() => handleMoveItem(index, "up")}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                        <span className="text-[11px]">Up</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        disabled={index === filteredItems.length - 1}
                        onClick={() => handleMoveItem(index, "down")}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                        <span className="text-[11px]">Down</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-3 text-primary text-xs hover:text-primary"
                        onClick={() => {
                          setEditingItem(item);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-3 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setItemToDelete(item)}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center text-muted-foreground text-xs">
                No FAQ questions found matching the filter.
              </Card>
            )}
          </div>

          {/* Desktop Table View (visible on md and up) */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Question & Preview</TableHead>
                    <TableHead className="w-32 text-xs">Category</TableHead>
                    <TableHead className="w-24 text-center text-xs">Status</TableHead>
                    <TableHead className="w-36 text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <TableRow key={item.id} className="hover:bg-muted/40">
                        <TableCell className="text-center font-mono text-muted-foreground text-xs">
                          {item.order ?? index + 1}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="space-y-1">
                            <span className="line-clamp-1 font-semibold text-foreground text-xs sm:text-sm">
                              {item.question}
                            </span>
                            <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">{item.answer}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal text-[11px]">
                            {item.categoryLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.isActive ?? true}
                            onCheckedChange={(checked) => {
                              const updated = content.items.map((i) =>
                                i.id === item.id ? { ...i, isActive: checked } : i,
                              );
                              setContent({ ...content, items: updated });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={index === 0}
                              onClick={() => handleMoveItem(index, "up")}
                              title="Move up"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={index === filteredItems.length - 1}
                              onClick={() => handleMoveItem(index, "down")}
                              title="Move down"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-primary hover:text-primary"
                              onClick={() => {
                                setEditingItem(item);
                                setDialogOpen(true);
                              }}
                              title="Edit item"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => setItemToDelete(item)}
                              title="Delete item"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-xs">
                        No FAQ questions found matching the filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 2. Critical Notice Tab ── */}
        <TabsContent value="notice" className="space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">Crucial Payment & Anti-Fraud Notice</CardTitle>
                  <CardDescription className="text-xs">
                    This prominent notice protects community members against payment fraud and unverified scam emails.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border bg-muted/40 p-2 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
                  <Label htmlFor="notice-switch" className="cursor-pointer font-medium text-xs">
                    Enable Notice
                  </Label>
                  <Switch
                    id="notice-switch"
                    checked={content.notice.enabled}
                    onCheckedChange={(val) => setContent({ ...content, notice: { ...content.notice, enabled: val } })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="notice-title" className="text-xs">
                  Alert Title
                </Label>
                <Input
                  id="notice-title"
                  value={content.notice.title}
                  onChange={(e) => setContent({ ...content, notice: { ...content.notice, title: e.target.value } })}
                  placeholder="Crucial Payment Notice"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notice-desc" className="text-xs">
                  Alert Description
                </Label>
                <Textarea
                  id="notice-desc"
                  rows={3}
                  value={content.notice.description}
                  onChange={(e) =>
                    setContent({ ...content, notice: { ...content.notice, description: e.target.value } })
                  }
                  placeholder="All official payment requests and ticket instructions will ONLY come from verified emails..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="verified-emails" className="text-xs">
                    Verified Email Addresses (comma separated)
                  </Label>
                  <Input
                    id="verified-emails"
                    value={content.notice.verifiedEmails.join(", ")}
                    onChange={(e) => {
                      const emails = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setContent({ ...content, notice: { ...content.notice, verifiedEmails: emails } });
                    }}
                    placeholder="info@gdgjakarta.org, info@gdgjakarta.com"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Highlighted inside styled badge codes on the alert banner.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="policy-link" className="text-xs">
                    Payment Policy Link Path
                  </Label>
                  <Input
                    id="policy-link"
                    value={content.notice.policyUrl}
                    onChange={(e) =>
                      setContent({ ...content, notice: { ...content.notice, policyUrl: e.target.value } })
                    }
                    placeholder="/payment-policy"
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="space-y-2 border-t pt-4">
                <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Live Banner Preview:
                </span>
                <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
                  <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">
                    {content.notice.title || "Crucial Payment Notice"}
                  </AlertTitle>
                  <AlertDescription className="mt-1 break-words text-amber-800 text-xs leading-relaxed sm:text-sm dark:text-amber-300">
                    {content.notice.description}{" "}
                    <span className="mt-1 inline-flex flex-wrap gap-1 sm:mt-0">
                      {content.notice.verifiedEmails.map((email) => (
                        <code
                          key={email}
                          className="break-all rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-950/70"
                        >
                          {email}
                        </code>
                      ))}
                    </span>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Categories Tab ── */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Add Category */}
            <Card className="md:col-span-1">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base">Add New Category</CardTitle>
                <CardDescription className="text-xs">Create a category to group related questions.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <form onSubmit={handleAddCategory} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-label" className="text-xs">
                      Category Display Label
                    </Label>
                    <Input
                      id="cat-label"
                      placeholder="e.g. Ticketing & Passes"
                      value={newCatLabel}
                      onChange={(e) => {
                        setNewCatLabel(e.target.value);
                        if (!newCatKey) {
                          setNewCatKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                        }
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cat-key" className="text-xs">
                      Category Identifier Key
                    </Label>
                    <Input
                      id="cat-key"
                      placeholder="e.g. ticketing"
                      value={newCatKey}
                      onChange={(e) => setNewCatKey(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" size="sm" className="w-full justify-center gap-1.5 font-semibold text-xs">
                    <Plus className="size-3.5" />
                    <span>Create Category</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing Categories */}
            <Card className="md:col-span-2">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base">Active Categories</CardTitle>
                <CardDescription className="text-xs">
                  Filter pills displayed on top of the FAQ accordion.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile View for Categories */}
                <div className="divide-y border-t sm:hidden">
                  {content.categories.map((cat) => {
                    const count =
                      cat.key === "all"
                        ? content.items.length
                        : content.items.filter((i) => i.category === cat.key).length;
                    const isProtected = cat.key === "all" || cat.key === "general";

                    return (
                      <div key={cat.key} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-foreground text-xs">{cat.label}</span>
                            <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
                              {count} {count === 1 ? "question" : "questions"}
                            </Badge>
                          </div>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">key: {cat.key}</p>
                        </div>
                        <div className="shrink-0">
                          {isProtected ? (
                            <span className="text-[11px] text-muted-foreground italic">Protected</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCategory(cat.key)}
                              className="h-8 px-2.5 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View Table for Categories */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Label</TableHead>
                        <TableHead className="text-xs">Key</TableHead>
                        <TableHead className="text-center text-xs">Questions Count</TableHead>
                        <TableHead className="text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {content.categories.map((cat) => {
                        const count =
                          cat.key === "all"
                            ? content.items.length
                            : content.items.filter((i) => i.category === cat.key).length;
                        const isProtected = cat.key === "all" || cat.key === "general";

                        return (
                          <TableRow key={cat.key}>
                            <TableCell className="font-semibold text-xs sm:text-sm">{cat.label}</TableCell>
                            <TableCell className="font-mono text-muted-foreground text-xs">{cat.key}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {count}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isProtected ? (
                                <span className="text-[11px] text-muted-foreground italic">Protected</span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCategory(cat.key)}
                                  className="h-7 text-destructive text-xs hover:text-destructive"
                                >
                                  Delete
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 4. Header & Support Tab ── */}
        <TabsContent value="header" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Header Settings */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base">FAQ Page Header</CardTitle>
                <CardDescription className="text-xs">
                  Main headline and introduction at the top of the FAQ page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="header-badge" className="text-xs">
                    Badge Text
                  </Label>
                  <Input
                    id="header-badge"
                    value={content.header.badge}
                    onChange={(e) => setContent({ ...content, header: { ...content.header, badge: e.target.value } })}
                    placeholder="GDG Jakarta Community Help Center"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="header-title" className="text-xs">
                    Page Headline
                  </Label>
                  <Input
                    id="header-title"
                    value={content.header.title}
                    onChange={(e) => setContent({ ...content, header: { ...content.header, title: e.target.value } })}
                    placeholder="Frequently Asked Questions"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="header-desc" className="text-xs">
                    Subtitle Description
                  </Label>
                  <Textarea
                    id="header-desc"
                    rows={3}
                    value={content.header.description}
                    onChange={(e) =>
                      setContent({ ...content, header: { ...content.header, description: e.target.value } })
                    }
                    placeholder="Everything you need to know about our events, commitment fees, ticket reservations..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact & Support Settings */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base">Bottom Help Card</CardTitle>
                <CardDescription className="text-xs">Support contact card shown beneath the questions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-title" className="text-xs">
                    Contact Headline
                  </Label>
                  <Input
                    id="contact-title"
                    value={content.contact.title}
                    onChange={(e) => setContent({ ...content, contact: { ...content.contact, title: e.target.value } })}
                    placeholder="Still have questions or doubts?"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-desc" className="text-xs">
                    Contact Text
                  </Label>
                  <Textarea
                    id="contact-desc"
                    rows={2}
                    value={content.contact.description}
                    onChange={(e) =>
                      setContent({ ...content, contact: { ...content.contact, description: e.target.value } })
                    }
                    placeholder="Can't find what you are looking for, or received a suspicious message?"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" className="text-xs">
                      Official Contact Email
                    </Label>
                    <Input
                      id="contact-email"
                      value={content.contact.email}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, email: e.target.value } })
                      }
                      placeholder="info@gdgjakarta.org"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-ig" className="text-xs">
                      Instagram Handle
                    </Label>
                    <Input
                      id="contact-ig"
                      value={content.contact.instagram}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, instagram: e.target.value } })
                      }
                      placeholder="@gdgjakarta"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Faq Item Dialog */}
      <FaqItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        faqItem={editingItem}
        categories={content.categories}
        onSave={handleSaveItem}
      />

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this FAQ question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{itemToDelete?.question}&quot; from the public FAQ page. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && handleDeleteItem(itemToDelete.id)}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset FAQ to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite all custom questions, categories, and notice settings with GDG Jakarta&apos;s original
              default FAQ content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => {
                void resetToDefaults();
                setConfirmResetOpen(false);
              }}
            >
              Confirm Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowUnsavedPrompt}
        onCancel={cancelNavigation}
        onDiscard={confirmDiscardAndLeave}
        onSave={confirmSaveAndLeave}
        saving={isSavingAndLeaving}
        title="Unsaved FAQ Changes"
        description="You have unsaved changes in your FAQ & Policy configuration. If you leave without saving, your modifications will be discarded."
      />
    </div>
  );
}

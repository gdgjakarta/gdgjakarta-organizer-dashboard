"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Mail,
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
import { useFaqContent } from "@/lib/content/hooks";
import type { FaqCategory, FaqItem } from "@/lib/content/types";

import { FaqItemDialog } from "./faq-item-dialog";

export function FaqDashboard() {
  const { content, setContent, loading, saving, saveContent, resetToDefaults } = useFaqContent();

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              FAQ & Policy Configuration
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">
              Live Editor
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust FAQ questions, payment policies, verified anti-fraud emails, and contact options for public display.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link href="/faq" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              <span>Preview Live FAQ</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={() => saveContent(content)}
            disabled={saving || loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <Save className="size-3.5" />
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-4">
          <TabsTrigger value="questions" className="text-xs sm:text-sm">
            Questions ({content.items.length})
          </TabsTrigger>
          <TabsTrigger value="notice" className="text-xs sm:text-sm">
            Critical Payment Notice
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">
            Categories ({content.categories.length - 1})
          </TabsTrigger>
          <TabsTrigger value="header" className="text-xs sm:text-sm">
            Header & Support
          </TabsTrigger>
        </TabsList>

        {/* ── 1. Questions Tab ── */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search questions or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>Add FAQ Question</span>
            </Button>
          </div>

          <Card>
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
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {item.order ?? index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground text-xs sm:text-sm line-clamp-1">
                              {item.question}
                            </span>
                            <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">{item.answer}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px] font-normal">
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">Crucial Payment & Anti-Fraud Notice</CardTitle>
                  <CardDescription className="text-xs">
                    This prominent notice protects community members against payment fraud and unverified scam emails.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="notice-switch" className="text-xs font-medium cursor-pointer">
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
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="pt-4 border-t space-y-2">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Live Banner Preview:
                </span>
                <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
                  <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">
                    {content.notice.title || "Crucial Payment Notice"}
                  </AlertTitle>
                  <AlertDescription className="mt-1 text-amber-800 text-xs sm:text-sm leading-relaxed dark:text-amber-300">
                    {content.notice.description}{" "}
                    {content.notice.verifiedEmails.map((email) => (
                      <code
                        key={email}
                        className="mr-1 rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-950/70"
                      >
                        {email}
                      </code>
                    ))}
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Categories Tab ── */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Category */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Add New Category</CardTitle>
                <CardDescription className="text-xs">Create a category to group related questions.</CardDescription>
              </CardHeader>
              <CardContent>
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

                  <Button type="submit" size="sm" className="w-full gap-1.5 text-xs font-semibold">
                    <Plus className="size-3.5" />
                    <span>Create Category</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing Categories */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Active Categories</CardTitle>
                <CardDescription className="text-xs">
                  Filter pills displayed on top of the FAQ accordion.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
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
                          <TableCell className="font-mono text-xs text-muted-foreground">{cat.key}</TableCell>
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
                                className="h-7 text-xs text-destructive hover:text-destructive"
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 4. Header & Support Tab ── */}
        <TabsContent value="header" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Header Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">FAQ Page Header</CardTitle>
                <CardDescription className="text-xs">
                  Main headline and introduction at the top of the FAQ page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              <CardHeader>
                <CardTitle className="text-base">Bottom Help Card</CardTitle>
                <CardDescription className="text-xs">Support contact card shown beneath the questions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && handleDeleteItem(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
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
    </div>
  );
}

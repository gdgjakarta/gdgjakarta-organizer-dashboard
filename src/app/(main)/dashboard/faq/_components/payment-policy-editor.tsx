"use client";

import { useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CreditCard,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
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
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { usePaymentPolicyContent } from "@/lib/content/hooks";
import type { PaymentPolicySection } from "@/lib/content/types";

import { PaymentPolicySectionDialog } from "./payment-policy-section-dialog";

export function PaymentPolicyEditor() {
  const { content, setContent, hasChanges, discardChanges, saving, saveContent, resetToDefaults } =
    usePaymentPolicyContent();

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PaymentPolicySection | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const sections = (content.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleAddSection = () => {
    setEditingSection(null);
    setDialogOpen(true);
  };

  const handleEditSection = (section: PaymentPolicySection) => {
    setEditingSection(section);
    setDialogOpen(true);
  };

  const handleDeleteSection = (id: string) => {
    setContent({
      ...content,
      sections: (content.sections || []).filter((s) => s.id !== id),
    });
  };

  const handleToggleSection = (id: string, active: boolean) => {
    setContent({
      ...content,
      sections: (content.sections || []).map((s) => (s.id === id ? { ...s, isActive: active } : s)),
    });
  };

  const handleMoveSection = (idx: number, dir: "up" | "down") => {
    const list = [...sections];
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    const reordered = list.map((item, i) => ({ ...item, order: i + 1 }));
    setContent({ ...content, sections: reordered });
  };

  const handleSaveSection = (saved: PaymentPolicySection) => {
    const currentList = content.sections || [];
    const exists = currentList.some((s) => s.id === saved.id);

    const updated = exists
      ? currentList.map((s) => (s.id === saved.id ? saved : s))
      : [...currentList, { ...saved, order: currentList.length + 1 }];

    setContent({ ...content, sections: updated });
  };

  return (
    <div className="space-y-6">
      {/* Overview & Quick Links */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-lg">Payment Policy Configuration</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Manage the content, commitment fee rules, anti-fraud guidelines, and verified channels published at{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">/payment-policy</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link href="/payment-policy" target="_blank">
              <ExternalLink className="size-3.5" />
              View Live Page
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            className="gap-1.5 text-destructive text-xs hover:text-destructive"
          >
            <RefreshCw className="size-3.5" />
            Reset Defaults
          </Button>
        </div>
      </div>

      {/* Header & Meta Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Header & Meta</CardTitle>
          <CardDescription className="text-xs">
            Configure the badge, title, and intro description shown at the top of the policy page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pol-badge" className="text-xs">
                Header Badge
              </Label>
              <Input
                id="pol-badge"
                value={content.header?.badge ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    header: { ...content.header, badge: e.target.value },
                  })
                }
                placeholder="Official GDG Jakarta Guidelines"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pol-title" className="text-xs">
                Page Title
              </Label>
              <Input
                id="pol-title"
                value={content.header?.title ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    header: { ...content.header, title: e.target.value },
                  })
                }
                placeholder="Payment Policy"
                className="text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pol-desc" className="text-xs">
              Header Subtitle / Intro
            </Label>
            <Textarea
              id="pol-desc"
              value={content.header?.description ?? ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  header: { ...content.header, description: e.target.value },
                })
              }
              placeholder="Official guidance regarding event commitment fees..."
              rows={2}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Notice Banner */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-500" />
                Anti-Fraud Verification Alert
              </CardTitle>
              <CardDescription className="text-xs">
                Highlighted amber callout displayed prominently below the header.
              </CardDescription>
            </div>
            <Switch
              checked={content.notice?.enabled ?? true}
              onCheckedChange={(checked) =>
                setContent({
                  ...content,
                  notice: { ...content.notice, enabled: checked },
                })
              }
            />
          </div>
        </CardHeader>
        {content.notice?.enabled && (
          <CardContent className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="pol-notice-title" className="text-xs">
                Alert Title
              </Label>
              <Input
                id="pol-notice-title"
                value={content.notice?.title ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    notice: { ...content.notice, title: e.target.value },
                  })
                }
                placeholder="Crucial: Official Payment Verification"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pol-notice-desc" className="text-xs">
                Alert Description
              </Label>
              <Textarea
                id="pol-notice-desc"
                value={content.notice?.description ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    notice: { ...content.notice, description: e.target.value },
                  })
                }
                placeholder="All official payment requests from GDG Jakarta will ONLY originate..."
                rows={3}
                className="text-xs"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Policy Sections Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold">Policy Content Sections</CardTitle>
              <CardDescription className="text-xs">
                Numbered structured sections explaining commitment fees, merchandise, and anti-fraud rules.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddSection} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center text-xs">#</TableHead>
                  <TableHead className="text-xs">Section Title & Content</TableHead>
                  <TableHead className="w-24 text-center text-xs">Status</TableHead>
                  <TableHead className="w-20 text-center text-xs">Order</TableHead>
                  <TableHead className="w-24 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                      No policy sections created. Click &quot;Add Section&quot; to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  sections.map((sec, idx) => (
                    <TableRow key={sec.id}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="max-w-[320px] sm:max-w-md">
                        <div className="space-y-1">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                            <span>{sec.title}</span>
                            {sec.callout && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400"
                              >
                                Callout
                              </Badge>
                            )}
                          </div>
                          {sec.body && (
                            <p className="line-clamp-2 text-muted-foreground text-[11px] leading-relaxed">{sec.body}</p>
                          )}
                          {sec.bullets && sec.bullets.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">• {sec.bullets.length} bullet point(s)</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={sec.isActive ?? true}
                          onCheckedChange={(checked) => handleToggleSection(sec.id, checked)}
                          aria-label="Toggle section active"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMoveSection(idx, "up")}
                            className="size-7"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={idx === sections.length - 1}
                            onClick={() => handleMoveSection(idx, "down")}
                            className="size-7"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditSection(sec)} className="size-7">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSection(sec.id)}
                            className="size-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contact Section Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Contact & Verification Box</CardTitle>
          <CardDescription className="text-xs">
            Configure contact details and help desk buttons displayed at the bottom of the policy page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pol-contact-title" className="text-xs">
              Section Title
            </Label>
            <Input
              id="pol-contact-title"
              value={content.contact?.title ?? ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  contact: { ...content.contact, title: e.target.value },
                })
              }
              placeholder="Questions or Doubts?"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pol-contact-desc" className="text-xs">
              Description
            </Label>
            <Textarea
              id="pol-contact-desc"
              value={content.contact?.description ?? ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  contact: { ...content.contact, description: e.target.value },
                })
              }
              placeholder="If you are ever in doubt or receive any suspicious payment request..."
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pol-contact-email" className="text-xs">
                Official Support Email
              </Label>
              <Input
                id="pol-contact-email"
                value={content.contact?.email ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    contact: { ...content.contact, email: e.target.value },
                  })
                }
                placeholder="info@gdgjakarta.org"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pol-contact-ig" className="text-xs">
                Instagram URL
              </Label>
              <Input
                id="pol-contact-ig"
                value={content.contact?.instagram ?? ""}
                onChange={(e) =>
                  setContent({
                    ...content,
                    contact: { ...content.contact, instagram: e.target.value },
                  })
                }
                placeholder="https://instagram.com/gdgjakarta"
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Save Bar */}
      <FloatingSaveBar
        isDirty={hasChanges}
        isSaving={saving}
        onSave={() => void saveContent(content)}
        onDiscard={discardChanges}
        saveLabel="Save Policy"
        savingLabel="Saving Policy..."
        savedLabel="Policy Saved"
        discardLabel="Discard"
        statusInfo={`${sections.length} Section(s)`}
        helperText="Updates immediately reflect on the public /payment-policy page."
      />

      {/* Unsaved Changes Prompt */}
      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowUnsavedPrompt}
        onCancel={cancelNavigation}
        onDiscard={confirmDiscardAndLeave}
        onSave={confirmSaveAndLeave}
        saving={isSavingAndLeaving}
        title="Unsaved Payment Policy Changes"
        description="You have unsaved changes in the payment policy. If you leave without saving, your modifications will be discarded."
      />

      {/* Section Dialog */}
      <PaymentPolicySectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        section={editingSection}
        onSave={handleSaveSection}
      />

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Payment Policy to Defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current payment policy in Firestore with the default GDG Jakarta policy
              guidelines. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await resetToDefaults();
                setResetDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Reset to Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

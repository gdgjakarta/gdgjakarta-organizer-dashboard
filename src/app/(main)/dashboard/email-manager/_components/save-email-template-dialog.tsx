"use client";

import { useEffect, useState } from "react";

import { Bookmark, BookmarkCheck, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { type EmailBlastTemplate, saveEmailBlastAsTemplate } from "./default-html-template";

interface SaveEmailTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSubject: string;
  currentHeaderUrl?: string;
  currentBody: string;
  activeTemplate?: EmailBlastTemplate | null;
  onSaved: (template: EmailBlastTemplate) => void;
}

export function SaveEmailTemplateDialog({
  open,
  onOpenChange,
  currentSubject,
  currentHeaderUrl,
  currentBody,
  activeTemplate,
  onSaved,
}: SaveEmailTemplateDialogProps) {
  const [name, setName] = useState("");
  const [badge, setBadge] = useState("Custom Template");
  const [description, setDescription] = useState("");
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (activeTemplate?.isCustom) {
      setName(activeTemplate.name);
      setBadge(activeTemplate.badge || "Custom Template");
      setDescription(activeTemplate.description || "");
      setIsUpdatingExisting(true);
    } else {
      setName(currentSubject ? `${currentSubject.slice(0, 40)} Template` : "");
      setBadge("Custom Template");
      setDescription("");
      setIsUpdatingExisting(false);
    }
  }, [open, activeTemplate, currentSubject]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }

    if (!currentBody.trim()) {
      toast.error("Email HTML content cannot be empty.");
      return;
    }

    const templateId = isUpdatingExisting && activeTemplate?.id ? activeTemplate.id : undefined;

    const saved = saveEmailBlastAsTemplate({
      id: templateId,
      name: name.trim(),
      badge: badge.trim() || "Custom Template",
      description: description.trim() || undefined,
      subject: currentSubject || "Important Update: [[EventName]]",
      headerUrl: currentHeaderUrl?.trim() || undefined,
      body: currentBody,
    });

    toast.success("Template Saved", {
      description: `"${saved.name}" is now saved in your templates library.`,
    });

    onSaved(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bookmark className="size-4 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-lg">Save as Email Template</DialogTitle>
              <DialogDescription className="text-xs">
                Save your subject line, header image, and HTML layout for reuse across future campaigns.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {activeTemplate?.isCustom && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Editing: {activeTemplate.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  You can overwrite this template or save as a new one.
                </span>
              </div>
              <Button
                type="button"
                variant={isUpdatingExisting ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsUpdatingExisting(!isUpdatingExisting)}
              >
                {isUpdatingExisting ? "Overwrite" : "Save as New"}
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-name" className="text-xs font-semibold">
              Template Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="e.g. VIP Speaker Invitation Keynote"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-badge" className="text-xs font-semibold">
                Badge / Tag
              </Label>
              <Input
                id="template-badge"
                placeholder="e.g. Speaker Outreach"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Content Summary</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
                <FileText className="size-3.5" />
                <span>{currentBody.length.toLocaleString()} chars HTML</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-desc" className="text-xs font-semibold">
              Description (Optional)
            </Label>
            <Textarea
              id="template-desc"
              placeholder="Brief note about when to use this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 resize-none text-xs"
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Snapshot to be saved:</span>
            </div>
            <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
              <div className="truncate">
                <strong className="text-foreground">Subject:</strong>{" "}
                {currentSubject || "Important Update: [[EventName]]"}
              </div>
              {currentHeaderUrl && (
                <div className="truncate">
                  <strong className="text-foreground">Header URL:</strong> {currentHeaderUrl}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="gap-1.5">
            <BookmarkCheck className="size-3.5" />
            {isUpdatingExisting ? "Update Template" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

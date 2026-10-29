"use client";

import { useEffect, useState } from "react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentPolicySection } from "@/lib/content/types";

interface PaymentPolicySectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: PaymentPolicySection | null;
  onSave: (section: PaymentPolicySection) => void;
}

export function PaymentPolicySectionDialog({ open, onOpenChange, section, onSave }: PaymentPolicySectionDialogProps) {
  const isEditing = Boolean(section);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bulletsText, setBulletsText] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Callout state
  const [hasCallout, setHasCallout] = useState(false);
  const [calloutType, setCalloutType] = useState<"info" | "warning" | "destructive" | "success">("warning");
  const [calloutTitle, setCalloutTitle] = useState("");
  const [calloutMessage, setCalloutMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    if (section) {
      setTitle(section.title);
      setBody(section.body);
      setBulletsText(section.bullets ? section.bullets.join("\n") : "");
      setIsActive(section.isActive ?? true);
      if (section.callout) {
        setHasCallout(true);
        setCalloutType(section.callout.type);
        setCalloutTitle(section.callout.title || "");
        setCalloutMessage(section.callout.message);
      } else {
        setHasCallout(false);
        setCalloutType("warning");
        setCalloutTitle("");
        setCalloutMessage("");
      }
    } else {
      setTitle("");
      setBody("");
      setBulletsText("");
      setIsActive(true);
      setHasCallout(false);
      setCalloutType("warning");
      setCalloutTitle("");
      setCalloutMessage("");
    }
  }, [section, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const bullets = bulletsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);

    const updatedSection: PaymentPolicySection = {
      id: section?.id ?? `section-${Date.now()}`,
      order: section?.order ?? 99,
      title: title.trim(),
      body: body.trim(),
      bullets,
      isActive,
      callout:
        hasCallout && calloutMessage.trim()
          ? {
              type: calloutType,
              title: calloutTitle.trim() || undefined,
              message: calloutMessage.trim(),
            }
          : undefined,
    };

    onSave(updatedSection);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Policy Section" : "Add Policy Section"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEditing
                ? "Update section title, content description, bullet points, or callout notices."
                : "Add a structured section to the official Payment Policy page."}
            </DialogDescription>
          </DialogHeader>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="sec-title" className="text-xs">
              Section Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Commitment Fee & Ticket Payments"
              required
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="sec-body" className="text-xs">
              Section Description / Intro Body
            </Label>
            <Textarea
              id="sec-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter section intro description..."
              rows={3}
            />
          </div>

          {/* Bullets */}
          <div className="space-y-1.5">
            <Label htmlFor="sec-bullets" className="text-xs">
              Bullet Points (One per line)
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Tip: Wrap terms in <code className="rounded bg-muted px-1">**bold**</code> for highlighting.
            </p>
            <Textarea
              id="sec-bullets"
              value={bulletsText}
              onChange={(e) => setBulletsText(e.target.value)}
              placeholder="**Point Title**: Description of the policy clause..."
              rows={4}
            />
          </div>

          {/* Callout Notice Box */}
          <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Highlight / Alert Box</Label>
                <p className="text-[11px] text-muted-foreground">
                  Optional banner callout inside this section (e.g. warning, anti-fraud notice).
                </p>
              </div>
              <Switch checked={hasCallout} onCheckedChange={setHasCallout} />
            </div>

            {hasCallout && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alert Style</Label>
                    <Select
                      value={calloutType}
                      onValueChange={(val: "info" | "warning" | "destructive" | "success") => setCalloutType(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warning">Warning (Amber)</SelectItem>
                        <SelectItem value="destructive">Danger / Destructive (Red)</SelectItem>
                        <SelectItem value="info">Info (Primary)</SelectItem>
                        <SelectItem value="success">Success (Green)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Alert Title</Label>
                    <Input
                      value={calloutTitle}
                      onChange={(e) => setCalloutTitle(e.target.value)}
                      placeholder="e.g. Important Note on No-Shows"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Alert Message</Label>
                  <Textarea
                    value={calloutMessage}
                    onChange={(e) => setCalloutMessage(e.target.value)}
                    placeholder="Enter callout warning message..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-xs font-medium">Publish Section</Label>
              <p className="text-[11px] text-muted-foreground">
                When disabled, this section is hidden from the public Payment Policy page.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Save Changes" : "Add Section"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

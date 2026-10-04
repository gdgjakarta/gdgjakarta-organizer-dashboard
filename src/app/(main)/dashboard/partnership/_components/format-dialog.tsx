"use client";

import { useEffect, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PartnershipFormat } from "@/lib/content/types";

interface FormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format?: PartnershipFormat | null;
  onSave: (format: PartnershipFormat) => void;
}

export function FormatDialog({ open, onOpenChange, format, onSave }: FormatDialogProps) {
  const isEditing = Boolean(format);

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [iconName, setIconName] = useState("Rocket");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverable, setNewDeliverable] = useState("");

  useEffect(() => {
    if (!open) return;
    if (format) {
      setTitle(format.title);
      setTag(format.tag);
      setIconName(format.iconName || "Rocket");
      setDescription(format.description);
      setIsActive(format.isActive !== false);
      setDeliverables(format.deliverables ? [...format.deliverables] : []);
    } else {
      setTitle("");
      setTag("Special Activation");
      setIconName("Rocket");
      setDescription("");
      setIsActive(true);
      setDeliverables([
        "Dedicated speaking or presentation session",
        "Branded digital assets & banners",
        "Direct developer feedback & interaction",
      ]);
    }
    setNewDeliverable("");
  }, [format, open]);

  const handleAddDeliverable = () => {
    if (!newDeliverable.trim()) return;
    setDeliverables([...deliverables, newDeliverable.trim()]);
    setNewDeliverable("");
  };

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newFormat: PartnershipFormat = {
      id: format?.id ?? `fmt-${Date.now()}`,
      title: title.trim(),
      tag: tag.trim() || "Collaboration",
      iconName,
      isActive,
      description: description.trim(),
      deliverables: deliverables.filter(Boolean),
    };

    onSave(newFormat);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Collaboration Format" : "Add Collaboration Format"}</DialogTitle>
            <DialogDescription>
              Define collaboration formats (such as workshops, summits, hackathons, or custom activations).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fmt-title">
                  Format Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fmt-title"
                  placeholder="e.g. Technical Codelabs & Workshops"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fmt-tag">Tag Badge</Label>
                <Input
                  id="fmt-tag"
                  placeholder="e.g. High Adoption, Flagship"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fmt-icon">Icon Graphic</Label>
                <select
                  id="fmt-icon"
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Rocket">Rocket (Conference / Launch)</option>
                  <option value="Laptop">Laptop (Hands-on Codelab)</option>
                  <option value="Terminal">Terminal (Hackathon / Code)</option>
                  <option value="Presentation">Presentation (Tech Talks / Meetups)</option>
                  <option value="Flame">Flame (Gamified Booth)</option>
                  <option value="Gift">Gift (Merch & Swag)</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="fmt-status" className="text-xs font-medium cursor-pointer">
                    Visible on Public Page
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Show in collaboration formats</p>
                </div>
                <Switch id="fmt-status" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fmt-desc">Description</Label>
              <Textarea
                id="fmt-desc"
                placeholder="Describe how this format brings value to sponsors and developers..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Deliverables List */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold">Included Touchpoints & Deliverables</Label>
              <div className="space-y-2">
                {deliverables.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const updated = [...deliverables];
                        updated[idx] = e.target.value;
                        setDeliverables(updated);
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="size-8 text-destructive shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Add deliverable (e.g. Interactive demo kiosks)..."
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDeliverable();
                      }
                    }}
                    className="text-xs h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddDeliverable}
                    className="h-8 gap-1 text-xs shrink-0"
                  >
                    <Plus className="size-3.5" />
                    <span>Add</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {isEditing ? "Save Format" : "Add Format"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

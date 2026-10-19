"use client";

import { useEffect, useId, useState } from "react";

import { Calendar, Plus, Sparkles, Tag, User } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  type CustomPlaceholderDefinition,
  STANDARD_ATTENDEE_PLACEHOLDER_KEYS,
  STANDARD_EVENT_PLACEHOLDER_KEYS,
  sanitizeTokenKey,
} from "../_types/placeholders";

interface PresetSuggestion {
  key: string;
  label: string;
  sampleValue: string;
  description: string;
}

const EVENT_PRESETS: PresetSuggestion[] = [
  {
    key: "WifiPassword",
    label: "Wi-Fi Password",
    sampleValue: "GDGJakarta2026!",
    description: "Venue guest Wi-Fi network credentials",
  },
  {
    key: "SlidoUrl",
    label: "Slido Q&A Link",
    sampleValue: "https://app.sli.do/event/gdg-jkt",
    description: "Audience interactive live Q&A link",
  },
  {
    key: "FeedbackUrl",
    label: "Feedback Survey URL",
    sampleValue: "https://gdgjakarta.org/feedback",
    description: "Post-event participant survey link",
  },
  {
    key: "LiveStreamUrl",
    label: "Live Stream Link",
    sampleValue: "https://youtube.com/live/gdgjakarta",
    description: "YouTube / Google Meet online stream link",
  },
  {
    key: "BoothLocation",
    label: "Booth / Room Location",
    sampleValue: "Hall B, Booth #12",
    description: "Room number or partner exhibition spot",
  },
];

const ATTENDEE_PRESETS: PresetSuggestion[] = [
  {
    key: "CompanyName",
    label: "Company / Organization",
    sampleValue: "Google Indonesia",
    description: "Attendee's workplace or organization",
  },
  {
    key: "JobTitle",
    label: "Job Title",
    sampleValue: "Senior Software Engineer",
    description: "Professional job title",
  },
  {
    key: "SeatNumber",
    label: "Reserved Seat Number",
    sampleValue: "Row A - Seat 14",
    description: "Allocated auditorium or table seat",
  },
  {
    key: "TShirtSize",
    label: "T-Shirt Size",
    sampleValue: "L (Unisex)",
    description: "Merchandise size selection",
  },
  {
    key: "DietaryRequirement",
    label: "Dietary Preference",
    sampleValue: "Halal / Vegetarian",
    description: "Catering and meal preference",
  },
];

interface AddPlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: "event" | "attendee";
  existingEventKeys?: string[];
  existingAttendeeKeys?: string[];
  onAdd: (placeholder: CustomPlaceholderDefinition) => void;
}

export function AddPlaceholderDialog({
  open,
  onOpenChange,
  defaultCategory = "event",
  existingEventKeys = [],
  existingAttendeeKeys = [],
  onAdd,
}: AddPlaceholderDialogProps) {
  const [category, setCategory] = useState<"event" | "attendee">(defaultCategory);
  const [keyInput, setKeyInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [sampleValueInput, setSampleValueInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const keyInputId = useId();
  const labelInputId = useId();
  const sampleInputId = useId();
  const descInputId = useId();

  useEffect(() => {
    if (open) {
      setCategory(defaultCategory);
      setKeyInput("");
      setLabelInput("");
      setSampleValueInput("");
      setDescriptionInput("");
      setKeyError(null);
    }
  }, [open, defaultCategory]);

  const sanitizedKey = sanitizeTokenKey(keyInput);

  const validateKey = (key: string, cat: "event" | "attendee") => {
    if (!key) {
      setKeyError("Placeholder key is required.");
      return false;
    }

    const standardKeys = cat === "event" ? STANDARD_EVENT_PLACEHOLDER_KEYS : STANDARD_ATTENDEE_PLACEHOLDER_KEYS;
    const existingCustomKeys = cat === "event" ? existingEventKeys : existingAttendeeKeys;

    if (standardKeys.some((k) => k.toLowerCase() === key.toLowerCase())) {
      setKeyError(`"${key}" is an official built-in token and already exists.`);
      return false;
    }

    if (existingCustomKeys.some((k) => k.toLowerCase() === key.toLowerCase())) {
      setKeyError(`A placeholder with key "${key}" already exists.`);
      return false;
    }

    setKeyError(null);
    return true;
  };

  const handleApplyPreset = (preset: PresetSuggestion) => {
    setKeyInput(preset.key);
    setLabelInput(preset.label);
    setSampleValueInput(preset.sampleValue);
    setDescriptionInput(preset.description);
    validateKey(preset.key, category);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateKey(sanitizedKey, category)) {
      return;
    }

    const finalLabel = labelInput.trim() || sanitizedKey;
    const finalSample = sampleValueInput.trim() || `[${finalLabel}]`;

    const newPlaceholder: CustomPlaceholderDefinition = {
      key: sanitizedKey,
      label: finalLabel,
      sampleValue: finalSample,
      category,
      description: descriptionInput.trim() || undefined,
    };

    onAdd(newPlaceholder);
    toast.success(`Token [[${sanitizedKey}]] Added`, {
      description: `Added custom ${category === "event" ? "event" : "attendee"} placeholder. You can drag or insert it anywhere in your email template.`,
    });
    onOpenChange(false);
  };

  const presets = category === "event" ? EVENT_PRESETS : ATTENDEE_PRESETS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full overflow-hidden">
        <DialogHeader className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg">Add Dynamic Placeholder</DialogTitle>
              <DialogDescription className="text-xs">
                Create a dynamic token for event details or attendee data that resolves automatically across templates
                and previews.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1 text-xs min-w-0">
          {/* Category Switcher */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-semibold">Placeholder Scope</Label>
            <Tabs
              value={category}
              onValueChange={(val) => {
                const newCat = val as "event" | "attendee";
                setCategory(newCat);
                if (sanitizedKey) {
                  validateKey(sanitizedKey, newCat);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid h-9 w-full grid-cols-2">
                <TabsTrigger value="event" className="gap-1.5 text-xs">
                  <Calendar className="size-3.5 text-sky-500" />
                  Event Data Placeholder
                </TabsTrigger>
                <TabsTrigger value="attendee" className="gap-1.5 text-xs">
                  <User className="size-3.5 text-emerald-500" />
                  Attendee Data Placeholder
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Preset Suggestions Chips */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="size-3 text-amber-500" />
              <span>Popular presets (click to autofill):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                    sanitizedKey === preset.key
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <code>[[{preset.key}]]</code>
                  <span className="text-[10px] opacity-80">({preset.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Token Key & Live Badge Preview */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <Label htmlFor={keyInputId} className="text-xs font-semibold">
                Token Key <span className="text-destructive">*</span>
              </Label>
              {sanitizedKey && (
                <div className="flex items-center gap-1 text-[11px] min-w-0">
                  <span className="text-muted-foreground">Preview:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      category === "event"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    [[{sanitizedKey}]]
                  </Badge>
                </div>
              )}
            </div>
            <Input
              id={keyInputId}
              placeholder={category === "event" ? "e.g. WifiPassword, SlidoUrl" : "e.g. CompanyName, SeatNumber"}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                const nextKey = sanitizeTokenKey(e.target.value);
                validateKey(nextKey, category);
              }}
              className="h-9 w-full min-w-0 font-mono text-xs"
              autoFocus
            />
            {keyError ? (
              <p className="text-[11px] text-destructive">{keyError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Letters, digits, and underscores. Strips brackets automatically.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
            {/* Label Input */}
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor={labelInputId} className="text-xs font-semibold">
                Display Label
              </Label>
              <Input
                id={labelInputId}
                placeholder={category === "event" ? "e.g. Wi-Fi Password" : "e.g. Company Name"}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="h-9 w-full min-w-0 text-xs"
              />
            </div>

            {/* Sample / Default Value */}
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor={sampleInputId} className="text-xs font-semibold">
                Default / Preview Value
              </Label>
              <Input
                id={sampleInputId}
                placeholder={category === "event" ? "e.g. GDGJakarta2026!" : "e.g. Google Indonesia"}
                value={sampleValueInput}
                onChange={(e) => setSampleValueInput(e.target.value)}
                className="h-9 w-full min-w-0 text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor={descInputId} className="text-xs font-semibold">
              Description (Optional)
            </Label>
            <Input
              id={descInputId}
              placeholder="e.g. Credentials displayed to all confirmed participants"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="h-9 w-full min-w-0 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!sanitizedKey || Boolean(keyError)} className="gap-1.5">
              <Tag className="size-3.5" />
              Add Placeholder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

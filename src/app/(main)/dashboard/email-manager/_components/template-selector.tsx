"use client";

import { CheckCircle2, FileText, LayoutTemplate, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EMAIL_FEATURE_TEMPLATES, type EmailFeatureTemplateItem } from "./template-utils";

interface TemplateSelectorProps {
  currentTemplateId: string;
  onSelectTemplate: (template: EmailFeatureTemplateItem) => void;
  disabled?: boolean;
}

export function TemplateSelector({ currentTemplateId, onSelectTemplate, disabled = false }: TemplateSelectorProps) {
  const handleSelect = (templateId: string) => {
    const found = EMAIL_FEATURE_TEMPLATES.find((t) => t.id === templateId);
    if (!found) return;

    onSelectTemplate(found);
    toast.success("Email Template Loaded", {
      description: `Loaded "${found.name}". Subject and HTML body have been updated.`,
    });
  };

  const selectedTemplate = EMAIL_FEATURE_TEMPLATES.find((t) => t.id === currentTemplateId);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card/60 p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="size-4 text-primary" />
          <span className="font-semibold text-foreground text-xs tracking-tight">Pre-built Email Templates</span>
        </div>
        {selectedTemplate && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {selectedTemplate.badge}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Select value={currentTemplateId} onValueChange={handleSelect} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an email template..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {/* Group 1: General & Updates */}
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                  <Sparkles className="size-3.5" />
                  General &amp; Updates
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "general").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Group 2: RSVP & Passes */}
              <SelectGroup className="mt-1 border-t pt-1">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  RSVP &amp; Tickets
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "rsvp").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Group 3: Curation & Application */}
              <SelectGroup className="mt-1 border-t pt-1">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-sky-600 text-xs dark:text-sky-400">
                  <FileText className="size-3.5" />
                  Curation &amp; Registration
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "curation").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Group 4: Waitlist */}
              <SelectGroup className="mt-1 border-t pt-1">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-amber-600 text-xs dark:text-amber-400">
                  <FileText className="size-3.5" />
                  Waitlist Notifications
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "waitlist").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Group 5: Cancellations */}
              <SelectGroup className="mt-1 border-t pt-1">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-rose-600 text-xs dark:text-rose-400">
                  <FileText className="size-3.5" />
                  Cancellations
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "cancellation").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Group 6: Outreach & Invitations */}
              <SelectGroup className="mt-1 border-t pt-1">
                <SelectLabel className="flex items-center gap-1.5 font-semibold text-purple-600 text-xs dark:text-purple-400">
                  <Sparkles className="size-3.5" />
                  Community &amp; Speaker Outreach
                </SelectLabel>
                {EMAIL_FEATURE_TEMPLATES.filter((t) => t.category === "invitation").map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{tpl.name}</span>
                      <Badge variant="outline" className="px-1 text-[9px]">
                        {tpl.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTemplate && <p className="text-[11px] text-muted-foreground">{selectedTemplate.description}</p>}
    </div>
  );
}

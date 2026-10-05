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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FaqCategory, FaqItem } from "@/lib/content/types";

interface FaqItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faqItem?: FaqItem | null;
  categories: FaqCategory[];
  onSave: (item: FaqItem) => void;
}

export function FaqItemDialog({ open, onOpenChange, faqItem, categories, onSave }: FaqItemDialogProps) {
  const isEditing = Boolean(faqItem);

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("general");
  const [answer, setAnswer] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (faqItem) {
      setQuestion(faqItem.question);
      setCategory(faqItem.category);
      setAnswer(faqItem.answer);
      setIsActive(faqItem.isActive ?? true);
    } else {
      setQuestion("");
      setCategory(categories[1]?.key ?? "general");
      setAnswer("");
      setIsActive(true);
    }
  }, [faqItem, categories, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    const selectedCat = categories.find((c) => c.key === category);
    const categoryLabel = selectedCat?.label ?? category;

    const newItem: FaqItem = {
      id: faqItem?.id ?? `faq-${Date.now()}`,
      question: question.trim(),
      category,
      categoryLabel,
      answer: answer.trim(),
      order: faqItem?.order ?? 99,
      isActive,
    };

    onSave(newItem);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit FAQ Item" : "Add New FAQ Item"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEditing
                ? "Update this question, answer, or category."
                : "Create a new question and answer to be published on the FAQ page."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question" className="font-medium text-xs sm:text-sm">
                Question <span className="text-destructive">*</span>
              </Label>
              <Input
                id="faq-question"
                placeholder="e.g. Why does GDG Jakarta require a commitment fee?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="faq-category" className="font-medium text-xs sm:text-sm">
                  Category
                </Label>
                <select
                  id="faq-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {categories
                    .filter((c) => c.key !== "all")
                    .map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="space-y-0.5">
                    <Label htmlFor="faq-status" className="cursor-pointer font-medium text-xs">
                      Published & Active
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Visible on public FAQ</p>
                  </div>
                  <Switch id="faq-status" checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-answer" className="font-medium text-xs sm:text-sm">
                Answer <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="faq-answer"
                placeholder="Write the clear, concise explanation. Paragraphs and bullet points are preserved..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                required
                className="resize-y"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: You can use double line breaks for paragraphs, or &quot;• &quot; for bullet lists.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 pt-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={!question.trim() || !answer.trim()} className="w-full sm:w-auto">
              {isEditing ? "Save Changes" : "Add FAQ Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

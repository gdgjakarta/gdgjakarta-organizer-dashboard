"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFirestoreEvent } from "@/lib/firestore/client";
import type { CustomQuestion, FirestoreEvent } from "@/lib/firestore/types";

interface CustomFormTabProps {
  event: FirestoreEvent;
}

export function CustomFormTab({ event }: CustomFormTabProps) {
  const [requiresApproval, setRequiresApproval] = useState(Boolean(event.requires_approval));
  const [maxAttendees, setMaxAttendees] = useState(event.max_attendees ? String(event.max_attendees) : "");
  const [questions, setQuestions] = useState<CustomQuestion[]>(
    event.custom_questions && event.custom_questions.length > 0
      ? event.custom_questions
      : [
          {
            id: "role",
            label: "Current Professional Role / Title",
            type: "text",
            required: true,
            placeholder: "e.g. Senior Frontend Engineer, CS Student, etc.",
          },
          {
            id: "company",
            label: "Company or University",
            type: "text",
            required: true,
            placeholder: "e.g. GoTo, UI, Freelance",
          },
          {
            id: "experience",
            label: "Years of Professional Experience",
            type: "select",
            options: ["Student / Fresher", "1-2 years", "3-5 years", "5+ years"],
            required: true,
          },
        ],
  );

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAddQuestion = () => {
    const newQ: CustomQuestion = {
      id: `q_${Date.now()}`,
      label: "",
      type: "text",
      required: false,
      placeholder: "",
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, updates: Partial<CustomQuestion>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const updatedEvent: FirestoreEvent = {
          ...event,
          requires_approval: requiresApproval,
          max_attendees: maxAttendees ? Number(maxAttendees) : undefined,
          custom_questions: questions.filter((q) => q.label.trim().length > 0),
          updated_at: new Date().toISOString(),
        };

        await saveFirestoreEvent(updatedEvent);
        toast.success("Registration form settings saved successfully!");
        router.refresh();
      } catch {
        toast.error("Failed to save registration form settings.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Approval & Capacity Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Registration Policy</CardTitle>
          <CardDescription>
            Configure whether registrations require organizer review and set maximum capacity limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
            <Checkbox
              id="requires-approval"
              checked={requiresApproval}
              onCheckedChange={(checked) => setRequiresApproval(Boolean(checked))}
            />
            <div className="space-y-1">
              <label htmlFor="requires-approval" className="cursor-pointer font-medium text-sm leading-none">
                Require Organizer Approval (Curation Mode)
              </label>
              <p className="text-muted-foreground text-xs">
                When enabled, new registrants are marked as <strong>Pending Review</strong> and must be approved by an
                organizer in the Registrants tab before their ticket is confirmed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="max-attendees">Maximum Capacity (Optional)</FieldLabel>
              <Input
                id="max-attendees"
                type="number"
                placeholder="Unlimited"
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Custom Questions Questionnaire Builder */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Custom Registration Questions</CardTitle>
            <CardDescription>
              Questions presented to GDG community members when registering for this event.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddQuestion} className="gap-1.5 self-start">
            <Plus className="size-3.5" />
            Add Question
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
              No custom questions configured. Registrants will only submit their member profile.
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-muted-foreground text-xs uppercase">Question #{idx + 1}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveQuestion(q.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <Field>
                      <FieldLabel>Question Label</FieldLabel>
                      <Input
                        placeholder="e.g. Current Job Title or Area of Interest"
                        value={q.label}
                        onChange={(e) => handleUpdateQuestion(q.id, { label: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="md:col-span-3">
                    <Field>
                      <FieldLabel>Input Type</FieldLabel>
                      <Select
                        value={q.type}
                        onValueChange={(val: "text" | "textarea" | "select") =>
                          handleUpdateQuestion(q.id, { type: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Short Text</SelectItem>
                          <SelectItem value="textarea">Paragraph</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex items-end pb-2 md:col-span-2">
                    <label
                      htmlFor={`required-${q.id}`}
                      className="flex cursor-pointer items-center gap-2 font-medium text-xs"
                    >
                      <Checkbox
                        id={`required-${q.id}`}
                        checked={q.required}
                        onCheckedChange={(checked) => handleUpdateQuestion(q.id, { required: Boolean(checked) })}
                      />
                      Required
                    </label>
                  </div>
                </div>

                {q.type === "select" && (
                  <Field>
                    <FieldLabel>Dropdown Options (comma separated)</FieldLabel>
                    <Input
                      placeholder="Option 1, Option 2, Option 3"
                      value={q.options?.join(", ") ?? ""}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                )}
              </div>
            ))
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isPending} className="gap-2">
              <Save className="size-4" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

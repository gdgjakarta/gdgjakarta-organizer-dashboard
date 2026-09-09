"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { checkEventRegistrationAction, registerForEventAction } from "@/server/firestore-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface EventRegistrationModalProps {
  event: FirestoreEvent;
  existingRegistration?: FirestoreRegistration | null;
  children?: React.ReactNode;
}

function isEventPast(event: FirestoreEvent): boolean {
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function EventRegistrationModal({ event, existingRegistration, children }: EventRegistrationModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [localReg, setLocalReg] = useState<FirestoreRegistration | null>(existingRegistration ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (existingRegistration) {
      setLocalReg(existingRegistration);
      return;
    }
    if (!user) return;
    async function checkStatus() {
      try {
        const found = await checkEventRegistrationAction(String(event.id), user?.id, user?.email);
        if (found) {
          setLocalReg(found);
        }
      } catch (err) {
        console.error("[EventRegistrationModal] failed to check registration status:", err);
      }
    }
    void checkStatus();
  }, [user, event.id, existingRegistration]);

  const activeRegistration = existingRegistration ?? localReg;
  const isPast = isEventPast(event);

  const questions =
    event.custom_questions && event.custom_questions.length > 0
      ? event.custom_questions
      : [
          {
            id: "role",
            label: "Current Professional Role / Title",
            type: "text" as const,
            required: true,
            placeholder: "e.g. Senior Frontend Engineer, CS Student, etc.",
          },
          {
            id: "company",
            label: "Company or Institution",
            type: "text" as const,
            required: true,
            placeholder: "e.g. GoTo, UI, Freelance",
          },
          {
            id: "experience",
            label: "Years of Professional Experience",
            type: "select" as const,
            options: ["Student / Fresher", "1-2 years", "3-5 years", "5+ years"],
            required: true,
          },
        ];

  const handleInputChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to register for GDG Jakarta events.");
      router.push("/auth/member/login");
      return;
    }

    if (isPast) {
      toast.error("This event has already ended. Registration is closed.");
      setOpen(false);
      return;
    }

    // Validate required questions
    for (const q of questions) {
      if (q.required && !answers[q.id]?.trim()) {
        toast.error(`Please answer: "${q.label}"`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const initialStatus = event.requires_approval ? "pending" : "approved";

        const registrationPayload: Omit<FirestoreRegistration, "id"> = {
          event_id: String(event.id),
          event_title: event.title,
          member_id: user.id,
          member_name: user.name,
          member_email: user.email,
          member_avatar: user.avatar,
          member_role: user.role,
          status: initialStatus,
          answers,
          registered_at: new Date().toISOString(),
        };

        const result = await registerForEventAction(registrationPayload);

        if (result.success) {
          if (event.requires_approval) {
            toast.success("Registration submitted! It is now pending organizer review.", { duration: 5000 });
          } else {
            toast.success("Successfully registered! See you at the event.", { duration: 5000 });
          }
          setOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || "Failed to register. Please try again.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to register. Please try again.";
        toast.error(msg);
      }
    });
  };

  if (activeRegistration) {
    const isApproved = activeRegistration.status === "approved" || activeRegistration.status === "attended";
    const isPendingReview = activeRegistration.status === "pending";
    let statusLabel = "Registered";
    if (isApproved) {
      statusLabel = "Registered (Approved)";
    } else if (isPendingReview) {
      statusLabel = "Pending Approval";
    }

    return (
      <Button
        variant={isApproved ? "outline" : "secondary"}
        size="sm"
        disabled
        className="cursor-default gap-1.5 opacity-90"
      >
        <CheckCircle2 className={`size-3.5 ${isApproved ? "text-emerald-500" : "text-amber-500"}`} />
        {statusLabel}
      </Button>
    );
  }

  if (isPast) {
    return (
      <Button variant="secondary" size="sm" disabled className="cursor-default opacity-75">
        Registration Closed
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Register for Event
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {event.is_virtual ? "Virtual" : "In-Person"}
            </Badge>
            {event.requires_approval && (
              <Badge variant="secondary" className="text-[10px]">
                Requires Approval
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl leading-snug">{event.title}</DialogTitle>
          <DialogDescription>
            {event.requires_approval
              ? "This event is curated. Please complete the details below for organizer review."
              : "Complete your registration details to reserve your spot."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Member Profile Info */}
          {user && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-muted-foreground text-xs">
              <div>
                Registering as <strong className="text-foreground">{user.name}</strong> ({user.email})
              </div>
            </div>
          )}

          {/* Dynamic Questions */}
          <div className="space-y-4">
            {questions.map((q) => (
              <Field key={q.id}>
                <FieldLabel className="font-medium text-xs">
                  {q.label} {q.required && <span className="text-destructive">*</span>}
                </FieldLabel>

                {q.type === "text" && (
                  <Input
                    placeholder={q.placeholder || "Your answer"}
                    value={answers[q.id] || ""}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.required}
                  />
                )}

                {q.type === "textarea" && (
                  <Textarea
                    placeholder={q.placeholder || "Type your response here..."}
                    value={answers[q.id] || ""}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    rows={3}
                    required={q.required}
                  />
                )}

                {q.type === "select" && (
                  <Select value={answers[q.id] || ""} onValueChange={(val) => handleInputChange(q.id, val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            ))}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Registration"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import {
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { submitProposalDecisionAction } from "@/server/public-proposal-actions";
import type { SponsorProposalSession } from "@/types/sponsor";

interface SponsorProposalPortalProps {
  proposal: SponsorProposalSession;
}

export function SponsorProposalPortal({ proposal }: SponsorProposalPortalProps) {
  const [currentStatus, setCurrentStatus] = useState(proposal.status);
  const [notes, setNotes] = useState(proposal.notes || "");
  const [isSubmitting, startTransition] = useTransition();

  const handleDecision = (decision: "confirmed" | "declined") => {
    startTransition(async () => {
      try {
        const res = await submitProposalDecisionAction(proposal.token, decision, notes.trim());
        if (res.success) {
          setCurrentStatus(decision);
          if (decision === "confirmed") {
            toast.success("Awesome! We have recorded that your team wants to tap in!");
          } else {
            toast.info("Thank you for letting us know.");
          }
        } else {
          toast.error(res.error || "Failed to record decision.");
        }
      } catch {
        toast.error("Error submitting response.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-xs text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          Partnership Invitation
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Partnering with GDG Jakarta</h1>
        <p className="mt-2 text-base text-muted-foreground max-w-xl mx-auto">
          Prepared exclusively for <strong>{proposal.company_name}</strong> for the upcoming event{" "}
          <strong>{proposal.event_title}</strong>.
        </p>

        {/* Current status pill */}
        <div className="mt-4 flex justify-center">
          {(() => {
            if (currentStatus === "confirmed") {
              return (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-1 px-3">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Decision Recorded: Confirmed / Tap In!
                </Badge>
              );
            }
            if (currentStatus === "declined") {
              return (
                <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs py-1 px-3">
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Decision Recorded: Declined
                </Badge>
              );
            }
            return (
              <Badge variant="outline" className="text-xs py-1 px-3 bg-blue-500/10 text-blue-600 border-blue-500/20">
                Awaiting Decision
              </Badge>
            );
          })()}
        </div>
      </div>

      {/* Proposal Details Card */}
      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Proposal Summary & Prospectus
          </CardTitle>
          <CardDescription>Review the event prospectus deck and proposed tier details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border p-4 bg-muted/20">
            <div>
              <span className="text-xs text-muted-foreground">Target Event</span>
              <p className="text-sm font-semibold mt-0.5">{proposal.event_title}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Sponsorship Tier</span>
              <p className="text-sm font-semibold capitalize mt-0.5">{proposal.tier || "Community"} Sponsor</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Recipient Representative</span>
              <p className="text-sm font-semibold mt-0.5">{proposal.recipient_name || proposal.recipient_email}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Sent Date</span>
              <p className="text-sm font-semibold mt-0.5">{new Date(proposal.sent_at).toLocaleDateString()}</p>
            </div>
          </div>

          {proposal.deck_url && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Sponsorship Prospectus & Pitch Deck</p>
                  <p className="text-xs text-muted-foreground">
                    View our packages, attendee demographics, and booth specs.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <a href={proposal.deck_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Deck
                </a>
              </Button>
            </div>
          )}

          {/* Interactive Decision Action */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="text-base font-bold text-foreground">Are you ready to join as our partner?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let us know if you want to tap in. You can also leave a note for special requirements.
              </p>
            </div>

            <Textarea
              placeholder="Any questions, custom request, or dietary/booth preferences (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto font-semibold bg-emerald-600 hover:bg-emerald-700 text-white min-w-44"
                disabled={isSubmitting}
                onClick={() => handleDecision("confirmed")}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                We Want to Tap In!
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
                disabled={isSubmitting}
                onClick={() => handleDecision("declined")}
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                Decline for this Event
              </Button>
            </div>

            {currentStatus === "confirmed" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-800 dark:text-emerald-300 text-xs">
                <strong>Next Step:</strong> Our organizers have been notified! You can also complete your public brand
                assets and logo upload anytime through our{" "}
                <Link
                  href={`/events/${proposal.event_id}/partner-confirmation`}
                  className="underline font-semibold hover:opacity-80"
                >
                  Sponsor Confirmation Portal
                </Link>
                .
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

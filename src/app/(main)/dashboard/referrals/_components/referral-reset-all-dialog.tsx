"use client";

import { useState } from "react";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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
import { resetAllMembersReferralsAction } from "@/lib/firestore/actions";

interface ReferralResetAllDialogProps {
  totalActiveReferrers: number;
  totalPoints: number;
  onResetCompleted: () => void;
}

export function ReferralResetAllDialog({
  totalActiveReferrers,
  totalPoints,
  onResetCompleted,
}: ReferralResetAllDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const isConfirmed = confirmText.trim().toUpperCase() === "RESET";

  const handleReset = async () => {
    if (!isConfirmed) return;
    setResetting(true);
    try {
      const res = await resetAllMembersReferralsAction();
      if (!res.success) {
        toast.error(res.error || "Failed to reset referrals.");
        return;
      }

      toast.success(
        `Successfully reset referral points & tickets for ${res.count ?? totalActiveReferrers} community members.`,
      );
      setOpen(false);
      setConfirmText("");
      onResetCompleted();
    } catch {
      toast.error("An unexpected error occurred while resetting referrals.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!resetting) {
          setOpen(next);
          if (!next) setConfirmText("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-destructive/30 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
        >
          <RotateCcw className="size-3.5" />
          Reset All Referrals
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-xs">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base text-destructive">Reset All Referral Points?</DialogTitle>
              <DialogDescription className="text-xs">
                This will reset referral points and referred tickets counts for all community members.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary Box */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-foreground">
            <p className="font-semibold text-destructive">Warning: This action cannot be reversed.</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground text-[11px]">
              <li>
                <strong>{totalActiveReferrers} members</strong> with earned points will have their{" "}
                <span className="font-mono">referral_points</span> and{" "}
                <span className="font-mono">referrals_count</span> set to 0.
              </li>
              <li>
                A total of <strong>{totalPoints.toLocaleString("id-ID")} points</strong> will be cleared across the
                chapter.
              </li>
              <li>
                Existing member referral codes and past ticket redemption logs remain preserved for historic reference.
              </li>
            </ul>
          </div>

          {/* Type Confirmation */}
          <Field>
            <FieldLabel className="text-xs font-medium">
              Type <span className="font-bold font-mono text-destructive">RESET</span> below to confirm:
            </FieldLabel>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              disabled={resetting}
              className="mt-1 h-8 font-mono text-xs uppercase"
              autoFocus
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={resetting} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            disabled={!isConfirmed || resetting}
            className="h-8 text-xs font-medium"
          >
            {resetting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Resetting All...
              </>
            ) : (
              "Yes, Reset All Referrals"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

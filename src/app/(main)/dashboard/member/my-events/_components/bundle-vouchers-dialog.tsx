"use client";

import { useEffect, useMemo, useState } from "react";

import { Check, Copy, Gift, Share2 } from "lucide-react";
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
import type { BundleIssuedVoucher, EventVoucher, FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface BundleVouchersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
}

export function BundleVouchersDialog({ open, onOpenChange, registration, event }: BundleVouchersDialogProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [eventVouchersMap, setEventVouchersMap] = useState<Map<string, EventVoucher>>(() => new Map());

  // Load private event_vouchers to resolve live redemption state
  useEffect(() => {
    if (!open || !registration?.event_id || !Array.isArray(registration.bundle_vouchers)) return;
    let isMounted = true;
    void (async () => {
      try {
        const { getEventVouchers } = await import("@/lib/firestore/client");
        const list = await getEventVouchers(registration.event_id);
        if (isMounted && list.length > 0) {
          const vMap = new Map<string, EventVoucher>();
          for (const v of list) {
            vMap.set(v.code.trim().toUpperCase(), v);
          }
          setEventVouchersMap(vMap);
        }
      } catch {
        // ignore read error
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [open, registration?.event_id, registration?.bundle_vouchers]);

  const vouchers: BundleIssuedVoucher[] = useMemo(() => {
    const raw = registration.bundle_vouchers ?? [];
    return raw.map((bv) => {
      const cleanCode = (bv.code || "").trim().toUpperCase();
      const vDoc = eventVouchersMap.get(cleanCode);
      const isClaimed =
        bv.status === "redeemed" ||
        Boolean(vDoc && ((vDoc.times_used ?? 0) > 0 || vDoc.redeemed_by_name || vDoc.redeemed_by_email));

      return {
        ...bv,
        status: (isClaimed ? "redeemed" : "available") as "available" | "redeemed",
        redeemed_by_name: vDoc?.redeemed_by_name || bv.redeemed_by_name,
        redeemed_by_email: vDoc?.redeemed_by_email || bv.redeemed_by_email,
        redeemed_at: vDoc?.redeemed_at || bv.redeemed_at,
      };
    });
  }, [registration.bundle_vouchers, eventVouchersMap]);

  const redeemedCount = vouchers.filter((v) => v.status === "redeemed").length;
  const availableCount = vouchers.filter((v) => v.status === "available").length;

  const handleCopyCode = (code: string) => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Copied voucher code "${code}" to clipboard!`);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleShareVoucher = (v: BundleIssuedVoucher) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const regUrl = `${origin}/events/${registration.event_id}?voucher=${encodeURIComponent(v.code)}`;
    const shareText = `Hey! Here is your 100% FREE pass to "${event?.title ?? registration.event_title}" from my ticket bundle.\n\nVoucher Code: ${v.code}\nClaim link: ${regUrl}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: `Free Ticket Pass to ${registration.event_title}`,
          text: shareText,
        })
        .catch(() => {
          // Fallback to clipboard
          void navigator.clipboard.writeText(shareText);
          toast.success("Invitation message copied to clipboard!");
        });
    } else {
      void navigator.clipboard.writeText(shareText);
      toast.success("Invitation message copied to clipboard!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gift className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Bundle Friend Vouchers</DialogTitle>
              <DialogDescription className="text-xs">
                {registration.bundle_name
                  ? `Package: ${registration.bundle_name}`
                  : "Share these 100% free passes with your friends"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Summary Banner */}
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Included Tickets:</span>
              <span className="font-semibold text-foreground">1 Personal Pass + {vouchers.length} Friend Vouchers</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Voucher Status:</span>
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  {availableCount} Available
                </Badge>
                {redeemedCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  >
                    {redeemedCount} Claimed
                  </Badge>
                )}
              </div>
            </div>
            <p className="border-primary/10 border-t pt-1 text-[11px] text-muted-foreground leading-relaxed">
              Each voucher code below grants <strong>100% free admission</strong> for 1 friend when entered at checkout.
            </p>
          </div>

          {/* Vouchers List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-semibold text-foreground text-xs">
              <span>Friend Voucher Codes ({vouchers.length})</span>
              <span className="text-[11px] text-muted-foreground">Single-use per friend</span>
            </div>

            {vouchers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                No friend vouchers generated for this package.
              </div>
            ) : (
              <div className="space-y-2">
                {vouchers.map((v, idx) => {
                  const isRedeemed = v.status === "redeemed";
                  const isCopied = copiedCode === v.code;

                  return (
                    <div
                      key={v.code || idx}
                      className={cn(
                        "flex flex-col justify-between gap-2.5 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center",
                        isRedeemed ? "border-muted bg-muted/40" : "border-primary/20 bg-card hover:border-primary/40",
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-foreground text-sm tracking-wider">{v.code}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium text-[10px]",
                              isRedeemed
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            {isRedeemed ? "Claimed" : "Available"}
                          </Badge>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          {isRedeemed ? (
                            <span className="font-medium text-purple-700 dark:text-purple-300">
                              Claimed by {v.redeemed_by_name || "Friend"}
                              {v.redeemed_at ? ` on ${new Date(v.redeemed_at).toLocaleDateString("id-ID")}` : ""}
                            </span>
                          ) : (
                            <span>100% Free • {v.ticket_name || "Event Pass"}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopyCode(v.code)}
                        >
                          {isCopied ? (
                            <>
                              <Check className="size-3 text-emerald-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> Copy
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleShareVoucher(v)}
                        >
                          <Share2 className="size-3 text-primary" /> Share
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

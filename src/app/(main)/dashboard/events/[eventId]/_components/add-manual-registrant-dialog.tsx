"use client";

import { useId, useMemo, useState } from "react";

import { CreditCard, Loader2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { addManualRegistrantAction } from "@/server/manual-registration-actions";

interface AddManualRegistrantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: FirestoreEvent;
  onSuccess: (newRegistration: FirestoreRegistration) => void;
}

export function AddManualRegistrantDialog({ isOpen, onClose, event, onSuccess }: AddManualRegistrantDialogProps) {
  const fullNameId = useId();
  const emailId = useId();
  const selectionIdKey = useId();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Active tickets and bundles
  const activeTickets = useMemo(() => {
    return (event.tickets ?? []).filter((t) => t.status !== "hidden");
  }, [event.tickets]);

  const activeBundles = useMemo(() => {
    return (event.bundles ?? []).filter((b) => b.status !== "hidden");
  }, [event.bundles]);

  // Default selection if not set
  const effectiveKey = useMemo(() => {
    if (selectedKey) return selectedKey;
    if (activeTickets.length > 0) return `ticket_${activeTickets[0].id}`;
    if (activeBundles.length > 0) return `bundle_${activeBundles[0].id}`;
    return "";
  }, [selectedKey, activeTickets, activeBundles]);

  // Selected item metadata & price calculation
  const selectedInfo = useMemo(() => {
    if (!effectiveKey) return { type: "ticket" as const, id: "", name: "Default Ticket", price: 0 };
    if (effectiveKey.startsWith("bundle_")) {
      const bundleId = effectiveKey.replace("bundle_", "");
      const b = activeBundles.find((item) => item.id === bundleId);
      return {
        type: "bundle" as const,
        id: bundleId,
        name: b?.name ?? "Bundle Package",
        price: b?.price ?? 0,
      };
    }
    const ticketId = effectiveKey.replace("ticket_", "");
    const t = activeTickets.find((item) => item.id === ticketId);
    return {
      type: "ticket" as const,
      id: ticketId,
      name: t?.name ?? "Event Ticket",
      price: t?.price ?? 0,
    };
  }, [effectiveKey, activeBundles, activeTickets]);

  const isPaid = selectedInfo.price > 0;
  const isBusy = isSubmittingDirect || isSubmittingPay;

  const handleReset = () => {
    setFullName("");
    setEmail("");
    setSelectedKey("");
    setIsSubmittingDirect(false);
    setIsSubmittingPay(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isBusy) {
      handleReset();
      onClose();
    }
  };

  const handleSubmit = async (mode: "direct" | "payment_link") => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      toast.error("Please enter the attendee's full name.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please provide a valid attendee email address.");
      return;
    }
    if (!selectedInfo.id) {
      toast.error("Please choose a ticket tier or bundle package.");
      return;
    }

    if (mode === "direct") {
      setIsSubmittingDirect(true);
    } else {
      setIsSubmittingPay(true);
    }

    try {
      const res = await addManualRegistrantAction({
        eventId: String(event.id),
        fullName: trimmedName,
        email: trimmedEmail,
        selectionType: selectedInfo.type,
        selectionId: selectedInfo.id,
        mode,
      });

      if (!res.success || !res.registration) {
        toast.error(res.error || "Failed to add registrant.");
        return;
      }

      if (mode === "payment_link") {
        toast.success(`Payment link generated and emailed to ${trimmedEmail}!`, {
          description: `Invoice: ${res.invoiceNumber ?? "Generated"}`,
        });
      } else {
        toast.success(`Registered ${trimmedName} directly to Bevy!`, {
          description: `Ticket code: ${res.registration.attendee_code || "Issued"}`,
        });
      }

      onSuccess(res.registration);
      handleReset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(msg);
    } finally {
      setIsSubmittingDirect(false);
      setIsSubmittingPay(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Add Registrant Manually</DialogTitle>
              <DialogDescription className="text-xs">
                Register an attendee directly to Bevy or issue a payment link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor={fullNameId} className="text-xs font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={fullNameId}
              placeholder="e.g. Budi Santoso"
              value={fullName}
              disabled={isBusy}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor={emailId} className="text-xs font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id={emailId}
              type="email"
              placeholder="e.g. budi@example.com"
              value={email}
              disabled={isBusy}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Ticket / Bundle Selection */}
          <div className="space-y-1.5">
            <Label htmlFor={selectionIdKey} className="text-xs font-medium">
              Ticket or Bundle Selection <span className="text-destructive">*</span>
            </Label>
            <Select value={effectiveKey} onValueChange={setSelectedKey} disabled={isBusy}>
              <SelectTrigger id={selectionIdKey} className="h-9 text-xs">
                <SelectValue placeholder="Select ticket tier or bundle" />
              </SelectTrigger>
              <SelectContent>
                {activeTickets.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Ticket Tiers
                    </SelectLabel>
                    {activeTickets.map((t) => {
                      const priceLabel =
                        t.type === "free" || !t.price || t.price === 0
                          ? "Free"
                          : `Rp ${Number(t.price).toLocaleString("id-ID")}`;
                      return (
                        <SelectItem key={`ticket_${t.id}`} value={`ticket_${t.id}`} className="text-xs">
                          <span className="font-medium">{t.name}</span>
                          <span className="ml-1.5 text-muted-foreground">({priceLabel})</span>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}

                {activeBundles.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Bundle Packages
                    </SelectLabel>
                    {activeBundles.map((b) => {
                      const priceLabel = `Rp ${Number(b.price || 0).toLocaleString("id-ID")}`;
                      return (
                        <SelectItem key={`bundle_${b.id}`} value={`bundle_${b.id}`} className="text-xs">
                          <span className="font-medium">{b.name}</span>
                          <span className="ml-1.5 text-muted-foreground">({priceLabel})</span>
                          {b.badge && (
                            <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                              {b.badge}
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}

                {activeTickets.length === 0 && activeBundles.length === 0 && (
                  <SelectItem value="ticket_regular" className="text-xs">
                    Regular Ticket (Default Free)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing indicator banner */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Item Price</span>
            <span className="font-semibold">
              {isPaid ? `Rp ${selectedInfo.price.toLocaleString("id-ID")}` : "Free"}
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="h-8 text-xs">
            Cancel
          </Button>

          {/* Add Directly: Always available */}
          <Button
            type="button"
            variant={isPaid ? "outline" : "default"}
            onClick={() => handleSubmit("direct")}
            disabled={isBusy}
            className="h-8 gap-1.5 text-xs"
            title="Adds attendee directly to Bevy and marks as confirmed"
          >
            {isSubmittingDirect ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Adding to Bevy...</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3.5" />
                <span>Add Directly</span>
              </>
            )}
          </Button>

          {/* Generate Payment Link: Only visible when paid detected */}
          {isPaid && (
            <Button
              type="button"
              variant="default"
              onClick={() => handleSubmit("payment_link")}
              disabled={isBusy}
              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              title="Creates pending registration and emails DOKU payment link"
            >
              {isSubmittingPay ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Generating Link...</span>
                </>
              ) : (
                <>
                  <CreditCard className="size-3.5" />
                  <span>Generate Payment Link</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

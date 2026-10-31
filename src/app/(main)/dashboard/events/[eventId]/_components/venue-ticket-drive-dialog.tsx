"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  ExternalLink,
  Filter,
  FolderSync,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  SearchCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFirestoreDate } from "@/lib/date-utils";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import {
  checkDriveReaderPermission,
  computeSequencePdfAssignments,
  type EventVenueTicketConfig,
  extractDriveFolderId,
  findOrphanedVenueTicketShares,
  getCachedDriveAccessToken,
  getEventVenueTicketConfig,
  grantDriveReaderPermission,
  listDriveFolderPdfs,
  recordVenueTicketGrantedShare,
  requestDriveAccessToken,
  revokeVenueTicketAccessForItems,
  saveEventVehicleTicketUrl,
  saveEventVenueTicketConfig,
  saveRegistrationVenueTicketAssignments,
  sortEligibleRegistrantsByTime,
  updateRegistrationDriveShareStatus,
} from "@/lib/google-drive/venue-tickets";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface VenueTicketDriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  event?: FirestoreEvent | null;
  registrations: FirestoreRegistration[];
  config: EventVenueTicketConfig | null;
  onConfigUpdated: (config: EventVenueTicketConfig) => void;
  onRegistrationsPatched: (updatesByRegId: Map<string, Partial<FirestoreRegistration>>) => void;
  onSendVenueTicketEmail: (reg: FirestoreRegistration, sharedToken?: string) => Promise<boolean>;
  sendingRegistrationId?: string | null;
}

export function VenueTicketDriveDialog({
  open,
  onOpenChange,
  eventId,
  registrations,
  config,
  onConfigUpdated,
  onRegistrationsPatched,
  onSendVenueTicketEmail,
  sendingRegistrationId,
}: VenueTicketDriveDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [folderUrl, setFolderUrl] = useState(config?.folder_url ?? "");
  const [vehicleTicketUrl, setVehicleTicketUrl] = useState(config?.vehicle_ticket_url ?? "");
  const [isSavingVehicleUrl, setIsSavingVehicleUrl] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRemapping, setIsRemapping] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [checkAccessProgress, setCheckAccessProgress] = useState<{ current: number; total: number } | null>(null);
  const [grantingAccessId, setGrantingAccessId] = useState<string | null>(null);
  const [unverifiedAccessIds, setUnverifiedAccessIds] = useState<Set<string>>(new Set());
  const [deliveryFilter, setDeliveryFilter] = useState<
    "all" | "sent" | "not_sent" | "shared" | "not_shared" | "pending_send" | "unassigned"
  >("all");
  const [seqRangeOption, setSeqRangeOption] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isVehicleUrlDirty = useMemo(
    () => (vehicleTicketUrl ?? "").trim() !== (config?.vehicle_ticket_url ?? "").trim(),
    [vehicleTicketUrl, config?.vehicle_ticket_url],
  );

  // Clear selections when filter changes or registrations change significantly
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(registrations.map((r) => r.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [registrations]);

  useEffect(() => {
    if (config?.folder_url && !folderUrl) {
      setFolderUrl(config.folder_url);
    }
  }, [config?.folder_url, folderUrl]);

  useEffect(() => {
    setVehicleTicketUrl(config?.vehicle_ticket_url ?? "");
  }, [config?.vehicle_ticket_url]);

  const eligibleRegistrants = useMemo(() => sortEligibleRegistrantsByTime(registrations), [registrations]);

  const syncedFiles = config?.files ?? [];

  const mappedCount = useMemo(
    () => eligibleRegistrants.filter((r) => Boolean(r.venue_ticket_file_id)).length,
    [eligibleRegistrants],
  );

  const sentCount = useMemo(
    () => eligibleRegistrants.filter((r) => Boolean(r.venue_ticket_sent_at)).length,
    [eligibleRegistrants],
  );

  const pendingSendRegistrants = useMemo(
    () =>
      eligibleRegistrants.filter(
        (r) => Boolean(r.venue_ticket_file_id && r.venue_ticket_url) && !r.venue_ticket_sent_at,
      ),
    [eligibleRegistrants],
  );

  const sharedCount = useMemo(
    () => eligibleRegistrants.filter((r) => Boolean(r.venue_ticket_shared_at)).length,
    [eligibleRegistrants],
  );

  const seqRangeOptions = useMemo(() => {
    const total = eligibleRegistrants.length;
    if (total === 0) return [];

    const bucketSize = 100;
    const options: Array<{ label: string; value: string; start: number; end: number }> = [];

    for (let start = 1; start <= total; start += bucketSize) {
      const end = Math.min(start + bucketSize - 1, total);
      options.push({
        label: `No. ${start} – ${end === total ? `${end} (End)` : end}`,
        value: `${start}-${end}`,
        start,
        end,
      });
    }

    return options;
  }, [eligibleRegistrants.length]);

  const parsedSeqRange = useMemo(() => {
    if (seqRangeOption === "all") return null;
    const parts = seqRangeOption.split("-");
    const start = Number.parseInt(parts[0], 10);
    const end = Number.parseInt(parts[1], 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { start, end };
  }, [seqRangeOption]);

  const filteredRegistrantsWithIndex = useMemo(() => {
    return eligibleRegistrants
      .map((reg, index) => ({ reg, sequenceNumber: index + 1 }))
      .filter(({ reg, sequenceNumber }) => {
        if (parsedSeqRange) {
          if (sequenceNumber < parsedSeqRange.start || sequenceNumber > parsedSeqRange.end) {
            return false;
          }
        }
        if (deliveryFilter === "all") return true;
        if (deliveryFilter === "sent") return Boolean(reg.venue_ticket_sent_at);
        if (deliveryFilter === "not_sent") return !reg.venue_ticket_sent_at;
        if (deliveryFilter === "shared") return Boolean(reg.venue_ticket_shared_at);
        if (deliveryFilter === "not_shared") return !reg.venue_ticket_shared_at;
        if (deliveryFilter === "pending_send") {
          return Boolean(reg.venue_ticket_file_id && reg.venue_ticket_url) && !reg.venue_ticket_sent_at;
        }
        if (deliveryFilter === "unassigned") return !reg.venue_ticket_file_id;
        return true;
      });
  }, [eligibleRegistrants, deliveryFilter, parsedSeqRange]);

  const handleSyncAndMap = async () => {
    const folderId = extractDriveFolderId(folderUrl);
    if (!folderId) {
      toast.error("Please enter a valid Google Drive folder URL or folder ID.");
      return;
    }

    setIsSyncing(true);
    try {
      let token = getCachedDriveAccessToken(user?.email) || (await requestDriveAccessToken(user?.email));
      const files = await listDriveFolderPdfs(folderId, token).catch(async (_err) => {
        // Retry once with forced consent if token expired or lacks scope
        token = await requestDriveAccessToken(user?.email, true);
        return listDriveFolderPdfs(folderId, token);
      });

      if (files.length === 0) {
        toast.warning("No venue ticket files found in the selected Google Drive folder.");
      }

      const assignmentResult = computeSequencePdfAssignments(registrations, files);
      const itemsToRevoke = [
        ...assignmentResult.staleRegistrants.map((r) => ({
          fileId: r.venue_ticket_file_id,
          email: r.member_email,
          registrationId: r.id,
        })),
        ...assignmentResult.assignments
          .filter(
            ({ registration, file }) =>
              Boolean(registration.venue_ticket_file_id) && registration.venue_ticket_file_id !== file.id,
          )
          .map(({ registration }) => ({
            fileId: registration.venue_ticket_file_id,
            email: registration.member_email,
            registrationId: registration.id,
          })),
        ...findOrphanedVenueTicketShares(registrations, config),
      ];
      if (itemsToRevoke.length > 0) {
        await revokeVenueTicketAccessForItems(itemsToRevoke, {
          eventId,
          userEmail: user?.email,
          accessToken: token,
        });
      }

      const updatesByRegId = await saveRegistrationVenueTicketAssignments(
        assignmentResult.assignments,
        assignmentResult.staleRegistrants,
      );
      const savedConfig = await saveEventVenueTicketConfig(eventId, folderUrl, folderId, files, {
        vehicleTicketUrl,
      });

      onConfigUpdated(savedConfig);
      if (updatesByRegId.size > 0) {
        onRegistrationsPatched(updatesByRegId);
      }

      toast.success(
        `Synced ${files.length} ticket file(s) and mapped ${assignmentResult.assignments.length} of ${assignmentResult.eligibleRegistrants.length} confirmed registrant(s).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sync Google Drive folder.";
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemapRegistrants = async () => {
    if (syncedFiles.length === 0) {
      if (folderUrl.trim()) {
        await handleSyncAndMap();
      } else {
        toast.error("Sync a Google Drive folder first before remapping registrants.");
      }
      return;
    }

    setIsRemapping(true);
    try {
      const assignmentResult = computeSequencePdfAssignments(registrations, syncedFiles);
      const itemsToRevoke = [
        ...assignmentResult.staleRegistrants.map((r) => ({
          fileId: r.venue_ticket_file_id,
          email: r.member_email,
          registrationId: r.id,
        })),
        ...assignmentResult.assignments
          .filter(
            ({ registration, file }) =>
              Boolean(registration.venue_ticket_file_id) && registration.venue_ticket_file_id !== file.id,
          )
          .map(({ registration }) => ({
            fileId: registration.venue_ticket_file_id,
            email: registration.member_email,
            registrationId: registration.id,
          })),
        ...findOrphanedVenueTicketShares(registrations, config),
      ];
      if (itemsToRevoke.length > 0) {
        await revokeVenueTicketAccessForItems(itemsToRevoke, {
          eventId,
          userEmail: user?.email,
        });
        const refreshedConfig = await getEventVenueTicketConfig(eventId);
        if (refreshedConfig) {
          onConfigUpdated(refreshedConfig);
        }
      }

      const updatesByRegId = await saveRegistrationVenueTicketAssignments(
        assignmentResult.assignments,
        assignmentResult.staleRegistrants,
      );
      if (updatesByRegId.size > 0) {
        onRegistrationsPatched(updatesByRegId);
      }
      toast.success(
        `Remapped ${assignmentResult.assignments.length} of ${assignmentResult.eligibleRegistrants.length} confirmed registrant(s) (${updatesByRegId.size} updated).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remap registrants.";
      toast.error(msg);
    } finally {
      setIsRemapping(false);
    }
  };

  const selectedRegistrants = useMemo(() => {
    return eligibleRegistrants.filter((r) => selectedIds.has(r.id));
  }, [eligibleRegistrants, selectedIds]);

  const selectedWithTicket = useMemo(() => {
    return selectedRegistrants.filter((r) => Boolean(r.venue_ticket_file_id && r.venue_ticket_url));
  }, [selectedRegistrants]);

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAllFiltered = () => {
    if (filteredRegistrantsWithIndex.length === 0) return;
    const allFilteredSelected = filteredRegistrantsWithIndex.every(({ reg }) => selectedIds.has(reg.id));
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      for (const { reg } of filteredRegistrantsWithIndex) {
        next.delete(reg.id);
      }
    } else {
      for (const { reg } of filteredRegistrantsWithIndex) {
        next.add(reg.id);
      }
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkSendPending = async () => {
    if (pendingSendRegistrants.length === 0) return;

    setIsBulkSending(true);
    setBulkProgress({ current: 0, total: pendingSendRegistrants.length });
    try {
      const token = getCachedDriveAccessToken(user?.email) || (await requestDriveAccessToken(user?.email));
      let successCount = 0;

      for (let i = 0; i < pendingSendRegistrants.length; i++) {
        const reg = pendingSendRegistrants[i];
        setBulkProgress({ current: i + 1, total: pendingSendRegistrants.length });
        const currentValidToken = getCachedDriveAccessToken(user?.email) || token;
        const ok = await onSendVenueTicketEmail(reg, currentValidToken);
        if (ok) {
          successCount += 1;
        } else {
          toast.error(
            `Bulk delivery stopped at ${reg.member_name} (${i + 1}/${pendingSendRegistrants.length}) due to an error.`,
          );
          break;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Sent Venue Ticket email and granted view access to ${successCount} of ${pendingSendRegistrants.length} registrant(s).`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete bulk venue ticket delivery.";
      toast.error(msg);
    } finally {
      setIsBulkSending(false);
      setBulkProgress(null);
    }
  };

  const handleBulkSendSelected = async () => {
    if (selectedWithTicket.length === 0) {
      toast.error("None of the selected registrants have an assigned venue ticket file.");
      return;
    }

    setIsBulkSending(true);
    setBulkProgress({ current: 0, total: selectedWithTicket.length });
    try {
      const token = getCachedDriveAccessToken(user?.email) || (await requestDriveAccessToken(user?.email));
      let successCount = 0;

      for (let i = 0; i < selectedWithTicket.length; i++) {
        const reg = selectedWithTicket[i];
        setBulkProgress({ current: i + 1, total: selectedWithTicket.length });
        const currentValidToken = getCachedDriveAccessToken(user?.email) || token;
        const ok = await onSendVenueTicketEmail(reg, currentValidToken);
        if (ok) {
          successCount += 1;
        } else {
          toast.error(
            `Selected bulk delivery stopped at ${reg.member_name} (${i + 1}/${selectedWithTicket.length}) due to an error.`,
          );
          break;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Sent Venue Ticket email and granted view access to ${successCount} of ${selectedWithTicket.length} selected registrant(s).`,
        );
      }
      setSelectedIds(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete selected venue ticket delivery.";
      toast.error(msg);
    } finally {
      setIsBulkSending(false);
      setBulkProgress(null);
    }
  };

  const handleSaveVehicleTicketUrl = async () => {
    if (!isVehicleUrlDirty) return;
    setIsSavingVehicleUrl(true);
    try {
      const savedConfig = await saveEventVehicleTicketUrl(eventId, vehicleTicketUrl.trim() || undefined);
      onConfigUpdated(savedConfig);
      toast.success(
        savedConfig.vehicle_ticket_url
          ? "Vehicle parking pass link saved to Firestore."
          : "Vehicle parking pass link cleared from Firestore.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save vehicle parking pass link.";
      toast.error(msg);
    } finally {
      setIsSavingVehicleUrl(false);
    }
  };

  const targetsToCheckAccess = useMemo(() => {
    if (selectedIds.size > 0) {
      return selectedWithTicket;
    }
    return filteredRegistrantsWithIndex
      .map(({ reg }) => reg)
      .filter((r) => Boolean(r.venue_ticket_file_id && r.venue_ticket_url));
  }, [selectedIds.size, selectedWithTicket, filteredRegistrantsWithIndex]);

  const handleBulkCheckDriveAccess = async () => {
    if (targetsToCheckAccess.length === 0) {
      toast.error("No registrants with assigned venue ticket files to check.");
      return;
    }

    setIsCheckingAccess(true);
    setCheckAccessProgress({ current: 0, total: targetsToCheckAccess.length });
    try {
      let token = getCachedDriveAccessToken(user?.email) || (await requestDriveAccessToken(user?.email));
      const updatesByRegId = new Map<string, Partial<FirestoreRegistration>>();
      const nextUnverified = new Set(unverifiedAccessIds);
      let verifiedCount = 0;
      let missingCount = 0;

      for (let i = 0; i < targetsToCheckAccess.length; i++) {
        const reg = targetsToCheckAccess[i];
        setCheckAccessProgress({ current: i + 1, total: targetsToCheckAccess.length });
        const fileId = reg.venue_ticket_file_id;
        if (!fileId || !reg.member_email) continue;

        let hasAccess = false;
        try {
          hasAccess = await checkDriveReaderPermission(fileId, reg.member_email, token);
        } catch (err) {
          if (err instanceof Error && err.message.includes("401")) {
            token = await requestDriveAccessToken(user?.email, true);
            hasAccess = await checkDriveReaderPermission(fileId, reg.member_email, token);
          } else {
            throw err;
          }
        }

        if (hasAccess) {
          verifiedCount += 1;
          nextUnverified.delete(reg.id);
          const sharedAt = reg.venue_ticket_shared_at || new Date().toISOString();
          if (!reg.venue_ticket_shared_at) {
            const patch = await updateRegistrationDriveShareStatus(reg.id, sharedAt);
            updatesByRegId.set(reg.id, patch);
          }
        } else {
          missingCount += 1;
          nextUnverified.add(reg.id);
          if (reg.venue_ticket_shared_at) {
            const patch = await updateRegistrationDriveShareStatus(reg.id, null);
            updatesByRegId.set(reg.id, patch);
          }
        }
      }

      setUnverifiedAccessIds(nextUnverified);
      if (updatesByRegId.size > 0) {
        onRegistrationsPatched(updatesByRegId);
      }

      if (missingCount > 0) {
        toast.warning(
          `Drive access checked: ${verifiedCount} shared, ${missingCount} missing access (switched to Grant Access).`,
        );
      } else {
        toast.success(`Drive access verified: all ${verifiedCount} checked attendee(s) have active view access.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to check Google Drive access status.";
      toast.error(msg);
    } finally {
      setIsCheckingAccess(false);
      setCheckAccessProgress(null);
    }
  };

  const handleGrantSingleAccess = async (reg: FirestoreRegistration) => {
    const fileId = reg.venue_ticket_file_id;
    if (!fileId || !reg.member_email) return;

    setGrantingAccessId(reg.id);
    try {
      let token = getCachedDriveAccessToken(user?.email) || (await requestDriveAccessToken(user?.email));
      try {
        await grantDriveReaderPermission(fileId, reg.member_email, token);
      } catch (err) {
        if (err instanceof Error && err.message.includes("401")) {
          token = await requestDriveAccessToken(user?.email, true);
          await grantDriveReaderPermission(fileId, reg.member_email, token);
        } else {
          throw err;
        }
      }

      const sharedAt = new Date().toISOString();
      await recordVenueTicketGrantedShare(eventId, {
        fileId,
        email: reg.member_email,
        registrationId: reg.id,
        sharedAt,
      });
      const patch = await updateRegistrationDriveShareStatus(reg.id, sharedAt);
      const updates = new Map<string, Partial<FirestoreRegistration>>();
      updates.set(reg.id, patch);
      onRegistrationsPatched(updates);

      setUnverifiedAccessIds((prev) => {
        const next = new Set(prev);
        next.delete(reg.id);
        return next;
      });

      const refreshedConfig = await getEventVenueTicketConfig(eventId);
      if (refreshedConfig) {
        onConfigUpdated(refreshedConfig);
      }

      toast.success(`Granted Google Drive view access to ${reg.member_email}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to grant Google Drive access.";
      toast.error(msg);
    } finally {
      setGrantingAccessId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSyncing && !isBulkSending && !isCheckingAccess && onOpenChange(next)}
    >
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl">
        <DialogHeader className="shrink-0 border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Ticket className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-base">Google Drive Venue Ticket Distribution</DialogTitle>
              <DialogDescription className="text-xs">
                Sync a private Google Drive folder of venue tickets, map 1-to-1 by registration timestamp, and grant
                view-only access before sending.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Drive Folder Input & Sync Action */}
          <div className="space-y-2 rounded-lg border bg-muted/15 p-4">
            <Label htmlFor="venue-ticket-folder-url" className="font-semibold text-xs">
              Google Drive Folder Link
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="venue-ticket-folder-url"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1a2b3c4d5e..."
                disabled={isSyncing || isBulkSending}
                className="flex-1 text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSyncAndMap}
                disabled={isSyncing || isBulkSending || !folderUrl.trim()}
                className="gap-1.5 text-xs shrink-0"
              >
                {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <FolderSync className="size-3.5" />}
                <span>{isSyncing ? "Syncing & Mapping..." : "Sync & Auto-Map by Registration Time"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uses your signed-in Google account so the folder can remain private. Already-sent tickets stay locked to
              their recipients, while unsent registrants are remapped in registration-time sequence.
            </p>
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vehicle-ticket-url" className="font-medium text-[11px]">
                  Vehicle Ticket Link
                </Label>
                <code className="text-[10px] text-sky-600 dark:text-sky-400">[[VehicleTicketUrl]]</code>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="vehicle-ticket-url"
                  value={vehicleTicketUrl}
                  onChange={(e) => setVehicleTicketUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  disabled={isSyncing || isBulkSending || isSavingVehicleUrl}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveVehicleTicketUrl}
                  disabled={!isVehicleUrlDirty || isSavingVehicleUrl || isSyncing || isBulkSending}
                  className="h-8 gap-1.5 px-3 text-xs shrink-0"
                >
                  {isSavingVehicleUrl ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>{isSavingVehicleUrl ? "Saving..." : "Save Pass"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Synced Ticket Files</div>
              <div className="mt-1 font-bold text-lg tabular-nums">{syncedFiles.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Confirmed Registrants</div>
              <div className="mt-1 font-bold text-lg tabular-nums">{eligibleRegistrants.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Mapped 1-to-1</div>
              <div className="mt-1 font-bold text-emerald-600 text-lg tabular-nums dark:text-emerald-400">
                {mappedCount}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Sent / Pending</div>
              <div className="mt-1 font-bold text-lg tabular-nums">
                <span className="text-primary">{sentCount}</span>
                <span className="mx-1 text-muted-foreground font-normal text-sm">/</span>
                <span className="text-amber-600 dark:text-amber-400">{pendingSendRegistrants.length}</span>
              </div>
            </div>
          </div>

          {/* Sequence Mapping Preview Table */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-xs">
                  Confirmed Registrants Sequence (Sorted by Registration Time Ascending)
                </span>
                <Select
                  value={deliveryFilter}
                  onValueChange={(val) =>
                    setDeliveryFilter(
                      val as "all" | "sent" | "not_sent" | "shared" | "not_shared" | "pending_send" | "unassigned",
                    )
                  }
                >
                  <SelectTrigger className="h-7 w-[185px] text-xs">
                    <Filter className="mr-1.5 size-3 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Filter delivery status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Registrants ({eligibleRegistrants.length})</SelectItem>
                    <SelectItem value="shared">Drive Access Shared ({sharedCount})</SelectItem>
                    <SelectItem value="not_shared">Not Shared ({eligibleRegistrants.length - sharedCount})</SelectItem>
                    <SelectItem value="sent">Email Sent ({sentCount})</SelectItem>
                    <SelectItem value="not_sent">Email Not Sent ({eligibleRegistrants.length - sentCount})</SelectItem>
                    <SelectItem value="pending_send">Pending Send ({pendingSendRegistrants.length})</SelectItem>
                    <SelectItem value="unassigned">Unassigned ({eligibleRegistrants.length - mappedCount})</SelectItem>
                  </SelectContent>
                </Select>
                {seqRangeOptions.length > 1 && (
                  <Select value={seqRangeOption} onValueChange={setSeqRangeOption}>
                    <SelectTrigger className="h-7 w-[160px] text-xs tabular-nums">
                      <SelectValue placeholder="All Sequence No." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All No. (1 – {eligibleRegistrants.length})</SelectItem>
                      {seqRangeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {config?.updated_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Last synced: {formatFirestoreDate(config.updated_at, "dd MMM yyyy, HH:mm")}
                  </span>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleBulkCheckDriveAccess}
                  disabled={
                    isCheckingAccess || isRemapping || isSyncing || isBulkSending || targetsToCheckAccess.length === 0
                  }
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  {isCheckingAccess ? <Loader2 className="size-3 animate-spin" /> : <SearchCheck className="size-3" />}
                  <span>
                    {isCheckingAccess
                      ? `Checking Access (${checkAccessProgress?.current ?? 0}/${checkAccessProgress?.total ?? 0})...`
                      : selectedIds.size > 0
                        ? `Check Selected Access (${targetsToCheckAccess.length})`
                        : `Check Drive Access (${targetsToCheckAccess.length})`}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleRemapRegistrants}
                  disabled={
                    isRemapping ||
                    isCheckingAccess ||
                    isSyncing ||
                    isBulkSending ||
                    (syncedFiles.length === 0 && !folderUrl.trim())
                  }
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <RefreshCw className={cn("size-3", isRemapping && "animate-spin")} />
                  <span>{isRemapping ? "Remapping..." : "Sync Registrants & Remap"}</span>
                </Button>
              </div>
            </div>

            {/* Selection Toolbar when items selected */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 bg-primary/10 text-primary text-xs">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    <span>
                      {selectedIds.size} {selectedIds.size === 1 ? "attendee" : "attendees"} selected
                    </span>
                  </Badge>
                  {selectedWithTicket.length < selectedIds.size && (
                    <span className="text-[11px] text-muted-foreground">
                      ({selectedWithTicket.length} with assigned ticket)
                    </span>
                  )}
                  {selectedIds.size < filteredRegistrantsWithIndex.length && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next = new Set(selectedIds);
                        for (const { reg } of filteredRegistrantsWithIndex) {
                          next.add(reg.id);
                        }
                        setSelectedIds(next);
                      }}
                      className="h-6 text-muted-foreground text-[11px] hover:text-foreground"
                    >
                      Select all filtered ({filteredRegistrantsWithIndex.length})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleClearSelection}
                    className="h-6 gap-1 text-muted-foreground text-[11px] hover:text-foreground"
                  >
                    <X className="size-3" />
                    Clear
                  </Button>
                </div>

                <Button
                  type="button"
                  size="xs"
                  disabled={isBulkSending || isSyncing || selectedWithTicket.length === 0}
                  onClick={handleBulkSendSelected}
                  className="h-7 gap-1.5 text-xs"
                >
                  {isBulkSending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  <span>
                    {isBulkSending
                      ? `Sending (${bulkProgress?.current ?? 0}/${bulkProgress?.total ?? 0})...`
                      : `Send Venue Ticket to Selected (${selectedWithTicket.length})`}
                  </span>
                </Button>
              </div>
            )}

            <div className="max-h-[340px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredRegistrantsWithIndex.length > 0 &&
                          filteredRegistrantsWithIndex.every(({ reg }) => selectedIds.has(reg.id))
                        }
                        onCheckedChange={toggleSelectAllFiltered}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>Registrant</TableHead>
                    <TableHead className="whitespace-nowrap">Registered At</TableHead>
                    <TableHead>Assigned Venue Ticket</TableHead>
                    <TableHead>Delivery Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrantsWithIndex.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Users className="size-4 text-muted-foreground" />
                          <span>
                            {eligibleRegistrants.length === 0
                              ? "No approved or paid & registered participants yet."
                              : "No registrants match the selected filter."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRegistrantsWithIndex.map(({ reg, sequenceNumber }) => {
                      const isSendingThis = sendingRegistrationId === reg.id;
                      const isSelected = selectedIds.has(reg.id);
                      return (
                        <TableRow key={reg.id} className={cn(isSelected && "bg-muted/40")}>
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectRow(reg.id)}
                              aria-label={`Select ${reg.member_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-muted-foreground text-xs">
                            #{sequenceNumber}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground text-xs">{reg.member_name}</div>
                            <div className="text-[11px] text-muted-foreground">{reg.member_email}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {formatFirestoreDate(reg.registered_at, "dd MMM, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            {reg.venue_ticket_file_name && reg.venue_ticket_url ? (
                              <a
                                href={reg.venue_ticket_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
                              >
                                <span className="max-w-[180px] truncate">{reg.venue_ticket_file_name}</span>
                                <ExternalLink className="size-3 shrink-0" />
                              </a>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Unassigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {reg.venue_ticket_shared_at ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                                >
                                  <ShieldCheck className="size-2.5" />
                                  Shared
                                </Badge>
                              ) : unverifiedAccessIds.has(reg.id) ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                                >
                                  <ShieldAlert className="size-2.5" />
                                  No Access
                                </Badge>
                              ) : null}
                              {reg.venue_ticket_sent_at ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="size-2.5" />
                                  Sent
                                </Badge>
                              ) : reg.venue_ticket_file_id ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                                >
                                  Pending Send
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {reg.venue_ticket_file_id && reg.venue_ticket_url ? (
                              <div className="flex items-center justify-end gap-1">
                                {(unverifiedAccessIds.has(reg.id) ||
                                  (reg.venue_ticket_sent_at && !reg.venue_ticket_shared_at)) && (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    disabled={
                                      grantingAccessId === reg.id ||
                                      isSendingThis ||
                                      isBulkSending ||
                                      isSyncing ||
                                      isCheckingAccess
                                    }
                                    onClick={() => void handleGrantSingleAccess(reg)}
                                    className="h-6 gap-1 border-blue-500/30 px-2 text-[11px] text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                                  >
                                    {grantingAccessId === reg.id ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <ShieldCheck className="size-3" />
                                    )}
                                    <span>Grant Access</span>
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="xs"
                                  variant={reg.venue_ticket_sent_at ? "ghost" : "outline"}
                                  disabled={
                                    isSendingThis ||
                                    grantingAccessId === reg.id ||
                                    isBulkSending ||
                                    isSyncing ||
                                    isCheckingAccess
                                  }
                                  onClick={() => void onSendVenueTicketEmail(reg)}
                                  className={cn(
                                    "h-6 gap-1 px-2 text-[11px]",
                                    !reg.venue_ticket_sent_at && "border-primary/30 text-primary hover:bg-primary/5",
                                  )}
                                >
                                  {isSendingThis ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Mail className="size-3" />
                                  )}
                                  <span>{reg.venue_ticket_sent_at ? "Resend" : "Grant & Send"}</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 shrink-0 flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            {checkAccessProgress
              ? `Checking Drive access ${checkAccessProgress.current} of ${checkAccessProgress.total}...`
              : bulkProgress
                ? `Sending ${bulkProgress.current} of ${bulkProgress.total}...`
                : selectedIds.size > 0
                  ? `${selectedIds.size} selected (${selectedWithTicket.length} ready to send).`
                  : `${pendingSendRegistrants.length} mapped registrant(s) awaiting email delivery.`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSyncing || isBulkSending || isCheckingAccess}
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
            {selectedIds.size > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={isSyncing || isBulkSending || isCheckingAccess || selectedWithTicket.length === 0}
                onClick={handleBulkSendSelected}
                className="gap-1.5 text-xs"
              >
                {isBulkSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                <span>
                  {isBulkSending
                    ? `Sending (${bulkProgress?.current ?? 0}/${bulkProgress?.total ?? 0})...`
                    : `Send Venue Ticket to Selected (${selectedWithTicket.length})`}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isSyncing || isBulkSending || isCheckingAccess || pendingSendRegistrants.length === 0}
                onClick={handleBulkSendPending}
                className="gap-1.5 text-xs"
              >
                {isBulkSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                <span>
                  {isBulkSending
                    ? `Sending (${bulkProgress?.current ?? 0}/${bulkProgress?.total ?? 0})...`
                    : `Grant Access & Send Pending (${pendingSendRegistrants.length})`}
                </span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

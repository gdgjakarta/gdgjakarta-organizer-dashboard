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
  Send,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFirestoreDate } from "@/lib/date-utils";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import {
  computeSequencePdfAssignments,
  type EventVenueTicketConfig,
  extractDriveFolderId,
  findOrphanedVenueTicketShares,
  getCachedDriveAccessToken,
  getEventVenueTicketConfig,
  listDriveFolderPdfs,
  requestDriveAccessToken,
  revokeVenueTicketAccessForItems,
  saveEventVenueTicketConfig,
  saveRegistrationVenueTicketAssignments,
  sortEligibleRegistrantsByTime,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRemapping, setIsRemapping] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<
    "all" | "sent" | "not_sent" | "shared" | "not_shared" | "pending_send" | "unassigned"
  >("all");

  useEffect(() => {
    if (config?.folder_url && !folderUrl) {
      setFolderUrl(config.folder_url);
    }
    if (config?.vehicle_ticket_url && !vehicleTicketUrl) {
      setVehicleTicketUrl(config.vehicle_ticket_url);
    }
  }, [config?.folder_url, config?.vehicle_ticket_url, folderUrl, vehicleTicketUrl]);

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

  const filteredRegistrantsWithIndex = useMemo(() => {
    return eligibleRegistrants
      .map((reg, index) => ({ reg, sequenceNumber: index + 1 }))
      .filter(({ reg }) => {
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
  }, [eligibleRegistrants, deliveryFilter]);

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
        const ok = await onSendVenueTicketEmail(reg, token);
        if (ok) successCount += 1;
      }

      toast.success(
        `Sent Venue Ticket email and granted view access to ${successCount} of ${pendingSendRegistrants.length} registrant(s).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete bulk venue ticket delivery.";
      toast.error(msg);
    } finally {
      setIsBulkSending(false);
      setBulkProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSyncing && !isBulkSending && onOpenChange(next)}>
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
              <Input
                id="vehicle-ticket-url"
                value={vehicleTicketUrl}
                onChange={(e) => {
                  const next = e.target.value;
                  setVehicleTicketUrl(next);
                  if (config) onConfigUpdated({ ...config, vehicle_ticket_url: next.trim() || undefined });
                }}
                placeholder="https://drive.google.com/file/d/..."
                disabled={isSyncing || isBulkSending}
                className="h-8 text-xs"
              />
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
              </div>
              <div className="flex items-center gap-2">
                {config?.updated_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Last synced: {formatFirestoreDate(config.updated_at, "dd MMM yyyy, HH:mm")}
                  </span>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleRemapRegistrants}
                  disabled={
                    isRemapping || isSyncing || isBulkSending || (syncedFiles.length === 0 && !folderUrl.trim())
                  }
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <RefreshCw className={cn("size-3", isRemapping && "animate-spin")} />
                  <span>{isRemapping ? "Remapping..." : "Sync Registrants & Remap"}</span>
                </Button>
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">No.</TableHead>
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
                      <TableCell colSpan={6} className="h-28 text-center text-muted-foreground text-xs">
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
                      return (
                        <TableRow key={reg.id}>
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
                              {reg.venue_ticket_shared_at && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                                >
                                  <ShieldCheck className="size-2.5" />
                                  Shared
                                </Badge>
                              )}
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
                              <Button
                                type="button"
                                size="xs"
                                variant={reg.venue_ticket_sent_at ? "ghost" : "outline"}
                                disabled={isSendingThis || isBulkSending || isSyncing}
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
            {bulkProgress
              ? `Sending ${bulkProgress.current} of ${bulkProgress.total}...`
              : `${pendingSendRegistrants.length} mapped registrant(s) awaiting email delivery.`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSyncing || isBulkSending}
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSyncing || isBulkSending || pendingSendRegistrants.length === 0}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

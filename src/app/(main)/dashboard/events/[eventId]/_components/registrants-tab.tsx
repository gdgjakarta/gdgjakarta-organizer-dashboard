"use client";

import { useState, useTransition } from "react";

import { format, parseISO } from "date-fns";
import { Check, CheckCircle, Download, MoreHorizontal, Search, UserCheck, UserX, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import { updateRegistrationStatusAction } from "@/server/firestore-actions";

interface RegistrantsTabProps {
  eventId: string;
  registrations: FirestoreRegistration[];
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string; dotClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
};

export function RegistrantsTab({ eventId, registrations }: RegistrantsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectRegistration, setInspectRegistration] = useState<FirestoreRegistration | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compute email occurrences to detect duplicate registrant attempts
  const emailCounts = new Map<string, number>();
  for (const r of registrations) {
    const email = (r.member_email || "").toLowerCase();
    if (email) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
  }

  // Filter logic
  const filtered = registrations.filter((reg) => {
    const matchesSearch =
      reg.member_name.toLowerCase().includes(search.toLowerCase()) ||
      reg.member_email.toLowerCase().includes(search.toLowerCase()) ||
      (reg.answers && JSON.stringify(reg.answers).toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "all" || reg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (registrationId: string, newStatus: RegistrationStatus) => {
    startTransition(async () => {
      try {
        await updateRegistrationStatusAction(registrationId, eventId, newStatus);
        toast.success(`Applicant marked as ${STATUS_VARIANTS[newStatus].label}`);
      } catch {
        toast.error("Failed to update status.");
      }
    });
  };

  const handleBatchAction = (newStatus: RegistrationStatus) => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      try {
        const promises = Array.from(selectedIds).map((id) => updateRegistrationStatusAction(id, eventId, newStatus));
        await Promise.all(promises);
        toast.success(`Updated ${selectedIds.size} registrants to ${STATUS_VARIANTS[newStatus].label}`);
        setSelectedIds(new Set());
      } catch {
        toast.error("Batch update failed.");
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Registrants & Attendance Filtration ({filtered.length})</CardTitle>
            <CardDescription>
              Review attendee applications, professionalism criteria, and approve or reject participants.
            </CardDescription>
          </div>

          {/* Batch Actions Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground text-xs">{selectedIds.size} selected:</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-emerald-600 dark:text-emerald-400"
                onClick={() => handleBatchAction("approved")}
                disabled={isPending}
              >
                <UserCheck className="size-3.5" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive"
                onClick={() => handleBatchAction("rejected")}
                disabled={isPending}
              >
                <UserX className="size-3.5" />
                Reject All
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {/* Filtration Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="h-8 w-64">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8 text-xs"
                  placeholder="Search name, email, role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="h-8 text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="attended">Attended</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Download className="size-3" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Registrants Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Professionalism & Details</TableHead>
                  <TableHead>Registered At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                      {registrations.length === 0
                        ? "No registrations received yet for this event."
                        : "No applicants match the selected filter criteria."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((reg) => {
                    const statusMeta = STATUS_VARIANTS[reg.status] || STATUS_VARIANTS.pending;
                    const answersSummary = reg.answers
                      ? Object.entries(reg.answers)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" • ")
                      : "Standard RSVP";

                    let regDate = reg.registered_at;
                    try {
                      regDate = format(parseISO(reg.registered_at), "dd MMM yyyy, h:mm a");
                    } catch {
                      // Keep raw string
                    }

                    return (
                      <TableRow key={reg.id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(reg.id)}
                            onCheckedChange={() => toggleSelectRow(reg.id)}
                            aria-label={`Select ${reg.member_name}`}
                          />
                        </TableCell>

                        <TableCell onClick={() => setInspectRegistration(reg)}>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-full border">
                              <AvatarImage src={reg.member_avatar} alt={reg.member_name} />
                              <AvatarFallback className="font-medium text-xs">
                                {getInitials(reg.member_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-foreground text-sm hover:underline">
                                {reg.member_name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">{reg.member_email}</span>
                                {(emailCounts.get((reg.member_email || "").toLowerCase()) || 0) > 1 && (
                                  <Badge
                                    variant="destructive"
                                    className="px-1.5 py-0 font-normal text-[10px]"
                                    title="Multiple registrations detected with this email address"
                                  >
                                    Duplicate Email
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell onClick={() => setInspectRegistration(reg)}>
                          <Badge
                            variant="outline"
                            className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", statusMeta.badgeClass)}
                          >
                            <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                            {statusMeta.label}
                          </Badge>
                        </TableCell>

                        <TableCell onClick={() => setInspectRegistration(reg)} className="max-w-[280px]">
                          <div className="truncate text-muted-foreground text-xs" title={answersSummary}>
                            {answersSummary}
                          </div>
                        </TableCell>

                        <TableCell
                          onClick={() => setInspectRegistration(reg)}
                          className="text-muted-foreground text-xs"
                        >
                          {regDate}
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {reg.status !== "approved" && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="size-7 text-emerald-600 hover:bg-emerald-500/10"
                                title="Approve"
                                onClick={() => handleStatusChange(reg.id, "approved")}
                                disabled={isPending}
                              >
                                <Check className="size-4" />
                              </Button>
                            )}

                            {reg.status !== "rejected" && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="size-7 text-destructive hover:bg-destructive/10"
                                title="Reject"
                                onClick={() => handleStatusChange(reg.id, "rejected")}
                                disabled={isPending}
                              >
                                <X className="size-4" />
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" className="size-7 text-muted-foreground">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setInspectRegistration(reg)}>
                                  View application details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(reg.id, "waitlisted")}>
                                  Move to Waitlist
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(reg.id, "attended")}>
                                  Mark as Attended
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Applicant Details Modal */}
      {inspectRegistration && (
        <Dialog open={Boolean(inspectRegistration)} onOpenChange={(open) => !open && setInspectRegistration(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="size-9 rounded-full border">
                  <AvatarImage src={inspectRegistration.member_avatar} alt={inspectRegistration.member_name} />
                  <AvatarFallback>{getInitials(inspectRegistration.member_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-base">{inspectRegistration.member_name}</div>
                  <div className="text-muted-foreground text-xs">{inspectRegistration.member_email}</div>
                </div>
              </DialogTitle>
              <DialogDescription>
                Submitted registration details and question responses for filtration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <div className="font-medium text-muted-foreground text-xs uppercase">Status</div>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 border px-2 py-0.5 font-medium text-xs",
                    (STATUS_VARIANTS[inspectRegistration.status] || STATUS_VARIANTS.pending).badgeClass,
                  )}
                >
                  {(STATUS_VARIANTS[inspectRegistration.status] || STATUS_VARIANTS.pending).label}
                </Badge>
              </div>

              {inspectRegistration.answers && Object.keys(inspectRegistration.answers).length > 0 ? (
                <div className="space-y-3">
                  <div className="font-semibold text-muted-foreground text-xs uppercase">Question Responses</div>
                  <div className="space-y-2.5">
                    {Object.entries(inspectRegistration.answers).map(([question, answer]) => (
                      <div key={question} className="rounded-md border p-2.5">
                        <div className="font-medium text-muted-foreground text-xs">{question}</div>
                        <div className="mt-1 font-medium text-foreground text-sm">{String(answer)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground text-xs italic">
                  No additional custom questions were attached to this registration.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  handleStatusChange(inspectRegistration.id, "rejected");
                  setInspectRegistration(null);
                }}
              >
                <XCircle className="mr-1.5 size-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  handleStatusChange(inspectRegistration.id, "approved");
                  setInspectRegistration(null);
                }}
              >
                <CheckCircle className="mr-1.5 size-3.5" />
                Approve
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

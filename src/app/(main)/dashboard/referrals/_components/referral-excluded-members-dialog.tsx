"use client";

import { useCallback, useEffect, useState } from "react";

import { Check, Loader2, Plus, Search, ShieldAlert, Undo2, UserX } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  excludeMemberFromLeaderboardAction,
  getExcludedReferralMembersAction,
  includeMemberInLeaderboardAction,
  searchMembersForExclusionAction,
} from "@/lib/firestore/actions";
import type { ExcludedReferralMember } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface ReferralExcludedMembersDialogProps {
  onExclusionsChanged: () => void;
  autoExcludeRoles?: string[];
  autoExcludeOrganizers?: boolean;
}

export function ReferralExcludedMembersDialog({
  onExclusionsChanged,
  autoExcludeRoles,
  autoExcludeOrganizers,
}: ReferralExcludedMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [excludedList, setExcludedList] = useState<ExcludedReferralMember[]>([]);
  const [filterExcludedQuery, setFilterExcludedQuery] = useState("");

  const trimmedFilter = filterExcludedQuery.toLowerCase().trim();
  const filteredExcludedList = trimmedFilter
    ? excludedList.filter(
        (m) =>
          m.name.toLowerCase().includes(trimmedFilter) ||
          m.email.toLowerCase().includes(trimmedFilter) ||
          m.role.toLowerCase().includes(trimmedFilter) ||
          m.member_id.toLowerCase().includes(trimmedFilter),
      )
    : excludedList;

  // Search mode to add new member to exclusion
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      avatar_url?: string | null;
      isAlreadyExcluded: boolean;
    }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const loadExcludedMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExcludedReferralMembersAction();
      setExcludedList(data);
    } catch {
      toast.error("Failed to load excluded members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadExcludedMembers();
    }
  }, [open, loadExcludedMembers]);

  // Handle Search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchMembersForExclusionAction(searchQuery.trim());
        setSearchResults(results);
      } catch {
        // Quiet fallback
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  const handleExcludeMember = async (memberId: string, memberName: string) => {
    setActionInProgressId(memberId);
    try {
      const res = await excludeMemberFromLeaderboardAction(memberId);
      if (!res.success) {
        toast.error(res.error || "Failed to exclude member.");
        return;
      }
      toast.success(`${memberName} excluded from referral leaderboard.`);
      await loadExcludedMembers();
      onExclusionsChanged();
      // Update local search result state
      setSearchResults((prev) => prev.map((m) => (m.id === memberId ? { ...m, isAlreadyExcluded: true } : m)));
    } catch {
      toast.error("Failed to exclude member.");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRestoreMember = async (memberId: string, memberName: string) => {
    setActionInProgressId(memberId);
    try {
      const res = await includeMemberInLeaderboardAction(memberId);
      if (!res.success) {
        toast.error(res.error || "Failed to restore member.");
        return;
      }
      toast.success(`${memberName} restored to referral leaderboard.`);
      await loadExcludedMembers();
      onExclusionsChanged();
      setSearchResults((prev) => prev.map((m) => (m.id === memberId ? { ...m, isAlreadyExcluded: false } : m)));
    } catch {
      toast.error("Failed to restore member.");
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
          <UserX className="size-3.5" />
          Excluded Members
          {excludedList.length > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {excludedList.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-xs">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Leaderboard Excluded Members</DialogTitle>
              <DialogDescription className="text-xs">
                Members listed here will not appear in leaderboard rankings, podiums, or be eligible for prizes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Quick Search & Add Member */}
          <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5">
            <p className="text-xs font-medium text-foreground">Exclude a Member</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search member by name or email to exclude..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-2.5 size-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Live Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 divide-y rounded-lg border bg-background text-xs shadow-xs max-h-48 overflow-y-auto">
                {searchResults.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={m.name} />
                        <AvatarFallback className="text-[9px]">
                          {m.name
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0]?.toUpperCase())
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-xs leading-none">{m.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground leading-none">{m.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                        {m.role}
                      </Badge>
                    </div>

                    {m.isAlreadyExcluded ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
                        <Check className="size-2.5" />
                        Already Excluded
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleExcludeMember(m.id, m.name)}
                        disabled={actionInProgressId === m.id}
                        className="h-6 gap-1 text-[11px]"
                      >
                        {actionInProgressId === m.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="size-3" />
                            Exclude
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Currently Excluded Table */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-foreground">
                  Currently Excluded Members ({excludedList.length})
                </p>
                {(() => {
                  const effectiveRoles =
                    autoExcludeRoles ?? (autoExcludeOrganizers ? ["googler", "organizer", "team_member"] : []);
                  if (effectiveRoles.length === 0) return null;

                  return (
                    <div className="flex flex-wrap items-center gap-1">
                      {effectiveRoles.includes("googler") && (
                        <Badge
                          variant="outline"
                          className="border-red-500/30 bg-red-500/10 text-red-700 text-[10px] dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300"
                        >
                          Googler Excluded
                        </Badge>
                      )}
                      {effectiveRoles.includes("organizer") && (
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 bg-blue-500/10 text-blue-700 text-[10px] dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300"
                        >
                          Organizer Excluded
                        </Badge>
                      )}
                      {effectiveRoles.includes("team_member") && (
                        <Badge
                          variant="outline"
                          className="border-purple-500/30 bg-purple-500/10 text-purple-700 text-[10px] dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300"
                        >
                          Team Member Excluded
                        </Badge>
                      )}
                    </div>
                  );
                })()}
              </div>
              {excludedList.length > 2 && (
                <div className="relative w-full sm:w-48">
                  <Search className="pointer-events-none absolute left-2.5 top-2 size-3 text-muted-foreground" />
                  <Input
                    placeholder="Filter excluded list..."
                    value={filterExcludedQuery}
                    onChange={(e) => setFilterExcludedQuery(e.target.value)}
                    className="h-7 pl-7 text-[11px] bg-background"
                  />
                </div>
              )}
            </div>

            {loading && (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && excludedList.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs">
                No members are currently excluded from the leaderboard.
              </div>
            )}

            {!loading && excludedList.length > 0 && filteredExcludedList.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs">
                No excluded members match &quot;{filterExcludedQuery}&quot;.
              </div>
            )}

            {!loading && filteredExcludedList.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Member</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-right text-xs">Points</TableHead>
                      <TableHead className="text-center text-xs">Exclusion Reason</TableHead>
                      <TableHead className="w-24 text-right text-xs">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExcludedList.map((entry) => (
                      <TableRow key={entry.member_id} className="text-xs">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarImage src={entry.avatar_url ?? undefined} alt={entry.name} />
                              <AvatarFallback className="text-[10px]">
                                {entry.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((w) => w[0]?.toUpperCase())
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-xs leading-none">{entry.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-none">{entry.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="font-normal text-[10px]">
                            {entry.role}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs">
                          {entry.referral_points} <span className="text-[10px] text-muted-foreground">pts</span>
                        </TableCell>

                        <TableCell className="text-center">
                          {entry.reason === "role_auto" ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                entry.excluded_role === "googler"
                                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300"
                                  : entry.excluded_role === "organizer"
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300"
                                    : "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300",
                              )}
                            >
                              {entry.excluded_role === "googler"
                                ? "Role (Googler)"
                                : entry.excluded_role === "organizer"
                                  ? "Role (Organizer)"
                                  : entry.excluded_role === "team_member"
                                    ? "Role (Team Member)"
                                    : `Role (${entry.role})`}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Manually Excluded
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {entry.reason === "manual" ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleRestoreMember(entry.member_id, entry.name)}
                              disabled={actionInProgressId === entry.member_id}
                              className="h-6 gap-1 text-[11px] text-primary hover:text-primary"
                              title="Restore to leaderboard"
                            >
                              {actionInProgressId === entry.member_id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <>
                                  <Undo2 className="size-3" />
                                  Restore
                                </>
                              )}
                            </Button>
                          ) : (
                            <span
                              className="text-[10px] text-muted-foreground"
                              title="Managed via Auto-exclude roles settings"
                            >
                              Auto-managed
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

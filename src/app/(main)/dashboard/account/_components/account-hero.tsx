"use client";

import { Calendar, CheckCircle2, QrCode, Sparkles, Trophy } from "lucide-react";

import { GdgLogo } from "@/components/gdg-logo";
import { RoleBadge } from "@/components/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FirestoreMember } from "@/lib/firestore/types";
import { getInitials } from "@/lib/utils";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

interface AccountHeroProps {
  user: AuthOrganizer;
  member: FirestoreMember | null;
}

export function AccountHero({ user, member }: AccountHeroProps) {
  const displayName = member?.name ?? user.name;
  const email = member?.email ?? user.email;
  const avatarUrl = member?.avatar_url ?? user.avatar;
  const rawRole = member?.chapter_role ?? user.chapterRole ?? member?.role ?? user.role;
  const teamLabel = member?.team ?? (rawRole.toLowerCase().includes("organizer") ? "Core Team" : "Community");

  const registeredCount = member?.events_registered_count ?? 0;
  const attendedCount = member?.events_attended_count ?? 0;
  const referralPoints = member?.referral_points ?? 0;
  const joinedDateFormatted = member?.joined_date
    ? new Date(member.joined_date).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* User identity & badges */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-20 rounded-2xl border-2 border-background shadow-md">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="rounded-2xl bg-primary/10 font-bold text-2xl text-primary">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-bold text-2xl text-foreground tracking-tight">{displayName}</h1>
                <RoleBadge role={rawRole} size="default" />
                <Badge variant="outline" className="text-xs">
                  {teamLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-medium text-foreground">{email}</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5">
                  <GdgLogo size={24} className="h-4 w-auto" />
                  <span>GDG Jakarta</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:flex md:items-center md:gap-4">
            <div className="flex flex-col rounded-xl bg-background/80 p-3 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Calendar className="size-3.5" />
                <span>Registered</span>
              </div>
              <span className="mt-1 font-bold text-foreground text-lg">{registeredCount}</span>
            </div>

            <div className="flex flex-col rounded-xl bg-background/80 p-3 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <QrCode className="size-3.5" />
                <span>Attended</span>
              </div>
              <span className="mt-1 font-bold text-foreground text-lg">{attendedCount}</span>
            </div>

            <div className="flex flex-col rounded-xl bg-background/80 p-3 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Trophy className="size-3.5 text-amber-500" />
                <span>Points</span>
              </div>
              <span className="mt-1 font-bold text-foreground text-lg">{referralPoints}</span>
            </div>

            <div className="flex flex-col rounded-xl bg-background/80 p-3 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Sparkles className="size-3.5 text-primary" />
                <span>Member Since</span>
              </div>
              <span className="mt-1 font-bold text-foreground text-sm">{joinedDateFormatted}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

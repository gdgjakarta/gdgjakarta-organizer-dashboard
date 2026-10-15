"use client";

import Link from "next/link";

import { ArrowUpRight, Award, CheckCircle2, ExternalLink, Globe, Shield, Users } from "lucide-react";

import { GdgLogo } from "@/components/gdg-logo";
import { RoleBadge } from "@/components/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BEVY_CONFIG } from "@/config/bevy-config";
import { isCoreTeamOrStaff, isExecutiveOrganizer } from "@/lib/auth-roles";
import type { FirestoreMember } from "@/lib/firestore/types";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

interface AccountChapterTabProps {
  user: AuthOrganizer;
  member: FirestoreMember | null;
}

export function AccountChapterTab({ user, member }: AccountChapterTabProps) {
  const rawRole = member?.chapter_role ?? user.chapterRole ?? member?.role ?? user.role;
  const isOrganizer = isExecutiveOrganizer(user) || isExecutiveOrganizer(member?.role);
  const isStaff = !isOrganizer && (isCoreTeamOrStaff(user) || isCoreTeamOrStaff(member?.role));
  const isMember = !isOrganizer && !isStaff;

  const bevyUserId = member?.bevy_user_id ?? user.bevyUserId;

  return (
    <div className="space-y-6">
      {/* Chapter Overview Card */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 p-2">
                <GdgLogo size={40} className="h-6 w-auto" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Developer Group Jakarta</CardTitle>
                <CardDescription>Official Google Developer Community Chapter in Indonesia</CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="size-3.5" />
              Active Chapter
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Google Developer Groups (GDG) Jakarta is an open community for developers interested in Google's developer
            technology from Android, Flutter, Cloud, AI/ML to Web technologies. We host conferences, workshops,
            codelabs, and community meetups.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-1 rounded-xl bg-muted/40 p-3.5">
              <span className="text-muted-foreground text-xs">Chapter ID</span>
              <p className="font-mono font-semibold text-foreground text-sm">{BEVY_CONFIG.chapterId}</p>
            </div>
            <div className="space-y-1 rounded-xl bg-muted/40 p-3.5">
              <span className="text-muted-foreground text-xs">Region</span>
              <p className="font-semibold text-foreground text-sm">Jakarta, Indonesia (APAC)</p>
            </div>
            <div className="space-y-1 rounded-xl bg-muted/40 p-3.5">
              <span className="text-muted-foreground text-xs">Platform</span>
              <p className="font-semibold text-foreground text-sm">gdg.community.dev</p>
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href="https://gdg.community.dev/gdg-jakarta/" target="_blank" rel="noreferrer">
                <span>Visit Chapter Page on Bevy</span>
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role & Privileges Card */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Role & Community Privileges</CardTitle>
              <CardDescription>Your assigned access level and capabilities within GDG Jakarta</CardDescription>
            </div>
            <RoleBadge role={rawRole} size="default" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOrganizer && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                <span className="font-semibold text-foreground text-sm">Executive Organizer Access</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You have full administrative privileges to oversee GDG Jakarta operations, including event creation,
                ticket tiers, merchandise inventory, community member database, automated email campaigns, and referral
                program configuration.
              </p>
              <div className="pt-1">
                <Button size="sm" asChild className="gap-1.5 text-xs">
                  <Link href="/dashboard/organizer">
                    <span>Open Organizer Dashboard</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {isStaff && (
            <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-foreground text-sm">Core Team & Operational Access</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You have access to event volunteer operations, including camera QR scanner check-ins, on-site attendee
                roster verification, and attendance synchronization during GDG Jakarta conferences.
              </p>
              <div className="pt-1">
                <Button size="sm" asChild className="gap-1.5 text-xs">
                  <Link href="/dashboard/events">
                    <span>Go to Event Operations</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {isMember && (
            <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-foreground text-sm">Community Member Access</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                As an active GDG Jakarta community member, you can register for all open workshops, conferences, and
                meetups, participate in the community referral program for ticket discounts, and access your personal
                event passes.
              </p>
              <div className="pt-1">
                <Button size="sm" asChild className="gap-1.5 text-xs">
                  <Link href="/dashboard/member/my-events">
                    <span>View My Registered Events</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Bevy Connection Info */}
          <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Globe className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm">Bevy Community Platform Sync</span>
              </div>
              <p className="text-muted-foreground text-xs">
                {bevyUserId
                  ? `Connected (Bevy User ID: ${bevyUserId})`
                  : "Synchronizing profile with Bevy chapter database..."}
              </p>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">
              {bevyUserId ? "Synced" : "Syncing"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

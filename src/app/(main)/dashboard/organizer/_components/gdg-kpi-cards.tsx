import { CalendarCheck, Globe, TrendingUp, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreEvent, FirestoreMember } from "@/lib/firestore/types";

interface GDGKpiProps {
  events: FirestoreEvent[];
  members: FirestoreMember[];
  totalEventsCount?: number;
  totalMembersCount?: number;
}

export function GDGKpiCards({ events, members, totalEventsCount, totalMembersCount }: GDGKpiProps) {
  const totalEvents = totalEventsCount && totalEventsCount > 0 ? totalEventsCount : events.length;
  const publishedEvents = events.filter((e) => e.status === "Published").length;
  const totalMembers = totalMembersCount && totalMembersCount > 0 ? totalMembersCount : members.length;
  const coreTeamCount = members.filter((m) => m.team === "Core Team" || m.role !== "Member").length;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Total Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Community</CardTitle>
            <CardAction>
              <Users className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-3xl text-foreground leading-none tracking-tight">
                {totalMembers.toLocaleString()}
              </span>
              <Badge className="rounded-sm border-emerald-600/50 bg-emerald-500/10 px-1.5 font-normal text-emerald-700 text-xs dark:border-emerald-800/50 dark:bg-emerald-500/15 dark:text-emerald-300">
                <TrendingUp className="size-3" />
                Active
              </Badge>
            </div>
            <div className="mt-2 text-right text-muted-foreground text-xs">
              {coreTeamCount > 0 ? `${coreTeamCount} Core Organizers` : "Core Organizers & Members"}
            </div>
          </CardContent>
        </Card>

        {/* Total Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Events</CardTitle>
            <CardAction>
              <CalendarCheck className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-3xl text-foreground leading-none tracking-tight">
                {totalEvents.toLocaleString()}
              </span>
              <Badge className="rounded-sm border-blue-600/50 bg-blue-500/10 px-1.5 font-normal text-blue-700 text-xs dark:border-blue-800/50 dark:bg-blue-500/15 dark:text-blue-300">
                {publishedEvents > 0 ? `${publishedEvents} Active` : "Published"}
              </Badge>
            </div>
            <div className="mt-2 text-right text-muted-foreground text-xs">Meetups & DevLabs</div>
          </CardContent>
        </Card>

        {/* Chapter Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chapter Status</CardTitle>
            <CardAction>
              <Globe className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            <div className="font-bold text-3xl text-foreground leading-none tracking-tight">GDG Jakarta</div>
            <div className="mt-2 text-right text-muted-foreground text-xs">Community Chapter #642</div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

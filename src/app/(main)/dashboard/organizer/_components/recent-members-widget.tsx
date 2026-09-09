import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreMember } from "@/lib/firestore/types";
import { getInitials } from "@/lib/utils";

interface RecentMembersProps {
  members: FirestoreMember[];
}

export function RecentMembersWidget({ members }: RecentMembersProps) {
  const displayedMembers = members.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Community & Organizers</CardTitle>
        <CardAction>
          <Link
            href="/dashboard/members"
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            View All <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {displayedMembers.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No members loaded. Click "Sync Bevy Data" to import.
          </div>
        ) : (
          displayedMembers.map((member) => {
            const isOrganizer = member.team === "Core Team" || member.role !== "Member";

            return (
              <div key={member.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-8 rounded-full border">
                    <AvatarImage src={member.avatar_url} alt={member.name} />
                    <AvatarFallback className="font-medium text-[11px]">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 flex-col">
                    <div className="truncate font-medium text-foreground text-xs leading-tight">{member.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground leading-tight">{member.email}</div>
                  </div>
                </div>

                <Badge variant={isOrganizer ? "default" : "outline"} className="shrink-0 font-normal text-[10px]">
                  {member.role || "Member"}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

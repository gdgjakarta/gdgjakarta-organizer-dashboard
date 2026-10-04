import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreMember } from "@/lib/firestore/types";
import { getInitials } from "@/lib/utils";

export interface CommunityOrganizerItem {
  id: string;
  name: string;
  email?: string;
  company?: string;
  role: string;
  avatar_url?: string | null;
}

export interface RecentMembersProps {
  organizers?: CommunityOrganizerItem[];
  members?: FirestoreMember[];
}

export function CommunityOrganizersWidget({ organizers, members }: RecentMembersProps) {
  const items: CommunityOrganizerItem[] =
    organizers && organizers.length > 0
      ? organizers
      : (members ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role || "Member",
          avatar_url: m.avatar_url ?? undefined,
        }));

  const displayedOrganizers = items.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Community Organizers</CardTitle>
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
        {displayedOrganizers.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">No organizers loaded yet.</div>
        ) : (
          displayedOrganizers.map((organizer) => {
            const subtitle = organizer.email || organizer.company || organizer.role;

            return (
              <div key={organizer.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-8 rounded-full border">
                    <AvatarImage src={organizer.avatar_url || undefined} alt={organizer.name} />
                    <AvatarFallback className="font-medium text-[11px]">{getInitials(organizer.name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 flex-col">
                    <div className="truncate font-medium text-foreground text-xs leading-tight">{organizer.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground leading-tight">{subtitle}</div>
                  </div>
                </div>

                <Badge variant="outline" className="shrink-0 font-normal text-[10px]">
                  {organizer.role || "Organizer"}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export const RecentMembersWidget = CommunityOrganizersWidget;

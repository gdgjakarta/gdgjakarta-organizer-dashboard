"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

import { RoleBadge } from "@/components/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBevyTeamSettingsUrl } from "@/config/remote-config-utils";
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

const INITIAL_VISIBLE_COUNT = 6;

export function CommunityOrganizersWidget({ organizers, members }: RecentMembersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const hasMore = items.length > INITIAL_VISIBLE_COUNT;
  const displayedOrganizers = isExpanded ? items : items.slice(0, INITIAL_VISIBLE_COUNT);
  const remainingCount = items.length - INITIAL_VISIBLE_COUNT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Community Organizers</CardTitle>
        <CardAction>
          <a
            href={getBevyTeamSettingsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            Manage Team on Bevy <ExternalLink className="size-3.5" />
          </a>
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

                <RoleBadge role={organizer.role || "Organizer"} size="sm" className="shrink-0" />
              </div>
            );
          })
        )}

        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1 w-full gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Load More ({remainingCount} more) <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export const RecentMembersWidget = CommunityOrganizersWidget;

import Image from "next/image";

import { Users } from "lucide-react";

import { BEVY_CONFIG } from "@/config/bevy-config";
import { organizers as fallbackOrganizers } from "@/data/organizers";
import { getChapterTeam } from "@/lib/bevy/client";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";

export interface SpotlightOrganizer {
  name: string;
  avatar?: string;
  role: string;
}

interface OrganizersSpotlightSectionProps {
  organizers?: SpotlightOrganizer[];
}

function resolveRoleTitle(tm: BevyChapterTeamMember): string {
  if (tm.title?.trim()) {
    return tm.title.trim();
  }
  if (typeof tm.role === "object" && "name" in tm.role && tm.role.name) {
    return tm.role.name;
  }
  if (typeof tm.role === "string" && tm.role) {
    return tm.role;
  }
  if (tm.is_chapter_leader) {
    return "Lead Organizer";
  }
  return "Organizer";
}

export async function OrganizersSpotlightSection({
  organizers: initialOrganizers,
}: OrganizersSpotlightSectionProps = {}) {
  let displayOrganizers: SpotlightOrganizer[] = initialOrganizers ?? [];

  if (displayOrganizers.length === 0) {
    try {
      const team = await getChapterTeam(BEVY_CONFIG.chapterId);
      // Strictly filter to visible team members (matching Bevy visibility configuration)
      const visibleTeam = team.filter((m) => m.visible !== false);

      if (visibleTeam.length > 0) {
        displayOrganizers = visibleTeam.map((m) => {
          const name =
            m.user?.full_name?.trim() ||
            [m.user?.first_name, m.user?.last_name].filter(Boolean).join(" ").trim() ||
            "Community Organizer";
          const avatar = m.user?.cropped_avatar_url || m.user?.avatar?.thumbnail_url || m.user?.avatar?.url;
          const role = resolveRoleTitle(m);

          return {
            name,
            avatar,
            role,
          };
        });
      }
    } catch (err) {
      console.warn("[OrganizersSpotlightSection] Failed to fetch live chapter team:", err);
    }
  }

  // Fallback to static organizers if live fetch yields empty list
  if (displayOrganizers.length === 0) {
    displayOrganizers = fallbackOrganizers;
  }

  return (
    <section className="container mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <span
          className="font-medium text-xs uppercase tracking-widest transition-colors duration-500"
          style={{ color: "var(--theme-text)" }}
        >
          Leadership & Volunteers
        </span>
        <h2 className="mt-3 font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
          Meet the community leaders.
        </h2>
        <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
          The dedicated organizers, engineers, and community champions powering GDG Jakarta's initiatives.
        </p>
      </div>

      {/* Organizers Grid */}
      {displayOrganizers.length > 0 ? (
        <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 lg:gap-8">
          {displayOrganizers.map((member, index) => {
            const name = member.name;
            const avatar = member.avatar;
            const roleName = member.role;
            const itemKey = `${name}-${index}`;

            return (
              <div
                key={itemKey}
                className="group flex flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  borderColor: "var(--theme-border)",
                }}
              >
                {/* Circular Avatar */}
                <div
                  className="relative mb-4 size-32 overflow-hidden rounded-full border-2 bg-muted shadow-sm transition-all duration-300 group-hover:scale-105 sm:size-36"
                  style={{
                    borderColor: "var(--theme-border)",
                  }}
                >
                  {avatar ? (
                    <Image src={avatar} alt={name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Users className="size-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-medium text-[22.66px] leading-tight transition-colors group-hover:text-[var(--theme-text)]">
                  {name}
                </h3>

                {/* Role Pill */}
                <span
                  className="mt-2 line-clamp-1 rounded-full px-2.5 py-0.5 font-medium text-[14px] transition-colors"
                  style={{
                    backgroundColor: "var(--theme-bg-subtle)",
                    color: "var(--theme-text)",
                  }}
                >
                  {roleName || "Organizer"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-12 text-center text-muted-foreground text-sm">
          Unable to load organizer list at this time.
        </div>
      )}
    </section>
  );
}

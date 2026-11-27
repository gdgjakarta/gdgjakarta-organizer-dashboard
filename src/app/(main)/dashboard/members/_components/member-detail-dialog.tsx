"use client";
import * as React from "react";

import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Hash,
  MapPin,
  Percent,
  Phone,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { BevyChapterMemberDetail } from "@/lib/bevy/types";
import { getFirestoreMemberByEmail } from "@/lib/firestore/client";
import type { FirestoreMember } from "@/lib/firestore/types";
import { getInitials } from "@/lib/utils";
import { getBevyChapterMemberDetailAction } from "@/server/bevy-actions";

import type { MemberRow } from "./data";

type SocialKey = "LinkedIn" | "GitHub" | "Instagram" | "X" | "Threads" | "Website" | "Facebook";

function WhatsAppIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
    </svg>
  );
}

function SocialIcon({ kind }: { kind: SocialKey }) {
  switch (kind) {
    case "LinkedIn":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-3.5 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        >
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
        </svg>
      );
    case "GitHub":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-pink-600 dark:text-pink-400"
          aria-hidden="true"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "Threads":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.182c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z" />
        </svg>
      );
    case "Facebook":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-3.5 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        >
          <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
        </svg>
      );
    default:
      return <Globe className="size-3.5 text-muted-foreground" />;
  }
}

function formatSocialDisplay(kind: SocialKey, rawUrl: string): string {
  const clean = rawUrl.trim();
  try {
    const url = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    if (kind === "LinkedIn") {
      const m = path.match(/in\/([^/]+)/i);
      return m ? `in/${m[1]}` : path || url.hostname;
    }
    if (kind === "GitHub") {
      return path ? `@${path.split("/")[0]}` : url.hostname;
    }
    if (kind === "Instagram" || kind === "X" || kind === "Threads") {
      const handle = path.split("/")[0]?.replace(/^@/, "");
      return handle ? `@${handle}` : url.hostname;
    }
    return url.hostname.replace(/^www\./, "") + (path ? `/${path}` : "");
  } catch {
    return clean;
  }
}

function resolveSocialHref(kind: SocialKey, rawUrl: string): string {
  const clean = rawUrl.trim();
  if (kind === "X") {
    const handle = clean
      .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/?/i, "")
      .replace(/^@/, "")
      .replace(/^\/+|\/+$/g, "");
    return `https://x.com/${handle}`;
  }
  return clean.startsWith("http") ? clean : `https://${clean}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-muted/30 p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-semibold text-2xl tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  copyValue,
  href,
  hrefTitle,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  copyValue?: string;
  href?: string;
  hrefTitle?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-medium font-mono text-emerald-700 text-xs transition-colors hover:bg-emerald-500/15 dark:text-emerald-400"
            title={hrefTitle ?? `Open ${label}`}
          >
            <WhatsAppIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{value}</span>
          </a>
        ) : (
          <span className={mono ? "truncate font-medium font-mono text-xs" : "truncate font-medium text-xs"}>
            {value}
          </span>
        )}
        {copyValue ? (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(copyValue);
              toast.success(`${label} copied`);
            }}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`Copy ${label}`}
          >
            <Copy className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MemberDetailDialog({
  member,
  onOpenChange,
}: {
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<BevyChapterMemberDetail | null>(null);
  const [fsMember, setFsMember] = React.useState<FirestoreMember | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!member) return;
    let cancelled = false;
    setDetail(null);
    setFsMember(null);
    setError(null);

    if (member.email) {
      getFirestoreMemberByEmail(member.email)
        .then((res) => !cancelled && setFsMember(res))
        .catch(() => {
          // non-blocking
        });
    }

    if (member.id == null) {
      setError("This member is not linked to a Bevy chapter membership yet.");
      return;
    }
    setLoading(true);
    getBevyChapterMemberDetailAction(member.id)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setDetail(res.data);
        else setError(res.error);
      })
      .catch(() => !cancelled && setError("Failed to load member details."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [member]);

  const user = detail?.user;
  const name = user?.full_name || member?.name || "";
  const email = user?.email || member?.email || "";
  const agg = detail?.event_attendance_stats?.aggregate;
  const registered = agg?.total_events_registered ?? detail?.events_registered_count ?? member?.eventsCount ?? 0;
  const checkedIn = agg?.total_checked_in ?? 0;
  const rate = registered > 0 ? Math.min(100, Math.max(0, Math.round((checkedIn / registered) * 100))) : 0;
  const location = [user?.city, user?.country].filter(Boolean).join(", ");
  const jobTitle = user?.title || fsMember?.title || member?.title;
  const company = user?.company || fsMember?.company || fsMember?.company_or_institution || member?.company;
  const roleTitle = [jobTitle, company].filter(Boolean).join(" · ");
  const phone = fsMember?.phone;
  const bio = user?.bio || fsMember?.notes;
  const roleName = user?.role?.name || member?.role;
  const profileUrl = user?.profile_url || member?.profileUrl;
  const links = (
    [
      ["LinkedIn", user?.linkedin || fsMember?.linkedin_url],
      ["GitHub", fsMember?.github_url],
      ["Instagram", fsMember?.instagram_url],
      ["X", user?.twitter || fsMember?.x_url],
      ["Threads", fsMember?.threads_url],
      ["Website", user?.website || fsMember?.website_url],
      ["Facebook", user?.facebook],
    ] as Array<[SocialKey, string | null | undefined]>
  ).filter((l): l is [SocialKey, string] => Boolean(l[1]));

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:w-fit sm:min-w-[30rem] sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex min-w-0 items-center gap-3.5">
              <Avatar className="size-13 shrink-0 border">
                <AvatarImage src={user?.avatar?.thumbnail_url || user?.avatar?.url || member?.avatarUrl} alt={name} />
                <AvatarFallback className="font-semibold text-sm">{getInitials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="truncate text-lg">{name}</DialogTitle>
                  {roleName ? (
                    <Badge variant="secondary" className="text-[11px]">
                      {roleName}
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="flex items-center gap-1.5 truncate text-xs">
                  <span className="truncate">{email}</span>
                  {email ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(email);
                        toast.success("Email copied");
                      }}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Copy email"
                    >
                      <Copy className="size-3" />
                    </button>
                  ) : null}
                </DialogDescription>
                {roleTitle ? <p className="truncate text-muted-foreground text-xs">{roleTitle}</p> : null}
              </div>
            </div>

            {profileUrl ? (
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <a href={`https://gdg.community.dev${profileUrl}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Bevy
                </a>
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-5 px-6 py-5">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
              {error}
            </div>
          ) : null}

          {detail ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={CalendarCheck} label="Registered" value={registered} />
                <StatCard icon={CheckCircle2} label="Checked in" value={checkedIn} />
                <StatCard icon={Percent} label="Check-in rate" value={`${rate}%`} />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MetaItem
                  icon={Calendar}
                  label="Joined"
                  value={new Date(detail.created_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                />
                {location ? <MetaItem icon={MapPin} label="Location" value={location} /> : null}
                {phone ? (
                  <MetaItem
                    icon={Phone}
                    label="Phone / WhatsApp"
                    value={phone}
                    copyValue={phone}
                    href={`https://wa.me/${phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
                    hrefTitle="Open in WhatsApp"
                    mono
                  />
                ) : null}
                <MetaItem icon={Hash} label="Member ID" value={detail.id} copyValue={String(detail.id)} mono />
                <MetaItem
                  icon={Shield}
                  label="User ID"
                  value={detail.user.id}
                  copyValue={String(detail.user.id)}
                  mono
                />
              </div>

              {bio ? (
                <div className="space-y-1.5">
                  <div className="font-medium text-muted-foreground text-xs">Bio</div>
                  <p className="rounded-xl border bg-muted/20 p-3 text-sm leading-relaxed">{bio}</p>
                </div>
              ) : null}

              {links.length ? (
                <div className="space-y-2">
                  <div className="font-medium text-muted-foreground text-xs">Social &amp; Public Profiles</div>
                  <div className="flex flex-wrap gap-2">
                    {links.map(([label, href]) => (
                      <a
                        key={label}
                        href={resolveSocialHref(label, href)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 font-medium text-xs transition-colors hover:bg-muted"
                        title={label}
                      >
                        <SocialIcon kind={label} />
                        <span>{formatSocialDisplay(label, href)}</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail.user_preferences_memberships?.length ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                    <Users className="size-3.5" />
                    <span>Chapter memberships ({detail.user_preferences_memberships.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.user_preferences_memberships.map((m) => (
                      <Badge key={m.chapter.id} variant="outline" className="font-normal">
                        {m.chapter.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

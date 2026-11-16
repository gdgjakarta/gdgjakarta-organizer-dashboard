"use client";

import { useEffect, useState } from "react";

import { Briefcase, Building2, CheckCircle2, Globe, Loader2, Phone, Save, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasTeamOperationalAccess } from "@/lib/auth-roles";
import type { FirestoreMember } from "@/lib/firestore/types";
import { splitFullName } from "@/lib/utils";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

function SocialAppIcon({ kind }: { kind: "LinkedIn" | "GitHub" | "Instagram" | "X" | "Threads" | "Website" }) {
  switch (kind) {
    case "LinkedIn":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-4 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        >
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
        </svg>
      );
    case "GitHub":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-foreground" aria-hidden="true">
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
          className="size-4 text-pink-600 dark:text-pink-400"
          aria-hidden="true"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-foreground" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "Threads":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-foreground" aria-hidden="true">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.182c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z" />
        </svg>
      );
    default:
      return <Globe className="size-4 text-muted-foreground" />;
  }
}

interface AccountProfileTabProps {
  user: AuthOrganizer;
  member: FirestoreMember | null;
  onProfileUpdated: (updated: Partial<FirestoreMember>) => void;
}

export function AccountProfileTab({ user, member, onProfileUpdated }: AccountProfileTabProps) {
  const initialNames = splitFullName(member?.name ?? user.name);
  const [firstName, setFirstName] = useState(member?.first_name ?? initialNames.firstName);
  const [lastName, setLastName] = useState(member?.last_name ?? initialNames.lastName);
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [company, setCompany] = useState(member?.company ?? member?.company_or_institution ?? "");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(member?.linkedin_url ?? "");
  const [githubUrl, setGithubUrl] = useState(member?.github_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(member?.instagram_url ?? "");
  const [xUrl, setXUrl] = useState(member?.x_url ?? "");
  const [threadsUrl, setThreadsUrl] = useState(member?.threads_url ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(member?.website_url ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync form fields when async Firestore member data arrives after initial mount
  useEffect(() => {
    if (!member) return;
    const names = splitFullName(member.name ?? user.name);
    setFirstName(member.first_name ?? names.firstName);
    setLastName(member.last_name ?? names.lastName);
    setPhone(member.phone ?? "");
    setTitle(member.title ?? "");
    setCompany(member.company ?? member.company_or_institution ?? "");
    setNotes(member.notes ?? "");
    setLinkedinUrl(member.linkedin_url ?? "");
    setGithubUrl(member.github_url ?? "");
    setInstagramUrl(member.instagram_url ?? "");
    setXUrl(member.x_url ?? "");
    setThreadsUrl(member.threads_url ?? "");
    setWebsiteUrl(member.website_url ?? "");
  }, [member, user.name]);

  const email = member?.email ?? user.email;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const combinedName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ") || user.name;

    setIsSaving(true);
    try {
      const isOrgOrStaff =
        hasTeamOperationalAccess(user) ||
        hasTeamOperationalAccess({ role: member?.role, chapterRole: member?.chapter_role }) ||
        member?.team === "Core Team";

      const resolvedRole = isOrgOrStaff ? user.role || member?.role : (member?.role ?? user.role);
      const resolvedChapterRole = isOrgOrStaff
        ? user.chapterRole || member?.chapter_role
        : (member?.chapter_role ?? user.chapterRole);
      const resolvedTeam = isOrgOrStaff ? "Core Team" : (member?.team ?? "Community");
      const resolvedBevyId = member?.bevy_user_id ?? user.bevyUserId;

      const payload: Partial<FirestoreMember> & { id: string } = {
        id: member?.id ?? user.id,
        uid: user.id,
        name: combinedName,
        first_name: trimmedFirst || null,
        last_name: trimmedLast || null,
        email,
        phone: phone.trim(),
        title: title.trim(),
        company: company.trim(),
        company_or_institution: company.trim(),
        notes: notes.trim(),
        linkedin_url: linkedinUrl.trim(),
        github_url: githubUrl.trim(),
        instagram_url: instagramUrl.trim(),
        x_url: xUrl.trim(),
        threads_url: threadsUrl.trim(),
        website_url: websiteUrl.trim(),
        ...(resolvedRole ? { role: resolvedRole } : {}),
        ...(resolvedChapterRole ? { chapter_role: resolvedChapterRole } : {}),
        ...(resolvedTeam ? { team: resolvedTeam } : {}),
        ...(resolvedBevyId ? { bevy_user_id: String(resolvedBevyId) } : {}),
      };

      const { saveFirestoreMember } = await import("@/lib/firestore/client");
      await saveFirestoreMember(payload);
      onProfileUpdated(payload);
      toast.success("Profile details updated successfully!");
    } catch (error) {
      console.error("[AccountProfileTab] Failed to save profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-xs">
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>
          Update your public profile and event attendee contact information. These details will be used for event
          check-in passes and community communication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="font-medium text-xs">
                First Name
              </Label>
              <div className="relative">
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Budi"
                  className="pl-9"
                  required
                />
                <User className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="font-medium text-xs">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Santoso"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="font-medium text-xs">
                Email Address
              </Label>
              <span className="flex items-center gap-1 font-medium text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Verified via Google
              </span>
            </div>
            <Input id="email" value={email} disabled className="cursor-not-allowed bg-muted/50 opacity-80" />
            <p className="text-[11px] text-muted-foreground">
              Your email address is managed through your Google Account and cannot be modified directly here.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-medium text-xs">
                Phone / WhatsApp Number
              </Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +62 812 3456 7890"
                  className="pl-9"
                />
                <Phone className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">Used for urgent event updates and pass confirmation.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="font-medium text-xs">
                Job Title / Profession
              </Label>
              <div className="relative">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mobile Developer / Student"
                  className="pl-9"
                />
                <Briefcase className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="font-medium text-xs">
              Company / University / Organization
            </Label>
            <div className="relative">
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Universitas Indonesia / Google / Tech Startup"
                className="pl-9"
              />
              <Building2 className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="font-medium text-xs">
              Bio / About Me
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell the community a little bit about what you're building or learning..."
              rows={3}
            />
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <Label className="font-medium text-xs">Social &amp; Website Links</Label>
              <p className="text-[11px] text-muted-foreground">
                Used to automatically pre-fill matching event registration questions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="linkedinUrl" className="font-medium text-xs">
                  LinkedIn
                </Label>
                <div className="relative">
                  <Input
                    id="linkedinUrl"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="LinkedIn" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="githubUrl" className="font-medium text-xs">
                  GitHub
                </Label>
                <div className="relative">
                  <Input
                    id="githubUrl"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="GitHub" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instagramUrl" className="font-medium text-xs">
                  Instagram
                </Label>
                <div className="relative">
                  <Input
                    id="instagramUrl"
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/username"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="Instagram" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xUrl" className="font-medium text-xs">
                  X (Twitter)
                </Label>
                <div className="relative">
                  <Input
                    id="xUrl"
                    type="url"
                    value={xUrl}
                    onChange={(e) => setXUrl(e.target.value)}
                    placeholder="https://x.com/username"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="X" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="threadsUrl" className="font-medium text-xs">
                  Threads
                </Label>
                <div className="relative">
                  <Input
                    id="threadsUrl"
                    type="url"
                    value={threadsUrl}
                    onChange={(e) => setThreadsUrl(e.target.value)}
                    placeholder="https://threads.net/@username"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="Threads" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl" className="font-medium text-xs">
                  Personal Website URL
                </Label>
                <div className="relative">
                  <Input
                    id="websiteUrl"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourdomain.com"
                    className="pl-9"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-3 flex size-4 items-center justify-center">
                    <SocialAppIcon kind="Website" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

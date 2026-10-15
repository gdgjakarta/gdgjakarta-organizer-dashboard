"use client";

import { useState } from "react";

import { Briefcase, Building2, CheckCircle2, Loader2, Phone, Save, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirestoreMember } from "@/lib/firestore/client";
import type { FirestoreMember } from "@/lib/firestore/types";
import { splitFullName } from "@/lib/utils";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

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
  const [isSaving, setIsSaving] = useState(false);

  const email = member?.email ?? user.email;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const combinedName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ") || user.name;

    setIsSaving(true);
    try {
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
      };

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

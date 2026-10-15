"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Gift, Globe, ShieldCheck, User } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirestoreMemberById } from "@/lib/firestore/client";
import type { FirestoreMember } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { AccountChapterTab } from "./account-chapter-tab";
import { AccountHero } from "./account-hero";
import { AccountProfileTab } from "./account-profile-tab";
import { AccountReferralsTab } from "./account-referrals-tab";
import { AccountSecurityTab } from "./account-security-tab";

export function AccountView() {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const searchParams = useSearchParams();

  const [member, setMember] = useState<FirestoreMember | null>(null);
  const [loadingMember, setLoadingMember] = useState(true);

  // Default tab or from query parameter
  const initialTab = searchParams.get("tab") ?? "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    let isMounted = true;
    async function fetchMember() {
      if (!user?.id) return;
      try {
        const data = await getFirestoreMemberById(user.id);
        if (isMounted && data) {
          setMember(data);
        }
      } catch (err) {
        console.error("[AccountView] Error fetching member profile:", err);
      } finally {
        if (isMounted) setLoadingMember(false);
      }
    }

    if (user?.id) {
      void fetchMember();
    } else if (!isAuthLoading) {
      setLoadingMember(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, isAuthLoading]);

  const handleProfileUpdated = (updated: Partial<FirestoreMember>) => {
    setMember((prev) => (prev ? { ...prev, ...updated } : (updated as FirestoreMember)));
  };

  if (isAuthLoading || (loadingMember && !member && !user)) {
    return (
      <div className="flex animate-pulse flex-col gap-6 p-4 sm:p-6">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-40 w-full rounded-2xl bg-muted" />
        <div className="h-10 w-80 rounded-xl bg-muted" />
        <div className="h-72 w-full rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="font-bold text-xl">Please Sign In</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          You must be logged in to view and manage your GDG Jakarta account.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Account Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Identity Banner */}
      <AccountHero user={user} member={member} />

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-muted/60 p-1 sm:w-auto">
          <TabsTrigger value="profile" className="gap-2 px-3.5 py-2 text-xs sm:text-sm">
            <User className="size-4" />
            <span>Personal Profile</span>
          </TabsTrigger>
          <TabsTrigger value="chapter" className="gap-2 px-3.5 py-2 text-xs sm:text-sm">
            <Globe className="size-4" />
            <span>Community & Chapter</span>
          </TabsTrigger>
          <TabsTrigger value="referrals" className="gap-2 px-3.5 py-2 text-xs sm:text-sm">
            <Gift className="size-4" />
            <span>Referrals & Rewards</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 px-3.5 py-2 text-xs sm:text-sm">
            <ShieldCheck className="size-4" />
            <span>Security & Session</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 focus-visible:outline-none">
          <AccountProfileTab user={user} member={member} onProfileUpdated={handleProfileUpdated} />
        </TabsContent>

        <TabsContent value="chapter" className="space-y-4 focus-visible:outline-none">
          <AccountChapterTab user={user} member={member} />
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4 focus-visible:outline-none">
          <AccountReferralsTab user={user} member={member} />
        </TabsContent>

        <TabsContent value="security" className="space-y-4 focus-visible:outline-none">
          <AccountSecurityTab user={user} member={member} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

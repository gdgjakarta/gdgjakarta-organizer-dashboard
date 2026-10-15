"use client";

import { useMemo, useState } from "react";

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Monitor,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_MAINTENANCE_CONFIG, type MaintenanceConfig } from "@/config/maintenance-config";
import { saveMaintenanceConfigAction } from "@/server/maintenance-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MaintenanceDashboardProps {
  initialConfig: MaintenanceConfig;
}

export function MaintenanceDashboard({ initialConfig }: MaintenanceDashboardProps) {
  const [config, setConfig] = useState<MaintenanceConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<MaintenanceConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<string>("settings");

  // Confirmation dialog state for master toggle
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEnabledState, setPendingEnabledState] = useState<boolean | null>(null);

  const user = useAuthStore((s) => s.user);

  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  const handleToggleClick = (checked: boolean) => {
    setPendingEnabledState(checked);
    setShowConfirmDialog(true);
  };

  const handleConfirmToggle = () => {
    if (pendingEnabledState !== null) {
      setConfig((prev) => ({ ...prev, enabled: pendingEnabledState }));
    }
    setShowConfirmDialog(false);
    setPendingEnabledState(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Partial<MaintenanceConfig> = {
        ...config,
        updatedBy: user?.id,
        updatedByName: user?.name,
      };

      const result = await saveMaintenanceConfigAction(payload);
      if (result.success && result.config) {
        setSavedConfig(result.config);
        setConfig(result.config);
        toast.success(
          result.config.enabled
            ? "Maintenance Mode is now ACTIVE across all routes"
            : "Maintenance Mode has been DEACTIVATED. Platform is live!",
          {
            description: result.config.enabled
              ? "All regular routes and member pages are now showing the Maintenance Screen."
              : "Normal community operations and route access have been restored.",
          },
        );
      } else {
        toast.error("Failed to save maintenance settings", {
          description: result.error ?? "An unexpected error occurred.",
        });
      }
    } catch (err) {
      toast.error("Failed to save settings", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(savedConfig);
    toast.info("Changes discarded", { description: "Reverted form to current live configuration." });
  };

  const handleResetDefaults = () => {
    setConfig({
      ...DEFAULT_MAINTENANCE_CONFIG,
      enabled: config.enabled, // preserve current active status
    });
    toast.info("Reset to default templates", {
      description: "Default copy and layout values applied. Click Save to publish.",
    });
  };

  // Helper presets for estimated end time
  const applyTimePreset = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    // Format to yyyy-MM-ddThh:mm for datetime-local
    const pad = (n: number) => String(n).padStart(2, "0");
    const localIso = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setConfig((prev) => ({ ...prev, estimatedEndTime: localIso }));
  };

  const applyTomorrowPreset = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0); // 09:00 AM
    const pad = (n: number) => String(n).padStart(2, "0");
    const localIso = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setConfig((prev) => ({ ...prev, estimatedEndTime: localIso }));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">Maintenance Mode</h1>
            <Badge
              variant="outline"
              className={
                config.enabled
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }
            >
              {config.enabled ? "Active" : "Normal Operations"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            Control platform-wide maintenance interception and customize the visitor announcement page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </Badge>
          )}

          <Button onClick={handleSave} disabled={isSaving || !isDirty} className="gap-1.5 shadow-xs">
            <Save className={`h-4 w-4 ${isSaving ? "animate-spin" : ""}`} />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Master Toggle Banner Card */}
      <Card
        className={`border-2 transition-all ${
          config.enabled ? "border-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10" : "border-border/80 bg-card"
        }`}
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                config.enabled ? "bg-amber-500 text-white shadow-sm" : "bg-muted text-muted-foreground"
              }`}
            >
              {config.enabled ? <AlertTriangle className="h-6 w-6" /> : <Wrench className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-foreground">
                  {config.enabled ? "Maintenance Mode is currently ENABLED" : "Maintenance Mode is DISABLED"}
                </span>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {config.enabled
                  ? "All public and member routes will display the maintenance screen to non-organizers."
                  : "The website and community services are functioning normally for all public visitors."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="master-toggle" className="cursor-pointer font-semibold text-sm">
              {config.enabled ? "Active" : "Inactive"}
            </Label>
            <Switch
              id="master-toggle"
              checked={config.enabled}
              onCheckedChange={handleToggleClick}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Settings vs Preview */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="settings" className="gap-2">
              <Wrench className="h-4 w-4" />
              Settings & Content
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Live Preview
            </TabsTrigger>
          </TabsList>

          {activeTab === "settings" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
          )}
        </div>

        {/* Settings Tab Content */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Announcement Copy Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold text-base">Announcement Content</CardTitle>
                <CardDescription>Displayed prominently on the public maintenance page to visitors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="font-medium text-xs">
                    Page Headline Title
                  </Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Under Scheduled Maintenance"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline" className="font-medium text-xs">
                    Subtitle / Punchline
                  </Label>
                  <Input
                    id="headline"
                    value={config.headline}
                    onChange={(e) => setConfig((prev) => ({ ...prev, headline: e.target.value }))}
                    placeholder="e.g. We're making GDG Jakarta even better!"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-medium text-xs">
                    Detailed Explanation Message
                  </Label>
                  <Textarea
                    id="message"
                    rows={4}
                    value={config.message}
                    onChange={(e) => setConfig((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Explain the reason for maintenance, expected updates, and when attendees can register."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Schedule & Countdown Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold text-base">Estimated Completion Time</CardTitle>
                <CardDescription>Powers the live countdown timer on the visitor maintenance page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="end-time" className="font-medium text-xs">
                    Target Completion Date & Time
                  </Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={config.estimatedEndTime || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        estimatedEndTime: e.target.value || null,
                      }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank if duration is indefinite or uncertain.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2 pt-2">
                  <Label className="font-medium text-muted-foreground text-xs">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTimePreset(1)}
                      className="text-xs"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      +1 Hour
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTimePreset(3)}
                      className="text-xs"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      +3 Hours
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTimePreset(6)}
                      className="text-xs"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      +6 Hours
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={applyTomorrowPreset} className="text-xs">
                      <Calendar className="mr-1 h-3 w-3" />
                      Tomorrow 09:00 WIB
                    </Button>
                    {config.estimatedEndTime && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfig((prev) => ({ ...prev, estimatedEndTime: null }))}
                        className="text-muted-foreground text-xs hover:text-destructive"
                      >
                        Clear Timer
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Access & Bypass Settings */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold text-base">Bypass & Community Contact</CardTitle>
                <CardDescription>Control organizer preview permissions and emergency support contact.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <Label htmlFor="organizer-bypass" className="font-medium text-sm">
                        Executive Organizer Bypass
                      </Label>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      When enabled, authenticated Leads, Co-Organizers, and Googlers can browse the entire website
                      normally with a top notification banner, while public visitors see the maintenance page.
                    </p>
                  </div>
                  <Switch
                    id="organizer-bypass"
                    checked={config.allowOrganizerBypass}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, allowOrganizerBypass: checked }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="font-medium text-xs">
                      Contact Email
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={config.contactEmail}
                      onChange={(e) => setConfig((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="organizer@gdgjakarta.org"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="socialLinks" className="font-medium text-sm">
                        Show Community Links
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Displays official GDG Jakarta Instagram and Bevy community page links.
                      </p>
                    </div>
                    <Switch
                      id="socialLinks"
                      checked={config.showSocialLinks}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, showSocialLinks: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                Interactive live preview based on your current settings. Click &quot;Save Changes&quot; to apply to
                public visitors.
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewDevice("desktop")}
                className="h-8 gap-1.5 text-xs"
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </Button>
              <Button
                variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewDevice("mobile")}
                className="h-8 gap-1.5 text-xs"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </Button>
            </div>
          </div>

          {/* Simulated Device Frame */}
          <div className="flex justify-center rounded-2xl border border-border/80 bg-muted/40 p-4 sm:p-6">
            <div
              className={`overflow-hidden rounded-2xl border border-border shadow-xl transition-all duration-300 ${
                previewDevice === "desktop"
                  ? "w-full max-w-5xl"
                  : "w-full max-w-[390px] border-4 border-foreground/15 shadow-2xl"
              }`}
            >
              <div className="max-h-[720px] overflow-y-auto">
                <MaintenanceScreen config={config} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog for Master Toggle */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${pendingEnabledState ? "text-amber-500" : "text-emerald-500"}`} />
              {pendingEnabledState
                ? "Enable Global Maintenance Mode?"
                : "Disable Maintenance Mode & Restore Public Access?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {pendingEnabledState
                ? "Activating Maintenance Mode will immediately intercept all public visitors and member routes, showing them the maintenance announcement screen. You can still access and manage settings as an Executive Organizer."
                : "Deactivating Maintenance Mode will restore normal website navigation, public landing pages, and event registration for all attendees."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEnabledState(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={
                pendingEnabledState
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {pendingEnabledState ? "Yes, Enable Maintenance" : "Yes, Restore Platform"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky Bottom Floating Bar when dirty */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border/80 bg-background/95 px-5 py-2.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-4 w-4 text-amber-500" />
              You have unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-8 text-xs">
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

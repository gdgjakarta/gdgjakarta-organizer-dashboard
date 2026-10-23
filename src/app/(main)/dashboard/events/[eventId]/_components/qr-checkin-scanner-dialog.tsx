"use client";

import * as React from "react";

import {
  AlertCircle,
  Building2,
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  Loader2,
  Mail,
  PackageCheck,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Ticket,
  Undo2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  updateBreakoutSessionCheckInAction,
  updateRegistrationCheckInAction,
  updateRegistrationMerchandiseCollectionAction,
} from "@/lib/firestore/actions";
import type { CustomQuestion, EventSession, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import {
  type BevyAttendeeItem,
  checkInBevyAttendeeAction,
  fetchAllBevyEventAttendeesAction,
} from "@/server/bevy-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

export type QrScannerMode = "event_checkin" | "session_checkin" | "merchandise_collection";

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string; dotClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  waiting_for_payment: {
    label: "Waiting for Payment",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  paid_and_registered: {
    label: "Paid & Registered",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  expired: {
    label: "Expired",
    badgeClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    dotClass: "bg-zinc-500",
  },
  failed: {
    label: "Failed",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
  canceled: {
    label: "Canceled",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  },
  cancelled: {
    label: "Canceled",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  },
  approved: {
    label: "Approved",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  registered: {
    label: "Registered",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  paid_waitlisted: {
    label: "Paid Waitlist",
    badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    dotClass: "bg-indigo-500",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
};

function getStatusMeta(status?: string) {
  if (status && status in STATUS_VARIANTS) {
    return STATUS_VARIANTS[status as RegistrationStatus];
  }
  const fallbackLabel = (status || "pending").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    label: fallbackLabel,
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  };
}

interface QrCheckInScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle?: string;
  initialMode?: QrScannerMode;
  initialSessionId?: string;
  sessions?: EventSession[];
  registrations: FirestoreRegistration[];
  questions?: CustomQuestion[];
  onRegistrationUpdated?: (updated: FirestoreRegistration) => void;
}

interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  rawQr: string;
  mode: QrScannerMode;
  registration: FirestoreRegistration;
  sessionTitle?: string;
  syncedToBevy?: boolean;
  actionSummary: string;
}

function getAnswerDisplay(reg: FirestoreRegistration, keys: string[]): string {
  if (!reg.answers) return "";
  for (const key of keys) {
    const val = reg.answers[key];
    if (Array.isArray(val) && val.length > 0) return val.join(", ");
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

export function QrCheckInScannerDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  initialMode = "event_checkin",
  initialSessionId,
  sessions = [],
  registrations,
  questions = [],
  onRegistrationUpdated,
}: QrCheckInScannerDialogProps) {
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = React.useState<QrScannerMode>(initialMode);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(initialSessionId || sessions[0]?.id || "");
  const [syncBevy, setSyncBevy] = React.useState<boolean>(initialMode === "event_checkin");
  const [autoExecuteOnScan, setAutoExecuteOnScan] = React.useState<boolean>(true);

  const [qrInput, setQrInput] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isStartingCamera, setIsStartingCamera] = React.useState(false);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [mediaStream, setMediaStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [facingMode, setFacingMode] = React.useState<"environment" | "user">("environment");
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("");
  const isStartingCameraRef = React.useRef(false);

  const [activeReg, setActiveReg] = React.useState<FirestoreRegistration | null>(null);
  const [lastScannedAttendeeId, setLastScannedAttendeeId] = React.useState<number | null>(null);
  const [showFullAnswers, setShowFullAnswers] = React.useState(false);
  const [scanHistory, setScanHistory] = React.useState<ScanHistoryEntry[]>([]);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const lastScannedCodeRef = React.useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });
  const bevyAttendeesCacheRef = React.useRef<BevyAttendeeItem[] | null>(null);

  const selectedSession = React.useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  // Sync initial props when dialog opens
  React.useEffect(() => {
    if (open) {
      const effectiveMode = initialMode === "session_checkin" && sessions.length === 0 ? "event_checkin" : initialMode;
      setMode(effectiveMode);
      const nextSessionId = initialSessionId || sessions[0]?.id || "";
      setSelectedSessionId(nextSessionId);
      if (effectiveMode === "event_checkin") {
        setSyncBevy(true);
      } else if (effectiveMode === "session_checkin") {
        const s = sessions.find((item) => item.id === nextSessionId);
        setSyncBevy(s?.sync_check_in_to_bevy ?? false);
      } else {
        setSyncBevy(false);
      }
    }
  }, [open, initialMode, initialSessionId, sessions]);

  // Update syncBevy default when mode or selectedSession changes
  const handleModeChange = (nextMode: QrScannerMode) => {
    setMode(nextMode);
    if (nextMode === "event_checkin") {
      setSyncBevy(true);
    } else if (nextMode === "session_checkin") {
      setSyncBevy(selectedSession?.sync_check_in_to_bevy ?? false);
    } else {
      setSyncBevy(false);
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const s = sessions.find((item) => item.id === sessionId);
    if (mode === "session_checkin") {
      setSyncBevy(s?.sync_check_in_to_bevy ?? false);
    }
  };

  // Stop camera helper
  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isStartingCameraRef.current = false;
    setMediaStream(null);
    setCameraActive(false);
    setIsStartingCamera(false);
  }, []);

  // Stop camera when dialog closes
  React.useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open, stopCamera]);

  // Stop camera tracks on unmount only
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };
  }, []);

  // Parse `eventId:attendeeId` or fallback identifiers
  const parseQrPayload = React.useCallback(
    (
      raw: string,
    ): {
      scannedEventId?: string;
      bevyAttendeeId?: number;
      fallbackQuery?: string;
      error?: string;
    } => {
      const trimmed = raw.trim();
      if (!trimmed) return { error: "Empty QR code payload." };

      // Check standard Bevy QR format: `eventId:attendeeId`
      if (trimmed.includes(":")) {
        const parts = trimmed.split(":");
        const left = parts[0]?.trim();
        const right = parts[1]?.trim();
        const parsedAttendeeId = Number(right);
        if (left && !Number.isNaN(parsedAttendeeId) && parsedAttendeeId > 0) {
          if (String(left) !== String(eventId)) {
            return {
              error: `QR belongs to Event ID ${left}, but current event is ${eventId}.`,
            };
          }
          return {
            scannedEventId: left,
            bevyAttendeeId: parsedAttendeeId,
          };
        }
      }

      // Check if purely numeric Bevy Attendee ID
      const numericId = Number(trimmed);
      if (!Number.isNaN(numericId) && numericId > 0 && /^\d+$/.test(trimmed)) {
        return { bevyAttendeeId: numericId };
      }

      // Fallback: email or Firestore registration ID
      return { fallbackQuery: trimmed };
    },
    [eventId],
  );

  // Resolve FirestoreRegistration from Bevy Attendee ID or fallback query
  const resolveRegistration = React.useCallback(
    async (
      bevyAttendeeId?: number,
      fallbackQuery?: string,
    ): Promise<{
      registration: FirestoreRegistration | null;
      resolvedBevyAttendeeId: number | null;
    }> => {
      if (bevyAttendeeId) {
        // 1. Direct match on cached `bevy_attendee_id` in Firestore registrations
        const directMatch = registrations.find((r) => Number(r.bevy_attendee_id) === Number(bevyAttendeeId));
        if (directMatch) {
          return {
            registration: directMatch,
            resolvedBevyAttendeeId: bevyAttendeeId,
          };
        }

        // 2. Fallback lookup via Bevy Event Attendees API -> match email
        if (!bevyAttendeesCacheRef.current) {
          const res = await fetchAllBevyEventAttendeesAction(eventId);
          if (res.success && res.attendees) {
            bevyAttendeesCacheRef.current = res.attendees;
          }
        }
        const bevyAttendee = bevyAttendeesCacheRef.current?.find((a) => Number(a.id) === Number(bevyAttendeeId));
        if (bevyAttendee?.email) {
          const emailLower = bevyAttendee.email.trim().toLowerCase();
          const emailMatch = registrations.find((r) => (r.member_email || "").trim().toLowerCase() === emailLower);
          if (emailMatch) {
            return {
              registration: {
                ...emailMatch,
                bevy_attendee_id: bevyAttendeeId,
              },
              resolvedBevyAttendeeId: bevyAttendeeId,
            };
          }
        }

        return { registration: null, resolvedBevyAttendeeId: bevyAttendeeId };
      }

      if (fallbackQuery) {
        const q = fallbackQuery.trim().toLowerCase();
        const match = registrations.find(
          (r) =>
            r.id.toLowerCase() === q ||
            (r.member_email || "").trim().toLowerCase() === q ||
            (r.member_name || "").trim().toLowerCase() === q,
        );
        if (match) {
          return {
            registration: match,
            resolvedBevyAttendeeId: match.bevy_attendee_id ? Number(match.bevy_attendee_id) : null,
          };
        }
      }

      return { registration: null, resolvedBevyAttendeeId: null };
    },
    [eventId, registrations],
  );

  // Execute action for a resolved registration
  const executeModeAction = React.useCallback(
    async (reg: FirestoreRegistration, resolvedAttendeeId: number | null, rawQr: string, targetStatus = true) => {
      setIsProcessing(true);
      try {
        const attendeeIdToUse = resolvedAttendeeId ?? (reg.bevy_attendee_id ? Number(reg.bevy_attendee_id) : null);

        if (mode === "event_checkin") {
          let syncedBevy = false;
          if (syncBevy) {
            let finalBevyId = attendeeIdToUse;
            if (!finalBevyId) {
              if (!bevyAttendeesCacheRef.current) {
                const res = await fetchAllBevyEventAttendeesAction(eventId);
                if (res.success && res.attendees) {
                  bevyAttendeesCacheRef.current = res.attendees;
                }
              }
              const matched = bevyAttendeesCacheRef.current?.find(
                (a) => a.email?.trim().toLowerCase() === (reg.member_email || "").trim().toLowerCase(),
              );
              if (matched) finalBevyId = matched.id;
            }

            if (finalBevyId) {
              const bevyRes = await checkInBevyAttendeeAction(eventId, finalBevyId, targetStatus);
              if (!bevyRes.success) {
                toast.warning(`Saved to Firestore, but Bevy check-in returned: ${bevyRes.error}`);
              } else {
                syncedBevy = true;
              }
            } else {
              toast.warning("Attendee not found in Bevy roster; logged check-in to Firestore only.");
            }
          }

          const nowIso = targetStatus ? new Date().toISOString() : null;
          const fsRes = await updateRegistrationCheckInAction(reg.id, eventId, targetStatus, attendeeIdToUse, nowIso);

          if (!fsRes.success) {
            toast.error(fsRes.error || "Failed to update check-in in Firestore.");
            return;
          }

          const updated: FirestoreRegistration = {
            ...reg,
            is_checked_in: targetStatus,
            checked_in_at: nowIso,
            bevy_attendee_id: attendeeIdToUse ?? reg.bevy_attendee_id,
          };
          setActiveReg(updated);
          onRegistrationUpdated?.(updated);

          if (targetStatus) {
            setScanHistory((prev) => [
              {
                id: `${Date.now()}-${reg.id}`,
                timestamp: new Date().toISOString(),
                rawQr,
                mode,
                registration: updated,
                syncedToBevy: syncedBevy,
                actionSummary: syncedBevy ? "Checked in (Firestore + Bevy)" : "Checked in (Firestore)",
              },
              ...prev.slice(0, 19),
            ]);
          }

          toast.success(
            targetStatus
              ? `Checked in ${reg.member_name || reg.member_email}${syncedBevy ? " (Synced to Bevy)" : ""}`
              : `Undid check-in for ${reg.member_name || reg.member_email}`,
          );
          return;
        }

        if (mode === "session_checkin") {
          if (!selectedSessionId) {
            toast.error("Please select a breakout session first.");
            return;
          }
          const targetSessionId = selectedSessionId;
          const sessionTitle = selectedSession?.title || "Breakout Session";

          let syncedBevy = false;
          if (syncBevy && attendeeIdToUse) {
            const bevyRes = await checkInBevyAttendeeAction(eventId, attendeeIdToUse, targetStatus);
            if (!bevyRes.success) {
              toast.warning(`Session check-in logged to Firestore, but Bevy sync returned: ${bevyRes.error}`);
            } else {
              syncedBevy = true;
            }
          }

          const fsRes = await updateBreakoutSessionCheckInAction(
            reg.id,
            eventId,
            targetSessionId,
            sessionTitle,
            targetStatus,
            {
              id: user?.id || "organizer",
              name: user?.name || user?.email || "Organizer",
              email: user?.email || undefined,
              method: "qr_scan",
              rawQr,
              bevyAttendeeId: attendeeIdToUse,
              syncedToBevy: syncedBevy,
            },
          );

          if (!fsRes.success) {
            toast.error(fsRes.error || "Failed to update session check-in in Firestore.");
            return;
          }

          const nextBreakoutIds = Array.from(new Set([...(reg.breakout_session_ids ?? []), targetSessionId]));
          const nextSessionCheckIns = {
            ...(reg.session_check_ins ?? {}),
            ...(fsRes.record ? { [targetSessionId]: fsRes.record } : {}),
          };
          const updated: FirestoreRegistration = {
            ...reg,
            bevy_attendee_id: attendeeIdToUse ?? reg.bevy_attendee_id,
            breakout_session_ids: nextBreakoutIds,
            session_check_ins: nextSessionCheckIns,
          };
          setActiveReg(updated);
          onRegistrationUpdated?.(updated);

          if (targetStatus) {
            setScanHistory((prev) => [
              {
                id: `${Date.now()}-${reg.id}`,
                timestamp: new Date().toISOString(),
                rawQr,
                mode,
                registration: updated,
                sessionTitle,
                syncedToBevy: syncedBevy,
                actionSummary: `Session check-in: ${sessionTitle}${syncedBevy ? " (+Bevy)" : ""}`,
              },
              ...prev.slice(0, 19),
            ]);
          }

          toast.success(
            targetStatus
              ? `Checked in ${reg.member_name || reg.member_email} to "${sessionTitle}"`
              : `Undid session check-in for ${reg.member_name || reg.member_email}`,
          );
          return;
        }

        if (mode === "merchandise_collection") {
          const hasMerch = reg.selected_merchandise && reg.selected_merchandise.length > 0;
          if (!hasMerch && targetStatus) {
            toast.warning(`${reg.member_name || reg.member_email} has no merchandise items on their registration.`);
            return;
          }

          const reviewer = user
            ? {
                id: user.id,
                name: user.name || user.email || "Organizer",
                email: user.email || undefined,
                notes: targetStatus
                  ? "Merchandise collected via QR Scanner"
                  : "Merchandise collection undone via QR Scanner",
              }
            : undefined;

          const merchRes = await updateRegistrationMerchandiseCollectionAction(reg.id, eventId, targetStatus, reviewer);

          if (!merchRes.success) {
            toast.error(merchRes.error || "Failed to update merchandise collection.");
            return;
          }

          const updated: FirestoreRegistration = {
            ...reg,
            bevy_attendee_id: attendeeIdToUse ?? reg.bevy_attendee_id,
            is_merchandise_collected: targetStatus,
            merchandise_collected_at: merchRes.collectedAt ?? null,
            status_logs: merchRes.statusLog ? [...(reg.status_logs ?? []), merchRes.statusLog] : reg.status_logs,
          };
          setActiveReg(updated);
          onRegistrationUpdated?.(updated);

          if (targetStatus) {
            setScanHistory((prev) => [
              {
                id: `${Date.now()}-${reg.id}`,
                timestamp: new Date().toISOString(),
                rawQr,
                mode,
                registration: updated,
                actionSummary: "Merchandise Collected",
              },
              ...prev.slice(0, 19),
            ]);
          }

          toast.success(
            targetStatus
              ? `Marked merchandise collected for ${reg.member_name || reg.member_email}`
              : `Undid merchandise collection for ${reg.member_name || reg.member_email}`,
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [eventId, mode, onRegistrationUpdated, selectedSession, selectedSessionId, syncBevy, user],
  );

  // Handle QR code string submission (from camera or manual input)
  const handleProcessQrCode = React.useCallback(
    async (rawQrText: string) => {
      const parsed = parseQrPayload(rawQrText);
      if (parsed.error) {
        toast.error(parsed.error);
        return;
      }

      setIsProcessing(true);
      try {
        const { registration, resolvedBevyAttendeeId } = await resolveRegistration(
          parsed.bevyAttendeeId,
          parsed.fallbackQuery,
        );
        setLastScannedAttendeeId(resolvedBevyAttendeeId);

        if (!registration) {
          setActiveReg(null);
          toast.error(
            parsed.bevyAttendeeId
              ? `No registration found in Firestore matching Bevy Attendee ID #${parsed.bevyAttendeeId}.`
              : `No registration found matching "${rawQrText}".`,
          );
          return;
        }

        setActiveReg(registration);

        if (autoExecuteOnScan) {
          await executeModeAction(registration, resolvedBevyAttendeeId, rawQrText, true);
        } else {
          toast.info(`Found attendee: ${registration.member_name || registration.member_email}`);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [autoExecuteOnScan, executeModeAction, parseQrPayload, resolveRegistration],
  );

  // Start camera & request browser camera permission on click
  const startCamera = React.useCallback(
    async (overrideFacingMode?: "environment" | "user", overrideDeviceId?: string) => {
      if (isStartingCameraRef.current) return;

      if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        const msg =
          "Camera API (navigator.mediaDevices.getUserMedia) is unavailable. Make sure you are on HTTPS or http://localhost.";
        setCameraError(msg);
        toast.error(msg);
        return;
      }

      // Stop any previous active stream tracks before requesting a new stream
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      // Build constraints:
      // On desktop (macOS/Windows/Linux), requesting `facingMode: "environment"` causes
      // macOS Continuity Camera or Firefox/Zen Browser to hang while searching for a rear iPhone camera.
      // Only pass `facingMode` on mobile or when explicitly flipping camera.
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "");
      const deviceIdToUse = overrideDeviceId ?? selectedDeviceId;

      let videoConstraints: boolean | MediaTrackConstraints = true;
      if (deviceIdToUse) {
        videoConstraints = { deviceId: { exact: deviceIdToUse } };
      } else if (overrideFacingMode) {
        videoConstraints = { facingMode: { ideal: overrideFacingMode } };
      } else if (isMobile) {
        videoConstraints = { facingMode: { ideal: facingMode } };
      }

      // IMPORTANT: Call getUserMedia synchronously on the user click gesture BEFORE
      // triggering React state updates, and do NOT disable the clicked button (which
      // causes Radix Dialog FocusScope to steal focus and dismiss Firefox/Zen permission popups).
      const mediaPromise = navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      isStartingCameraRef.current = true;
      setCameraError(null);
      setIsStartingCamera(true);

      const slowPromptTimer = window.setTimeout(() => {
        if (isStartingCameraRef.current) {
          setCameraError(
            "Waiting for browser or macOS camera permission. Check the camera icon in your browser's URL bar (top-left) to click Allow, and ensure your browser is enabled in macOS System Settings → Privacy & Security → Camera.",
          );
        }
      }, 4500);

      try {
        let stream: MediaStream;
        try {
          stream = await mediaPromise;
        } catch (firstErr) {
          // If specific device/facingMode constraint failed (not permission denied), retry with default `{ video: true }`
          const firstName = firstErr instanceof DOMException ? firstErr.name : "";
          if (firstName === "NotAllowedError" || firstName === "PermissionDeniedError" || videoConstraints === true) {
            throw firstErr;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        window.clearTimeout(slowPromptTimer);

        if (!isStartingCameraRef.current) {
          // User clicked cancel while waiting
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        setCameraError(null);
        setMediaStream(stream);
        setCameraActive(true);

        // Enumerate video input devices so user can switch cameras if multiple exist
        if (navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              const cams = devices.filter((d) => d.kind === "videoinput");
              setVideoDevices(cams);
              const activeTrackDeviceId = stream.getVideoTracks()[0]?.getSettings?.()?.deviceId;
              if (activeTrackDeviceId) {
                setSelectedDeviceId(activeTrackDeviceId);
              }
            })
            .catch(() => {
              // ignore device enumeration errors
            });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            void videoRef.current?.play().catch(() => {
              // ignore play interruption
            });
          };
          void videoRef.current.play().catch(() => {
            // ignore play interruption
          });
        }
      } catch (err) {
        window.clearTimeout(slowPromptTimer);
        const errName = err instanceof DOMException ? err.name : "";
        let msg = err instanceof Error ? err.message : "Unable to access camera.";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          msg =
            "Camera permission was denied or blocked. Click the camera/permissions icon in your browser's URL bar to Allow camera access, and check macOS System Settings → Privacy & Security → Camera.";
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          msg = "No camera device was found on this device.";
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          msg =
            "Camera is currently in use by another application or tab. Close other apps using the camera and try again.";
        }
        setCameraError(msg);
        setMediaStream(null);
        setCameraActive(false);
        toast.error(msg);
      } finally {
        isStartingCameraRef.current = false;
        setIsStartingCamera(false);
      }
    },
    [facingMode, selectedDeviceId],
  );

  // Ensure stream is bound to <video> element whenever cameraActive or mediaStream updates
  React.useEffect(() => {
    const videoEl = videoRef.current;
    const activeStream = mediaStream ?? streamRef.current;
    if (cameraActive && videoEl && activeStream) {
      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
      }
      videoEl.onloadedmetadata = () => {
        void videoEl.play().catch(() => {
          // ignore play interruption
        });
      };
      void videoEl.play().catch(() => {
        // ignore play interruption
      });
    }
  }, [cameraActive, mediaStream]);

  // BarcodeDetector + jsQR fallback polling when camera is active (works in Chrome, Safari, Firefox, Zen, Arc)
  React.useEffect(() => {
    if (!cameraActive) return;

    type BarcodeDetectorLike = {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
    };
    type JsQrFn = (data: Uint8ClampedArray, width: number, height: number) => { data?: string } | null;

    const BarcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;

    let detector: BarcodeDetectorLike | null = null;
    if (BarcodeDetectorCtor) {
      try {
        detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      } catch {
        detector = new BarcodeDetectorCtor();
      }
    }

    let jsQrDecoder: JsQrFn | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!detector) {
      // Load lightweight jsQR decoder dynamically for Firefox / Zen Browser / desktop browsers without BarcodeDetector
      const jsQrUrl = "https://fastly.jsdelivr.net/npm/jsqr@1.4.0/+esm";
      import(/* webpackIgnore: true */ jsQrUrl)
        .then((mod: { default?: JsQrFn }) => {
          if (typeof mod?.default === "function") {
            jsQrDecoder = mod.default;
          }
        })
        .catch(() => {
          // ignore CDN load failure
        });
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled || !videoRef.current || isProcessing) return;
      const video = videoRef.current;
      if (video.readyState < 2) return;

      try {
        let detectedValue: string | undefined;

        if (detector) {
          const barcodes = await detector.detect(video);
          detectedValue = barcodes[0]?.rawValue?.trim();
        } else if (jsQrDecoder && ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQrDecoder(imageData.data, imageData.width, imageData.height);
          detectedValue = code?.data?.trim();
        }

        if (detectedValue) {
          const now = Date.now();
          if (lastScannedCodeRef.current.code === detectedValue && now - lastScannedCodeRef.current.time < 3500) {
            return;
          }
          lastScannedCodeRef.current = { code: detectedValue, time: now };
          setQrInput(detectedValue);
          await handleProcessQrCode(detectedValue);
        }
      } catch {
        // Ignore single frame detection errors
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cameraActive, isProcessing, handleProcessQrCode]);

  const activeSessionCheckIn =
    activeReg && selectedSessionId ? activeReg.session_check_ins?.[selectedSessionId] : undefined;

  const isAlreadyCompletedInCurrentMode = React.useMemo(() => {
    if (!activeReg) return false;
    if (mode === "event_checkin") return Boolean(activeReg.is_checked_in);
    if (mode === "session_checkin") return Boolean(activeSessionCheckIn?.is_checked_in);
    if (mode === "merchandise_collection") return Boolean(activeReg.is_merchandise_collected);
    return false;
  }, [activeReg, activeSessionCheckIn, mode]);

  const phoneVal = activeReg
    ? getAnswerDisplay(activeReg, [
        "whatsapp",
        "phone",
        "phone_number",
        "no_hp",
        "no_wa",
        "nomor_whatsapp",
        "mobile",
      ]) ||
      activeReg.member_phone ||
      ""
    : "";
  const orgVal = activeReg
    ? getAnswerDisplay(activeReg, [
        "institution",
        "company",
        "organization",
        "university",
        "instansi",
        "kampus",
        "perusahaan",
      ])
    : "";
  const roleVal = activeReg
    ? getAnswerDisplay(activeReg, ["role", "job_title", "position", "pekerjaan", "jabatan"]) ||
      activeReg.member_role ||
      ""
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Bevy QR Scanner & On-Site Desk</DialogTitle>
              <DialogDescription className="text-xs">
                Scan Bevy QR codes (<code className="font-mono">{eventId}:attendeeId</code>) for{" "}
                <span className="font-medium text-foreground">{eventTitle || `Event #${eventId}`}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Operational Mode Selector */}
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Scanner Mode</Label>
            <Tabs value={mode} onValueChange={(v) => handleModeChange(v as QrScannerMode)} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                <TabsTrigger value="event_checkin" className="gap-1.5 py-2 text-xs">
                  <UserCheck className="size-3.5" />
                  Main Event Check-in
                </TabsTrigger>
                <TabsTrigger value="session_checkin" disabled={sessions.length === 0} className="gap-1.5 py-2 text-xs">
                  <Layers className="size-3.5" />
                  Breakout Session Check-in
                </TabsTrigger>
                <TabsTrigger value="merchandise_collection" className="gap-1.5 py-2 text-xs">
                  <ShoppingBag className="size-3.5" />
                  Merchandise Collection
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 2. Mode Configuration Bar (Session selector + Sync Bevy toggle + Auto-execute toggle) */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
            {mode === "session_checkin" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Target Breakout Session</Label>
                <Select value={selectedSessionId} onValueChange={handleSessionChange}>
                  <SelectTrigger className="h-9 bg-background text-xs">
                    <SelectValue placeholder="Choose a breakout session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.title} {s.time_slot ? `(${s.time_slot})` : ""} —{" "}
                        {s.include_in_registration === false ? "On-Site / Manual" : "Pre-Event Form"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode !== "merchandise_collection" && (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="qr-sync-bevy" className="cursor-pointer font-medium text-xs">
                    Sync Check-in to Bevy API
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {syncBevy ? "Calls Bevy Check-in API + saves to Firestore" : "Saves check-in log to Firestore only"}
                  </p>
                </div>
                <Switch id="qr-sync-bevy" checked={syncBevy} onCheckedChange={setSyncBevy} />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="qr-auto-execute" className="cursor-pointer font-medium text-xs">
                  {mode === "merchandise_collection" ? "Auto-Collect on Scan" : "Auto Check-in on Scan"}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {autoExecuteOnScan
                    ? "Immediately processes attendee when QR is read"
                    : "Inspect attendee & answers before confirming"}
                </p>
              </div>
              <Switch id="qr-auto-execute" checked={autoExecuteOnScan} onCheckedChange={setAutoExecuteOnScan} />
            </div>
          </div>

          {/* 3. Camera Viewfinder & Manual / USB Scanner Input */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="space-y-3 md:col-span-5">
              <div className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border bg-black/90 text-white">
                <video
                  ref={videoRef}
                  className={
                    cameraActive
                      ? "absolute inset-0 h-full w-full object-cover"
                      : "pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
                  }
                  autoPlay
                  playsInline
                  muted
                />
                {cameraActive ? (
                  <>
                    <div className="pointer-events-none absolute inset-6 z-10 rounded-xl border-2 border-primary/80 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    <div className="absolute right-2.5 bottom-2.5 left-2.5 z-20 flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="bg-black/70 text-[10px] text-white">
                        Scanning eventId:attendeeId...
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            const nextMode = facingMode === "environment" ? "user" : "environment";
                            setFacingMode(nextMode);
                            void startCamera(nextMode);
                          }}
                        >
                          <RefreshCw className="mr-1 size-3" />
                          Flip
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-[11px]"
                          onClick={stopCamera}
                        >
                          <CameraOff className="mr-1 size-3" />
                          Stop
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 flex flex-col items-center gap-2.5 p-4 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
                      <Camera className="size-6 text-white/80" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-xs">Camera QR Scanner Ready</p>
                      <p className="text-[11px] text-white/60">
                        Point camera at attendee&apos;s Bevy ticket QR code (<code>{eventId}:attendeeId</code>)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" size="sm" onClick={() => void startCamera()} className="mt-1 gap-1.5">
                        {isStartingCamera ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Requesting Camera...
                          </>
                        ) : (
                          <>
                            <Camera className="size-3.5" />
                            Start Camera
                          </>
                        )}
                      </Button>
                      {isStartingCamera && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={stopCamera}
                          className="mt-1 h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {videoDevices.length > 1 && cameraActive && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Camera Device</Label>
                  <Select
                    value={selectedDeviceId}
                    onValueChange={(deviceId) => {
                      setSelectedDeviceId(deviceId);
                      void startCamera(undefined, deviceId);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Switch camera..." />
                    </SelectTrigger>
                    <SelectContent>
                      {videoDevices.map((d, idx) => (
                        <SelectItem key={d.deviceId || idx} value={d.deviceId} className="text-xs">
                          {d.label || `Camera ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cameraError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-700 text-xs dark:text-amber-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Manual / Handheld Scanner Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (qrInput.trim()) {
                    void handleProcessQrCode(qrInput);
                  }
                }}
                className="space-y-1.5"
              >
                <Label className="text-xs font-medium">QR Payload / Attendee ID / Email</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder={`${eventId}:987654 or email...`}
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isProcessing || !qrInput.trim()}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                    Lookup
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Supports USB barcode scanners, <code>eventId:attendeeId</code>, Bevy attendee ID, or registrant email.
                </p>
              </form>
            </div>

            {/* 4. Scanned Attendee Result Card (Same data as Registration Form) */}
            <div className="flex flex-col justify-between space-y-3 md:col-span-7">
              {activeReg ? (
                <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11 border">
                        <AvatarImage src={activeReg.member_avatar || undefined} alt={activeReg.member_name} />
                        <AvatarFallback className="font-semibold text-xs">
                          {getInitials(activeReg.member_name || activeReg.member_email || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-semibold text-sm">{activeReg.member_name || "Unnamed Registrant"}</h4>
                          {(() => {
                            const statusMeta = getStatusMeta(activeReg.status);
                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1.5 border px-2 py-0.5 font-medium text-[11px]",
                                  statusMeta.badgeClass,
                                )}
                              >
                                <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                                {statusMeta.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="size-3" />
                            {activeReg.member_email}
                          </span>
                          {phoneVal && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3" />
                              {phoneVal}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(activeReg.bevy_attendee_id || lastScannedAttendeeId) && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Bevy ID #{activeReg.bevy_attendee_id ?? lastScannedAttendeeId}
                      </Badge>
                    )}
                  </div>

                  {/* Institution / Role / Ticket Summary */}
                  <div className="grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs sm:grid-cols-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {orgVal || roleVal
                          ? [roleVal, orgVal].filter(Boolean).join(" @ ")
                          : "No organization / role specified"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ticket className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {activeReg.ticket_name || activeReg.bundle_name || activeReg.ticket_tier || "General Admission"}
                      </span>
                    </div>
                  </div>

                  {/* Status Banner for Current Mode */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                      isAlreadyCompletedInCurrentMode
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {isAlreadyCompletedInCurrentMode ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Clock className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {mode === "event_checkin" &&
                            (activeReg.is_checked_in ? "Checked In to Main Event" : "Not Checked In to Main Event")}
                          {mode === "session_checkin" &&
                            (activeSessionCheckIn?.is_checked_in
                              ? `Checked In: ${selectedSession?.title || "Main Session"}`
                              : `Not Checked In: ${selectedSession?.title || "Main Session"}`)}
                          {mode === "merchandise_collection" &&
                            (activeReg.is_merchandise_collected
                              ? "Merchandise Collected"
                              : "Merchandise Pending Collection")}
                        </p>
                        {mode === "event_checkin" && activeReg.checked_in_at && (
                          <p className="text-[11px] opacity-80">
                            At {new Date(activeReg.checked_in_at).toLocaleString()}
                          </p>
                        )}
                        {mode === "session_checkin" && activeSessionCheckIn?.checked_in_at && (
                          <p className="text-[11px] opacity-80">
                            At {new Date(activeSessionCheckIn.checked_in_at).toLocaleString()}
                          </p>
                        )}
                        {mode === "merchandise_collection" && activeReg.merchandise_collected_at && (
                          <p className="text-[11px] opacity-80">
                            Collected at {new Date(activeReg.merchandise_collected_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAlreadyCompletedInCurrentMode ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => executeModeAction(activeReg, lastScannedAttendeeId, qrInput, false)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Undo2 className="size-3.5" />
                          Undo
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => executeModeAction(activeReg, lastScannedAttendeeId, qrInput, true)}
                          className="h-8 gap-1.5 text-xs"
                        >
                          {isProcessing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : mode === "merchandise_collection" ? (
                            <PackageCheck className="size-3.5" />
                          ) : (
                            <UserCheck className="size-3.5" />
                          )}
                          {mode === "event_checkin" && "Check In Now"}
                          {mode === "session_checkin" && "Check In to Session"}
                          {mode === "merchandise_collection" && "Mark Merchandise Collected"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Merchandise Details Section (Always shown in merchandise mode or if attendee has merch) */}
                  {(mode === "merchandise_collection" ||
                    (activeReg.selected_merchandise && activeReg.selected_merchandise.length > 0)) && (
                    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-xs">
                          <ShoppingBag className="size-3.5 text-primary" />
                          Ordered Merchandise
                        </span>
                        {activeReg.payment_status && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            Payment: {activeReg.payment_status}
                          </Badge>
                        )}
                      </div>
                      {activeReg.selected_merchandise && activeReg.selected_merchandise.length > 0 ? (
                        <ul className="space-y-1 text-xs">
                          {activeReg.selected_merchandise.map((m, idx) => {
                            const variantLabel = m.selected_variations
                              ? Object.entries(m.selected_variations)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")
                              : m.selected_variant || m.selected_size || "";
                            return (
                              <li
                                key={`${m.merchandise_id}-${idx}`}
                                className="flex items-center justify-between rounded bg-background px-2 py-1"
                              >
                                <span>
                                  {m.name || m.merchandise_title || "Merchandise Item"}
                                  {variantLabel ? ` (${variantLabel})` : ""}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                  x{m.quantity}
                                </Badge>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          No merchandise items ordered by this registrant.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Registration Form Answers Toggle */}
                  <div className="space-y-2 border-t pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-xs">
                        <ClipboardList className="size-3.5 text-primary" />
                        Registration Form Answers
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setShowFullAnswers((prev) => !prev)}
                      >
                        {showFullAnswers ? "Hide Answers" : "Show All Answers"}
                      </Button>
                    </div>

                    {showFullAnswers && (
                      <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border bg-muted/20 p-2.5 text-xs">
                        {activeReg.answers && Object.keys(activeReg.answers).length > 0 ? (
                          Object.entries(activeReg.answers).map(([qId, val]) => {
                            const qLabel = questions.find((q) => q.id === qId)?.label || qId;
                            const formatted = Array.isArray(val) ? val.join(", ") : String(val || "-");
                            return (
                              <div key={qId} className="grid grid-cols-3 gap-2 border-b pb-1 last:border-b-0 last:pb-0">
                                <span className="font-medium text-muted-foreground">{qLabel}</span>
                                <span className="col-span-2 break-words">{formatted}</span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground">No custom form answers submitted.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                  <Sparkles className="mb-2 size-8 text-muted-foreground/60" />
                  <p className="font-medium text-sm">Scan or Lookup an Attendee</p>
                  <p className="mt-1 max-w-xs text-muted-foreground text-xs">
                    Scan an attendee&apos;s Bevy QR (<code className="font-mono">{eventId}:attendeeId</code>) to view
                    their registration form data and record check-in or merchandise collection.
                  </p>
                </div>
              )}

              {/* Recent Scans Log */}
              {scanHistory.length > 0 && (
                <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Recent Scans ({scanHistory.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setScanHistory([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {scanHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded bg-background px-2.5 py-1.5 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-medium">
                            {entry.registration.member_name || entry.registration.member_email}
                          </span>{" "}
                          <span className="text-muted-foreground">— {entry.actionSummary}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

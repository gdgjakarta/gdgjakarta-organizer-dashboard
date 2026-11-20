"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Award,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Square,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildCertificateVerifyUrl, formatPresenterRoleLabel } from "@/lib/events/certificate-utils";
import type { EventCertificateRecord, EventSpeakerConfirmation, FirestoreEvent } from "@/lib/firestore/types";
import {
  generateSpeakerCertificateAction,
  getEventCertificatesAction,
  sendSpeakerAppreciationEmailAction,
} from "@/server/certificate-actions";

const ROLE_BADGE_CLASSES: Record<string, string> = {
  speakers: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  panelists: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  moderators: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  mentors: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  facilitators: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  judges: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  hosts: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};

interface SpeakerAppreciationPanelProps {
  event: FirestoreEvent;
  confirmations: EventSpeakerConfirmation[];
}

export function SpeakerAppreciationPanel({ event, confirmations }: SpeakerAppreciationPanelProps) {
  const [certsBySpeakerId, setCertsBySpeakerId] = useState<Record<string, EventCertificateRecord>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busySpeakerId, setBusySpeakerId] = useState<string | null>(null);

  // Sequential bulk runner state
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; currentName: string }>({
    done: 0,
    total: 0,
    currentName: "",
  });
  const [bulkFailedIds, setBulkFailedIds] = useState<string[]>([]);
  const stopRequestedRef = useRef(false);

  const loadSpeakerCerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getEventCertificatesAction(event.id);
      if (res.success && res.certificates) {
        const map: Record<string, EventCertificateRecord> = {};
        for (const cert of res.certificates) {
          if (cert.certificate_type === "speaker" && cert.speaker_confirmation_id && cert.status === "active") {
            map[cert.speaker_confirmation_id] = cert;
          }
        }
        setCertsBySpeakerId(map);
      }
    } finally {
      setIsLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    void loadSpeakerCerts();
  }, [loadSpeakerCerts]);

  const speakerCertEnabled = Boolean(event.certificate_config?.speaker?.enabled);
  const hasPhotoAlbum = Boolean(event.photo_album_url?.trim());
  const hasHighlightVideo = Boolean((event.highlight_video_url || event.video_url)?.trim());

  const getSpeakerEmail = (s: EventSpeakerConfirmation) => (s.speaker_email || s.email || "").trim();

  const speakersWithEmail = useMemo(() => confirmations.filter((s) => Boolean(getSpeakerEmail(s))), [confirmations]);

  const filteredConfirmations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return confirmations;
    return confirmations.filter((s) => {
      const name = (nameOverrides[s.id] ?? s.display_name ?? s.full_name ?? "").toLowerCase();
      const email = getSpeakerEmail(s).toLowerCase();
      const talk = (s.talk_title || "").toLowerCase();
      const role = formatPresenterRoleLabel(s.presenter_role).toLowerCase();
      return name.includes(q) || email.includes(q) || talk.includes(q) || role.includes(q);
    });
  }, [confirmations, searchQuery, nameOverrides]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(speakersWithEmail.map((s) => s.id)));
  };

  const selectUnsent = () => {
    setSelectedIds(
      new Set(speakersWithEmail.filter((s) => certsBySpeakerId[s.id]?.email_status !== "sent").map((s) => s.id)),
    );
  };

  const handleGenerateSingle = async (speaker: EventSpeakerConfirmation, forceRegenerate = false) => {
    setBusySpeakerId(speaker.id);
    try {
      const res = await generateSpeakerCertificateAction(event.id, speaker.id, {
        recipientNameOverride: nameOverrides[speaker.id],
        forceRegenerate,
      });
      if (!res.success || !res.certificate) {
        toast.error(res.error || "Failed to generate speaker certificate.");
        return;
      }
      setCertsBySpeakerId((prev) => ({ ...prev, [speaker.id]: res.certificate! }));
      toast.success(`Certificate ready for ${res.certificate.recipient_name}`);
    } finally {
      setBusySpeakerId(null);
    }
  };

  const handleSendSingle = async (speaker: EventSpeakerConfirmation) => {
    setBusySpeakerId(speaker.id);
    try {
      const res = await sendSpeakerAppreciationEmailAction(event.id, speaker.id, {
        recipientNameOverride: nameOverrides[speaker.id],
      });
      if (res.certificate) {
        setCertsBySpeakerId((prev) => ({ ...prev, [speaker.id]: res.certificate! }));
      }
      if (!res.success) {
        toast.error(res.error || `Failed to email ${speaker.full_name}`);
        return;
      }
      toast.success(`Thank you email + certificate sent to ${getSpeakerEmail(speaker)}`);
    } finally {
      setBusySpeakerId(null);
    }
  };

  const runBulkSend = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    stopRequestedRef.current = false;
    setBulkRunning(true);
    setBulkFailedIds([]);
    setBulkProgress({ done: 0, total: targetIds.length, currentName: "" });

    const failed: string[] = [];
    let sentCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      if (stopRequestedRef.current) break;
      const id = targetIds[i];
      const speaker = confirmations.find((s) => s.id === id);
      if (!speaker) continue;

      setBulkProgress({
        done: i,
        total: targetIds.length,
        currentName: nameOverrides[id] || speaker.display_name || speaker.full_name,
      });

      const res = await sendSpeakerAppreciationEmailAction(event.id, id, {
        recipientNameOverride: nameOverrides[id],
      });
      if (res.certificate) {
        setCertsBySpeakerId((prev) => ({ ...prev, [id]: res.certificate! }));
      }
      if (res.success) {
        sentCount++;
      } else {
        failed.push(id);
      }

      setBulkProgress({
        done: i + 1,
        total: targetIds.length,
        currentName: nameOverrides[id] || speaker.display_name || speaker.full_name,
      });
    }

    setBulkFailedIds(failed);
    setBulkRunning(false);
    if (failed.length === 0) {
      toast.success(`Sent ${sentCount} speaker appreciation email(s) with certificates attached!`);
    } else {
      toast.warning(`Sent ${sentCount}, failed ${failed.length}. You can retry failed speakers below.`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-primary" />
              Speaker Appreciation Certificates &amp; Thank You Email
            </CardTitle>
            <CardDescription>
              Generate Certificates of Appreciation and send the customizable{" "}
              <code className="rounded bg-muted px-1 text-xs">speaker_thank_you</code> email with the PDF attached.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={speakerCertEnabled ? "default" : "destructive"}>
              {speakerCertEnabled ? "Speaker Template Active" : "Enable in Certificates Tab"}
            </Badge>
            <Badge variant={hasPhotoAlbum ? "secondary" : "outline"}>
              Photo Album: {hasPhotoAlbum ? "Included" : "Empty (Hidden)"}
            </Badge>
            <Badge variant={hasHighlightVideo ? "secondary" : "outline"}>
              Highlight Video: {hasHighlightVideo ? "Included" : "Empty (Hidden)"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-xs"
                placeholder="Search speaker by name, email, or talk title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {bulkFailedIds.length > 0 && !bulkRunning && (
                <Button type="button" size="sm" variant="destructive" onClick={() => void runBulkSend(bulkFailedIds)}>
                  Retry Failed ({bulkFailedIds.length})
                </Button>
              )}
              {bulkRunning ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    stopRequestedRef.current = true;
                  }}
                >
                  <Square className="mr-1.5 size-3.5" />
                  Stop Bulk Send
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!speakerCertEnabled || selectedIds.size === 0}
                  onClick={() => void runBulkSend(Array.from(selectedIds))}
                >
                  <Send className="mr-1.5 size-3.5" />
                  Generate &amp; Send ({selectedIds.size})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => void loadSpeakerCerts()} disabled={isLoading}>
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {bulkRunning && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  Sending {bulkProgress.done} / {bulkProgress.total} — {bulkProgress.currentName}
                </span>
                <span>{Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%</span>
              </div>
              <Progress value={(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100} />
            </div>
          )}

          {isLoading ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Speaker &amp; Certificate Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["sk-1", "sk-2", "sk-3", "sk-4"].map((key) => (
                    <TableRow key={key}>
                      <TableCell>
                        <Skeleton className="size-4 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Skeleton className="h-7 w-56" />
                          <Skeleton className="h-3 w-72" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Skeleton className="size-7 rounded-md" />
                          <Skeleton className="size-7 rounded-md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : confirmations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No confirmed speakers yet. Add speakers in the Confirmed Speakers list first.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all speakers"
                        checked={
                          speakersWithEmail.length > 0 && selectedIds.size === speakersWithEmail.length
                            ? true
                            : selectedIds.size > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAll();
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        disabled={bulkRunning || speakersWithEmail.length === 0}
                      />
                    </TableHead>
                    <TableHead>Speaker &amp; Certificate Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfirmations.map((speaker) => {
                    const cert = certsBySpeakerId[speaker.id];
                    const isBusy = busySpeakerId === speaker.id;
                    const defaultName = speaker.display_name || speaker.full_name;
                    const speakerEmail = getSpeakerEmail(speaker);
                    const verifyUrl = cert ? buildCertificateVerifyUrl(cert.token) : null;

                    return (
                      <TableRow key={speaker.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(speaker.id)}
                            onCheckedChange={() => toggleSelect(speaker.id)}
                            disabled={bulkRunning || !speakerEmail}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Input
                              className="h-7 max-w-xs text-xs font-medium"
                              value={nameOverrides[speaker.id] ?? defaultName}
                              onChange={(e) => setNameOverrides((prev) => ({ ...prev, [speaker.id]: e.target.value }))}
                              disabled={bulkRunning}
                            />
                            <div className="text-xs text-muted-foreground">
                              {speakerEmail || "No email"} {speaker.talk_title ? `• ${speaker.talk_title}` : ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ROLE_BADGE_CLASSES[String(speaker.presenter_role || "speakers").toLowerCase()] ||
                              ROLE_BADGE_CLASSES.speakers
                            }
                          >
                            {formatPresenterRoleLabel(speaker.presenter_role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!cert ? (
                            <Badge variant="secondary">Not Issued</Badge>
                          ) : cert.email_status === "sent" ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="size-3" />
                              Sent ({cert.email_sent_count || 1})
                            </Badge>
                          ) : cert.email_status === "failed" ? (
                            <Badge variant="destructive" className="gap-1" title={cert.email_error || ""}>
                              <XCircle className="size-3" />
                              Email Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline">PDF Ready</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title={cert ? "Regenerate certificate" : "Generate certificate"}
                              disabled={!speakerCertEnabled || isBusy || bulkRunning}
                              onClick={() => void handleGenerateSingle(speaker, Boolean(cert))}
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : cert ? (
                                <RefreshCw className="size-3.5" />
                              ) : (
                                <Award className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title={cert?.email_status === "sent" ? "Resend appreciation email" : "Send appreciation email"}
                              disabled={!speakerCertEnabled || !speakerEmail || isBusy || bulkRunning}
                              onClick={() => void handleSendSingle(speaker)}
                            >
                              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                            </Button>
                            {cert && verifyUrl && (
                              <>
                                <Button size="icon" variant="ghost" className="size-7" asChild title="Download PDF">
                                  <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" download>
                                    <Download className="size-3.5" />
                                  </a>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Copy verification link"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(verifyUrl);
                                    toast.success("Certificate link copied!");
                                  }}
                                >
                                  <Copy className="size-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-7" asChild title="Open verify page">
                                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-3.5" />
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

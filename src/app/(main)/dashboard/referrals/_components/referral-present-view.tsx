"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  Crown,
  Gift,
  Maximize,
  Minimize,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReferralLeaderboardEntry, ReferralProgramSettings } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { ConfettiEngine } from "./referral-confetti";
import { ReferralContendersTicker } from "./referral-contenders-ticker";
import { ReferralMysteryPodium } from "./referral-mystery-podium";
import { soundEffects } from "./referral-sound-effects";

interface ReferralPresentViewProps {
  initialEntries?: ReferralLeaderboardEntry[];
  initialSettings?: ReferralProgramSettings | null;
}

type RevealStage = "idle" | "revealing-3" | "revealing-2" | "revealing-1" | "completed";

export function ReferralPresentView({ initialEntries = [], initialSettings = null }: ReferralPresentViewProps) {
  const [entries] = useState<ReferralLeaderboardEntry[]>(initialEntries);
  const [settings] = useState<ReferralProgramSettings | null>(initialSettings);
  const [stage, setStage] = useState<RevealStage>("idle");
  const [revealedRanks, setRevealedRanks] = useState({
    rank1: false,
    rank2: false,
    rank3: false,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<ConfettiEngine | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  // Initialize Confetti Engine
  useEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: Canvas ref is populated by React on mount
    if (canvasRef.current) {
      const engine = new ConfettiEngine();
      engine.init(canvasRef.current);
      confettiRef.current = engine;
    }

    return () => {
      confettiRef.current?.destroy();
      confettiRef.current = null;
    };
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement !== null;
      setIsFullscreen(active);
      if (active) {
        setShowFullscreenBanner(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      soundEffects.stopDrumroll();
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenBanner(false);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  }, []);

  const toggleSound = useCallback(() => {
    const nextMuted = soundEffects.toggleMuted();
    setIsMuted(nextMuted);
  }, []);

  const clearPendingTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    soundEffects.stopDrumroll();
  }, []);

  const startRevealSequence = useCallback(() => {
    clearPendingTimeouts();

    // Reset ranks before starting
    setRevealedRanks({ rank1: false, rank2: false, rank3: false });
    setStage("revealing-3");

    // Phase 1: Reveal Rank #3 (Bronze)
    soundEffects.startDrumroll(2200);

    const t1 = window.setTimeout(() => {
      setRevealedRanks((prev) => ({ ...prev, rank3: true }));
      soundEffects.playBronzeChime();
      confettiRef.current?.burst({
        origin: { x: 0.8, y: 0.65 },
        particleCount: 45,
        spread: 60,
        colors: ["#D97706", "#B45309", "#FDE68A", "#FFFFFF"],
      });

      // Pause before Phase 2
      const t2 = window.setTimeout(() => {
        setStage("revealing-2");
        soundEffects.startDrumroll(2400);

        // Phase 2: Reveal Rank #2 (Silver)
        const t3 = window.setTimeout(() => {
          setRevealedRanks((prev) => ({ ...prev, rank2: true }));
          soundEffects.playSilverChime();
          confettiRef.current?.burst({
            origin: { x: 0.2, y: 0.65 },
            particleCount: 55,
            spread: 60,
            colors: ["#94A3B8", "#4285F4", "#E2E8F0", "#FFFFFF"],
          });

          // Pause before Phase 3 (Climax)
          const t4 = window.setTimeout(() => {
            setStage("revealing-1");
            soundEffects.startDrumroll(3200);

            // Phase 3: Reveal Rank #1 (Champion)
            const t5 = window.setTimeout(() => {
              setRevealedRanks({ rank1: true, rank2: true, rank3: true });
              setStage("completed");
              soundEffects.playChampionFanfare();
              soundEffects.playConfettiPop();
              confettiRef.current?.fireGrandFinale();
            }, 3200);

            timeoutsRef.current.push(t5);
          }, 1800);

          timeoutsRef.current.push(t4);
        }, 2400);

        timeoutsRef.current.push(t3);
      }, 1600);

      timeoutsRef.current.push(t2);
    }, 2200);

    timeoutsRef.current.push(t1);
  }, [clearPendingTimeouts]);

  // Keyboard Shortcuts: F for fullscreen, M for mute, Space for start reveal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if target is an input or button
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleSound();
      } else if (e.code === "Space" && stage === "idle") {
        e.preventDefault();
        startRevealSequence();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stage, toggleFullscreen, toggleSound, startRevealSequence]);

  const handleResetToMystery = () => {
    clearPendingTimeouts();
    setRevealedRanks({ rank1: false, rank2: false, rank3: false });
    setStage("idle");
  };

  const handleShootExtraConfetti = () => {
    soundEffects.playConfettiPop();
    confettiRef.current?.fireGrandFinale();
  };

  const handleExitPresentation = () => {
    if (window.opener) {
      window.close();
    } else {
      window.location.href = "/dashboard/referrals";
    }
  };

  return (
    <div
      data-content-padding="false"
      className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-white select-none"
    >
      {/* Canvas Confetti Layer */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50 h-full w-full" />

      {/* Top Header Bar */}
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/referrals"
            onClick={(e) => {
              if (window.opener) {
                e.preventDefault();
                window.close();
              }
            }}
            className="group flex size-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title="Exit Presentation"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          </Link>

          <div className="flex items-center gap-2">
            <span className="font-black text-blue-400 tracking-wider">GDG</span>
            <span className="font-semibold text-slate-200">Jakarta</span>
            <span className="text-slate-600">•</span>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 font-bold text-[11px] text-amber-400"
            >
              <Trophy className="mr-1 size-3 text-amber-400" />
              Championship Live Stage
            </Badge>
          </div>
        </div>

        {/* Grand Prize Banner in Center */}
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
          <Gift className="size-3.5 text-amber-400" />
          <span className="font-semibold text-amber-200">Grand Prize:</span>
          <span className="line-clamp-1 max-w-[280px]">
            {settings?.merch_prize_description || "Official GDG Jakarta Merchandise Bundle"}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSound}
            className={cn(
              "size-9 p-0 border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white",
              isMuted && "text-slate-500",
            )}
            title={isMuted ? "Unmute Audio (M)" : "Mute Audio (M)"}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-emerald-400" />}
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="size-9 p-0 border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </Button>

          {/* Exit Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitPresentation}
            className="text-xs text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            Exit Stage
          </Button>
        </div>
      </header>

      {/* Fullscreen Quick Activation Banner (if not in fullscreen) */}
      {showFullscreenBanner && !isFullscreen && (
        <div className="z-20 flex items-center justify-between border-b border-blue-500/30 bg-blue-950/40 px-6 py-2 text-blue-200 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Maximize className="size-3.5 text-blue-400" />
            <span>Presenting on stage? Go fullscreen for the optimal projector experience.</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="h-7 border-blue-400/40 bg-blue-500/20 px-2.5 text-blue-200 text-xs hover:bg-blue-500/30"
            >
              Enter Fullscreen
            </Button>
            <button
              type="button"
              onClick={() => setShowFullscreenBanner(false)}
              className="text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Presentation Stage Area */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-between overflow-y-auto px-4 py-6 md:px-8">
        {/* Subtle Background Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 size-80 rounded-full bg-amber-500/10 blur-[100px]" />

        {/* Stage Title */}
        <div className="z-10 text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1 text-xs text-slate-300">
            <Sparkles className="size-3.5 text-amber-400" />
            <span>
              {stage === "idle" && "Mystery Podium • Winners Concealed"}
              {stage === "revealing-3" && "Revealing 3rd Place (Bronze)..."}
              {stage === "revealing-2" && "Revealing 2nd Place (Silver)..."}
              {stage === "revealing-1" && "Revealing Season Grand Champion..."}
              {stage === "completed" && "Official Referral Program Winners"}
            </span>
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight text-white sm:text-4xl md:text-5xl">
            {stage === "completed" ? "Congratulations Champions!" : "Who Will Claim The Grand Prize?"}
          </h2>
        </div>

        {/* Top 3 Mystery / Revealed Podium */}
        <div className="my-auto flex w-full justify-center py-4">
          <ReferralMysteryPodium
            entries={entries}
            revealedRanks={revealedRanks}
            merchPrizeDescription={settings?.merch_prize_description}
          />
        </div>

        {/* Live Contenders Ticker (Shows all participating profiles) */}
        <div className="w-full max-w-6xl">
          <ReferralContendersTicker entries={entries} isRevealed={stage === "completed"} />
        </div>

        {/* Bottom Interactive Action Bar */}
        <div className="z-20 mt-4 flex flex-wrap items-center justify-center gap-4 py-2">
          {stage === "idle" && (
            <Button
              size="lg"
              onClick={startRevealSequence}
              className="group relative h-14 overflow-hidden rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-8 font-black text-amber-950 text-base shadow-xl shadow-amber-500/25 transition-all hover:scale-105 hover:shadow-amber-500/40 active:scale-95"
            >
              <div className="pointer-events-none absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              <Crown className="mr-2 size-5 transition-transform group-hover:rotate-12" />
              <span>Start Reveal Sequence</span>
              <Sparkles className="ml-2 size-4 animate-spin" />
            </Button>
          )}

          {stage !== "idle" && stage !== "completed" && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 font-semibold text-amber-300 text-sm backdrop-blur-md">
              <RefreshCw className="size-4 animate-spin text-amber-400" />
              <span>Revealing the Champions in Real-Time...</span>
            </div>
          )}

          {stage === "completed" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={handleShootExtraConfetti}
                className="rounded-xl border border-blue-500/40 bg-blue-600 font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-95"
              >
                <PartyPopper className="mr-2 size-5" />
                Fire Confetti
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={startRevealSequence}
                className="rounded-xl border-slate-700 bg-slate-900 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <RotateCcw className="mr-2 size-4" />
                Replay Reveal
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={handleResetToMystery}
                className="rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                Reset to Mystery
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

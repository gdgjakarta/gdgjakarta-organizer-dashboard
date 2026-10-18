// Web Audio API Sound Synthesizer for Referral Leaderboard Presentation Mode
// Zero external dependencies, 100% offline-ready, low latency.

class SoundEffectManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean;
  private drumrollInterval: number | null = null;

  constructor() {
    this.isMuted = false;
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopDrumroll();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // Tension Drumroll: Rapid low-frequency rhythmic beats that accelerate and intensify
  public startDrumroll(durationMs = 3000) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopDrumroll();

    const startTime = ctx.currentTime;
    const endTime = startTime + durationMs / 1000;
    const initialDelay = 120;
    const minDelay = 40;

    const playBeat = () => {
      if (this.isMuted || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (now >= endTime) {
        this.stopDrumroll();
        return;
      }

      const progress = Math.min(1, (now - startTime) / (durationMs / 1000));
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Frequency rises slightly with tension
      osc.type = "sine";
      osc.frequency.setValueAtTime(80 + progress * 70, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

      // Volume ramps up as we reach the climax
      const volume = 0.15 + progress * 0.25;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);

      const nextDelay = Math.max(minDelay, initialDelay - progress * 80);
      this.drumrollInterval = window.setTimeout(playBeat, nextDelay);
    };

    playBeat();
  }

  public stopDrumroll() {
    if (this.drumrollInterval !== null) {
      clearTimeout(this.drumrollInterval);
      this.drumrollInterval = null;
    }
  }

  // Rank 3 Reveal: Warm Bronze Chime (Major Third)
  public playBronzeChime() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.0]; // C4, E4, G4
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.2);
    });
  }

  // Rank 2 Reveal: Brighter Silver Fanfare (Octave leap + Fifths)
  public playSilverChime() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [329.63, 392.0, 523.25, 659.25]; // E4, G4, C5, E5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.25, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 1.5);
    });
  }

  // Rank 1 Reveal: Grand Champion Brass Fanfare & Triumphant Harmony
  public playChampionFanfare() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Arpeggiated triumphant fanfare: C4 -> G4 -> C5 -> E5 -> G5
    const arpeggio = [
      { f: 261.63, t: 0.0, d: 0.2 },
      { f: 392.0, t: 0.15, d: 0.2 },
      { f: 523.25, t: 0.3, d: 0.25 },
      { f: 659.25, t: 0.5, d: 0.3 },
      { f: 783.99, t: 0.75, d: 1.8 }, // Hold top note
    ];

    arpeggio.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, now + t);

      // Low-pass filter to give a warm brass feel
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now + t);

      gain.gain.setValueAtTime(0.28, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + d);
    });

    // Sustained high triumphant chord at the peak
    const chordTime = now + 0.75;
    const chordNotes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chordNotes.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, chordTime);

      gain.gain.setValueAtTime(0.18, chordTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(chordTime);
      osc.stop(chordTime + 2.5);
    });
  }

  // Confetti Shimmer Pops
  public playConfettiPop() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const freq = 1200 + Math.random() * 1400;
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0.12, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.15);
    }
  }
}

export const soundEffects = new SoundEffectManager();

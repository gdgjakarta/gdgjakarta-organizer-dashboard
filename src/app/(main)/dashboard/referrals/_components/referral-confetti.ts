// High-Performance HTML5 Canvas Confetti Engine for Referral Presentation Mode
// Zero external dependencies, GDG Brand colors, 3D flutter physics.

export interface ConfettiBurstOptions {
  particleCount?: number;
  origin?: { x: number; y: number };
  spread?: number;
  angle?: number;
  velocity?: number;
  colors?: string[];
  decay?: number;
  gravity?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  decay: number;
  gravity: number;
  shape: "rect" | "circle";
}

// Google Developer Groups Brand Palette
export const GDG_CONFETTI_COLORS = [
  "#4285F4", // Google Blue
  "#EA4335", // Google Red
  "#FBBC04", // Google Yellow
  "#34A853", // Google Green
  "#F59E0B", // Gold
  "#FFFFFF", // Sparkle White
  "#8B5CF6", // Purple accent
];

export class ConfettiEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private resizeHandler: (() => void) | null = null;

  public init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();

    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);
  }

  public destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
  }

  public resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    if (this.ctx) {
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    }
  }

  public burst(options: ConfettiBurstOptions = {}) {
    if (!this.canvas) return;

    const count = options.particleCount ?? 80;
    const origin = options.origin ?? { x: 0.5, y: 0.7 };
    const spread = (options.spread ?? 60) * (Math.PI / 180);
    const angle = (options.angle ?? 90) * (Math.PI / 180);
    const baseVelocity = options.velocity ?? 45;
    const colors = options.colors ?? GDG_CONFETTI_COLORS;
    const decay = options.decay ?? 0.015;
    const gravity = options.gravity ?? 1.2;

    const startX = origin.x * window.innerWidth;
    const startY = origin.y * window.innerHeight;

    for (let i = 0; i < count; i++) {
      const pAngle = angle + (Math.random() - 0.5) * spread;
      const velocity = baseVelocity * (0.6 + Math.random() * 0.8);
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(pAngle) * velocity,
        vy: -Math.sin(pAngle) * velocity,
        size: 7 + Math.random() * 8,
        color,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        wobble: Math.random() * 10,
        wobbleSpeed: 0.1 + Math.random() * 0.1,
        opacity: 1,
        decay: decay * (0.8 + Math.random() * 0.4),
        gravity,
        shape: Math.random() > 0.3 ? "rect" : "circle",
      });
    }

    if (this.animationId === null) {
      this.loop();
    }
  }

  // Dual side cannons shooting inward from bottom corners
  public fireDualCannons() {
    // Left Cannon shooting up-right (60 degrees)
    this.burst({
      particleCount: 70,
      origin: { x: 0.05, y: 0.9 },
      angle: 60,
      spread: 55,
      velocity: 52,
    });

    // Right Cannon shooting up-left (120 degrees)
    this.burst({
      particleCount: 70,
      origin: { x: 0.95, y: 0.9 },
      angle: 120,
      spread: 55,
      velocity: 52,
    });
  }

  // Grand Finale celebration: Continuous fireworks wave
  public fireGrandFinale() {
    this.fireDualCannons();

    setTimeout(() => {
      this.burst({
        particleCount: 90,
        origin: { x: 0.5, y: 0.5 },
        spread: 360,
        velocity: 35,
      });
    }, 300);

    setTimeout(() => {
      this.fireDualCannons();
    }, 700);

    setTimeout(() => {
      this.burst({
        particleCount: 120,
        origin: { x: 0.5, y: 0.6 },
        spread: 120,
        velocity: 55,
      });
    }, 1200);
  }

  private loop = () => {
    if (!this.canvas || !this.ctx) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98; // air resistance
      p.vy *= 0.98;
      p.wobble += p.wobbleSpeed;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > window.innerHeight + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.scale(Math.cos(p.wobble), 1);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.opacity);

      if (p.shape === "circle") {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(this.loop);
    } else {
      this.animationId = null;
    }
  };
}

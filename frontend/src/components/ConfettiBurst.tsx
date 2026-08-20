import React, { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// ConfettiBurst — Lightweight CSS/Canvas confetti triggered on celebration.
// Spawns coloured particles that fly up and fade out over 1.8 s.
// Self-cleaning: removes the canvas when the animation finishes.
// Uses brand colors from design system: primary, secondary, accent
// ---------------------------------------------------------------------------

const COLOURS = [
  '#2563EB', // primary-500
  '#006474', // primary-dark
  '#F59E0B', // secondary-500
  '#865300', // secondary-dark
  '#EC4899', // accent-500
  '#10b981', // emerald-500 (success)
  '#f97316', // orange-500
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  life: number; // 0–1 progress
}

function createParticles(cx: number, cy: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6, // bias upward
      color: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      alpha: 1,
      life: 0,
    };
  });
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Burst origin: upper-centre of screen
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.35;

    let particles = createParticles(cx, cy, 70);
    const duration = 1800; // ms
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.3,   // gravity
        rotation: p.rotation + p.rotationSpeed,
        alpha: 1 - progress,
        life: progress,
      }));

      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        // Draw a small rectangle (confetti ribbon)
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
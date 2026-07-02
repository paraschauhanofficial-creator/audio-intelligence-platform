"use client";

import { useEffect, useRef } from "react";

interface AudioBackgroundProps {
  parallax?: { x: number; y: number };
}

export default function AudioBackground({ parallax }: AudioBackgroundProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    // Particle wave lines
    const LINES = 6;
    const lines = [
      { color: "#00B7FF", alpha: 0.12, speed: 0.4, freq: 0.8, amp: 0.12, off: 0 },
      { color: "#14D8C4", alpha: 0.10, speed: 0.3, freq: 0.6, amp: 0.15, off: Math.PI*0.4 },
      { color: "#F0A500", alpha: 0.08, speed: 0.5, freq: 1.0, amp: 0.09, off: Math.PI*0.8 },
      { color: "#FF6B4A", alpha: 0.07, speed: 0.35, freq: 0.7, amp: 0.11, off: Math.PI*1.2 },
      { color: "#14D8C4", alpha: 0.09, speed: 0.45, freq: 0.9, amp: 0.08, off: Math.PI*1.6 },
      { color: "#00B7FF", alpha: 0.06, speed: 0.25, freq: 0.5, amp: 0.13, off: Math.PI*2.0 },
    ];

    // Particles along the waves
    const PARTICLES = 120;
    const particles = Array.from({ length: PARTICLES }, (_, i) => ({
      lineIdx: Math.floor(Math.random() * LINES),
      progress: Math.random(),
      speed: 0.0008 + Math.random() * 0.0012,
      size: Math.random() * 2.5 + 0.8,
      opacity: Math.random() * 0.5 + 0.15,
      pulse: Math.random() * Math.PI * 2,
    }));

    // EQ bars
    const BARS = 48;
    const bars = Array.from({ length: BARS }, () => ({
      h: Math.random() * 0.15 + 0.03,
      t: Math.random() * 0.15 + 0.03,
      s: Math.random() * 0.02 + 0.008,
    }));

    let t = 0;

    const getLineY = (line: typeof lines[0], x: number, w: number, h: number, time: number) => {
      const p = x / w;
      return h * 0.48
        + Math.sin(p * Math.PI * 2 * line.freq + time * line.speed + line.off) * h * line.amp
        + Math.sin(p * Math.PI * 3.5 * line.freq + time * line.speed * 1.4 + line.off) * h * line.amp * 0.4;
    };

    const frame = () => {
      t += 0.012;
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, w, h);

      // Draw wave lines as dotted particle streams
      lines.forEach((line, li) => {
        // Thin continuous line
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y = getLineY(line, x, w, h, t);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = line.color + Math.round(line.alpha * 0.4 * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Dotted particles along line
        const steps = 80;
        for (let s = 0; s < steps; s++) {
          const px = (s / steps) * w;
          const py = getLineY(line, px, w, h, t);
          const glowT = Math.sin(t * 2 + s * 0.3 + li) * 0.5 + 0.5;
          const r = 1.2 + glowT * 1.2;
          const a = line.alpha * (0.3 + glowT * 0.5);
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = line.color + Math.round(a * 255).toString(16).padStart(2, "0");
          ctx.fill();
        }
      });

      // Moving particles
      particles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
        p.pulse += 0.05;

        const line = lines[p.lineIdx];
        const px = p.progress * w;
        const py = getLineY(line, px, w, h, t);
        const glow = Math.sin(p.pulse) * 0.5 + 0.5;
        const r = p.size * (0.6 + glow * 0.8);
        const a = p.opacity * (0.4 + glow * 0.6);

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = line.color + Math.round(a * 255).toString(16).padStart(2, "0");
        ctx.fill();

        // Occasional bright flare
        if (glow > 0.85) {
          ctx.beginPath();
          ctx.arc(px, py, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = line.color + Math.round(a * 0.15 * 255).toString(16).padStart(2, "0");
          ctx.fill();
        }
      });

      // EQ bars at bottom
      const barW = w / BARS;
      const maxH = h * 0.10;
      const baseY = h * 0.97;
      const eqColors = ["#00B7FF","#14D8C4","#F0A500","#FF6B4A"];

      bars.forEach((bar, i) => {
        if (Math.random() < 0.015) bar.t = Math.random() * 0.18 + 0.03;
        bar.h += (bar.t - bar.h) * bar.s;
        const bh = bar.h * maxH * (1 + Math.sin(t * 0.5 + i * 0.2) * 0.1);
        const bx = i * barW + barW * 0.15;
        const bww = barW * 0.65;
        const col = eqColors[Math.floor(i / BARS * eqColors.length)];
        ctx.fillStyle = col + Math.round((0.12 + bar.h * 0.15) * 255).toString(16).padStart(2, "0");
        ctx.beginPath();
        (ctx as any).roundRect(bx, baseY - bh, bww, bh, 1);
        ctx.fill();
      });

      // Vignette — edges dark, centre clear
      const gv = ctx.createRadialGradient(w*0.5, h*0.5, 0, w*0.5, h*0.5, w*0.7);
      gv.addColorStop(0, "rgba(10,10,10,0)");
      gv.addColorStop(1, "rgba(10,10,10,0.85)");
      ctx.fillStyle = gv; ctx.fillRect(0, 0, w, h);

      // Top header fade
      const gt = ctx.createLinearGradient(0, 0, 0, h * 0.12);
      gt.addColorStop(0, "rgba(10,10,10,0.95)");
      gt.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = gt; ctx.fillRect(0, 0, w, h * 0.12);

      animId = requestAnimationFrame(frame);
    };

    frame();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0,
      width: "100vw", height: "100vh",
      zIndex: 0, pointerEvents: "none",
      transform: parallax ? `translate(${parallax.x}px, ${parallax.y}px)` : undefined,
      transition: "transform 0.15s ease-out",
      willChange: "transform",
    }} />
  );
}
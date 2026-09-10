"use client";

import { useEffect, useRef } from "react";

export default function Ambient3DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    };

    const count = Math.min(45, Math.floor(width / 30));
    const particles: Particle[] = [];
    const colors = ["rgba(56, 213, 240, ", "rgba(240, 180, 56, ", "rgba(20, 147, 173, "];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Background ambient gradient
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.3, 0, width * 0.5, height * 0.5, width * 0.8);
      grad.addColorStop(0, "rgba(6, 10, 18, 0.4)");
      grad.addColorStop(1, "rgba(5, 6, 10, 0.95)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Connect particles with distance lines
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(56, 213, 240, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Render & update particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}0.8)`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(56, 213, 240, 0.6)";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (!reducedMotion) animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-60" />;
}

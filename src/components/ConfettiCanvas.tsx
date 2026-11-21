import { useEffect, useRef } from 'react';

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'rect' | 'ribbon';
}

interface ConfettiCanvasProps {
  active: boolean;
  burstKey: number;
}

const COLORS = [
  '#A3E635', // 10UNDER Neon Lime
  '#84CC16', // Deep Lime
  '#FACC15', // Champion Gold
  '#00D1FF', // Electric Blue
  '#F8FAFC', // Crisp White
  '#22C55E', // Emerald Accent
];

export function ConfettiCanvas({ active, burstKey }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const particles: ConfettiParticle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnBurst = (originX: number, originY: number, count: number, spreadAngle: number, baseAngle: number) => {
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
        const speed = 7 + Math.random() * 14;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - Math.random() * 4,
          size: 7 + Math.random() * 9,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.24,
          opacity: 1,
          shape: Math.random() > 0.35 ? 'rect' : 'ribbon',
        });
      }
    };

    const w = canvas.width;
    const h = canvas.height;
    // Initial triple cannon launch (left, center, right)
    spawnBurst(w * 0.14, h * 0.72, 65, 0.9, -Math.PI * 0.34);
    spawnBurst(w * 0.86, h * 0.72, 65, 0.9, -Math.PI * 0.66);
    spawnBurst(w * 0.5, h * 0.45, 90, Math.PI * 1.4, -Math.PI * 0.5);

    const secondBurstTimer = window.setTimeout(() => {
      spawnBurst(canvas.width * 0.25, canvas.height * 0.6, 55, 1.1, -Math.PI * 0.42);
      spawnBurst(canvas.width * 0.75, canvas.height * 0.6, 55, 1.1, -Math.PI * 0.58);
    }, 520);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.26; // gravity
        p.vx *= 0.988; // air drag
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height * 0.85) {
          p.opacity -= 0.025;
        }

        if (p.opacity <= 0 || p.y > canvas.height + 40) {
          particles.splice(i, 1);
          continue;
        }

        aliveCount++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
        } else {
          ctx.fillRect(-p.size * 0.75, -p.size * 0.18, p.size * 1.5, p.size * 0.36);
        }
        ctx.restore();
      }

      if (aliveCount > 0) {
        animId = window.requestAnimationFrame(render);
      }
    };

    animId = window.requestAnimationFrame(render);

    return () => {
      window.clearTimeout(secondBurstTimer);
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [active, burstKey]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}

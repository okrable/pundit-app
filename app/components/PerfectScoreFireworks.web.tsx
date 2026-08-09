import { useEffect } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

const COLORS = [
  '#d07158',
  '#34855b',
  '#4CAF50',
  '#FFD54F',
  '#4FC3F7',
  '#BA68C8',
  '#FFFFFF',
] as const;

const ORIGINS = [
  { at: 0, x: 0.5, y: 70 },
  { at: 380, x: 0.18, y: 130 },
  { at: 760, x: 0.82, y: 120 },
  { at: 1140, x: 0.34, y: 210 },
  { at: 1520, x: 0.68, y: 220 },
  { at: 1900, x: 0.08, y: 280 },
  { at: 2280, x: 0.92, y: 270 },
  { at: 2660, x: 0.46, y: 330 },
  { at: 3040, x: 0.74, y: 360 },
] as const;

const PARTICLES_PER_BURST = 52;
const MINIMUM_SPEED = 100;
const MAXIMUM_SPEED = 280;
const MINIMUM_LIFE = 3.8;
const MAXIMUM_LIFE = 5.4;
const TIME_SCALE = 0.84;
const GRAVITY = 52;
const DRAG = 0.991;
const LARGE_PARTICLE_CHANCE = 0.14;

interface FireworkParticle {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maximumLife: number;
  size: number;
  isLarge: boolean;
  color: string;
  twinkleOffset: number;
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

export default function PerfectScoreFireworks() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '999999',
    });
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const pixelRatio = window.devicePixelRatio || 1;
    let animationFrame = 0;
    let particles: FireworkParticle[] = [];
    let nextBurst = 0;
    let previousTime = performance.now();
    const startedAt = previousTime;

    const resize = () => {
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const createParticleSize = () =>
      Math.random() < LARGE_PARTICLE_CHANCE
        ? randomBetween(4.8, 7.5)
        : randomBetween(1.2, 3.4);

    const explode = (origin: (typeof ORIGINS)[number]) => {
      const originX =
        window.innerWidth * origin.x + randomBetween(-24, 24);
      const originY = origin.y + randomBetween(-24, 24);

      for (let index = 0; index < PARTICLES_PER_BURST; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomBetween(MINIMUM_SPEED, MAXIMUM_SPEED);
        const life = randomBetween(MINIMUM_LIFE, MAXIMUM_LIFE);
        const size = createParticleSize();

        particles.push({
          x: originX,
          y: originY,
          previousX: originX,
          previousY: originY,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          life,
          maximumLife: life,
          size,
          isLarge: size >= 4.8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    };

    const frame = (now: number) => {
      const realDelta = Math.min((now - previousTime) / 1000, 0.04);
      const delta = realDelta * TIME_SCALE;
      const elapsed = now - startedAt;
      previousTime = now;

      while (nextBurst < ORIGINS.length && elapsed >= ORIGINS[nextBurst].at) {
        explode(ORIGINS[nextBurst]);
        nextBurst += 1;
      }

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.globalCompositeOperation = 'lighter';

      particles = particles.filter((particle) => {
        particle.life -= delta;
        if (particle.life <= 0) return false;

        particle.previousX = particle.x;
        particle.previousY = particle.y;

        const drag = Math.pow(DRAG, delta * 60);
        particle.velocityX *= drag;
        particle.velocityY = particle.velocityY * drag + GRAVITY * delta;
        particle.x += particle.velocityX * delta;
        particle.y += particle.velocityY * delta;

        const lifeProgress = particle.life / particle.maximumLife;
        const twinkle =
          0.72 +
          Math.sin(elapsed / 100 + particle.twinkleOffset) * 0.28;

        context.globalAlpha = Math.max(0, lifeProgress) * twinkle;
        context.strokeStyle = particle.color;
        context.lineWidth =
          2 * lifeProgress * (particle.isLarge ? 1.35 : 1);
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(particle.previousX, particle.previousY);
        context.lineTo(particle.x, particle.y);
        context.stroke();

        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.size * lifeProgress,
          0,
          Math.PI * 2
        );
        context.fill();

        return true;
      });

      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';

      if (particles.length || nextBurst < ORIGINS.length) {
        animationFrame = window.requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.remove();
    };
  }, [reduceMotion]);

  return null;
}

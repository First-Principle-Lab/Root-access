'use client';

import { useEffect, useRef } from 'react';

export function GenerativeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let redraw = () => {};
    const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      if (width === window.innerWidth && height === window.innerHeight) return false;
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return true;
    };

    resize();

      type Branch = { x: number; y: number; angle: number; counter: { value: number } };
      let branches: Branch[] = [];
      let drawn = 0;
      let seed = 4381;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const start = () => {
        context.clearRect(0, 0, width, height);
        seed = 4381;
        drawn = 0;
        branches = [
          { x: width * .72, y: -8, angle: Math.PI / 2, counter: { value: 0 } },
          { x: width * .84, y: -8, angle: Math.PI / 2, counter: { value: 0 } },
          { x: width * .69, y: height + 8, angle: -Math.PI / 2, counter: { value: 0 } },
          { x: width * .26, y: height + 8, angle: -Math.PI / 2, counter: { value: 0 } },
          { x: -8, y: height * .73, angle: 0, counter: { value: 0 } },
          { x: -8, y: height * .34, angle: 0, counter: { value: 0 } },
          { x: width + 8, y: height * .35, angle: Math.PI, counter: { value: 0 } },
          { x: width + 8, y: height * .65, angle: Math.PI, counter: { value: 0 } },
        ];
        if (width < 680) branches = [branches[0], branches[2], branches[4]];
      };
      const draw = (time: number) => {
        if (time - lastFrame >= 25 || !lastFrame) {
          lastFrame = time;
          const dark = document.documentElement.classList.contains('dark');
          context.strokeStyle = dark ? 'rgba(155,155,155,.145)' : 'rgba(75,75,75,.12)';
          context.lineWidth = .75;
          do {
            const previous = branches;
            branches = [];
            for (const branch of previous) {
              if (drawn >= 25000) break;
              if (motion && random() < .5) { branches.push(branch); continue; }
              const length = random() * 6;
              branch.counter.value++;
              const nx = branch.x + Math.cos(branch.angle) * length;
              const ny = branch.y + Math.sin(branch.angle) * length;
              context.beginPath();
              context.moveTo(branch.x, branch.y);
              context.lineTo(nx, ny);
              context.stroke();
              drawn++;
              if (nx < -100 || nx > width + 100 || ny < -100 || ny > height + 100) continue;
              const spread = Math.PI / 12;
              const probability = branch.counter.value <= 30 ? .8 : .5;
              if (random() < probability) branches.push({ x: nx, y: ny, angle: branch.angle + random() * spread, counter: branch.counter });
              if (random() < probability) branches.push({ x: nx, y: ny, angle: branch.angle - random() * spread, counter: branch.counter });
            }
          } while (!motion && branches.length && drawn < 25000);
        }
        if (motion && branches.length && drawn < 25000) frame = requestAnimationFrame(draw);
      };
      start();
      redraw = () => { start(); lastFrame = 0; draw(performance.now()); };
      draw(performance.now());

    const onResize = () => { if (resize()) { cancelAnimationFrame(frame); redraw(); } };
    const onThemeChange = () => { cancelAnimationFrame(frame); redraw(); };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="generative-background generative-background--roots" aria-hidden="true" />;
}

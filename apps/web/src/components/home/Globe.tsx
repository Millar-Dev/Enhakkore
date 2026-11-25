'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export interface GlobeMarker {
  lat: number;
  lng: number;
  label: string;
  href: string;
}

/**
 * A dotted globe with a gold marker on every country that has something to
 * show. Drawn on a canvas from a 16KB list of land points — no map library.
 *
 * It turns slowly on its own, can be dragged, and a marker opens its country.
 * With "reduce motion" switched on it does not spin. It only starts drawing
 * once it scrolls into view, and stops when it leaves.
 */
export function Globe({ markers, initialLng = 30 }: { markers: GlobeMarker[]; initialLng?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [hover, setHover] = useState<GlobeMarker | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let land: number[] = [];
    let rotation = -initialLng;
    const tilt = -12;
    let dragging = false;
    let lastX = 0;
    let frame = 0;
    let visible = false;
    let projected: { x: number; y: number; marker: GlobeMarker }[] = [];

    const resize = () => {
      const size = canvas.clientWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const toRad = Math.PI / 180;
    const project = (lat: number, lng: number, radius: number, cx: number, cy: number) => {
      const phi = lat * toRad;
      const lambda = (lng + rotation) * toRad;
      const t = tilt * toRad;
      const x = Math.cos(phi) * Math.sin(lambda);
      let y = Math.sin(phi);
      let z = Math.cos(phi) * Math.cos(lambda);
      const y2 = y * Math.cos(t) - z * Math.sin(t);
      z = y * Math.sin(t) + z * Math.cos(t);
      y = y2;
      return { x: cx + x * radius, y: cy - y * radius, z };
    };

    const draw = () => {
      const size = canvas.clientWidth;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.46;
      context.clearRect(0, 0, size, size);

      const glow = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      glow.addColorStop(0, '#12507e');
      glow.addColorStop(1, '#061f33');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(248, 244, 236, 0.9)';
      for (let i = 0; i < land.length; i += 2) {
        const point = project(land[i]!, land[i + 1]!, radius, cx, cy);
        if (point.z <= 0) continue;
        const dot = 1 + point.z * 1.2;
        context.globalAlpha = 0.25 + point.z * 0.75;
        context.fillRect(point.x - dot / 2, point.y - dot / 2, dot, dot);
      }
      context.globalAlpha = 1;

      projected = [];
      for (const marker of markers) {
        const point = project(marker.lat, marker.lng, radius, cx, cy);
        if (point.z <= 0.05) continue;
        projected.push({ x: point.x, y: point.y, marker });
        context.fillStyle = 'rgba(212, 175, 83, 0.25)';
        context.beginPath();
        context.arc(point.x, point.y, 9 * point.z, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#d4af53';
        context.beginPath();
        context.arc(point.x, point.y, 3.6, 0, Math.PI * 2);
        context.fill();
      }

      context.strokeStyle = 'rgba(212, 175, 83, 0.35)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
    };

    const loop = () => {
      if (!dragging && !reduceMotion) rotation -= 0.08;
      draw();
      if (visible && !reduceMotion) frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (reduceMotion) draw();
      else frame = requestAnimationFrame(loop);
    };

    resize();
    fetch('/media/globe/land-v1.json')
      .then((response) => response.json())
      .then((points: number[]) => {
        land = points;
        draw();
      })
      .catch(() => draw());

    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(frame);
    });
    observer.observe(canvas);

    const hit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return projected.find((point) => Math.hypot(point.x - x, point.y - y) < 14)?.marker ?? null;
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (dragging) {
        rotation += (event.clientX - lastX) * 0.35;
        lastX = event.clientX;
        if (reduceMotion) draw();
      }
      setHover(hit(event));
    };
    const onUp = (event: PointerEvent) => {
      dragging = false;
      const marker = hit(event);
      if (marker) router.push(marker.href);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', resize);
    };
  }, [markers, initialLng, router]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="aspect-square w-full cursor-grab touch-pan-y active:cursor-grabbing"
        role="img"
        aria-label={`Globe showing ${markers.map((marker) => marker.label).join(', ')}`}
      />
      <p className="pointer-events-none mt-2 text-center text-xs font-semibold text-acacia-700" aria-live="polite">
        {hover ? hover.label : markers.length ? 'Drag to turn · tap a gold marker' : ''}
      </p>
      {/* The same places as plain links, for keyboards and screen readers. */}
      <ul className="sr-only">
        {markers.map((marker) => (
          <li key={marker.href}>
            <a href={marker.href}>{marker.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

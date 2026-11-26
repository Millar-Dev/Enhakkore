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
 * The interactive globe: a dotted Earth drawn on a canvas from a 16KB list of
 * land points (no map library), with an illuminated marker on every country
 * that has something to show and travel lines from the home city.
 *
 * It turns slowly on its own; it can be dragged in any direction, zoomed with
 * the wheel, a pinch or the +/− buttons, and a marker opens its country. With
 * "reduce motion" on it does not spin or animate. It only draws while visible.
 */
export function Globe({
  markers,
  initialLng = 30,
  home,
  tone = 'light',
}: {
  markers: GlobeMarker[];
  initialLng?: number;
  /** Where the travel lines start (the launch city). */
  home?: { lat: number; lng: number } | null;
  /** `dark` for the navy hero. */
  tone?: 'light' | 'dark';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(1);
  const router = useRouter();
  const [hover, setHover] = useState<GlobeMarker | null>(null);
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let land: number[] = [];
    let rotation = -initialLng;
    let tilt = -12;
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let frame = 0;
    let visible = false;
    let pulse = 0;
    let projected: { x: number; y: number; marker: GlobeMarker }[] = [];
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchZoom = 1;

    const resize = () => {
      const size = canvas.clientWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
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

    /** Points along the great circle between two places, lifted off the surface in the middle. */
    const arc = (from: { lat: number; lng: number }, to: { lat: number; lng: number }, radius: number, cx: number, cy: number) => {
      const v = (p: { lat: number; lng: number }) => [Math.cos(p.lat * toRad) * Math.cos(p.lng * toRad), Math.cos(p.lat * toRad) * Math.sin(p.lng * toRad), Math.sin(p.lat * toRad)];
      const a = v(from);
      const b = v(to);
      const dot = Math.min(1, Math.max(-1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!));
      const omega = Math.acos(dot);
      if (omega < 0.01) return [];
      const points: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 32; i += 1) {
        const t = i / 32;
        const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
        const s2 = Math.sin(t * omega) / Math.sin(omega);
        const x = s1 * a[0]! + s2 * b[0]!;
        const y = s1 * a[1]! + s2 * b[1]!;
        const z = s1 * a[2]! + s2 * b[2]!;
        const lat = Math.asin(z) / toRad;
        const lng = Math.atan2(y, x) / toRad;
        const lift = 1 + Math.sin(Math.PI * t) * Math.min(0.18, omega * 0.12);
        const p = project(lat, lng, radius * lift, cx, cy);
        points.push(p);
      }
      return points;
    };

    function draw() {
      const size = canvas!.clientWidth;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.44 * zoomRef.current;
      context!.clearRect(0, 0, size, size);

      const glow = context!.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      glow.addColorStop(0, '#12507e');
      glow.addColorStop(1, '#061f33');
      context!.fillStyle = glow;
      context!.beginPath();
      context!.arc(cx, cy, radius, 0, Math.PI * 2);
      context!.fill();

      context!.fillStyle = 'rgba(248, 244, 236, 0.9)';
      for (let i = 0; i < land.length; i += 2) {
        const point = project(land[i]!, land[i + 1]!, radius, cx, cy);
        if (point.z <= 0) continue;
        const dot = (1 + point.z * 1.2) * Math.min(1.6, zoomRef.current);
        context!.globalAlpha = 0.22 + point.z * 0.7;
        context!.fillRect(point.x - dot / 2, point.y - dot / 2, dot, dot);
      }
      context!.globalAlpha = 1;

      // Travel and connection lines from the home city.
      if (home) {
        context!.lineWidth = 1.2;
        for (const marker of markers) {
          const points = arc(home, marker, radius, cx, cy);
          context!.beginPath();
          let drawing = false;
          for (const point of points) {
            if (point.z <= 0) {
              drawing = false;
              continue;
            }
            if (!drawing) context!.moveTo(point.x, point.y);
            else context!.lineTo(point.x, point.y);
            drawing = true;
          }
          context!.strokeStyle = 'rgba(212, 175, 83, 0.55)';
          context!.stroke();
        }
      }

      projected = [];
      const beat = reduceMotion ? 0.5 : (Math.sin(pulse) + 1) / 2;
      for (const marker of markers) {
        const point = project(marker.lat, marker.lng, radius, cx, cy);
        if (point.z <= 0.05) continue;
        projected.push({ x: point.x, y: point.y, marker });
        context!.fillStyle = `rgba(212, 175, 83, ${0.12 + beat * 0.2})`;
        context!.beginPath();
        context!.arc(point.x, point.y, (8 + beat * 6) * point.z, 0, Math.PI * 2);
        context!.fill();
        context!.fillStyle = '#f2d27a';
        context!.beginPath();
        context!.arc(point.x, point.y, 3.8, 0, Math.PI * 2);
        context!.fill();
      }

      context!.strokeStyle = 'rgba(212, 175, 83, 0.35)';
      context!.lineWidth = 1;
      context!.beginPath();
      context!.arc(cx, cy, radius, 0, Math.PI * 2);
      context!.stroke();
    }
    redrawRef.current = draw;

    const loop = () => {
      if (!dragging) rotation -= 0.07;
      pulse += 0.05;
      draw();
      if (visible) frame = requestAnimationFrame(loop);
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
      return projected.find((point) => Math.hypot(point.x - x, point.y - y) < 16)?.marker ?? null;
    };
    const setZoom = (value: number) => {
      zoomRef.current = Math.min(2.4, Math.max(0.8, value));
      draw();
    };
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        pinchStart = Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y);
        pinchZoom = zoomRef.current;
      }
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && pinchStart > 0) {
        const [p1, p2] = [...pointers.values()];
        setZoom(pinchZoom * (Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y) / pinchStart));
        moved = true;
        return;
      }
      if (dragging) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        rotation += dx * (0.35 / zoomRef.current);
        tilt = Math.max(-60, Math.min(60, tilt + dy * (0.25 / zoomRef.current)));
        lastX = event.clientX;
        lastY = event.clientY;
        if (reduceMotion) draw();
      }
      setHover(hit(event));
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      dragging = false;
      const marker = !moved ? hit(event) : null;
      if (marker) router.push(marker.href);
    };
    const onWheel = (event: WheelEvent) => {
      // Zoom only while the pointer is over the globe and ctrl/⌘ or a trackpad pinch is used,
      // so scrolling the page past the hero still works.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoomRef.current * (event.deltaY < 0 ? 1.08 : 0.92));
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
    };
  }, [markers, initialLng, router, home]);

  const zoomBy = (factor: number) => {
    zoomRef.current = Math.min(2.4, Math.max(0.8, zoomRef.current * factor));
    redrawRef.current();
  };
  const label = tone === 'dark' ? 'text-white/80' : 'text-acacia-700';

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="aspect-square w-full cursor-grab touch-none active:cursor-grabbing"
        role="img"
        aria-label={`Interactive globe showing ${markers.map((marker) => marker.label).join(', ')}`}
      />
      <div className="absolute bottom-10 right-1 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" className="h-9 w-9 rounded-full border border-white/30 bg-acacia-700/70 text-lg font-bold text-white backdrop-blur hover:bg-acacia-600">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" className="h-9 w-9 rounded-full border border-white/30 bg-acacia-700/70 text-lg font-bold text-white backdrop-blur hover:bg-acacia-600">−</button>
      </div>
      <p className={`pointer-events-none mt-2 text-center text-xs font-semibold ${label}`} aria-live="polite">
        {hover ? hover.label : markers.length ? 'Drag to turn · pinch or +/− to zoom · tap a gold marker' : 'Drag to turn · pinch or +/− to zoom'}
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

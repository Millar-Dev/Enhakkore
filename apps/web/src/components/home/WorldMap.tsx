'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Catalogue, CatalogueCountry } from '@/lib/public';
import { Globe } from './Globe';

/**
 * The hero's "situation room" globe — a real WebGL globe (MapLibre GL) that
 * turns into a flat street map as you zoom in.
 *
 * - Country outlines come from Natural Earth (public domain), served from this
 *   website, so the globe works without any map account.
 * - From country level down, a dark street map (© OpenStreetMap contributors,
 *   © CARTO) fades in, so cities and streets become visible.
 * - Drag to turn, pinch / wheel / +/− to zoom, arrow keys and +/− on the
 *   keyboard. Tap a gold marker or any country to fly there and open what
 *   Enhakkore has in that place; "World view" flies back out.
 * - As the hero background (`background`), the globe fills the whole hero and
 *   is framed to one side of the words. On phones one finger still scrolls the
 *   page (taps select places, pinch zooms); the full-screen button gives the
 *   map the whole screen with normal dragging. On computers, Ctrl/⌘ + scroll
 *   zooms so the page still scrolls.
 * - Without WebGL, the lighter canvas globe is shown instead.
 */

interface Target {
  kind: 'country' | 'city';
  name: string;
  country?: CatalogueCountry | null;
  citySlug?: string;
  total: number;
  counts?: CatalogueCountry['counts'];
  lat: number;
  lng: number;
}

const ALIASES: Record<string, string> = {
  'united states of america': 'united states',
  'dem. rep. congo': 'dr congo',
  'central african rep.': 'central african republic',
  'dominican rep.': 'dominican republic',
  "côte d'ivoire": 'ivory coast',
  's. sudan': 'south sudan',
  'eq. guinea': 'equatorial guinea',
  'bosnia and herz.': 'bosnia and herzegovina',
  'czechia': 'czech republic',
};
const norm = (value: string) => {
  const lower = value.toLowerCase().trim();
  return ALIASES[lower] ?? lower;
};

function boundsOf(geometry: GeoJSON.Geometry): [[number, number], [number, number]] | null {
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      const [x, y] = coords as [number, number];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    } else if (Array.isArray(coords)) coords.forEach(visit);
  };
  if ('coordinates' in geometry) visit(geometry.coordinates);
  if (minX > maxX) return null;
  // Countries that cross the date line (Russia, Fiji…) would span the world; keep them sensible.
  if (maxX - minX > 180) return null;
  return [[minX, minY], [maxX, maxY]];
}

/**
 * Outlines that cross the 180° meridian (Fiji, eastern Russia) jump from +180
 * to −180 and would be drawn as a thin band right round the globe. Keep each
 * such ring continuous by moving its western half past 180°.
 */
function unwrapAntimeridian(geometry: GeoJSON.Geometry) {
  const fixRing = (ring: number[][]) => {
    const lngs = ring.map((point) => point[0]!);
    if (Math.max(...lngs) - Math.min(...lngs) <= 180) return ring;
    return ring.map(([lng, lat]) => [lng! < 0 ? lng! + 360 : lng!, lat!]);
  };
  if (geometry.type === 'Polygon') geometry.coordinates = geometry.coordinates.map(fixRing);
  if (geometry.type === 'MultiPolygon') geometry.coordinates = geometry.coordinates.map((polygon) => polygon.map(fixRing));
}

/** Points along the great circle between two places, for the gold flight arcs. */
function arc(from: [number, number], to: [number, number], steps = 48): number[][] {
  const rad = Math.PI / 180;
  const [l1, p1] = [from[0] * rad, from[1] * rad];
  const [l2, p2] = [to[0] * rad, to[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-6) return [from, to];
  const points: number[][] = [];
  let lastLng = from[0];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    let lng = Math.atan2(y, x) / rad;
    // Keep the line continuous across 180°.
    while (lng - lastLng > 180) lng -= 360;
    while (lng - lastLng < -180) lng += 360;
    lastLng = lng;
    points.push([lng, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad]);
  }
  return points;
}

function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += 20) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 37 }, (_, i) => [lng, -90 + i * 5]) } });
  }
  for (let lat = -80; lat <= 80; lat += 20) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) } });
  }
  return { type: 'FeatureCollection', features };
}

/** Where the globe sits and how big it is, for the container's current size. */
function framing(element: HTMLElement, background: boolean) {
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (!background) return { padding: { top: 0, bottom: 0, left: 0, right: 0 }, zoom: width < 500 ? 0.3 : 1.1 };
  if (width >= 1024) {
    // Words on the left, globe on the right.
    const radius = Math.min(height * 0.46, width * 0.3);
    return { padding: { top: 0, bottom: 0, left: Math.round(width * 0.42), right: 0 }, zoom: Math.log2(radius / 81.5) };
  }
  // Phones and tablets: headline above, buttons below, the globe between them.
  const radius = Math.max(90, Math.min(width * 0.42, height * 0.23));
  return { padding: { top: 0, bottom: Math.round(height * 0.08), left: 0, right: 0 }, zoom: Math.log2(radius / 81.5) };
}

export function WorldMap({ catalogue, home, className = '', background = false }: { catalogue: Catalogue; home?: { lat: number; lng: number }; className?: string; background?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  // Where the globe sits, for the soft atmosphere glow drawn behind it.
  const [glow, setGlow] = useState<{ x: number; y: number; r: number } | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    const markers: Marker[] = [];
    let spin = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let interacting = false;

    const start = async () => {
      let maplibre: typeof import('maplibre-gl');
      try {
        maplibre = await import('maplibre-gl');
        const probe = document.createElement('canvas');
        if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('no webgl');
      } catch {
        if (!disposed) setFallback(true);
        return;
      }
      if (disposed) return;
      const [topojson, topo] = await Promise.all([import('topojson-client'), fetch('/media/globe/countries-110m.json').then((response) => response.json())]);
      if (disposed) return;
      const countries = topojson.feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
      const byName = new Map(catalogue.countries.map((country) => [norm(country.name), country]));
      countries.features.forEach((feature, index) => {
        const name = String(feature.properties?.name ?? '');
        const match = byName.get(norm(name));
        feature.id = index;
        if (feature.geometry && name !== 'Antarctica') unwrapAntimeridian(feature.geometry);
        feature.properties = { name, active: match && match.total > 0 ? 1 : 0 };
      });
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const touch = window.matchMedia('(pointer: coarse)').matches;

      const frame = framing(element, background);
      const placeGlow = () => {
        const f = framing(element, background);
        const w = element.clientWidth;
        const h = element.clientHeight;
        const r = 81.5 * 2 ** (map ? map.getZoom() : f.zoom);
        setGlow({ x: f.padding.left + (w - f.padding.left - f.padding.right) / 2, y: f.padding.top + (h - f.padding.top - f.padding.bottom) / 2, r });
      };
      // Gold arcs from home to every place with something on Enhakkore.
      const homeLngLat: [number, number] = [home?.lng ?? 39.28, home?.lat ?? -6.8];
      const destinations: [number, number][] = [];
      for (const country of catalogue.countries) {
        if (country.latitude !== null && country.longitude !== null && (country.total > 0 || country.featured)) destinations.push([country.longitude, country.latitude]);
        for (const city of country.cities) if (city.latitude != null && city.longitude != null) destinations.push([city.longitude, city.latitude]);
      }
      const arcs: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: destinations
          .filter(([lng, lat]) => Math.abs(lng - homeLngLat[0]) + Math.abs(lat - homeLngLat[1]) > 1.5)
          .map((to) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc(homeLngLat, to) } })),
      };
      try {
        map = new maplibre.Map({
          container: element,
          center: [home?.lng ?? 30, (home?.lat ?? 0) + 4],
          zoom: frame.zoom,
          minZoom: 0.2,
          maxZoom: 17,
          attributionControl: { compact: true },
          // Background on a phone: one finger scrolls the page, so no one-finger drag
          // (full screen turns it back on). Elsewhere: Ctrl/⌘ + scroll or two fingers.
          cooperativeGestures: background ? !touch : touch,
          dragPan: !(background && touch),
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          style: {
            version: 8,
            projection: { type: 'globe' },
            sources: {
              streets: {
                type: 'raster',
                tiles: ['a', 'b', 'c', 'd'].map((sub) => `https://${sub}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
                tileSize: 256,
                minzoom: 3,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a> · Natural Earth',
              },
              countries: { type: 'geojson', data: countries },
              graticule: { type: 'geojson', data: graticule() },
              arcs: { type: 'geojson', data: arcs },
            },
            layers: [
              { id: 'ocean', type: 'background', paint: { 'background-color': '#0a3a6e' } },
              { id: 'graticule', type: 'line', source: 'graticule', paint: { 'line-color': '#9fd3ff', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.12, 4, 0], 'line-width': 0.5 } },
              {
                id: 'land',
                type: 'fill',
                source: 'countries',
                paint: {
                  'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#f0cf86', ['==', ['get', 'active'], 1], '#d9b46a', '#a8895a'],
                  'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.95, 4, 0.85, 6, 0.15],
                },
              },
              { id: 'streets', type: 'raster', source: 'streets', minzoom: 3, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 5, 0.95] } },
              { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 0, '#7a5a26', 5, '#f3d48a'], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 0.9], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 1.4] } },
              // Gold flight arcs from home, with a soft glow underneath.
              { id: 'arcs-glow', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffd27a', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 5, 0], 'line-width': 5, 'line-blur': 4 } },
              { id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffd27a', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0], 'line-width': 1.4 } },
            ],
          },
        });
      } catch {
        if (!disposed) setFallback(true);
        return;
      }
      map.setPadding(frame.padding);
      mapRef.current = map;
      placeGlow();
      map.on('zoom', placeGlow);
      (window as unknown as { __enhMap?: MapLibreMap }).__enhMap = map;
      map.on('error', (event) => console.error('[map]', event.error?.message ?? event));
      map.addControl(new maplibre.NavigationControl({ showCompass: !touch, visualizePitch: false }), 'bottom-right');
      map.addControl(new maplibre.FullscreenControl(), 'bottom-right');
      if (background && touch) {
        const onFullscreen = () => {
          if (document.fullscreenElement) map?.dragPan.enable();
          else map?.dragPan.disable();
        };
        document.addEventListener('fullscreenchange', onFullscreen);
        map.on('remove', () => document.removeEventListener('fullscreenchange', onFullscreen));
      }
      const onResize = () => {
        if (!map) return;
        const next = framing(element, background);
        map.setPadding(next.padding);
        placeGlow();
      };
      window.addEventListener('resize', onResize);
      map.on('remove', () => window.removeEventListener('resize', onResize));

      const select = (next: Target, zoom?: number) => {
        setTarget(next);
        map!.flyTo({ center: [next.lng, next.lat], zoom: zoom ?? (next.kind === 'city' ? 10.5 : 4.6), speed: reduceMotion ? 3 : 0.9, curve: 1.6, essential: true });
      };

      // Markers: every country and city with something on Enhakkore.
      const addMarker = (lat: number, lng: number, label: string, size: 'lg' | 'sm', onClick: () => void) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `enh-marker enh-marker-${size}`;
        el.setAttribute('aria-label', label);
        el.innerHTML = `<span class="enh-marker-ring"></span><span class="enh-marker-dot"></span><span class="enh-marker-label">${label.replace(/</g, '&lt;')}</span>`;
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          onClick();
        });
        markers.push(new maplibre.Marker({ element: el }).setLngLat([lng, lat]).addTo(map!));
      };
      for (const country of catalogue.countries) {
        if (country.latitude === null || country.longitude === null || (country.total === 0 && !country.featured)) continue;
        addMarker(country.latitude, country.longitude, country.name, 'lg', () =>
          select({ kind: 'country', name: country.name, country, total: country.total, counts: country.counts, lat: country.latitude!, lng: country.longitude! }),
        );
        for (const city of country.cities) {
          if (city.latitude == null || city.longitude == null) continue;
          addMarker(city.latitude, city.longitude, city.name, 'sm', () =>
            select({ kind: 'city', name: city.name, country, citySlug: city.slug, total: city.total, counts: city.counts, lat: city.latitude!, lng: city.longitude! }),
          );
        }
      }

      let hovered: number | string | undefined;
      map.on('mousemove', 'land', (event) => {
        map!.getCanvas().style.cursor = 'pointer';
        const id = event.features?.[0]?.id;
        if (hovered !== undefined && hovered !== id) map!.setFeatureState({ source: 'countries', id: hovered }, { hover: false });
        if (id !== undefined) map!.setFeatureState({ source: 'countries', id }, { hover: true });
        hovered = id;
      });
      map.on('mouseleave', 'land', () => {
        map!.getCanvas().style.cursor = '';
        if (hovered !== undefined) map!.setFeatureState({ source: 'countries', id: hovered }, { hover: false });
        hovered = undefined;
      });
      map.on('click', 'land', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const name = String(feature.properties?.name ?? '');
        const country = byName.get(norm(name)) ?? null;
        const bounds = boundsOf(feature.geometry);
        const lat = country?.latitude ?? event.lngLat.lat;
        const lng = country?.longitude ?? event.lngLat.lng;
        setTarget({ kind: 'country', name: country?.name ?? name, country, total: country?.total ?? 0, counts: country?.counts, lat, lng });
        if (bounds) map!.fitBounds(bounds, { padding: 40, maxZoom: 6, speed: reduceMotion ? 3 : 0.9, essential: true });
        else map!.flyTo({ center: [lng, lat], zoom: 3.5, essential: true });
      });

      map.on('load', () => {
        if (!disposed) setReady(true);
      });

      // A slow turn until someone touches it; it resumes after a quiet spell at world view.
      const pause = () => {
        interacting = true;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          interacting = false;
        }, 15000);
      };
      map.on('mousedown', pause);
      map.on('touchstart', pause);
      map.on('wheel', pause);
      const turn = () => {
        if (!disposed && map && !interacting && !reduceMotion && map.getZoom() < 2.5 && !map.isMoving()) {
          const center = map.getCenter();
          map.setCenter([center.lng + 0.06, center.lat]);
        }
        spin = requestAnimationFrame(turn);
      };
      spin = requestAnimationFrame(turn);
    };

    // Load only when the hero is on screen.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void start();
      }
    });
    observer.observe(element);

    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(spin);
      if (idleTimer) clearTimeout(idleTimer);
      markers.forEach((marker) => marker.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [catalogue, home?.lat, home?.lng, background]);

  const worldView = () => {
    setTarget(null);
    const frame = container.current ? framing(container.current, background) : { zoom: 1.1 };
    mapRef.current?.flyTo({ center: [home?.lng ?? 30, (home?.lat ?? 0) + 4], zoom: frame.zoom, speed: 1.2, essential: true });
  };

  if (fallback) {
    const markers = catalogue.countries
      .filter((country) => (country.total > 0 || country.featured) && country.latitude !== null)
      .map((country) => ({ lat: country.latitude!, lng: country.longitude!, label: country.name, href: `/destinations/${country.slug}` }));
    if (!background) return <Globe markers={markers} home={home} tone="dark" />;
    return (
      <div className={`absolute inset-0 flex items-end justify-center overflow-hidden bg-[#04182a] lg:items-center lg:justify-end ${className}`}>
        <div className="w-[min(92vw,34rem)] translate-y-[18%] lg:mr-[6%] lg:translate-y-0">
          <Globe markers={markers} home={home} tone="dark" />
        </div>
      </div>
    );
  }

  const q = (extra: string) => (target?.citySlug ? `?city=${target.citySlug}${extra}` : target?.country ? `?country=${target.country.code}${extra}` : '');

  return (
    <div className={`enh-hud overflow-hidden bg-[#04182a] ${background ? 'enh-hud-bg absolute inset-0' : 'relative rounded-[1.4rem] border border-[#46c8ff]/25'} ${className}`}>
      {background && glow && glow.r < 900 && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: glow.x - glow.r * 1.35,
            top: glow.y - glow.r * 1.35,
            width: glow.r * 2.7,
            height: glow.r * 2.7,
            background: 'radial-gradient(circle, rgba(70,160,255,0.55) 0%, rgba(40,120,230,0.35) 36%, rgba(20,80,180,0.12) 52%, rgba(4,18,30,0) 70%)',
          }}
        />
      )}
      <div ref={container} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Interactive world map. Select a marker or a country to explore a place; zoom in to see streets." />
      {!background && (
        <div className="pointer-events-none absolute inset-0 z-[2] font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[#7fdcff]">
          <span className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-[#46c8ff]/70" />
          <span className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-[#46c8ff]/70" />
          <span className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-[#46c8ff]/70" />
          <span className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-[#46c8ff]/70" />
          {!target && ready && <p className="absolute bottom-4 left-5 max-w-[60%] normal-case tracking-normal text-white/70">Drag to turn · zoom in for streets · tap a gold marker</p>}
        </div>
      )}
      {!ready && <p className="pointer-events-none absolute inset-x-0 bottom-6 z-[2] text-center font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[#7fdcff]/70">Loading globe…</p>}
      {target && (
        <div className="absolute inset-x-3 bottom-3 z-[4] rounded-xl border border-[#e8c16a]/40 bg-[#04182a]/90 p-3 text-white shadow-2xl backdrop-blur md:left-auto md:right-14 md:w-72">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[#e8c16a]">Target · {target.kind}</p>
          <p className="mt-0.5 font-display text-xl leading-tight">{target.name}{target.kind === 'city' && target.country ? <span className="text-white/60">, {target.country.name}</span> : null}</p>
          <p className="mt-1 text-xs text-white/70">
            {target.total > 0 && target.counts
              ? [target.counts.trips && `${target.counts.trips} trip${target.counts.trips === 1 ? '' : 's'}`, target.counts.activities && `${target.counts.activities} activities`, target.counts.events && `${target.counts.events} events`, target.counts.places && `${target.counts.places} places`].filter(Boolean).join(' · ')
              : 'Nothing listed here yet — the map still works for exploring.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-bold">
            {target.country && (
              <Link href={target.citySlug ? `/destinations/${target.country.slug}/${target.citySlug}` : `/destinations/${target.country.slug}`} className="rounded-full bg-[#e8c16a] px-3 py-1.5 text-[#04182a]">
                Open {target.name}
              </Link>
            )}
            {target.country && <Link href={`/explore${q('')}`} className="rounded-full border border-white/30 px-3 py-1.5">Explore</Link>}
            {target.country && <Link href={`/experiences${q('')}`} className="rounded-full border border-white/30 px-3 py-1.5">Experiences</Link>}
            {target.country && <Link href={`/travel${q('')}`} className="rounded-full border border-white/30 px-3 py-1.5">Travel</Link>}
            <button type="button" onClick={worldView} className="rounded-full border border-white/30 px-3 py-1.5">↺ World view</button>
          </div>
        </div>
      )}
      {!target && ready && (
        <button type="button" onClick={worldView} aria-label="Back to the world view" title="World view" className={`absolute z-[4] inline-flex items-center justify-center border text-[#7fdcff] ${background ? 'right-[10px] bottom-[calc(16rem+12rem)] h-10 w-10 rounded-full border-white/25 bg-[#04182a]/85 text-white lg:bottom-[11rem] lg:h-[29px] lg:w-[29px]' : 'right-3 top-3 h-10 rounded-full border-[#46c8ff]/40 bg-[#04182a]/80 px-3 font-mono text-[0.625rem] uppercase tracking-[0.18em]'}`}>
          {background ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          ) : (
            '↺ World view'
          )}
        </button>
      )}
    </div>
  );
}

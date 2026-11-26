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
 * - On phones the hero map needs two fingers to move (so the page still
 *   scrolls); the full-screen button gives it the whole screen.
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

export function WorldMap({ catalogue, home, className = '' }: { catalogue: Catalogue; home?: { lat: number; lng: number }; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [readout, setReadout] = useState({ lat: home?.lat ?? 0, lng: home?.lng ?? 0, zoom: 1.4 });
  const [target, setTarget] = useState<Target | null>(null);

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
        feature.properties = { name, active: match && match.total > 0 ? 1 : 0 };
      });
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const touch = window.matchMedia('(pointer: coarse)').matches;

      try {
        map = new maplibre.Map({
          container: element,
          center: [home?.lng ?? 30, (home?.lat ?? 0) + 4],
          zoom: element.clientWidth < 500 ? 0.3 : 1.1,
          minZoom: 0.2,
          maxZoom: 17,
          attributionControl: { compact: true },
          cooperativeGestures: touch,
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
            },
            layers: [
              { id: 'ocean', type: 'background', paint: { 'background-color': '#04182a' } },
              { id: 'graticule', type: 'line', source: 'graticule', paint: { 'line-color': '#2aa7d8', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.18, 4, 0], 'line-width': 0.6 } },
              {
                id: 'land',
                type: 'fill',
                source: 'countries',
                paint: {
                  'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#1d5f8f', ['==', ['get', 'active'], 1], '#16456b', '#0d2e4b'],
                  'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.95, 4, 0.85, 6, 0.15],
                },
              },
              { id: 'streets', type: 'raster', source: 'streets', minzoom: 3, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 5, 0.95] } },
              { id: 'borders-glow', type: 'line', source: 'countries', paint: { 'line-color': '#46c8ff', 'line-opacity': 0.25, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 6, 5], 'line-blur': 3 } },
              { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': ['case', ['==', ['get', 'active'], 1], '#e8c16a', '#5fd0ff'], 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 6, 1.4] } },
            ],
          },
        });
      } catch {
        if (!disposed) setFallback(true);
        return;
      }
      mapRef.current = map;
      (window as unknown as { __enhMap?: MapLibreMap }).__enhMap = map;
      map.on('error', (event) => console.error('[map]', event.error?.message ?? event));
      map.addControl(new maplibre.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');
      map.addControl(new maplibre.FullscreenControl(), 'bottom-right');

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

      const updateReadout = () => {
        const center = map!.getCenter();
        setReadout({ lat: center.lat, lng: center.lng, zoom: map!.getZoom() });
      };
      map.on('move', updateReadout);
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
  }, [catalogue, home?.lat, home?.lng]);

  const worldView = () => {
    setTarget(null);
    mapRef.current?.flyTo({ center: [home?.lng ?? 30, (home?.lat ?? 0) + 4], zoom: (container.current?.clientWidth ?? 600) < 500 ? 0.3 : 1.1, speed: 1.2, essential: true });
  };

  if (fallback) {
    const markers = catalogue.countries
      .filter((country) => (country.total > 0 || country.featured) && country.latitude !== null)
      .map((country) => ({ lat: country.latitude!, lng: country.longitude!, label: country.name, href: `/destinations/${country.slug}` }));
    return <Globe markers={markers} home={home} tone="dark" />;
  }

  const fmt = (value: number, pos: string, neg: string) => `${Math.abs(value).toFixed(3)}° ${value >= 0 ? pos : neg}`;
  const q = (extra: string) => (target?.citySlug ? `?city=${target.citySlug}${extra}` : target?.country ? `?country=${target.country.code}${extra}` : '');

  return (
    <div className={`enh-hud relative overflow-hidden rounded-[1.4rem] border border-[#46c8ff]/25 bg-[#04182a] ${className}`}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Interactive world map. Drag to turn, zoom to see streets, select a marker to explore a place." />
      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-[2] font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[#7fdcff]">
        <span className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-[#46c8ff]/70" />
        <span className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-[#46c8ff]/70" />
        <span className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-[#46c8ff]/70" />
        <span className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-[#46c8ff]/70" />
        <div className="absolute left-5 top-4 space-y-0.5">
          <p className="text-[#e8c16a]">Enhakkore · Global view</p>
          <p>Lat {fmt(readout.lat, 'N', 'S')}</p>
          <p>Lng {fmt(readout.lng, 'E', 'W')}</p>
          <p>Zoom {readout.zoom.toFixed(1)} {readout.zoom > 4.5 ? '· street map' : '· globe'}</p>
        </div>
        {!target && ready && <p className="absolute bottom-4 left-5 max-w-[60%] normal-case tracking-normal text-white/70">Drag to turn · zoom in for streets · tap a gold marker</p>}
        {!ready && <p className="absolute inset-0 flex items-center justify-center text-[#7fdcff]/80">Initialising globe…</p>}
        <span className="enh-crosshair absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2" aria-hidden />
      </div>
      {target && (
        <div className="absolute inset-x-3 bottom-3 z-[3] rounded-xl border border-[#e8c16a]/40 bg-[#04182a]/90 p-3 text-white shadow-2xl backdrop-blur md:left-auto md:right-14 md:w-72">
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
        <button type="button" onClick={worldView} className="absolute right-3 top-3 z-[3] rounded-full border border-[#46c8ff]/40 bg-[#04182a]/80 px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[#7fdcff]">
          ↺ World view
        </button>
      )}
    </div>
  );
}

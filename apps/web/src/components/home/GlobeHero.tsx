'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { EXPERIENCE_SECTIONS, EXPERIENCE_SECTION_NAMES, IMPACT_SUBCATEGORIES, TRAVEL_SUBCATEGORIES, type GlobeCategoryKey } from '@enhakkore/shared';
import { api } from '@/lib/api';
import { Globe } from './Globe';

/**
 * The homepage hero: a real WebGL globe (MapLibre GL, globe projection) is the
 * whole background.
 *
 * - The Earth's surface is NASA imagery (Blue Marble with Black Marble city
 *   lights) served from this website as map tiles; from country level a dark
 *   street map (© OpenStreetMap, © CARTO) takes over, so you can zoom from
 *   the planet to a street.
 * - Normal state: headline and buttons over a slowly turning globe. Gold
 *   lights mark every published place on Enhakkore.
 * - Locate: the words fade away, the globe re-frames, and a category panel
 *   (side panel on computers, bottom sheet on phones) filters pins for every
 *   published activity, trip, place, tournament, community and Impact project.
 *   Selecting a pin flies there and shows a card with a link to the real page.
 *   Close (×, Esc) returns to the normal hero.
 * - Phones: in the normal state one finger scrolls the page (pinch still zooms);
 *   in Locate mode the globe can be dragged. Computers: drag to turn; in the
 *   normal state Ctrl/⌘ + scroll zooms so the page still scrolls, in Locate
 *   mode the wheel zooms.
 * - Without WebGL a simple animated globe is shown and Locate still lists
 *   everything.
 */

export interface GlobeItem {
  id: string;
  type: string;
  categories: string[];
  label: string;
  title: string;
  summary: string | null;
  href: string;
  image: string | null;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  startsAt: string | null;
  price: string | null;
  isDemo: boolean;
  group: 'EXPLORE' | 'EXPERIENCES' | 'TRAVEL' | 'IMPACT';
  sub: string;
}

/**
 * Locate's two levels: four groups, then each group's subcategories. A
 * subcategory with nothing on the map (volunteering, donations) links to its
 * page instead of showing an empty globe.
 */
const LEVELS: { key: GlobeItem['group']; label: string; icon: string; blurb: string; subs: { key: string; label: string; href?: string }[] }[] = [
  { key: 'EXPLORE', label: 'Explore', icon: 'attractions', blurb: 'Stays, food, venues and attractions', subs: [{ key: 'STAYS', label: 'Stays' }, { key: 'FOOD', label: 'Food & Dining' }, { key: 'VENUES', label: 'Venues' }, { key: 'ATTRACTIONS', label: 'Attractions' }] },
  { key: 'EXPERIENCES', label: 'Experiences', icon: 'experiences', blurb: 'Events, sports, gaming, culture and more', subs: EXPERIENCE_SECTIONS.map((section) => ({ key: section.key, label: EXPERIENCE_SECTION_NAMES[section.key] })) },
  { key: 'TRAVEL', label: 'Travel', icon: 'travel', blurb: 'Group trips, safaris, beach and beyond', subs: TRAVEL_SUBCATEGORIES.map((item) => ({ key: item.key, label: item.label, href: item.key === 'PRIVATE' ? '/private-trips' : undefined })) },
  {
    key: 'IMPACT',
    label: 'Impact',
    icon: 'impact',
    blurb: 'Community projects and WSC — We Save Children',
    subs: IMPACT_SUBCATEGORIES.map((item) => ({ key: item.key, label: item.label, href: item.key === 'VOLUNTEERING' ? '/impact#volunteer' : item.key === 'DONATIONS' ? '/donate' : item.key === 'STORIES' ? '/stories' : undefined })),
  },
];
const EXPERIENCE_PIN: Record<string, string> = { SPORTS: 'sports', GAMING: 'gaming', PARTIES: 'events', COMMUNITIES: 'communities' };
/** Pin colour and icon for an item. */
function pinKey(item: GlobeItem) {
  if (item.group === 'EXPLORE') return item.sub.toLowerCase();
  if (item.group === 'EXPERIENCES') return EXPERIENCE_PIN[item.sub] ?? 'experiences';
  return item.group.toLowerCase();
}

interface Props {
  hero: { eyebrow: string; title: string; subtitle: string; primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string };
  home: { lat: number; lng: number };
  categories: { key: GlobeCategoryKey; label: string; enabled: boolean }[];
  launch: { name: string; slug: string; flag: string; facts: string } | null;
}

/** Line icons and pin colours per category. */
const CATEGORY_STYLE: Record<string, { colour: string; d: string }> = {
  all: { colour: '#f5b544', d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  experiences: { colour: '#f5b544', d: 'm3 20 6.5-11 4 6 2.5-3.5L21 20Z M15.5 6.5a2 2 0 1 0 0-.01' },
  travel: { colour: '#fbbf24', d: 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z' },
  sports: { colour: '#38bdf8', d: 'M13 4.5a1.5 1.5 0 1 0 0-.01 M9 20l3-6-3-3 4-4 3 3h3 M6 12l3-3 M12 14l3 6' },
  gaming: { colour: '#2dd4bf', d: 'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3a4 4 0 0 0-4-3.7Z' },
  events: { colour: '#f59e0b', d: 'M4 6.5h16v13H4z M4 10.5h16 M8 3.5v4 M16 3.5v4' },
  food: { colour: '#f97316', d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' },
  stays: { colour: '#eab308', d: 'M2 18V6 M2 11h20v7 M2 15h20 M6 11V8h5v3' },
  venues: { colour: '#ec4899', d: 'M3 21h18 M5 21V10l7-6 7 6v11 M9 21v-6h6v6' },
  attractions: { colour: '#22c55e', d: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  communities: { colour: '#fbbf24', d: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8' },
  impact: { colour: '#fb7185', d: 'M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z' },
};
const styleFor = (key: string) => CATEGORY_STYLE[key] ?? CATEGORY_STYLE.all!;

function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Points along the great circle between two places, for the gold arcs. */
function arc(from: [number, number], to: [number, number], steps = 48): number[][] {
  const rad = Math.PI / 180;
  const [l1, p1] = [from[0] * rad, from[1] * rad];
  const [l2, p2] = [to[0] * rad, to[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-6) return [from, to];
  const points: number[][] = [];
  let last = from[0];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    let lng = Math.atan2(y, x) / rad;
    while (lng - last > 180) lng -= 360;
    while (lng - last < -180) lng += 360;
    last = lng;
    points.push([lng, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad]);
  }
  return points;
}

/**
 * Outlines that cross the 180° meridian (Fiji, eastern Russia) jump from +180
 * to −180 and would be drawn as a thin band right round the globe; keep each
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

type Mode = 'hero' | 'locate';

/** Where the globe sits and how large it is, for the hero size and the mode. */
function framing(width: number, height: number, mode: Mode, cardOpen: boolean) {
  const wide = width >= 1024;
  let padding = { top: 0, bottom: 0, left: 0, right: 0 };
  let radius: number;
  if (mode === 'hero') {
    if (wide) {
      padding.left = Math.round(width * 0.4);
      radius = Math.min(height * 0.46, width * 0.3);
    } else {
      // Large, up and to the right, behind the headline.
      padding = { top: 0, bottom: Math.round(height * 0.3), left: Math.round(width * 0.25), right: 0 };
      radius = Math.min(width * 0.6, height * 0.36);
    }
  } else if (wide) {
    padding = { top: 0, bottom: 0, left: 330, right: cardOpen ? 380 : 40 };
    radius = Math.min(height * 0.42, (width - padding.left - padding.right) * 0.42);
  } else {
    padding = { top: 0, bottom: Math.round(height * 0.52), left: 0, right: 0 };
    radius = Math.min(width * 0.4, height * 0.2);
  }
  return { padding, zoom: Math.log2(Math.max(radius, 60) / 81.5) };
}

const WHEN = [
  { key: 'any', label: 'Any time' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Next 3 months' },
] as const;

export function GlobeHero({ hero, home, launch }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<GlobeItem[]>([]);
  const [mode, setMode] = useState<Mode>('hero');
  const [level1, setLevel1] = useState<GlobeItem['group'] | ''>('');
  const [level2, setLevel2] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [when, setWhen] = useState<(typeof WHEN)[number]['key']>('any');
  const [selected, setSelected] = useState<{ group: GlobeItem[]; index: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const modeRef = useRef<Mode>('hero');
  modeRef.current = mode;

  const sentences = hero.title.split(/(?<=\.)\s+/);

  // Published content with a place on the map.
  useEffect(() => {
    api
      .get<{ items: GlobeItem[] }>('/public/globe')
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  const countries = useMemo(() => [...new Set(items.map((item) => item.country).filter(Boolean) as string[])].sort(), [items]);
  const cities = useMemo(() => [...new Set(items.filter((item) => !country || item.country === country).map((item) => item.city).filter(Boolean) as string[])].sort(), [items, country]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const limit = when === 'month' ? now + 31 * 864e5 : when === 'quarter' ? now + 92 * 864e5 : Infinity;
    return items.filter((item) => {
      if (level1 && item.group !== level1) return false;
      if (level2 && item.sub !== level2) return false;
      if (country && item.country !== country) return false;
      if (city && item.city !== city) return false;
      if (when !== 'any') {
        if (!item.startsAt) return false;
        const at = new Date(item.startsAt).getTime();
        if (at < now - 864e5 || at > limit) return false;
      }
      return true;
    });
  }, [items, level1, level2, country, city, when]);

  /** Items that share a spot become one pin with a count. */
  const groups = useMemo(() => {
    const map = new Map<string, GlobeItem[]>();
    for (const item of mode === 'locate' ? filtered : items) {
      const key = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.values()];
  }, [items, filtered, mode]);

  const reframe = useCallback((nextMode: Mode, cardOpen: boolean, animate = true) => {
    const map = mapRef.current;
    const element = wrapper.current;
    if (!map || !element) return;
    const frame = framing(element.clientWidth, element.clientHeight, nextMode, cardOpen);
    if (animate) map.easeTo({ padding: frame.padding, zoom: frame.zoom, duration: 900, essential: true });
    else {
      map.setPadding(frame.padding);
      map.setZoom(frame.zoom);
    }
  }, []);

  const select = useCallback(
    (group: GlobeItem[], index = 0) => {
      setSelected({ group, index });
      setSheetOpen(true);
      const map = mapRef.current;
      const element = wrapper.current;
      if (!map || !element) return;
      const item = group[index]!;
      const frame = framing(element.clientWidth, element.clientHeight, 'locate', true);
      map.flyTo({ center: [item.lng, item.lat], zoom: Math.max(frame.zoom, 3.2), padding: frame.padding, speed: 0.9, curve: 1.5, essential: true });
    },
    [],
  );

  const enterLocate = () => {
    setMode('locate');
    setSheetOpen(true);
    // Bring the whole globe into view (the header slides away on the way down).
    const top = (wrapper.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const exitLocate = useCallback(() => {
    setMode('hero');
    setSelected(null);
    const map = mapRef.current;
    const element = wrapper.current;
    if (map && element) {
      const frame = framing(element.clientWidth, element.clientHeight, 'hero', false);
      map.flyTo({ center: [home.lng, home.lat + 4], zoom: frame.zoom, padding: frame.padding, speed: 1.1, essential: true });
    }
  }, [home.lat, home.lng]);

  // Scrolling past the hero leaves Locate and restores the hero — Locate never traps the page.
  useEffect(() => {
    if (mode !== 'locate' || !wrapper.current) return;
    const element = wrapper.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.intersectionRatio < 0.35) exitLocate();
      },
      { threshold: [0, 0.35, 0.6] },
    );
    // Give the scroll that brings the globe into view time to finish first.
    const timer = window.setTimeout(() => observer.observe(element), 900);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [mode, exitLocate]);

  // Esc closes Locate.
  useEffect(() => {
    if (mode !== 'locate') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') (selected ? setSelected(null) : exitLocate());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selected, exitLocate]);

  // Create the map once.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    let spin = 0;
    let idle: ReturnType<typeof setTimeout> | null = null;
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
      maplibreRef.current = maplibre;
      const [topojson, topo] = await Promise.all([import('topojson-client'), fetch('/media/globe/countries-110m.json').then((response) => response.json())]);
      if (disposed) return;
      const countriesGeo = topojson.feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
      countriesGeo.features.forEach((feature, index) => {
        feature.id = index;
        if (feature.geometry && feature.properties?.name !== 'Antarctica') unwrapAntimeridian(feature.geometry);
      });
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const box = wrapper.current!;
      const frame = framing(box.clientWidth, box.clientHeight, 'hero', false);
      try {
        map = new maplibre.Map({
          container: element,
          center: [home.lng, home.lat + 4],
          zoom: frame.zoom,
          minZoom: 0.3,
          maxZoom: 17,
          attributionControl: false,
          cooperativeGestures: !touch,
          dragPan: !touch,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          style: {
            version: 8,
            projection: { type: 'globe' },
            sources: {
              earth: {
                type: 'raster',
                tiles: [`${window.location.origin}/media/globe/earth/{z}/{x}/{y}.jpg`],
                tileSize: 256,
                maxzoom: 3,
                attribution: 'Earth imagery: NASA Blue Marble &amp; Black Marble',
              },
              streets: {
                type: 'raster',
                tiles: ['a', 'b', 'c', 'd'].map((sub) => `https://${sub}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
                tileSize: 256,
                minzoom: 4,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
              },
              countries: { type: 'geojson', data: countriesGeo },
              arcs: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            },
            layers: [
              { id: 'space', type: 'background', paint: { 'background-color': '#020a14' } },
              { id: 'earth', type: 'raster', source: 'earth', paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 1, 6.5, 0], 'raster-fade-duration': 0, 'raster-brightness-min': 0.04, 'raster-contrast': 0.12, 'raster-saturation': 0.15 } },
              { id: 'streets', type: 'raster', source: 'streets', minzoom: 4, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 0.95] } },
              { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': '#f5c76a', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.12, 0.001] } },
              { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': '#f3d48a', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.12, 5, 0.5], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 1.2] } },
              { id: 'arcs-glow', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffd27a', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 5, 0], 'line-width': 5, 'line-blur': 4 } },
              { id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffd27a', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 5, 0], 'line-width': 1.2 } },
            ],
          },
        });
      } catch {
        if (!disposed) setFallback(true);
        return;
      }
      map.setPadding(frame.padding);
      mapRef.current = map;
      (window as unknown as { __enhMap?: MapLibreMap }).__enhMap = map;
      map.on('error', (event) => console.error('[map]', event.error?.message ?? event));
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      // Credits stay available but folded, out of the way of the headline.
      map.addControl(new maplibre.AttributionControl({ compact: true }), 'top-left');
      map.once('idle', () => {
        const attrib = element.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
        attrib?.classList.remove('maplibregl-compact-show');
        if (attrib) attrib.open = false;
      });
      map.on('load', () => !disposed && setReady(true));

      let hovered: number | string | undefined;
      map.on('mousemove', 'land', (event) => {
        const id = event.features?.[0]?.id;
        if (hovered !== undefined && hovered !== id) map!.setFeatureState({ source: 'countries', id: hovered }, { hover: false });
        if (id !== undefined) map!.setFeatureState({ source: 'countries', id }, { hover: true });
        hovered = id;
      });
      map.on('mouseleave', 'land', () => {
        if (hovered !== undefined) map!.setFeatureState({ source: 'countries', id: hovered }, { hover: false });
        hovered = undefined;
      });

      const pause = () => {
        interacting = true;
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => (interacting = false), 15000);
      };
      map.on('mousedown', pause);
      map.on('touchstart', pause);
      map.on('wheel', pause);
      const turn = () => {
        if (!disposed && map && !interacting && !reduceMotion && modeRef.current === 'hero' && map.getZoom() < 2.5 && !map.isMoving()) {
          const center = map.getCenter();
          map.setCenter([center.lng + 0.05, center.lat]);
        }
        spin = requestAnimationFrame(turn);
      };
      spin = requestAnimationFrame(turn);

      const onResize = () => {
        if (!map || !wrapper.current) return;
        map.setPadding(framing(wrapper.current.clientWidth, wrapper.current.clientHeight, modeRef.current, false).padding);
      };
      window.addEventListener('resize', onResize);
      map.on('remove', () => window.removeEventListener('resize', onResize));
    };

    // Load when the hero is on screen.
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
      if (idle) clearTimeout(idle);
      markersRef.current.forEach((marker) => marker.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [home.lat, home.lng]);

  // Gestures and framing follow the mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (mode === 'locate') {
      map.dragPan.enable();
      map.cooperativeGestures.disable();
      map.scrollZoom.enable();
    } else {
      if (touch) map.dragPan.disable();
      map.cooperativeGestures[touch ? 'disable' : 'enable']();
    }
    if (!selected) reframe(mode, false);
  }, [mode, ready, reframe, selected]);

  // Arcs from home to each place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('arcs') as { setData?: (data: GeoJSON.FeatureCollection) => void } | undefined;
    const seen = new Set<string>();
    const features: GeoJSON.Feature[] = [];
    for (const item of mode === 'locate' ? filtered : items) {
      const key = `${item.lat.toFixed(1)},${item.lng.toFixed(1)}`;
      if (seen.has(key) || Math.abs(item.lat - home.lat) + Math.abs(item.lng - home.lng) < 1.5) continue;
      seen.add(key);
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc([home.lng, home.lat], [item.lng, item.lat]) } });
    }
    source?.setData?.({ type: 'FeatureCollection', features });
  }, [items, filtered, mode, ready, home.lat, home.lng]);

  // Markers: soft gold lights normally; category pins in Locate.
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    for (const group of groups) {
      const first = group[0]!;
      const key = pinKey(first);
      const style = styleFor(key);
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', group.length > 1 ? `${group.length} listings in ${first.city ?? first.country ?? 'this place'}` : first.title);
      if (mode === 'locate') {
        el.className = 'enh-pin';
        el.style.setProperty('--pin', style.colour);
        el.innerHTML = `<span class="enh-pin-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${style.d}"/></svg></span>${group.length > 1 ? `<span class="enh-pin-count">${group.length}</span>` : ''}`;
      } else {
        el.className = 'enh-light';
      }
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        if (modeRef.current === 'hero') setMode('locate');
        select(group);
      });
      markersRef.current.push(new maplibre.Marker({ element: el, anchor: mode === 'locate' ? 'bottom' : 'center' }).setLngLat([first.lng, first.lat]).addTo(map));
    }
  }, [groups, mode, ready, select]);

  const current = selected ? selected.group[selected.index] : null;
  const activeLevel = LEVELS.find((item) => item.key === level1);
  const categoryLabel = activeLevel ? (activeLevel.subs.find((item) => item.key === level2)?.label ?? `All ${activeLevel.label}`) : 'Everything';

  const Card = current ? (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-ink shadow-2xl">
      <div className="relative aspect-[16/9] bg-acacia-700">
        {current.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-clay-400 px-2.5 py-0.5 text-[0.6875rem] font-bold text-acacia-700">{current.type}</span>
        {current.isDemo && <span className="absolute left-3 top-9 rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-[#4b2a8a]">Demo</span>}
        <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">✕</button>
      </div>
      <div className="p-4">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{current.label}</p>
        <h3 className="mt-0.5 text-[1.25rem] font-bold leading-tight text-acacia-700">{current.title}</h3>
        <ul className="mt-2 space-y-1 text-[0.875rem] text-ink-soft">
          {current.startsAt && <li>📅 {new Date(current.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' })}</li>}
          {(current.city || current.country) && <li>📍 {[current.city, current.country].filter(Boolean).join(', ')}</li>}
          {current.price && <li className="font-bold text-ink">💳 {current.price}</li>}
        </ul>
        {current.summary && <p className="mt-2 line-clamp-3 text-[0.8125rem] leading-relaxed text-ink-muted">{current.summary}</p>}
        <div className="mt-3 flex items-center gap-2">
          <Link href={current.href} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">View details →</Link>
          {selected && selected.group.length > 1 && (
            <>
              <button type="button" aria-label="Previous" disabled={selected.index === 0} onClick={() => setSelected({ ...selected, index: selected.index - 1 })} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40">‹</button>
              <span className="text-xs text-ink-muted">{selected.index + 1}/{selected.group.length}</span>
              <button type="button" aria-label="Next" disabled={selected.index === selected.group.length - 1} onClick={() => setSelected({ ...selected, index: selected.index + 1 })} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40">›</button>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const tile = 'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center text-[0.75rem] font-semibold leading-tight transition lg:min-h-12 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:py-1.5 lg:text-left lg:text-sm';
  const Categories = !activeLevel ? (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-1.5">
      {LEVELS.map((level) => {
        const style = styleFor(level.icon);
        const count = items.filter((row) => row.group === level.key).length;
        return (
          <button key={level.key} type="button" onClick={() => { setLevel1(level.key); setLevel2(''); setSelected(null); }} className={`${tile} border-white/10 bg-white/[0.04] text-white hover:border-clay-400/60`}>
            <span style={{ color: style.colour }}><Svg d={style.d} size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block">{level.label}</span>
              <span className="hidden text-[0.6875rem] font-normal text-white/55 lg:block">{level.blurb}</span>
            </span>
            <span className="text-[0.6875rem] text-white/45">{count}</span>
          </button>
        );
      })}
    </div>
  ) : (
    <div>
      <button type="button" onClick={() => { setLevel1(''); setLevel2(''); setSelected(null); }} className="mb-2 inline-flex min-h-10 items-center text-sm font-semibold text-clay-400">‹ All categories</button>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-1">
        <button type="button" aria-pressed={!level2} onClick={() => { setLevel2(''); setSelected(null); }} className={`${tile} ${!level2 ? 'border-clay-400 bg-clay-400 text-acacia-700' : 'border-white/10 bg-white/[0.04] text-white'}`}>
          <span className="min-w-0 flex-1">All {activeLevel.label}</span>
          <span className="text-[0.6875rem] opacity-60">{items.filter((row) => row.group === activeLevel.key).length}</span>
        </button>
        {activeLevel.subs.map((sub) => {
          const count = items.filter((row) => row.group === activeLevel.key && row.sub === sub.key).length;
          const on = level2 === sub.key;
          if (count === 0 && sub.href) {
            return (
              <Link key={sub.key} href={sub.href} className={`${tile} border-white/10 bg-white/[0.02] text-white/85 hover:border-clay-400/60`}>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{sub.label}</span>
                <span className="text-[0.6875rem] text-white/45">open ›</span>
              </Link>
            );
          }
          return (
            <button key={sub.key} type="button" aria-pressed={on} onClick={() => { setLevel2(sub.key); setSelected(null); }} className={`${tile} ${on ? 'border-clay-400 bg-clay-400 text-acacia-700' : 'border-white/10 bg-white/[0.04] text-white hover:border-clay-400/60'}`}>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{sub.label}</span>
              <span className={`text-[0.6875rem] ${on ? 'text-acacia-700/70' : 'text-white/45'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const Filters = (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-2 lg:[&>*:last-child]:col-span-2">
      <select value={country} onChange={(event) => { setCountry(event.target.value); setCity(''); setSelected(null); }} aria-label="Country" className="h-10 w-full min-w-0 rounded-full border border-white/20 bg-[#0d2240] px-3 text-sm text-white">
        <option value="">All countries</option>
        {countries.map((name) => <option key={name}>{name}</option>)}
      </select>
      <select value={city} onChange={(event) => { setCity(event.target.value); setSelected(null); }} aria-label="City" className="h-10 w-full min-w-0 rounded-full border border-white/20 bg-[#0d2240] px-3 text-sm text-white">
        <option value="">Any city</option>
        {cities.map((name) => <option key={name}>{name}</option>)}
      </select>
      <select value={when} onChange={(event) => { setWhen(event.target.value as typeof when); setSelected(null); }} aria-label="When" className="h-10 w-full min-w-0 rounded-full border border-white/20 bg-[#0d2240] px-3 text-sm text-white">
        {WHEN.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </div>
  );

  const Results = (
    <ul className="grid gap-2">
      {filtered.slice(0, 40).map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => select([item])} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left hover:border-clay-400/60">
            <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#0d2240]">
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="shrink-0 rounded-full bg-clay-400 px-1.5 text-[0.625rem] font-bold text-acacia-700">{item.type}</span>
                {item.isDemo && <span className="shrink-0 rounded-full bg-white/80 px-1.5 text-[0.625rem] font-bold text-[#4b2a8a]">Demo</span>}
              </span>
              <span className="block truncate text-xs text-white/60">
                {[item.startsAt ? new Date(item.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Dar_es_Salaam' }) : null, item.city ?? item.country].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="text-white/40" aria-hidden>›</span>
          </button>
        </li>
      ))}
      {filtered.length === 0 && <li className="rounded-xl border border-white/10 p-4 text-sm text-white/65">Nothing published here yet for this choice. Try another category or place.</li>}
    </ul>
  );

  return (
    <section ref={wrapper} className="band-hero relative isolate flex min-h-[max(36rem,calc(100svh-7.25rem))] overflow-hidden text-white md:min-h-[max(38rem,calc(100svh-4.5rem))] lg:min-h-[max(36rem,min(calc(100svh-4.5rem),58rem))]" aria-label="Enhakkore around the world">
      {/* Atmosphere glow behind the globe */}
      <div aria-hidden className={`enh-atmosphere ${mode === 'locate' ? 'enh-atmosphere-locate' : ''}`} />
      {fallback ? (
        <div className="absolute inset-0 flex items-start justify-end overflow-hidden lg:items-center">
          <div className="w-[min(110vw,40rem)] translate-x-[18%] lg:mr-[4%] lg:translate-x-0">
            <Globe markers={items.map((item) => ({ lat: item.lat, lng: item.lng, label: item.title, href: item.href }))} home={home} tone="dark" />
          </div>
        </div>
      ) : (
        <div ref={container} className="enh-globe" style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Interactive globe. Choose Locate to explore what is on around the world." />
      )}

      {/* Shading so words stay readable; lighter in Locate mode. */}
      <div aria-hidden className={`pointer-events-none absolute inset-0 z-[1] transition-opacity duration-500 ${mode === 'locate' ? 'opacity-0' : 'opacity-100'} bg-[linear-gradient(180deg,rgba(2,10,20,0.35)_0%,rgba(2,10,20,0)_30%,rgba(2,10,20,0.6)_62%,rgba(2,10,20,0.96)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,10,20,0.92)_0%,rgba(2,10,20,0.6)_34%,rgba(2,10,20,0)_58%)]`} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-gradient-to-t from-[#06172b] to-transparent" />

      {/* Normal hero: words and actions. */}
      <div className={`shell pointer-events-none relative z-[3] flex w-full flex-col justify-end py-7 transition-all duration-500 md:py-10 lg:justify-center ${mode === 'locate' ? 'translate-y-4 opacity-0' : 'opacity-100'}`} aria-hidden={mode === 'locate'}>
        <div className="max-w-xl [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.22em] text-white/80 md:text-xs">{hero.eyebrow}</p>
          <h1 className="mt-2 font-display text-[clamp(2.1rem,9vw,4.6rem)] leading-[1.02]">
            {sentences.map((sentence, index) => (
              <span key={sentence + index} className={`block ${sentences.length > 1 && index === sentences.length - 1 ? 'text-clay-400' : ''}`}>{sentence}</span>
            ))}
          </h1>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-snug text-white/85 md:text-lg md:leading-relaxed">{hero.subtitle}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link href={hero.primaryHref} tabIndex={mode === 'locate' ? -1 : undefined} className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700 shadow-lg transition hover:bg-clay-500 hover:text-white">{hero.primaryLabel} →</Link>
            <button type="button" onClick={enterLocate} tabIndex={mode === 'locate' ? -1 : undefined} className="inline-flex h-12 items-center gap-2 rounded-full border border-clay-400/80 bg-[#04121e]/40 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10">
              <Svg d="M12 3v3M12 18v3M3 12h3M18 12h3 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" size={18} /> Locate
            </button>
            <Link href={hero.secondaryHref} tabIndex={mode === 'locate' ? -1 : undefined} className="hidden h-12 items-center rounded-full px-3 text-sm font-semibold text-white/85 underline-offset-4 hover:underline sm:inline-flex">{hero.secondaryLabel}</Link>
          </div>
          {launch && (
            <Link href={`/destinations/${launch.slug}`} tabIndex={mode === 'locate' ? -1 : undefined} className="mt-4 inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-[#04121e]/50 py-1 pl-1 pr-4 text-left backdrop-blur hover:border-clay-400">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg" aria-hidden>{launch.flag || '📍'}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{launch.name}</span>
                <span className="block truncate text-[0.6875rem] text-white/65">{launch.facts || 'See what is on'}</span>
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Locate mode */}
      {mode === 'locate' && (
        <>
          <button type="button" onClick={exitLocate} className="absolute right-3 top-3 z-[6] inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-[#04121e]/85 px-4 text-sm font-semibold backdrop-blur hover:border-clay-400 lg:right-6 lg:top-6" aria-label="Close Locate and return to the homepage">
            ✕ <span className="hidden sm:inline">Close</span>
          </button>

          {/* Computers: side panel and card */}
          <aside className="enh-fade-in absolute bottom-6 left-6 top-6 z-[5] hidden w-[18.5rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#06172b]/90 backdrop-blur-xl lg:flex" aria-label="Locate and explore">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-bold">Locate &amp; Explore</p>
              <span className="text-xs text-white/55">{filtered.length} shown</span>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto p-3">
              {Categories}
              <div className="mt-3">{Filters}</div>
              <p className="mt-3 text-xs font-semibold text-white/70">Showing: <span className="text-clay-400">{categoryLabel}</span></p>
              <div className="mt-2">{Results}</div>
            </div>
          </aside>
          {current && <div className="enh-fade-in absolute right-16 top-20 z-[5] hidden w-[21rem] lg:block">{Card}</div>}

          {/* Phones and tablets: bottom sheet */}
          <div className={`enh-sheet absolute inset-x-0 bottom-0 z-[5] flex max-h-[58%] flex-col rounded-t-3xl border-t border-white/10 bg-[#06172b]/95 backdrop-blur-xl transition-transform duration-300 lg:hidden ${sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.25rem)]'}`}>
            <button type="button" onClick={() => setSheetOpen((value) => !value)} className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1" aria-expanded={sheetOpen} aria-label={sheetOpen ? 'Lower the panel' : 'Raise the panel'}>
              <span className="h-1 w-10 rounded-full bg-white/40" aria-hidden />
              <span className="text-sm font-bold">{current ? current.title : 'Locate & Explore'}</span>
            </button>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
              {current ? (
                <>
                  <button type="button" onClick={() => setSelected(null)} className="mb-2 inline-flex min-h-10 items-center text-sm font-semibold text-clay-400">‹ Back to the list</button>
                  {Card}
                </>
              ) : (
                <>
                  {Categories}
                  <p className="mt-3 text-xs font-semibold text-white/70">Showing: <span className="text-clay-400">{categoryLabel}</span> · {filtered.length}</p>
                  <div className="mt-2">{Filters}</div>
                  <div className="mt-3">{Results}</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {!ready && !fallback && <p className="pointer-events-none absolute inset-x-0 top-6 z-[2] text-center text-[0.625rem] uppercase tracking-[0.2em] text-white/50">Loading globe…</p>}
    </section>
  );
}

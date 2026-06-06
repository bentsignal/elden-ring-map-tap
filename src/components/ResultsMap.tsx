import { useEffect, useRef, useState } from "react";
import type { DivIcon, LayerGroup, Map as LeafletMap } from "leaflet";
import { MAP_HEIGHT, MAP_WIDTH } from "../game/config";
import type { Grace, Point, RoundResult } from "../game/types";
import { addProgressiveMapOverlay } from "./mapOverlay";

interface ResultsMapProps {
  daily: Grace[];
  results: RoundResult[];
}

const toLatLng = (p: Point): [number, number] => [(1 - p.y) * MAP_HEIGHT, p.x * MAP_WIDTH];

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function ResultsMap({ daily, results }: ResultsMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !elRef.current) return;
      LRef.current = L;

      const bounds: [[number, number], [number, number]] = [
        [0, 0],
        [MAP_HEIGHT, MAP_WIDTH],
      ];
      const map = L.map(elRef.current, {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 2,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.25,
        maxBoundsViscosity: 1,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      addProgressiveMapOverlay(L, map, bounds);
      map.setMaxBounds(bounds);
      map.fitBounds(bounds);
      map.setMinZoom(map.getBoundsZoom(bounds));

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    layerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const guessIcon = (index: number): DivIcon =>
      L.divIcon({
        className: "",
        html: `<div class="er-review-guess"><span>${index + 1}</span></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
    const actualIcon = (index: number): DivIcon =>
      L.divIcon({
        className: "",
        html: `<div class="er-review-actual"><span>${index + 1}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

    const points: [number, number][] = [];

    results.forEach((result, index) => {
      const grace = daily[index];
      if (!grace) return;

      const actual = { x: grace.x, y: grace.y };
      const guessLatLng = toLatLng(result.guess);
      const actualLatLng = toLatLng(actual);
      points.push(guessLatLng, actualLatLng);

      L.polyline([guessLatLng, actualLatLng], {
        color: "#ecd08a",
        weight: 2,
        dashArray: "7 7",
        opacity: 0.78,
      }).addTo(layer);

      L.marker(guessLatLng, { icon: guessIcon(index), keyboard: false })
        .bindTooltip(`${ordinal(index + 1)} guess`, {
          direction: "bottom",
          className: "er-review-tip er-review-tip-guess",
          offset: [0, 12],
        })
        .addTo(layer);

      L.marker(actualLatLng, { icon: actualIcon(index), keyboard: false })
        .bindTooltip(grace.name, {
          permanent: true,
          direction: "top",
          className: "er-review-tip er-review-tip-actual",
          offset: [0, -14],
        })
        .addTo(layer);
    });

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.18), { animate: false });
    }
  }, [daily, ready, results]);

  return <div ref={elRef} className="h-full w-full" />;
}

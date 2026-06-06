import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import { MAP_HEIGHT, MAP_WIDTH } from "../game/config";
import type { Point } from "../game/types";
import { addProgressiveMapOverlay } from "./mapOverlay";

interface MapBoardProps {
  /** the answer to reveal (line + grace marker); null while guessing */
  actual: Point | null;
  /** the player's current guess marker */
  guess: Point | null;
  /** called with normalized coords when the map is clicked (guessing only) */
  onPick: (p: Point) => void;
  /** allow clicks to set a guess */
  interactive: boolean;
  /** optional caption shown on the revealed grace */
  actualLabel?: string;
  /** changes when the map should return to the full-map view */
  resetViewKey?: string | number;
}

// normalized (x,y in 0..1) <-> Leaflet CRS.Simple latlng (lat=y-up, lng=x)
const toLatLng = (p: Point): [number, number] => [(1 - p.y) * MAP_HEIGHT, p.x * MAP_WIDTH];

export function MapBoard({ actual, guess, onPick, interactive, actualLabel, resetViewKey }: MapBoardProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const guessMarkerRef = useRef<Marker | null>(null);
  const actualMarkerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const onPickRef = useRef(onPick);
  const interactiveRef = useRef(interactive);
  const [ready, setReady] = useState(false);

  onPickRef.current = onPick;
  interactiveRef.current = interactive;

  // init map once (client-side only)
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
      // Put +/- in the bottom-left so it clears the logo; hidden on touch via CSS.
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      addProgressiveMapOverlay(L, map, bounds);
      map.setMaxBounds(bounds);
      map.fitBounds(bounds);
      map.setMinZoom(map.getBoundsZoom(bounds));

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        if (!interactiveRef.current) return;
        onPickRef.current({
          x: e.latlng.lng / MAP_WIDTH,
          y: 1 - e.latlng.lat / MAP_HEIGHT,
        });
      });

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
    if (!L || !map || !ready || resetViewKey === undefined) return;

    const bounds: [[number, number], [number, number]] = [
      [0, 0],
      [MAP_HEIGHT, MAP_WIDTH],
    ];
    map.fitBounds(bounds, { animate: false });
  }, [ready, resetViewKey]);

  // guess marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    if (!guess) {
      guessMarkerRef.current?.remove();
      guessMarkerRef.current = null;
      return;
    }
    const icon = L.divIcon({
      className: "",
      html: `<div class="er-pin"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    if (!guessMarkerRef.current) {
      guessMarkerRef.current = L.marker(toLatLng(guess), { icon, keyboard: false }).addTo(map);
    } else {
      guessMarkerRef.current.setLatLng(toLatLng(guess));
    }
  }, [guess, ready]);

  // reveal: actual grace + connecting line, fit both into view
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    actualMarkerRef.current?.remove();
    lineRef.current?.remove();
    actualMarkerRef.current = null;
    lineRef.current = null;
    if (!actual) return;

    const icon = L.divIcon({
      className: "",
      html: `<div class="er-grace"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const m = L.marker(toLatLng(actual), { icon, keyboard: false }).addTo(map);
    if (actualLabel) {
      m.bindTooltip(actualLabel, { permanent: true, direction: "top", className: "er-tip", offset: [0, -12] });
    }
    actualMarkerRef.current = m;

    if (guess) {
      lineRef.current = L.polyline([toLatLng(guess), toLatLng(actual)], {
        color: "#e8c061",
        weight: 2,
        dashArray: "6 6",
        opacity: 0.9,
      }).addTo(map);
      map.fitBounds(L.latLngBounds([toLatLng(guess), toLatLng(actual)]).pad(0.45));
    } else {
      map.panTo(toLatLng(actual));
    }
  }, [actual, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={elRef} className="h-full w-full" />;
}

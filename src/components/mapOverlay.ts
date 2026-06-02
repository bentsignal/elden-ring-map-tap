import type { ImageOverlay, Map as LeafletMap } from "leaflet";
import { MAP_IMAGES } from "../game/config";

type Leaflet = typeof import("leaflet");
type Bounds = [[number, number], [number, number]];

function mapImagesForDevice(): string[] {
  const isTouchDevice =
    navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;

  return isTouchDevice ? MAP_IMAGES.slice(0, 2) : MAP_IMAGES;
}

export function addProgressiveMapOverlay(L: Leaflet, map: LeafletMap, bounds: Bounds): ImageOverlay {
  const [firstImage, ...remainingImages] = mapImagesForDevice();
  const firstOverlay = L.imageOverlay(firstImage, bounds).addTo(map);
  let activeOverlay = firstOverlay;

  const loadNext = (index: number) => {
    const image = remainingImages[index];
    if (!image) return;

    const nextOverlay = L.imageOverlay(image, bounds, { opacity: 0 });

    nextOverlay.once("load", () => {
      const previousOverlay = activeOverlay;
      activeOverlay = nextOverlay;
      nextOverlay.setOpacity(1);
      previousOverlay.remove();
      loadNext(index + 1);
    });
    nextOverlay.addTo(map);
  };

  firstOverlay.once("load", () => loadNext(0));

  return firstOverlay;
}

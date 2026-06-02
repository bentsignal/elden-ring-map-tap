# Elden Ring Grace Guesser

A daily wordle-style geography game for Elden Ring. Each day you get **five
Sites of Grace**; tap where you think each one sits on the map of the Lands Between,
and score by how close you land. Share your result with friends.

Inspired by [maptap.gg](https://maptap.gg).

## How to play

- **Five rounds, rising stakes.** Scores are quality 0–100 per round, multiplied
  `×1, ×1, ×2, ×3, ×3` → **1000 max**.
- **The hints fade.** Rounds 1–3 reveal the grace's region; rounds 4–5 give only the
  name.
- The map is the above-ground only — no DLC, no underground (river wells etc).

  ```
  Elden Ring Grace Guesser · May 22
  95👑  88👑  80👑  87👑  25🩸
  Runes: 679/1000
  💍 www.grace-guesser.com
  ```

## Graces

`src/data/graces.json` holds **267 above-ground graces** with `{ id, name, region,
x, y }`, where `x`/`y` are normalized `0..1` over the full-resolution Lands
Between map.

It is generated from a MapGenie-derived dump (`data-src/site-of-grace.ts`, from the
MIT-licensed [richiexuetang/interactive-game-maps](https://github.com/richiexuetang/interactive-game-maps))
by `scripts/build-graces.mjs`, which:

1. keeps only `mapSlug: "the-lands-between"` (drops the Shadow of the Erdtree DLC);
2. drops the open-world **underground** (`lat < 0.5`: Siofra, Ainsel, Nokron,
   Deeproot, Lake of Rot, …) and **Crumbling Farum Azula** (`lng > -0.55`);
3. assigns each grace a region via nearest labeled-anchor (KNN);
4. projects MapGenie lat/lng → normalized map pixels with a calibrated 6-param
   affine (fitted in `scripts/fit.mjs`, verified with `scripts/overlay.mjs`).

The map uses ERDB's `lod_0.jpeg` (9728×9216) as its coordinate space. The app
loads `public/map/lands-between-preview.jpg` first, then progressively swaps in
externally hosted higher-resolution map images as they finish loading. The 18 MB
original and large raw dumps are git-ignored under `data-src/` (re-downloadable;
see script headers).

To rebuild the data: `node scripts/build-graces.mjs`.

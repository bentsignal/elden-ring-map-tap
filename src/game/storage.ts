import { ROUND_COUNT } from "./config";
import type { Point, RoundResult } from "./types";

export type PersistedPhase = "playing" | "done";

export interface PersistedGame {
  version: 1;
  dateKey: string;
  phase: PersistedPhase;
  roundIndex: number;
  results: RoundResult[];
  guess: Point | null;
  revealed: boolean;
}

const STORAGE_PREFIX = "er-grace-guesser:";

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    point.x >= 0 &&
    point.x <= 1 &&
    typeof point.y === "number" &&
    Number.isFinite(point.y) &&
    point.y >= 0 &&
    point.y <= 1
  );
}

function isRoundResult(value: unknown): value is RoundResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    isPoint(result.guess) &&
    typeof result.distance === "number" &&
    Number.isFinite(result.distance) &&
    typeof result.baseScore === "number" &&
    Number.isFinite(result.baseScore) &&
    typeof result.roundScore === "number" &&
    Number.isFinite(result.roundScore)
  );
}

export function parsePersistedGame(value: unknown, dateKey: string): PersistedGame | null {
  if (!value || typeof value !== "object") return null;
  const game = value as Record<string, unknown>;
  if (game.version !== 1 || game.dateKey !== dateKey) return null;
  if (game.phase !== "playing" && game.phase !== "done") return null;
  if (!Array.isArray(game.results) || !game.results.every(isRoundResult)) return null;
  if (typeof game.roundIndex !== "number" || !Number.isInteger(game.roundIndex)) return null;
  if (game.roundIndex < 0 || game.roundIndex >= ROUND_COUNT) return null;
  if (game.guess !== null && !isPoint(game.guess)) return null;
  if (typeof game.revealed !== "boolean") return null;

  if (game.phase === "done") {
    if (game.results.length !== ROUND_COUNT) return null;
    return {
      version: 1,
      dateKey,
      phase: "done",
      roundIndex: ROUND_COUNT - 1,
      results: game.results,
      guess: null,
      revealed: false,
    };
  }

  if (game.results.length > game.roundIndex + 1) return null;
  if (game.revealed) {
    if (game.results.length !== game.roundIndex + 1) return null;
    return {
      version: 1,
      dateKey,
      phase: "playing",
      roundIndex: game.roundIndex,
      results: game.results,
      guess: game.results[game.roundIndex]?.guess ?? null,
      revealed: true,
    };
  }

  if (game.results.length !== game.roundIndex) return null;
  return {
    version: 1,
    dateKey,
    phase: "playing",
    roundIndex: game.roundIndex,
    results: game.results,
    guess: game.guess,
    revealed: false,
  };
}

export function loadPersistedGame(dateKey: string): PersistedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + dateKey);
    if (!raw) return null;
    return parsePersistedGame(JSON.parse(raw) as unknown, dateKey);
  } catch {
    return null;
  }
}

export function savePersistedGame(game: PersistedGame): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + game.dateKey, JSON.stringify(game));
  } catch {
    /* ignore quota / privacy mode */
  }
}

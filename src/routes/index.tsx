"use client";

import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapBoard } from "../components/MapBoard";
import { SoulsVerdict } from "../components/SoulsVerdict";
import { dateLabel, resetCountdownLabel, selectDaily, todayKey } from "../game/daily";
import { scoreRound, totalScore } from "../game/scoring";
import { buildShareText, emojiFor, tierFor } from "../game/share";
import { loadPersistedGame, savePersistedGame } from "../game/storage";
import { MAX_SCORE, ROUNDS, ROUND_COUNT } from "../game/config";
import type { Grace, Point, RoundResult } from "../game/types";
import type { PersistedGame } from "../game/storage";

export const Route = createFileRoute("/")({ component: Home });

type Phase = "intro" | "playing" | "done";

interface GameState {
  dateKey: string;
  phase: Phase;
  roundIndex: number;
  results: RoundResult[];
  guess: Point | null;
  revealed: boolean;
}

function introGame(dateKey: string): GameState {
  return {
    dateKey,
    phase: "intro",
    roundIndex: 0,
    results: [],
    guess: null,
    revealed: false,
  };
}

function gameFromPersisted(saved: PersistedGame | null, dateKey: string): GameState {
  if (!saved) return introGame(dateKey);
  return {
    dateKey,
    phase: saved.phase,
    roundIndex: saved.roundIndex,
    results: saved.results,
    guess: saved.guess,
    revealed: saved.revealed,
  };
}

function persistableGame(game: GameState): PersistedGame | null {
  if (game.phase === "intro") return null;
  return {
    version: 1,
    dateKey: game.dateKey,
    phase: game.results.length === ROUND_COUNT ? "done" : game.phase,
    roundIndex: game.results.length === ROUND_COUNT ? ROUND_COUNT - 1 : game.roundIndex,
    results: game.results,
    guess: game.revealed ? game.results[game.roundIndex]?.guess ?? game.guess : game.guess,
    revealed: game.results.length === ROUND_COUNT ? false : game.revealed,
  };
}

function initialGame(): GameState | null {
  if (typeof window === "undefined") return null;
  const key = todayKey();
  return gameFromPersisted(loadPersistedGame(key), key);
}

function AppTitle({ className = "" }: { className?: string }) {
  return (
    <span className={`block leading-tight ${className}`}>
      <span className="block">Elden Ring</span>
      <span className="block">Grace Guesser</span>
    </span>
  );
}

function Home() {
  const [game, setGame] = useState<GameState | null>(() => initialGame());

  const dateKey = game?.dateKey ?? "";
  const phase = game?.phase ?? "intro";
  const roundIndex = game?.roundIndex ?? 0;
  const results = game?.results ?? [];
  const guess = game?.guess ?? null;
  const revealed = game?.revealed ?? false;

  const daily: Grace[] = useMemo(
    () => (dateKey ? selectDaily(dateKey) : []),
    [dateKey]
  );

  const commitGame = useCallback((nextGame: GameState) => {
    const savedGame = persistableGame(nextGame);
    if (savedGame) savePersistedGame(savedGame);
    setGame(nextGame);
  }, []);

  useEffect(() => {
    const syncDate = () => {
      const key = todayKey();
      setGame((currentGame) => {
        if (currentGame?.dateKey === key) return currentGame;
        return gameFromPersisted(loadPersistedGame(key), key);
      });
    };

    setGame((currentGame) => {
      const key = todayKey();
      return currentGame?.dateKey === key
        ? currentGame
        : gameFromPersisted(loadPersistedGame(key), key);
    });
    const id = window.setInterval(syncDate, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const current = daily[roundIndex];
  const roundCfg = ROUNDS[roundIndex];
  const runningTotal = totalScore(results);

  const onPick = useCallback((p: Point) => {
    if (!game || game.phase !== "playing" || game.revealed) return;
    commitGame({ ...game, guess: p });
  }, [commitGame, game]);

  const submit = useCallback(() => {
    if (!game?.guess || !current || game.revealed) return;
    const r = scoreRound(game.guess, { x: current.x, y: current.y }, game.roundIndex);
    const nextResults = [...game.results, r];
    commitGame({
      ...game,
      phase: "playing",
      roundIndex: game.roundIndex,
      results: nextResults,
      guess: game.guess,
      revealed: true,
    });
  }, [commitGame, current, game]);

  const next = useCallback(() => {
    if (!game) return;
    if (game.roundIndex + 1 < ROUND_COUNT) {
      commitGame({
        ...game,
        roundIndex: game.roundIndex + 1,
        guess: null,
        revealed: false,
      });
      return;
    }
    commitGame({
      ...game,
      phase: "done",
      roundIndex: ROUND_COUNT - 1,
      guess: null,
      revealed: false,
    });
  }, [commitGame, game]);

  const begin = useCallback(() => {
    if (!dateKey) return;
    commitGame({
      dateKey,
      phase: "playing",
      roundIndex: 0,
      results: [],
      guess: null,
      revealed: false,
    });
  }, [commitGame, dateKey]);

  if (!game) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--er-bg)]">
        <p className="font-display er-title text-center text-2xl">
          <AppTitle />
        </p>
      </div>
    );
  }

  const lastResult = revealed ? results[results.length - 1] : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--er-bg)]">
      {/* The map fills the screen */}
      <div className="absolute inset-0">
        {phase === "playing" && current ? (
          <MapBoard
            actual={revealed ? { x: current.x, y: current.y } : null}
            guess={guess}
            onPick={onPick}
            interactive={!revealed}
            actualLabel={revealed ? current.name : undefined}
          />
        ) : (
          <MapBoard
            actual={null}
            guess={null}
            onPick={() => {}}
            interactive={false}
          />
        )}
      </div>

      {/* Souls-style splash for an extreme guess (replays each round via key) */}
      {phase === "playing" && lastResult && (
        <SoulsVerdict key={roundIndex} score={lastResult.baseScore} />
      )}

      {/* Top bar */}
      <Header
        dateKey={dateKey}
        phase={phase}
        roundIndex={roundIndex}
        runningTotal={runningTotal}
      />

      {/* Bottom control panel during play */}
      {phase === "playing" && current && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center p-3 sm:p-5">
          <div className="er-panel pointer-events-auto w-full max-w-2xl rounded-lg p-4 sm:p-5">
            {!revealed ? (
              <GuessPanel
                grace={current}
                roundCfg={roundCfg}
                hasGuess={!!guess}
                onSubmit={submit}
              />
            ) : (
              lastResult && (
                <RevealPanel
                  grace={current}
                  result={lastResult}
                  isLast={roundIndex + 1 === ROUND_COUNT}
                  onNext={next}
                />
              )
            )}
          </div>
        </div>
      )}

      {phase === "intro" && <IntroOverlay onBegin={begin} />}
      {phase === "done" && (
        <ResultsOverlay dateKey={dateKey} results={results} daily={daily} />
      )}
    </div>
  );
}

function Header({
  dateKey,
  phase,
  roundIndex,
  runningTotal,
}: {
  dateKey: string;
  phase: Phase;
  roundIndex: number;
  runningTotal: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between p-3 sm:p-4">
      <div className="er-panel pointer-events-auto rounded-md px-3 py-2">
        <h1 className="font-display er-title text-lg sm:text-xl">
          <AppTitle />
        </h1>
        <p className="mt-1 text-xs text-[var(--er-muted)]">
          {dateLabel(dateKey)}
        </p>
      </div>
      {phase === "playing" && (
        <div className="er-panel pointer-events-auto rounded-md px-3 py-2 text-right">
          <p className="font-display text-sm text-[var(--er-gold-bright)]">
            Round {roundIndex + 1}/{ROUND_COUNT}
          </p>
          <p className="text-xs text-[var(--er-muted)]">
            Runes <span className="text-[var(--er-ink)]">{runningTotal}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function GuessPanel({
  grace,
  roundCfg,
  hasGuess,
  onSubmit,
}: {
  grace: Grace;
  roundCfg: { multiplier: number; showRegion: boolean };
  hasGuess: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex items-center gap-2.5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--er-muted)]">
            Find this Site of Grace
          </p>
          <span className="er-chip font-display rounded-full px-2 py-0.5 text-[11px] leading-none">
            ×{roundCfg.multiplier}
          </span>
        </div>
        <p className="font-display er-title text-2xl leading-tight text-balance sm:text-3xl">
          {grace.name}
        </p>
        {roundCfg.showRegion ? (
          <div className="er-region-hint mt-0.5 flex w-fit items-center gap-2 rounded-md border px-3 py-1.5">
            <MapPin className="size-4 shrink-0 text-[var(--er-gold-bright)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--er-muted)]">
              Region
            </span>
            <span className="font-display text-base leading-none text-[var(--er-gold-bright)] sm:text-lg">
              {grace.region}
            </span>
          </div>
        ) : (
          <div className="mt-0.5 flex w-fit items-center gap-1.5 text-xs italic text-[var(--er-muted)]">
            <MapPin className="size-4 shrink-0 opacity-60" />
            region unknown — trust your memory
          </div>
        )}
      </div>
      <div className="hidden w-px shrink-0 bg-[var(--er-line)] sm:block" />
      <button
        className="er-btn shrink-0 self-center rounded-md px-7 py-3.5 text-sm max-sm:w-full"
        disabled={!hasGuess}
        onClick={onSubmit}
      >
        {hasGuess ? "Lay your guess" : "Tap the map"}
      </button>
    </div>
  );
}

function RevealPanel({
  grace,
  result,
  isLast,
  onNext,
}: {
  grace: Grace;
  result: RoundResult;
  isLast: boolean;
  onNext: () => void;
}) {
  const tier = tierFor(result.baseScore);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p className="font-display er-title text-xl leading-tight text-balance sm:text-2xl">
          {grace.name}
        </p>
        <p className="text-xs text-[var(--er-muted)]">
          {grace.region} · off by {(result.distance * 100).toFixed(1)}% of the
          map
        </p>
      </div>
      <div className="hidden w-px shrink-0 bg-[var(--er-line)] sm:block" />
      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <div className="sm:text-right">
          <p className="font-display text-2xl text-[var(--er-gold-bright)]">
            <span className="mr-1 text-3xl align-middle">{tier.emoji}</span>
            {result.baseScore}
            <span className="text-base text-[var(--er-muted)]">/100</span>
          </p>
          <p className="text-xs text-[var(--er-muted)]">
            {tier.label} · +{result.roundScore} runes
          </p>
        </div>
        <button
          className="er-btn shrink-0 rounded-md px-7 py-3.5 text-sm"
          onClick={onNext}
        >
          {isLast ? "See verdict" : "Next grace"}
        </button>
      </div>
    </div>
  );
}

function IntroOverlay({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="er-panel max-w-md rounded-xl p-7 flex flex-col gap-4 text-center">
        <h1 className="font-display er-title text-3xl sm:text-4xl">
          <AppTitle />
        </h1>
        <div className="mx-auto h-px w-24 mt-2 mb-1 bg-[var(--er-line)]" />
        <p className="text-[var(--er-ink)]">
          Guess where the Site of Grace is on the map.
        </p>
        <div className="mx-auto h-px w-24 mt-2 mb-3 bg-[var(--er-line)]" />
        <button
          className="er-btn w-full rounded-md py-3 text-sm"
          onClick={onBegin}
        >
          Begin the journey
        </button>
      </div>
    </div>
  );
}

function ResultsOverlay({
  dateKey,
  results,
  daily,
}: {
  dateKey: string;
  results: RoundResult[];
  daily: Grace[];
}) {
  const total = totalScore(results);
  const shareText = buildShareText(results, dateKey, total);
  const [copied, setCopied] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(() => resetCountdownLabel());

  useEffect(() => {
    const update = () => setResetCountdown(resetCountdownLabel());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareText]);

  const pct = Math.round((total / MAX_SCORE) * 100);
  const verdict =
    pct >= 90
      ? "Elden Lord"
      : pct >= 70
      ? "Tarnished of renown"
      : pct >= 45
      ? "Wandering Tarnished"
      : "Maidenless";

  return (
    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="er-panel flex max-h-[92dvh] w-full max-w-md flex-col rounded-xl">
        {/* Scrollable content — collapses on short screens so the footer stays in view */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
          <h2 className="font-display er-title text-center text-2xl">
            Your Verdict
          </h2>
          <p className="mt-1 text-center text-sm text-[var(--er-muted)]">
            {dateLabel(dateKey)}
          </p>

          <div className="my-4 text-center">
            <p className="font-display text-5xl text-[var(--er-gold-bright)]">
              {total}
            </p>
            <p className="text-sm text-[var(--er-muted)]">
              of {MAX_SCORE} · {verdict}
            </p>
          </div>

          <ul className="space-y-2">
            {results.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-[var(--er-line)] bg-black/30 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{emojiFor(r.baseScore)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--er-ink)]">
                      {daily[i]?.name}
                    </span>
                    <span className="block text-xs text-[var(--er-muted)]">
                      {daily[i]?.region} · ×{ROUNDS[i].multiplier}
                    </span>
                  </span>
                </span>
                <span className="font-display shrink-0 pl-2 text-right text-[var(--er-gold-bright)]">
                  {r.roundScore}
                  <span className="block text-xs text-[var(--er-muted)]">
                    {r.baseScore}/100
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <pre className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--er-line)] bg-black/40 p-3 text-center text-sm text-[var(--er-ink)]">
            {shareText}
          </pre>
        </div>

        {/* Pinned footer — Copy result is always visible regardless of screen height */}
        <div className="shrink-0 border-t border-[var(--er-line)] p-6 pt-4">
          <button
            className="er-btn w-full rounded-md py-3 text-sm"
            onClick={copy}
          >
            {copied ? "Copied to clipboard" : "Copy verdict"}
          </button>
          <p className="mt-3 text-center text-xs text-[var(--er-muted)]">
            New graces in {resetCountdown}.
          </p>
        </div>
      </div>
    </div>
  );
}

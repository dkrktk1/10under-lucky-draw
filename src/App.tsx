import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Minus,
  Plus,
  Settings,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ConfettiCanvas } from './components/ConfettiCanvas';
import { HistoryModal } from './components/HistoryModal';
import { PrizePanel } from './components/PrizePanel';
import { SettingsModal } from './components/SettingsModal';
import { SmartTrainerStage } from './components/SmartTrainerStage';
import { WinnerOverlay } from './components/WinnerOverlay';
import {
  AppStorageState,
  DrawPhase,
  FaceEmotion,
  PowerPoint,
  Prize,
  TelemetryState,
  WinnerRecord,
  getZoneFromWatts,
} from './types/raffle';
import { soundEngine } from './utils/soundEngine';
import {
  createDefaultState,
  generateNumberRange,
  loadAppState,
  saveAppState,
} from './utils/storage';

const SPRINT_DURATION_MS = 4600;
const RIDER_WEIGHT_KG = 72;
const GRAPH_BAR_COUNT = 34;

function createIdleHistory(): PowerPoint[] {
  return Array.from({ length: GRAPH_BAR_COUNT }, (_, idx) => {
    const w = 115 + Math.round(Math.sin(idx * 0.5) * 12);
    return { watts: w, zone: getZoneFromWatts(w) };
  });
}

function createIdleTelemetry(): TelemetryState {
  return {
    watts: 120,
    rpm: 68,
    bpm: 112,
    zone: 1,
    wkg: 120 / RIDER_WEIGHT_KG,
    progress: 0,
    powerHistory: createIdleHistory(),
  };
}

/**
 * Unbiased Fisher-Yates draw of `count` unique numbers from `pool`.
 */
function pickRandomNumbers(pool: number[], count: number): {
  picked: number[];
  remaining: number[];
} {
  const copy = [...pool];
  const safeCount = Math.min(count, copy.length);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const picked = copy.slice(0, safeCount);
  const pickedSet = new Set(picked);
  const remaining = pool.filter((n) => !pickedSet.has(n));
  return { picked, remaining };
}

export default function App() {
  const [appState, setAppState] = useState<AppStorageState>(() => loadAppState());
  const [phase, setPhase] = useState<DrawPhase>('IDLE');
  const [telemetry, setTelemetry] = useState<TelemetryState>(() => createIdleTelemetry());

  const [drawCount, setDrawCount] = useState<number>(1);
  const [latestRevealIds, setLatestRevealIds] = useState<string[]>([]);
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [confettiKey, setConfettiKey] = useState<number>(0);

  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sprintRafRef = useRef<number>(0);
  const revealTimeoutRef = useRef<number>(0);
  const lastGraphPushRef = useRef<number>(0);
  const appStateRef = useRef<AppStorageState>(appState);
  appStateRef.current = appState;

  // Sync sound engine enabled flag
  useEffect(() => {
    soundEngine.setEnabled(appState.soundEnabled);
  }, [appState.soundEnabled]);

  // Auto-persist to localStorage on state changes
  useEffect(() => {
    const result = saveAppState(appState);
    if (!result.ok && result.error) {
      setNotice(result.error);
    }
  }, [appState]);

  // Clean up animation frames / audio on unmount
  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(sprintRafRef.current);
      window.clearTimeout(revealTimeoutRef.current);
      soundEngine.stopSprintAudio();
    };
  }, []);

  // Subtle idle wattage pulse when resting in IDLE
  useEffect(() => {
    if (phase !== 'IDLE') return;
    const timer = window.setInterval(() => {
      setTelemetry((prev) => {
        const watts = 112 + Math.round(Math.random() * 18);
        const rpm = 66 + Math.round(Math.random() * 5);
        const bpm = 110 + Math.round(Math.random() * 4);
        const zone = getZoneFromWatts(watts);
        return {
          ...prev,
          watts,
          rpm,
          bpm,
          zone,
          wkg: watts / RIDER_WEIGHT_KG,
          progress: 0,
          powerHistory: [...prev.powerHistory.slice(1), { watts, zone }],
        };
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [phase]);

  // Derived remaining count per prize
  const remainingMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of appState.prizes) {
      const drawn = appState.winners.filter((w) => w.prizeId === p.id).length;
      counts[p.id] = Math.max(0, p.totalQuantity - drawn);
    }
    return counts;
  }, [appState.prizes, appState.winners]);

  const selectedPrize = useMemo(
    () =>
      appState.prizes.find((p) => p.id === appState.selectedPrizeId) ??
      appState.prizes[0],
    [appState.prizes, appState.selectedPrizeId]
  );

  const selectedPrizeRemaining = selectedPrize
    ? remainingMap[selectedPrize.id] ?? selectedPrize.totalQuantity
    : 0;

  // Automatically sync drawCount when selected prize or its remaining count changes
  useEffect(() => {
    if (!selectedPrize) return;
    const maxAllowed = Math.max(1, appState.availableNumbers.length);
    const synced =
      selectedPrizeRemaining > 0
        ? Math.min(selectedPrizeRemaining, maxAllowed)
        : 1;
    setDrawCount(synced);
  }, [selectedPrize?.id, selectedPrizeRemaining, appState.availableNumbers.length]);

  const totalPoolSize = useMemo(() => {
    const base = Math.max(0, appState.poolEnd - appState.poolStart + 1);
    return Math.max(base, appState.availableNumbers.length + appState.winners.length);
  }, [appState.poolStart, appState.poolEnd, appState.availableNumbers.length, appState.winners.length]);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((prev) => (prev === message ? null : prev));
    }, 3200);
  }, []);

  const isDrawing =
    phase === 'WARMUP_Z1_Z3' || phase === 'THRESHOLD_Z4_Z5' || phase === 'SPRINT_Z6';

  const handleSelectPrize = useCallback(
    (prizeId: string) => {
      if (isDrawing) return;
      soundEngine.playUiClick();
      setAppState((prev) => ({ ...prev, selectedPrizeId: prizeId }));
    },
    [isDrawing]
  );

  const handleStepPrize = useCallback(
    (delta: number) => {
      if (isDrawing || appState.prizes.length <= 1) return;
      soundEngine.playUiClick();
      setAppState((prev) => {
        const idx = prev.prizes.findIndex((p) => p.id === prev.selectedPrizeId);
        const safeIdx = idx === -1 ? 0 : idx;
        const nextIdx = (safeIdx + delta + prev.prizes.length) % prev.prizes.length;
        return { ...prev, selectedPrizeId: prev.prizes[nextIdx].id };
      });
    },
    [isDrawing, appState.prizes.length]
  );

  const handleToggleSound = useCallback(() => {
    setAppState((prev) => {
      const next = !prev.soundEnabled;
      soundEngine.setEnabled(next);
      if (next) {
        soundEngine.playUiClick();
      }
      return { ...prev, soundEnabled: next };
    });
  }, []);

  const completeDraw = useCallback(
    (prize: Prize, requestedCount: number) => {
      // Unconditionally stop looping sprint turbine audio first
      soundEngine.stopSprintAudio();

      const currentPool = appStateRef.current.availableNumbers;
      if (currentPool.length === 0) {
        setPhase('IDLE');
        return;
      }

      const count = Math.max(1, Math.min(requestedCount, currentPool.length));
      const { picked, remaining } = pickRandomNumbers(currentPool, count);

      if (picked.length === 0) {
        setPhase('IDLE');
        return;
      }

      const nowIso = new Date().toISOString();
      const baseTs = Date.now();
      const newRecords: WinnerRecord[] = picked.map((num, idx) => ({
        id: `win-${baseTs}-${idx}-${num}`,
        prizeId: prize.id,
        prizeName: prize.name,
        number: num,
        drawnAt: nowIso,
      }));
      const createdIds = newRecords.map((r) => r.id);

      setAppState((prev) => ({
        ...prev,
        availableNumbers: remaining,
        winners: [...prev.winners, ...newRecords],
      }));

      soundEngine.playVictoryFanfare();
      setPhase('EXPLOSION');
      setConfettiKey((k) => k + 1);
      setLatestRevealIds(createdIds);

      // Hold the dramatic explosion, President cheer pose & golden ticket popping out of the raffle machine
      revealTimeoutRef.current = window.setTimeout(() => {
        setShowOverlay(true);
      }, 950);
    },
    []
  );

  const startDraw = useCallback(() => {
    if (isDrawing || showOverlay || showHistory || showSettings) return;
    if (!selectedPrize) {
      flashNotice('먼저 [설정 및 경품 관리]에서 경품을 등록해주세요.');
      return;
    }
    if (appState.availableNumbers.length === 0) {
      flashNotice('남은 추첨 번호가 없습니다. 설정에서 번호 풀을 초기화해주세요.');
      return;
    }

    const safeCount = Math.max(
      1,
      Math.min(drawCount, appState.availableNumbers.length)
    );
    const activePrize = selectedPrize;

    window.cancelAnimationFrame(sprintRafRef.current);
    window.clearTimeout(revealTimeoutRef.current);

    setShowOverlay(false);
    setLatestRevealIds([]);
    setPhase('WARMUP_Z1_Z3');
    soundEngine.startSprintAudio();

    let startTime: number | null = null;
    lastGraphPushRef.current = 0;

    const tick = (now: number) => {
      if (startTime === null) {
        startTime = now;
        lastGraphPushRef.current = now;
      }

      const elapsed = Math.max(0, now - startTime);
      const progress = Math.max(0, Math.min(1, elapsed / SPRINT_DURATION_MS));

      let watts = 130;
      let rpm = 72;
      let bpm = 116;
      let nextPhase: DrawPhase = 'WARMUP_Z1_Z3';

      if (progress < 0.35) {
        // Phase 1: Z1 ~ Z3 Smooth Ramp
        const localT = Math.max(0, Math.min(1, progress / 0.35));
        watts = 135 + Math.pow(localT, 1.2) * 235 + Math.sin(elapsed * 0.015) * 10;
        rpm = 70 + localT * 24;
        bpm = 114 + localT * 36;
        nextPhase = 'WARMUP_Z1_Z3';
      } else if (progress < 0.7) {
        // Phase 2: Z4 ~ Z5 Threshold & VO2 MAX (sweat + mild shake)
        const localT = Math.max(0, Math.min(1, (progress - 0.35) / 0.35));
        watts = 370 + Math.pow(localT, 1.3) * 355 + Math.sin(elapsed * 0.025) * 18;
        rpm = 94 + localT * 20;
        bpm = 150 + localT * 30;
        nextPhase = 'THRESHOLD_Z4_Z5';
      } else {
        // Phase 3: Z6 MAX Dancing Sprint (800W ~ 1,120W+ overload!)
        const localT = Math.max(0, Math.min(1, (progress - 0.7) / 0.3));
        watts = 725 + Math.pow(localT, 1.15) * 385 + Math.sin(elapsed * 0.045) * 32;
        rpm = 114 + localT * 18 + Math.sin(elapsed * 0.03) * 3;
        bpm = 180 + localT * 17;
        nextPhase = 'SPRINT_Z6';
      }

      const clampedWatts = Number.isFinite(watts) ? Math.max(100, Math.round(watts)) : 130;
      const safeRpm = Number.isFinite(rpm) ? Math.max(40, rpm) : 70;
      const safeBpm = Number.isFinite(bpm) ? Math.max(80, bpm) : 114;
      const zone = getZoneFromWatts(clampedWatts);

      setPhase(nextPhase);
      soundEngine.updateSprintTelemetry(clampedWatts, safeRpm, zone, progress);

      const shouldPushGraph = now - lastGraphPushRef.current >= 120;
      if (shouldPushGraph) {
        lastGraphPushRef.current = now;
      }

      setTelemetry((prev) => ({
        watts: clampedWatts,
        rpm: safeRpm,
        bpm: safeBpm,
        zone,
        wkg: clampedWatts / RIDER_WEIGHT_KG,
        progress,
        powerHistory: shouldPushGraph
          ? [...prev.powerHistory.slice(1), { watts: clampedWatts, zone }]
          : prev.powerHistory,
      }));

      if (progress < 1) {
        sprintRafRef.current = window.requestAnimationFrame(tick);
      } else {
        completeDraw(activePrize, safeCount);
      }
    };

    sprintRafRef.current = window.requestAnimationFrame(tick);
  }, [
    isDrawing,
    showOverlay,
    showHistory,
    showSettings,
    selectedPrize,
    appState.availableNumbers.length,
    drawCount,
    completeDraw,
    flashNotice,
  ]);

  const handleCloseWinnerOverlay = useCallback(() => {
    soundEngine.playUiClick();
    setShowOverlay(false);
    setLatestRevealIds([]);
    setPhase('IDLE');
  }, []);

  // Return an absentee's number back to the pool and restore prize count (+1)
  const handleReturnWinner = useCallback(
    (recordId: string) => {
      const target = appStateRef.current.winners.find((w) => w.id === recordId);
      if (!target) return;

      soundEngine.playUiClick();

      setAppState((prev) => {
        const nextWinners = prev.winners.filter((w) => w.id !== recordId);
        const nextPool = prev.availableNumbers.includes(target.number)
          ? prev.availableNumbers
          : [...prev.availableNumbers, target.number].sort((a, b) => a - b);

        return {
          ...prev,
          winners: nextWinners,
          availableNumbers: nextPool,
        };
      });

      const nextRevealIds = latestRevealIds.filter((id) => id !== recordId);
      setLatestRevealIds(nextRevealIds);
      if (nextRevealIds.length === 0 && showOverlay) {
        setShowOverlay(false);
        setPhase('IDLE');
      }

      flashNotice(`${target.number}번이 추첨 풀로 반환되었습니다.`);
    },
    [latestRevealIds, showOverlay, flashNotice]
  );

  // Settings handlers
  const handleAddPrize = useCallback((prizeData: Omit<Prize, 'id'>) => {
    const newPrize: Prize = {
      ...prizeData,
      id: `prize-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setAppState((prev) => ({
      ...prev,
      prizes: [...prev.prizes, newPrize],
      selectedPrizeId: prev.selectedPrizeId || newPrize.id,
    }));
  }, []);

  const handleUpdatePrize = useCallback((updated: Prize) => {
    setAppState((prev) => ({
      ...prev,
      prizes: prev.prizes.map((p) => (p.id === updated.id ? updated : p)),
    }));
  }, []);

  const handleDeletePrize = useCallback((prizeId: string) => {
    setAppState((prev) => {
      if (prev.prizes.length <= 1) return prev;
      const nextPrizes = prev.prizes.filter((p) => p.id !== prizeId);
      const nextSelected =
        prev.selectedPrizeId === prizeId ? nextPrizes[0].id : prev.selectedPrizeId;
      return {
        ...prev,
        prizes: nextPrizes,
        selectedPrizeId: nextSelected,
      };
    });
  }, []);

  const handleUpdateFace = useCallback((emotion: FaceEmotion, dataUrl: string | null) => {
    setAppState((prev) => ({
      ...prev,
      faces: {
        ...prev.faces,
        [emotion]: dataUrl,
      },
    }));
  }, []);

  const handleResetPool = useCallback((start: number, end: number) => {
    const freshNumbers = generateNumberRange(start, end);
    setAppState((prev) => ({
      ...prev,
      poolStart: start,
      poolEnd: end,
      availableNumbers: freshNumbers,
      winners: [],
    }));
    setLatestRevealIds([]);
    setShowOverlay(false);
    setPhase('IDLE');
  }, []);

  const handleResetAllData = useCallback(() => {
    const defaults = createDefaultState();
    setAppState(defaults);
    setLatestRevealIds([]);
    setShowOverlay(false);
    setPhase('IDLE');
  }, []);

  // Global keyboard shortcuts (Spacebar to draw, ESC to close overlays, Arrows to switch prize)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (showOverlay) {
          handleCloseWinnerOverlay();
        } else if (showHistory) {
          setShowHistory(false);
        } else if (showSettings) {
          setShowSettings(false);
        }
        return;
      }

      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!showOverlay && !showHistory && !showSettings && phase === 'IDLE') {
          startDraw();
        }
      } else if (
        e.key === 'ArrowLeft' &&
        phase === 'IDLE' &&
        !showOverlay &&
        !showHistory &&
        !showSettings
      ) {
        handleStepPrize(-1);
      } else if (
        e.key === 'ArrowRight' &&
        phase === 'IDLE' &&
        !showOverlay &&
        !showHistory &&
        !showSettings
      ) {
        handleStepPrize(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    showOverlay,
    showHistory,
    showSettings,
    startDraw,
    handleCloseWinnerOverlay,
    handleStepPrize,
  ]);

  const latestRevealRecords = useMemo(() => {
    if (latestRevealIds.length === 0) return [];
    const idSet = new Set(latestRevealIds);
    return appState.winners.filter((w) => idSet.has(w.id));
  }, [latestRevealIds, appState.winners]);

  const maxDrawAllowed = Math.max(1, appState.availableNumbers.length);
  const canStartDraw =
    phase === 'IDLE' &&
    Boolean(selectedPrize) &&
    appState.availableNumbers.length > 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#080C14] text-slate-100 lg:h-screen lg:overflow-hidden">
      {/* Full-Screen Confetti Cannon */}
      <ConfettiCanvas active={phase === 'EXPLOSION'} burstKey={confettiKey} />

      {/* TOP HEADER BAR */}
      <header className="flex shrink-0 items-center justify-between gap-6 border-b border-slate-800/90 bg-[#0A0F1C] px-5 py-3.5 md:px-7">
        {/* Zone 1: Event Title with 10under Club Logo */}
        <h1 className="flex items-center gap-3 font-display text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 md:text-3xl">
          <span className="relative block h-8 w-[132px] shrink-0 overflow-hidden md:h-10 md:w-[164px]">
            <img
              src="./assets/aistudio/__________fa1c2477.png"
              alt="10under Triathlon Club"
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute top-0 left-1/2 w-[126%] max-w-none -translate-x-1/2 -translate-y-[53.2%] select-none"
            />
          </span>
          <span>연말 총회 경품 추첨</span>
        </h1>

        {/* Zone 2: Remaining Number Pool Status (unboxed clean telemetry text) */}
        <div className="hidden items-baseline gap-2.5 md:flex">
          <span className="text-sm font-medium text-slate-400">남은 추첨 번호</span>
          <span className="font-display text-3xl font-extrabold leading-none text-white tabular-nums">
            {appState.availableNumbers.length}
          </span>
          <span className="font-mono-num text-sm font-semibold text-slate-500">
            / {totalPoolSize}
          </span>
        </div>

        {/* Zone 3: Operational Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSound}
            title={appState.soundEnabled ? '사운드 끄기' : '사운드 켜기'}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3 text-xs font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {appState.soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 text-[#A3E635]" />
                <span className="hidden sm:inline">사운드 ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-slate-500" />
                <span className="hidden sm:inline text-slate-400">사운드 OFF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setShowHistory(true);
            }}
            disabled={isDrawing}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>
              당첨 기록
              {appState.winners.length > 0 ? ` (${appState.winners.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setShowSettings(true);
            }}
            disabled={isDrawing}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Settings className="h-4 w-4 text-slate-300" />
            <span className="hidden sm:inline">설정 및 경품 관리</span>
            <span className="sm:hidden">설정</span>
          </button>
        </div>
      </header>

      {/* Non-blocking Notice Banner (e.g., returned number / pool empty / quota info) */}
      {notice && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/12 px-6 py-2 text-center text-sm font-bold text-amber-200">
          {notice}
        </div>
      )}

      {/* MAIN CONTENT STAGE + PRIZE PANEL */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:p-5 lg:grid-cols-12">
        {/* Center Dominant Stage: Animated Smart Trainer + Zwift Power HUD */}
        <section className="min-h-[420px] lg:col-span-8 lg:min-h-0 xl:col-span-9">
          <SmartTrainerStage
            phase={phase}
            telemetry={telemetry}
            faces={appState.faces}
            availableNumbers={appState.availableNumbers}
            latestDrawnNumbers={latestRevealRecords.map((r) => r.number)}
          />
        </section>

        {/* Right Showcase: Active Prize + Navigation */}
        <section className="lg:col-span-4 lg:min-h-0 xl:col-span-3">
          <PrizePanel
            prizes={appState.prizes}
            selectedPrize={selectedPrize}
            remainingMap={remainingMap}
            disabled={isDrawing}
            onSelectPrize={handleSelectPrize}
            onPrevPrize={() => handleStepPrize(-1)}
            onNextPrize={() => handleStepPrize(1)}
          />
        </section>
      </main>

      {/* BOTTOM CONTROL BAR */}
      <footer className="shrink-0 border-t border-slate-800/90 bg-[#0A0F1C] px-5 py-3.5 md:px-7">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          {/* Left: Draw Count Stepper */}
          <div className="flex items-center justify-between gap-4 sm:justify-start">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-200">추첨 인원 수</span>
              <span className="text-xs text-slate-500">
                경품 남은 수량과 자동 연동 · 수동 변경 가능
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#0E1628] p-1">
              <button
                type="button"
                disabled={isDrawing || drawCount <= 1}
                onClick={() => {
                  soundEngine.playUiClick();
                  setDrawCount((c) => Math.max(1, c - 1));
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="추첨 인원 1명 감소"
              >
                <Minus className="h-4 w-4" />
              </button>

              <input
                type="number"
                min={1}
                max={maxDrawAllowed}
                disabled={isDrawing}
                value={drawCount}
                onChange={(e) => {
                  const val = Math.floor(Number(e.target.value) || 1);
                  setDrawCount(Math.max(1, Math.min(maxDrawAllowed, val)));
                }}
                aria-label="추첨 인원 수 입력"
                className="w-16 bg-transparent text-center font-display text-3xl font-extrabold text-white tabular-nums focus:outline-none disabled:opacity-50"
              />

              <button
                type="button"
                disabled={isDrawing || drawCount >= maxDrawAllowed}
                onClick={() => {
                  soundEngine.playUiClick();
                  setDrawCount((c) => Math.min(maxDrawAllowed, c + 1));
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="추첨 인원 1명 증가"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right/Main Focal Action: Giant Start Draw CTA */}
          <button
            type="button"
            onClick={startDraw}
            disabled={!canStartDraw}
            className={`flex min-h-[58px] flex-1 items-center justify-center gap-3 rounded-xl px-8 py-3 text-xl font-black tracking-wide transition-all sm:max-w-lg whitespace-nowrap ${
              isDrawing
                ? 'cursor-wait bg-gradient-to-r from-[#84CC16] via-[#A3E635] to-emerald-400 text-slate-950 shadow-[0_0_34px_rgba(163,230,53,0.5)]'
                : canStartDraw
                  ? 'bg-[#84CC16] text-slate-950 shadow-[0_0_28px_rgba(132,204,22,0.38)] hover:bg-[#A3E635] active:scale-[0.99]'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
            }`}
          >
            <Flame className={`h-6 w-6 shrink-0 ${isDrawing ? 'animate-bounce' : ''}`} />
            {isDrawing ? (
              <span>추첨중...</span>
            ) : appState.availableNumbers.length === 0 ? (
              <span>남은 추첨 번호가 없습니다</span>
            ) : (
              <span>
                추첨 시작 · {drawCount}명 뽑기{' '}
                <span className="ml-1 font-mono-num text-sm font-bold text-slate-900/80">
                  (Spacebar)
                </span>
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* WINNER REVEAL OVERLAY */}
      {showOverlay && latestRevealRecords.length > 0 && (
        <WinnerOverlay
          records={latestRevealRecords}
          prize={selectedPrize}
          faces={appState.faces}
          onReturnWinner={handleReturnWinner}
          onClose={handleCloseWinnerOverlay}
        />
      )}

      {/* WINNER HISTORY MODAL */}
      {showHistory && (
        <HistoryModal
          prizes={appState.prizes}
          winners={appState.winners}
          remainingPoolCount={appState.availableNumbers.length}
          totalPoolCount={totalPoolSize}
          onReturnWinner={handleReturnWinner}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* SETTINGS & PRIZE MANAGEMENT MODAL */}
      {showSettings && (
        <SettingsModal
          prizes={appState.prizes}
          faces={appState.faces}
          poolStart={appState.poolStart}
          poolEnd={appState.poolEnd}
          availableCount={appState.availableNumbers.length}
          winnersCount={appState.winners.length}
          onAddPrize={handleAddPrize}
          onUpdatePrize={handleUpdatePrize}
          onDeletePrize={handleDeletePrize}
          onUpdateFace={handleUpdateFace}
          onResetPool={handleResetPool}
          onResetAllData={handleResetAllData}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

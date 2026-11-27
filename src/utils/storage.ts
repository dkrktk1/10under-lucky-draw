import { INITIAL_PRIZES } from '../data/prizes';
import { AppStorageState, Prize, WinnerRecord } from '../types/raffle';

const LOCAL_STORAGE_KEY = 'tenunder_ftp_raffle_state_v1';
const LOCAL_STORAGE_META_KEY = 'tenunder_ftp_raffle_meta_v1';
const IDB_NAME = 'tenunder_ftp_raffle_db';
const IDB_VERSION = 1;
const IDB_STORE = 'app_state';
const IDB_RECORD_KEY = 'current';
const LARGE_DATA_URI_THRESHOLD = 48_000;

export const DEFAULT_PRIZES: Prize[] = INITIAL_PRIZES;

interface StoredEnvelope {
  savedAt: number;
  state: AppStorageState;
}

/**
 * Normalizes prize/face image paths so files placed in `public/images/` or `public/assets/`
 * work reliably as relative paths (`./images/prize1.jpg`, `./assets/...`) on GitHub Pages.
 */
export function normalizeAssetPath(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return trimmed;
  }
  if (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/src/assets/')
  ) {
    return `.${trimmed}`;
  }
  if (
    trimmed.startsWith('images/') ||
    trimmed.startsWith('assets/') ||
    trimmed.startsWith('src/assets/')
  ) {
    return `./${trimmed}`;
  }
  return trimmed;
}

export function generateNumberRange(start: number, end: number): number[] {
  const safeStart = Math.max(1, Math.min(9999, Math.floor(start)));
  const safeEnd = Math.max(safeStart, Math.min(9999, Math.floor(end)));
  const numbers: number[] = [];
  for (let i = safeStart; i <= safeEnd; i++) {
    numbers.push(i);
  }
  return numbers;
}

export function createDefaultState(): AppStorageState {
  return {
    version: 1,
    poolStart: 1,
    poolEnd: 100,
    availableNumbers: generateNumberRange(1, 100),
    prizes: INITIAL_PRIZES.map((p) => ({ ...p })),
    selectedPrizeId: INITIAL_PRIZES[0]?.id ?? '',
    winners: [],
    faces: {
      calm: null,
      pain: null,
      cheer: null,
    },
    soundEnabled: true,
  };
}

export function sanitizeAppState(raw: unknown): AppStorageState {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const parsed = raw as Partial<AppStorageState>;
  const defaultById = new Map(INITIAL_PRIZES.map((p) => [p.id, p]));

  const rawPrizes: unknown[] = Array.isArray(parsed.prizes) ? (parsed.prizes as unknown[]) : [];
  const validPrizes: Prize[] = rawPrizes
    .filter((p): p is Record<string, unknown> => {
      if (!p || typeof p !== 'object') return false;
      const obj = p as Record<string, unknown>;
      return (
        typeof obj.id === 'string' &&
        obj.id.trim().length > 0 &&
        typeof obj.name === 'string' &&
        obj.name.trim().length > 0
      );
    })
    .map((p) => {
      const id = String(p.id).trim();
      const fallbackDefault = defaultById.get(id);
      // Backward compatibility for older backups/storage using `totalQuantity` or `imageUrl`
      const rawQty = p.quantity ?? p.totalQuantity ?? fallbackDefault?.quantity ?? 1;
      const rawImage =
        typeof p.image === 'string'
          ? p.image
          : typeof p.imageUrl === 'string'
            ? p.imageUrl
            : '';
      const rawPrice =
        typeof p.price === 'string' ? p.price.trim() : fallbackDefault?.price ?? '';

      return {
        id,
        name: String(p.name).trim(),
        price: rawPrice,
        quantity: Math.max(1, Math.min(500, Math.floor(Number(rawQty) || 1))),
        image: normalizeAssetPath(rawImage),
      };
    });

  const prizes = validPrizes.length > 0 ? validPrizes : defaults.prizes;

  const selectedPrizeId =
    typeof parsed.selectedPrizeId === 'string' &&
    prizes.some((p) => p.id === parsed.selectedPrizeId)
      ? parsed.selectedPrizeId
      : prizes[0].id;

  const poolStart =
    typeof parsed.poolStart === 'number' && Number.isFinite(parsed.poolStart)
      ? Math.max(1, Math.min(9999, Math.floor(parsed.poolStart)))
      : defaults.poolStart;

  const poolEnd =
    typeof parsed.poolEnd === 'number' && Number.isFinite(parsed.poolEnd)
      ? Math.max(poolStart, Math.min(9999, Math.floor(parsed.poolEnd)))
      : Math.max(poolStart, defaults.poolEnd);

  const availableNumbers = Array.isArray(parsed.availableNumbers)
    ? Array.from(
        new Set(
          parsed.availableNumbers
            .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
            .map((n) => Math.floor(n))
        )
      ).sort((a, b) => a - b)
    : generateNumberRange(poolStart, poolEnd);

  const winners: WinnerRecord[] = Array.isArray(parsed.winners)
    ? parsed.winners
        .filter(
          (w): w is WinnerRecord =>
            Boolean(w) &&
            typeof w === 'object' &&
            typeof w.id === 'string' &&
            typeof w.prizeId === 'string' &&
            typeof w.number === 'number' &&
            Number.isFinite(w.number)
        )
        .map((w) => ({
          id: w.id,
          prizeId: w.prizeId,
          prizeName: typeof w.prizeName === 'string' ? w.prizeName : '',
          number: Math.floor(w.number),
          drawnAt: typeof w.drawnAt === 'string' ? w.drawnAt : new Date().toISOString(),
        }))
    : [];

  const sanitizeFace = (val: unknown): string | null =>
    typeof val === 'string' && val.trim().length > 0 ? normalizeAssetPath(val) : null;

  return {
    version: 1,
    poolStart,
    poolEnd,
    availableNumbers,
    prizes,
    selectedPrizeId,
    winners,
    faces: {
      calm: sanitizeFace(parsed.faces?.calm),
      pain: sanitizeFace(parsed.faces?.pain),
      cheer: sanitizeFace(parsed.faces?.cheer),
    },
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

async function readEnvelopeFromIndexedDB(): Promise<StoredEnvelope | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_RECORD_KEY);

    req.onsuccess = () => {
      db.close();
      if (!req.result) {
        resolve(null);
        return;
      }
      const raw = req.result as Record<string, unknown>;
      if (typeof raw.savedAt === 'number' && raw.state && typeof raw.state === 'object') {
        resolve({
          savedAt: raw.savedAt,
          state: sanitizeAppState(raw.state),
        });
      } else {
        resolve({
          savedAt: 0,
          state: sanitizeAppState(raw),
        });
      }
    };

    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to read IndexedDB.'));
    };
  });
}

async function writeEnvelopeToIndexedDB(envelope: StoredEnvelope): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(envelope, IDB_RECORD_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? req.error ?? new Error('Failed to write IndexedDB.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
    };
  });
}

function readEnvelopeFromLocalStorage(): StoredEnvelope | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const metaRaw = window.localStorage.getItem(LOCAL_STORAGE_META_KEY);
    const savedAt = metaRaw ? Number(metaRaw) || 0 : 0;
    return {
      savedAt,
      state: sanitizeAppState(parsed),
    };
  } catch {
    return null;
  }
}

/**
 * Strips oversized Base64 image blobs (>48KB) ONLY when localStorage hits 5MB quota,
 * ensuring critical draw pool, winner records, and prize quantities STILL persist synchronously.
 */
function createCompactLocalStorageCopy(state: AppStorageState): AppStorageState {
  const stripIfHuge = (val: string | null): string | null =>
    val && val.startsWith('data:') && val.length > LARGE_DATA_URI_THRESHOLD ? null : val;

  return {
    ...state,
    prizes: state.prizes.map((p) => ({
      ...p,
      image:
        p.image.startsWith('data:') && p.image.length > LARGE_DATA_URI_THRESHOLD ? '' : p.image,
    })),
    faces: {
      calm: stripIfHuge(state.faces.calm),
      pain: stripIfHuge(state.faces.pain),
      cheer: stripIfHuge(state.faces.cheer),
    },
  };
}

/**
 * Immediate synchronous save to localStorage (called right on draw/re-draw/return/selection
 * so even an instantaneous F5 refresh never loses a single winner or remaining number).
 */
export function saveAppStateSync(
  state: AppStorageState,
  savedAt: number = Date.now()
): { ok: boolean; compactOnly?: boolean } {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    window.localStorage.setItem(LOCAL_STORAGE_META_KEY, String(savedAt));
    return { ok: true };
  } catch {
    try {
      const compact = createCompactLocalStorageCopy(state);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(compact));
      window.localStorage.setItem(LOCAL_STORAGE_META_KEY, String(savedAt));
      return { ok: true, compactOnly: true };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Synchronous bootstrap read for immediate first paint without flash.
 */
export function loadAppState(): AppStorageState {
  return readEnvelopeFromLocalStorage()?.state ?? createDefaultState();
}

/**
 * Primary async loader: reconciles IndexedDB (full Base64 images) and localStorage
 * (instant synchronous snapshot) so the freshest state always wins with full photos intact.
 */
export async function loadAppStateAsync(): Promise<{
  state: AppStorageState;
  backend: 'indexeddb' | 'localstorage' | 'default';
}> {
  const lsEnv = readEnvelopeFromLocalStorage();

  try {
    const idbEnv = await readEnvelopeFromIndexedDB();

    if (idbEnv && lsEnv) {
      if (lsEnv.savedAt > idbEnv.savedAt) {
        // localStorage captured an ultra-recent draw right before reload; preserve any stripped photos from IDB
        const idbPrizeImages = new Map(idbEnv.state.prizes.map((p) => [p.id, p.image]));
        const merged: AppStorageState = {
          ...lsEnv.state,
          prizes: lsEnv.state.prizes.map((p) => ({
            ...p,
            image: p.image || idbPrizeImages.get(p.id) || '',
          })),
          faces: {
            calm: lsEnv.state.faces.calm ?? idbEnv.state.faces.calm,
            pain: lsEnv.state.faces.pain ?? idbEnv.state.faces.pain,
            cheer: lsEnv.state.faces.cheer ?? idbEnv.state.faces.cheer,
          },
        };
        try {
          await writeEnvelopeToIndexedDB({ savedAt: lsEnv.savedAt, state: merged });
        } catch {
          // ignore sync write failure
        }
        return { state: merged, backend: 'indexeddb' };
      }
      return { state: idbEnv.state, backend: 'indexeddb' };
    }

    if (idbEnv) {
      saveAppStateSync(idbEnv.state, idbEnv.savedAt || Date.now());
      return { state: idbEnv.state, backend: 'indexeddb' };
    }

    if (lsEnv) {
      try {
        await writeEnvelopeToIndexedDB({
          savedAt: lsEnv.savedAt || Date.now(),
          state: lsEnv.state,
        });
      } catch {
        // ignore migration failure
      }
      return { state: lsEnv.state, backend: 'indexeddb' };
    }

    return { state: createDefaultState(), backend: 'default' };
  } catch {
    if (lsEnv) {
      return { state: lsEnv.state, backend: 'localstorage' };
    }
    return { state: createDefaultState(), backend: 'default' };
  }
}

/**
 * Dual-layer persistence: writes immediately to localStorage (synchronous F5 shield)
 * AND persists full unstripped state (including Base64 images) to IndexedDB.
 */
export async function saveAppStateAsync(
  state: AppStorageState
): Promise<{ ok: boolean; backend: 'indexeddb' | 'localstorage'; error?: string }> {
  const savedAt = Date.now();
  const lsResult = saveAppStateSync(state, savedAt);

  try {
    await writeEnvelopeToIndexedDB({ savedAt, state });
    return { ok: true, backend: 'indexeddb' };
  } catch {
    if (lsResult.ok) {
      return { ok: true, backend: 'localstorage' };
    }
    return {
      ok: false,
      backend: 'localstorage',
      error:
        '브라우저 저장 용량이 가득 찼습니다. JSON 백업 후 일부 이미지를 줄이거나 ./images/ 경로를 사용해주세요.',
    };
  }
}

export function exportAppStateJson(state: AppStorageState): void {
  const payload = {
    app: '10under-raffle',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  link.href = url;
  link.setAttribute('download', `10under_경품추첨_백업_${stamp}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseImportedAppStateJson(
  jsonText: string
): { ok: true; state: AppStorageState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '올바른 JSON 백업 파일 형식이 아닙니다.' };
    }

    const candidate =
      parsed.app === '10under-raffle' && parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as Record<string, unknown>)
        : parsed;

    const hasRecognizableFields =
      Array.isArray(candidate.prizes) ||
      Array.isArray(candidate.availableNumbers) ||
      Array.isArray(candidate.winners) ||
      typeof candidate.poolEnd === 'number';

    if (!hasRecognizableFields) {
      return {
        ok: false,
        error: '10under 경품 추첨 백업 데이터가 포함되어 있지 않은 JSON 파일입니다.',
      };
    }

    const sanitized = sanitizeAppState(candidate);
    return { ok: true, state: sanitized };
  } catch {
    return {
      ok: false,
      error: 'JSON 파일을 읽을 수 없습니다. 파일이 손상되었는지 확인해주세요.',
    };
  }
}

export function buildWinnersSummaryText(prizes: Prize[], winners: WinnerRecord[]): string {
  if (winners.length === 0) return '아직 당첨 기록이 없습니다.';

  const lines: string[] = ['[10under 연말 총회 경품 추첨 결과]', ''];
  const prizeOrder = new Map<string, number>();
  prizes.forEach((p, idx) => prizeOrder.set(p.id, idx));

  const grouped = new Map<string, { name: string; price: string; numbers: number[] }>();
  for (const w of winners) {
    const existing = grouped.get(w.prizeId);
    if (existing) {
      existing.numbers.push(w.number);
    } else {
      const currentPrize = prizes.find((p) => p.id === w.prizeId);
      grouped.set(w.prizeId, {
        name: currentPrize ? currentPrize.name : w.prizeName,
        price: currentPrize ? currentPrize.price : '',
        numbers: [w.number],
      });
    }
  }

  const entries = Array.from(grouped.entries()).sort(([idA], [idB]) => {
    const orderA = prizeOrder.get(idA) ?? 999;
    const orderB = prizeOrder.get(idB) ?? 999;
    return orderA - orderB;
  });

  for (const [, group] of entries) {
    const sortedNums = [...group.numbers].sort((a, b) => a - b);
    const priceSuffix = group.price ? ` · ${group.price}` : '';
    lines.push(`■ ${group.name}${priceSuffix} (${sortedNums.length}명)`);
    lines.push(`  당첨 번호: ${sortedNums.map((n) => `${n}번`).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function downloadWinnersCsv(prizes: Prize[], winners: WinnerRecord[]): void {
  const header = ['순번', '경품명', '금액', '당첨번호', '추첨시각'];
  const rows = winners.map((w, idx) => {
    const prize = prizes.find((p) => p.id === w.prizeId);
    const prizeName = (prize ? prize.name : w.prizeName).replace(/"/g, '""');
    const prizePrice = (prize?.price ?? '').replace(/"/g, '""');
    const timeStr = new Date(w.drawnAt).toLocaleString('ko-KR');
    return [
      String(idx + 1),
      `"${prizeName}"`,
      `"${prizePrice}"`,
      String(w.number),
      `"${timeStr}"`,
    ].join(',');
  });

  // Prefix UTF-8 BOM so Microsoft Excel renders Korean cleanly
  const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `10under_연말총회_당첨결과_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

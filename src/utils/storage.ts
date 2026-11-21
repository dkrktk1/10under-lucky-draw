import { AppStorageState, Prize, WinnerRecord } from '../types/raffle';

const STORAGE_KEY = 'tenunder_ftp_raffle_state_v1';

export const DEFAULT_PRIZES: Prize[] = [
  {
    id: 'prize-garmin-965',
    name: '가민 포러너 965 GPS 철인 워치',
    totalQuantity: 1,
    imageUrl: './src/assets/images/prize_garmin_watch_1795183198262.jpg',
  },
  {
    id: 'prize-oakley-sutro',
    name: '오클리 수트로 라이트 스포츠 고글',
    totalQuantity: 2,
    imageUrl: './src/assets/images/prize_cycling_sunglasses_1795183217490.jpg',
  },
  {
    id: 'prize-scicon-bag',
    name: '시콘 에어로컴포트 자전거 캐링백',
    totalQuantity: 1,
    imageUrl: './src/assets/images/prize_bike_travel_bag_1795183195837.jpg',
  },
  {
    id: 'prize-maurten-gel',
    name: '모르텐 에너지젤 1박스 (12개입)',
    totalQuantity: 5,
    imageUrl: './src/assets/images/prize_energy_gel_box_1795183195323.jpg',
  },
];

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
    prizes: DEFAULT_PRIZES,
    selectedPrizeId: DEFAULT_PRIZES[0].id,
    winners: [],
    faces: {
      calm: null,
      pain: null,
      cheer: null,
    },
    soundEnabled: true,
  };
}

export function loadAppState(): AppStorageState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppStorageState>;
    const defaults = createDefaultState();

    const prizes =
      Array.isArray(parsed.prizes) && parsed.prizes.length > 0
        ? parsed.prizes.map((p) => ({
            ...p,
            imageUrl:
              typeof p.imageUrl === 'string' && p.imageUrl.startsWith('/src/assets/')
                ? `.${p.imageUrl}`
                : p.imageUrl,
          }))
        : defaults.prizes;

    const selectedPrizeId =
      parsed.selectedPrizeId && prizes.some((p) => p.id === parsed.selectedPrizeId)
        ? parsed.selectedPrizeId
        : prizes[0].id;

    return {
      version: 1,
      poolStart: typeof parsed.poolStart === 'number' ? parsed.poolStart : defaults.poolStart,
      poolEnd: typeof parsed.poolEnd === 'number' ? parsed.poolEnd : defaults.poolEnd,
      availableNumbers: Array.isArray(parsed.availableNumbers)
        ? parsed.availableNumbers.filter((n) => typeof n === 'number')
        : defaults.availableNumbers,
      prizes,
      selectedPrizeId,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
      faces: {
        calm: parsed.faces?.calm ?? null,
        pain: parsed.faces?.pain ?? null,
        cheer: parsed.faces?.cheer ?? null,
      },
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    };
  } catch {
    return createDefaultState();
  }
}

export function saveAppState(state: AppStorageState): { ok: boolean; error?: string } {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return {
        ok: false,
        error: '브라우저 저장 용량이 가득 찼습니다. 일부 이미지를 삭제하거나 URL로 등록해주세요.',
      };
    }
    return { ok: false, error: '데이터 저장 중 오류가 발생했습니다.' };
  }
}

export function buildWinnersSummaryText(prizes: Prize[], winners: WinnerRecord[]): string {
  if (winners.length === 0) return '아직 당첨 기록이 없습니다.';

  const lines: string[] = ['[10UNDER 연말 총회 경품 추첨 결과]', ''];
  const prizeOrder = new Map<string, number>();
  prizes.forEach((p, idx) => prizeOrder.set(p.id, idx));

  const grouped = new Map<string, { name: string; numbers: number[] }>();
  for (const w of winners) {
    const existing = grouped.get(w.prizeId);
    if (existing) {
      existing.numbers.push(w.number);
    } else {
      const currentPrize = prizes.find((p) => p.id === w.prizeId);
      grouped.set(w.prizeId, {
        name: currentPrize ? currentPrize.name : w.prizeName,
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
    lines.push(`■ ${group.name} (${sortedNums.length}명)`);
    lines.push(`  당첨 번호: ${sortedNums.map((n) => `${n}번`).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function downloadWinnersCsv(prizes: Prize[], winners: WinnerRecord[]): void {
  const header = ['순번', '경품명', '당첨번호', '추첨시각'];
  const rows = winners.map((w, idx) => {
    const prize = prizes.find((p) => p.id === w.prizeId);
    const prizeName = (prize ? prize.name : w.prizeName).replace(/"/g, '""');
    const timeStr = new Date(w.drawnAt).toLocaleString('ko-KR');
    return [String(idx + 1), `"${prizeName}"`, String(w.number), `"${timeStr}"`].join(',');
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

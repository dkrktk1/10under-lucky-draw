import { useState } from 'react';
import { Check, Copy, Download, RotateCcw, Trophy, X } from 'lucide-react';
import { Prize, WinnerRecord } from '../types/raffle';
import { buildWinnersSummaryText, downloadWinnersCsv } from '../utils/storage';

interface HistoryModalProps {
  prizes: Prize[];
  winners: WinnerRecord[];
  remainingPoolCount: number;
  totalPoolCount: number;
  onReturnWinner: (recordId: string) => void;
  onClose: () => void;
}

export function HistoryModal({
  prizes,
  winners,
  remainingPoolCount,
  totalPoolCount,
  onReturnWinner,
  onClose,
}: HistoryModalProps) {
  const [copied, setCopied] = useState(false);

  // Group winners by prizeId preserving prize list order
  const prizeMap = new Map<string, Prize>();
  prizes.forEach((p) => prizeMap.set(p.id, p));

  const grouped = new Map<string, { prizeName: string; items: WinnerRecord[] }>();
  for (const w of winners) {
    const existing = grouped.get(w.prizeId);
    const livePrize = prizeMap.get(w.prizeId);
    const displayName = livePrize ? livePrize.name : w.prizeName;
    if (existing) {
      existing.items.push(w);
    } else {
      grouped.set(w.prizeId, { prizeName: displayName, items: [w] });
    }
  }

  const orderedGroups = Array.from(grouped.entries()).sort(([idA], [idB]) => {
    const idxA = prizes.findIndex((p) => p.id === idA);
    const idxB = prizes.findIndex((p) => p.id === idB);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  const handleCopy = async () => {
    const text = buildWinnersSummaryText(prizes, winners);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownloadCsv = () => {
    downloadWinnersCsv(prizes, winners);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050810]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="당첨 기록"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0D1424] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-extrabold text-white">당첨 기록</h2>
            <span className="font-mono-num text-sm text-slate-400">
              총 {winners.length}명 당첨 · 남은 번호 {remainingPoolCount} / {totalPoolCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Export Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#0A101D] px-6 py-3">
          <p className="text-xs text-slate-400">
            당첨자가 자리에 없을 경우 번호 옆 <strong className="text-rose-300">[반환 ×]</strong>를 누르면 추첨 풀로 즉시 복원됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={winners.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>클립보드 복사</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={winners.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#84CC16] px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-[#A3E635] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV 다운로드</span>
            </button>
          </div>
        </div>

        {/* Winners List Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {orderedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-base font-bold text-slate-300">아직 추첨된 당첨자가 없습니다</p>
              <p className="mt-1 text-sm text-slate-500">
                메인 화면에서 추첨을 시작하면 경품별 당첨 번호가 이곳에 기록됩니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {orderedGroups.map(([prizeId, group]) => (
                <section
                  key={prizeId}
                  className="border-b border-slate-800/80 pb-5 last:border-b-0 last:pb-0"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-bold text-white">{group.prizeName}</h3>
                    <span className="font-mono-num text-xs font-semibold text-slate-400">
                      당첨 {group.items.length}명
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#121C30] pl-3.5 pr-1.5 py-1.5"
                      >
                        <span className="font-display text-2xl font-extrabold leading-none text-amber-300 tabular-nums">
                          {item.number}
                        </span>
                        <span className="text-xs text-slate-400">번</span>
                        <button
                          type="button"
                          onClick={() => onReturnWinner(item.id)}
                          title={`${item.number}번 반환 (추첨 풀로 복원)`}
                          className="ml-1 flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-bold text-slate-300 transition-colors hover:border-rose-500/70 hover:bg-rose-950/70 hover:text-rose-200 whitespace-nowrap"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>반환 ×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

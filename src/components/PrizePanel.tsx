import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { Prize } from '../types/raffle';

interface PrizePanelProps {
  prizes: Prize[];
  selectedPrize: Prize | undefined;
  remainingMap: Record<string, number>;
  disabled: boolean;
  onSelectPrize: (prizeId: string) => void;
  onPrevPrize: () => void;
  onNextPrize: () => void;
}

export function PrizePanel({
  prizes,
  selectedPrize,
  remainingMap,
  disabled,
  onSelectPrize,
  onPrevPrize,
  onNextPrize,
}: PrizePanelProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [selectedPrize?.id, selectedPrize?.image]);

  if (!selectedPrize) {
    return (
      <aside className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800/90 bg-[#0D1424] p-6 text-center">
        <Gift className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-base font-semibold text-slate-300">등록된 경품이 없습니다</p>
        <p className="mt-1 text-sm text-slate-500">
          상단 [설정 및 경품 관리]에서 경품을 추가해주세요.
        </p>
      </aside>
    );
  }

  const currentIdx = prizes.findIndex((p) => p.id === selectedPrize.id);
  const remaining = remainingMap[selectedPrize.id] ?? selectedPrize.quantity;
  const isSoldOut = remaining <= 0;

  return (
    <aside className="flex h-full flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0D1424] p-5">
      {/* Header Row: Section Label & Index */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
        <span className="text-sm font-bold text-slate-300">현재 추첨 경품</span>
        <span className="font-mono-num text-xs font-semibold text-slate-400">
          {currentIdx + 1} / {prizes.length}
        </span>
      </div>

      {/* Main Prize Showcase */}
      <div className="my-4 flex flex-1 flex-col justify-center gap-4">
        {/* Prize Image Frame (4:3) */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#090E1A]">
          {selectedPrize.image && !imgError ? (
            <img
              src={selectedPrize.image}
              alt={selectedPrize.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover transition-transform duration-300 ${
                isSoldOut ? 'opacity-40 grayscale' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#111A2E] to-slate-900 p-6 text-center">
              <Gift className="mb-2.5 h-12 w-12 text-[#A3E635]/80" />
              <span className="text-sm font-semibold text-slate-400">
                {selectedPrize.name}
              </span>
            </div>
          )}

          {/* Subtle bottom contrast scrim when sold out */}
          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
              <span className="font-display text-3xl font-extrabold tracking-wider text-slate-200">
                추첨 완료
              </span>
            </div>
          )}
        </div>

        {/* Prize Name, Price & Remaining Quantity */}
        <div className="flex flex-col gap-2">
          <h2
            className="text-2xl font-black leading-snug tracking-tight text-white xl:text-[26px]"
            style={{ textWrap: 'balance' }}
          >
            {selectedPrize.name}
          </h2>

          {selectedPrize.price && (
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-xs font-medium text-slate-400">경품 금액</span>
              <span className="font-mono-num text-lg font-extrabold text-amber-300 tabular-nums">
                {selectedPrize.price}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-slate-800/70 pt-2.5">
            <span className="text-sm font-medium text-slate-400">남은 수량</span>
            <div className="flex items-baseline gap-1.5 font-mono-num">
              <span
                className={`font-display text-4xl font-extrabold leading-none ${
                  isSoldOut ? 'text-slate-500' : 'text-[#A3E635]'
                }`}
              >
                {remaining}
              </span>
              <span className="text-base font-semibold text-slate-500">
                / {selectedPrize.quantity}개
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls & Quick Prize Strip */}
      <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onPrevPrize}
            disabled={disabled || prizes.length <= 1}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/70 px-3 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span>이전 경품</span>
          </button>
          <button
            type="button"
            onClick={onNextPrize}
            disabled={disabled || prizes.length <= 1}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/70 px-3 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <span>다음 경품</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        {/* Compact Prize Queue List (scrollable if many prizes) */}
        {prizes.length > 1 && (
          <div className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
            {prizes.map((p) => {
              const rem = remainingMap[p.id] ?? p.quantity;
              const isSelected = p.id === selectedPrize.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectPrize(p.id)}
                  className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#84CC16]/15 font-bold text-[#A3E635]'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  } disabled:cursor-not-allowed`}
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono-num text-[11px]">
                    {p.price && (
                      <span className={isSelected ? 'text-amber-300/90' : 'text-slate-500'}>
                        {p.price}
                      </span>
                    )}
                    <span>
                      {rem}/{p.quantity}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
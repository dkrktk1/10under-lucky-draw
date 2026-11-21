import { RotateCcw, Trophy, X } from 'lucide-react';
import { PresidentFaces, Prize, WinnerRecord } from '../types/raffle';
import { PresidentAvatar } from './PresidentAvatar';

interface WinnerOverlayProps {
  records: WinnerRecord[];
  prize: Prize | undefined;
  faces: PresidentFaces;
  onReturnWinner: (recordId: string) => void;
  onClose: () => void;
}

export function WinnerOverlay({
  records,
  prize,
  faces,
  onReturnWinner,
  onClose,
}: WinnerOverlayProps) {
  if (records.length === 0) return null;

  const isSingle = records.length === 1;

  // Compute readable grid columns for large projector screens
  const gridColsClass =
    records.length <= 2
      ? 'grid-cols-2 max-w-2xl'
      : records.length <= 4
        ? 'grid-cols-2 sm:grid-cols-4 max-w-4xl'
        : records.length <= 6
          ? 'grid-cols-2 sm:grid-cols-3 max-w-4xl'
          : records.length <= 12
            ? 'grid-cols-3 sm:grid-cols-4 max-w-5xl'
            : 'grid-cols-3 sm:grid-cols-5 max-w-6xl';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#060911]/90 p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="당첨 번호 발표"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col items-center overflow-y-auto rounded-3xl border border-amber-400/35 bg-[#0C1322] px-6 py-8 shadow-2xl sm:px-10 sm:py-10">
        {/* Top-right Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Celebratory Header: President Cheer Portrait + Prize Title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-4">
            <div className="rounded-full border-2 border-amber-400 p-0.5 shadow-lg shadow-amber-500/20">
              <PresidentAvatar emotion="cheer" faces={faces} size={74} />
            </div>
            {prize?.imageUrl && (
              <div className="h-[74px] w-[98px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                <img
                  src={prize.imageUrl}
                  alt={prize.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-amber-400">
            <Trophy className="h-5 w-5" />
            <span className="font-display text-xl font-extrabold tracking-wide">
              FTP 폭발 당첨 발표
            </span>
          </div>

          <h2
            className="text-2xl font-black text-white sm:text-4xl"
            style={{ textWrap: 'balance' }}
          >
            {prize?.name ?? records[0].prizeName}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            축하합니다! 총 <span className="font-mono-num font-bold text-amber-300">{records.length}명</span> 당첨
          </p>
        </div>

        {/* Winner Display Area: Single Giant Gold Card vs Multi Grid */}
        {isSingle ? (
          <div className="my-8 w-full max-w-md animate-card-pop">
            <div className="relative flex flex-col items-center justify-center rounded-3xl border-2 border-amber-400/85 bg-gradient-to-b from-amber-500/20 via-[#151E33] to-[#0E1526] px-8 py-10 shadow-[0_0_60px_rgba(250,204,21,0.22)]">
              <span className="text-sm font-bold tracking-widest text-amber-300">
                WINNER NUMBER
              </span>
              <div className="mt-2 font-display text-[132px] font-extrabold leading-none tracking-tight text-amber-300 tabular-nums drop-shadow-[0_4px_24px_rgba(250,204,21,0.45)] sm:text-[168px]">
                {records[0].number}
              </div>
              <button
                type="button"
                onClick={() => onReturnWinner(records[0].id)}
                className="mt-6 flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/60 hover:bg-rose-950/50 hover:text-rose-200 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>현장 부재 · 번호 반환</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`my-7 grid w-full gap-4 ${gridColsClass}`}>
            {records.map((rec, idx) => (
              <div
                key={rec.id}
                style={{ animationDelay: `${Math.min(idx * 55, 550)}ms` }}
                className="group relative flex flex-col items-center justify-center rounded-2xl border border-amber-400/55 bg-gradient-to-b from-[#172138] to-[#0F172A] px-4 py-6 shadow-lg animate-card-pop"
              >
                <span className="font-mono-num text-xs font-semibold text-slate-400">
                  #{idx + 1}
                </span>
                <div className="my-1 font-display text-6xl font-extrabold leading-none text-amber-300 tabular-nums sm:text-7xl">
                  {rec.number}
                </div>
                <button
                  type="button"
                  onClick={() => onReturnWinner(rec.id)}
                  title="당첨자 부재 시 추첨 풀로 반환"
                  className="mt-3 flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-rose-500/70 hover:bg-rose-950/60 hover:text-rose-200 whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>부재 반환</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Primary Action Footer */}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#84CC16] px-10 py-3.5 text-lg font-extrabold text-slate-950 transition-colors hover:bg-[#A3E635] whitespace-nowrap"
          >
            확인 · 다음 추첨 준비 (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}

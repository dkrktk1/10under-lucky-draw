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

interface GridLayoutConfig {
  cols: number;
  rows: number;
  gapPx: number;
  dense: boolean;
  ultraDense: boolean;
}

function getBibGridConfig(count: number): GridLayoutConfig {
  if (count <= 2) return { cols: 2, rows: 1, gapPx: 24, dense: false, ultraDense: false };
  if (count === 3) return { cols: 3, rows: 1, gapPx: 20, dense: false, ultraDense: false };
  if (count === 4) return { cols: 2, rows: 2, gapPx: 20, dense: false, ultraDense: false };
  if (count <= 6) return { cols: 3, rows: 2, gapPx: 18, dense: false, ultraDense: false };
  if (count <= 8) return { cols: 4, rows: 2, gapPx: 16, dense: false, ultraDense: false };
  if (count <= 10) return { cols: 5, rows: 2, gapPx: 14, dense: true, ultraDense: false };
  if (count <= 12) return { cols: 4, rows: 3, gapPx: 14, dense: true, ultraDense: false };
  if (count <= 15) return { cols: 5, rows: 3, gapPx: 12, dense: true, ultraDense: false };
  if (count <= 18) return { cols: 6, rows: 3, gapPx: 10, dense: true, ultraDense: true };
  if (count <= 20) return { cols: 5, rows: 4, gapPx: 10, dense: true, ultraDense: true };
  if (count <= 24) return { cols: 6, rows: 4, gapPx: 10, dense: true, ultraDense: true };
  if (count <= 30) return { cols: 6, rows: 5, gapPx: 8, dense: true, ultraDense: true };
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  return { cols, rows, gapPx: 6, dense: true, ultraDense: true };
}

/** Deterministic mini barcode bars derived from bib number */
function buildBarcodeBars(bibNumber: number): Array<{ x: number; w: number }> {
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 36;
  let seed = (bibNumber * 2654435761) >>> 0;
  for (let i = 0; i < 18; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const w = i === 0 || i === 17 ? 2.4 : (seed % 3 === 0 ? 2.8 : seed % 2 === 0 ? 1.7 : 1.1);
    const gap = seed % 4 === 0 ? 2.6 : 1.6;
    bars.push({ x: cursor, w });
    cursor += w + gap;
    if (cursor > 112) break;
  }
  return bars;
}

interface MarathonBibCardProps {
  record: WinnerRecord;
  orderIndex: number;
  isSingle: boolean;
  dense: boolean;
  ultraDense: boolean;
  onReturn: () => void;
}

function MarathonBibCard({
  record,
  orderIndex,
  isSingle,
  dense,
  ultraDense,
  onReturn,
}: MarathonBibCardProps) {
  const numStr = String(record.number);
  const numberFontSize =
    numStr.length <= 2 ? 136 : numStr.length === 3 ? 118 : 96;
  const barcodeBars = buildBarcodeBars(record.number);
  const rankLabel = `#${String(orderIndex + 1).padStart(2, '0')}`;
  const serialCode = `BIB-${numStr.padStart(4, '0')}`;
  const clipId = `bib-clip-${record.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      style={{
        width: 'min(100cqw, calc(100cqh * 360 / 248))',
        height: 'min(100cqh, calc(100cqw * 248 / 360))',
        animationDelay: isSingle ? '0ms' : `${Math.min(orderIndex * 45, 450)}ms`,
      }}
      className="group relative select-none animate-card-pop"
    >
      {/* Authentic Tyvek Marathon Race Bib SVG */}
      <svg
        viewBox="0 0 360 248"
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full overflow-visible ${
          isSingle
            ? 'drop-shadow-[0_18px_46px_rgba(132,204,22,0.28)]'
            : 'drop-shadow-[0_10px_24px_rgba(0,0,0,0.52)]'
        }`}
        aria-label={`당첨 배번 ${record.number}번`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="360" height="248" rx="11" />
          </clipPath>
          <linearGradient id={`${clipId}-paper`} x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="68%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#EEF2F6" />
          </linearGradient>
          <linearGradient id={`${clipId}-header`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B1324" />
            <stop offset="78%" stopColor="#111C33" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* Base Tyvek White Paper */}
          <rect x="0" y="0" width="360" height="248" fill={`url(#${clipId}-paper)`} />

          {/* Top Marathon Event Banner */}
          <rect x="0" y="0" width="360" height="54" fill={`url(#${clipId}-header)`} />

          {/* Diagonal Racing Speed Stripes on Header Right */}
          <polygon points="274,0 296,0 278,54 256,54" fill="#84CC16" opacity="0.22" />
          <polygon points="298,0 310,0 292,54 280,54" fill="#A3E635" opacity="0.4" />

          {/* Header Bottom Lime Trim Line */}
          <rect x="0" y="51" width="360" height="4.5" fill={isSingle ? '#A3E635' : '#84CC16'} />

          {/* Club Brand Wordmark in Header */}
          <text
            x="40"
            y="34"
            fontSize="26"
            fontWeight="900"
            fontStyle="italic"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.02em' }}
          >
            <tspan fill="#A3E635">10</tspan>
            <tspan fill="#FFFFFF">under</tspan>
          </text>

          {/* Header Vertical Divider & Event Subtitle */}
          <line x1="122" y1="15" x2="122" y2="39" stroke="#334155" strokeWidth="1.5" />
          <text
            x="134"
            y="25"
            fill="#E2E8F0"
            fontSize="10.5"
            fontWeight="800"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.13em' }}
          >
            TRIATHLON CLUB
          </text>
          <text
            x="134"
            y="39"
            fill="#94A3B8"
            fontSize="9.5"
            fontWeight="700"
            style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}
          >
            YEAR-END OFFICIAL BIB
          </text>

          {/* Draw Order / Grand Prize Tag (right side, inside pinhole) */}
          <text
            x="316"
            y="34"
            textAnchor="end"
            fill={isSingle ? '#FACC15' : '#A3E635'}
            fontSize={isSingle ? '17' : '19'}
            fontWeight="900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
          >
            {isSingle ? 'WINNER' : rankLabel}
          </text>

          {/* Side Corral Color Bars (Classic Marathon Wave/Corral Indicators) */}
          <rect x="0" y="72" width="7" height="106" fill={isSingle ? '#FACC15' : '#84CC16'} />
          <rect x="353" y="72" width="7" height="106" fill={isSingle ? '#FACC15' : '#84CC16'} />

          {/* Subtle Inner Framing Hairlines */}
          <line x1="18" y1="64" x2="342" y2="64" stroke="#E2E8F0" strokeWidth="1" />

          {/* MASSIVE RACE BIB NUMBER */}
          <text
            x="180"
            y="130"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#090F1C"
            fontSize={numberFontSize}
            fontWeight="900"
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {numStr}
          </text>

          {/* Bottom Tear-Off Timing Chip Strip */}
          <rect x="0" y="196" width="360" height="52" fill="#E8EEF5" />

          {/* Perforated Tear Line */}
          <line
            x1="10"
            y1="196"
            x2="350"
            y2="196"
            stroke="#94A3B8"
            strokeWidth="1.3"
            strokeDasharray="5 4"
          />

          {/* Mini Race Barcode (left of tear-off strip) */}
          <g fill="#0F172A">
            {barcodeBars.map((bar, i) => (
              <rect key={i} x={bar.x} y="205" width={bar.w} height="20" rx="0.4" />
            ))}
          </g>
          <text
            x="74"
            y="235"
            textAnchor="middle"
            fill="#475569"
            fontSize="8.5"
            fontWeight="700"
            style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}
          >
            {serialCode}
          </text>

          {/* Center Strip Label */}
          {isSingle ? (
            <>
              <text
                x="224"
                y="218"
                textAnchor="middle"
                fill="#0F172A"
                fontSize="12.5"
                fontWeight="900"
                style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}
              >
                10under FTP CHAMPIONSHIP
              </text>
              <text
                x="224"
                y="233"
                textAnchor="middle"
                fill="#475569"
                fontSize="9"
                fontWeight="700"
                style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}
              >
                TIMING CHIP VERIFIED · FINISHER
              </text>
            </>
          ) : (
            <text
              x="170"
              y="223"
              textAnchor="middle"
              fill="#334155"
              fontSize="11"
              fontWeight="800"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}
            >
              10under · {rankLabel}
            </text>
          )}

          {/* Bottom Edge Accent Bar */}
          <rect x="0" y="242" width="360" height="6" fill="#84CC16" />
          {isSingle && <rect x="120" y="242" width="120" height="6" fill="#FACC15" />}

          {/* Left & Right Perforation Tear Notches */}
          <circle cx="0" cy="196" r="5" fill="#0B1220" />
          <circle cx="360" cy="196" r="5" fill="#0B1220" />
        </g>

        {/* Outer Crisp Paper Edge Stroke */}
        <rect
          x="0.75"
          y="0.75"
          width="358.5"
          height="246.5"
          rx="10.5"
          fill="none"
          stroke={isSingle ? '#A3E635' : '#CBD5E1'}
          strokeOpacity={isSingle ? 0.9 : 0.75}
          strokeWidth={isSingle ? '2' : '1.4'}
        />

        {/* 4 Corner Safety-Pin Punch Holes (옷핀 구멍) */}
        {[
          { cx: 19, cy: 19, darkBg: true },
          { cx: 341, cy: 19, darkBg: true },
          { cx: 19, cy: 226, darkBg: false },
          { cx: 341, cy: 226, darkBg: false },
        ].map((hole, i) => (
          <g key={i}>
            <circle
              cx={hole.cx}
              cy={hole.cy}
              r="7.4"
              fill="none"
              stroke={hole.darkBg ? '#475569' : '#94A3B8'}
              strokeWidth="1.6"
            />
            <circle cx={hole.cx} cy={hole.cy} r="5.2" fill="#0B1220" />
          </g>
        ))}
      </svg>

      {/* Multi-winner Compact Return Button neatly tucked inside right tear-off strip */}
      {!isSingle && (
        <button
          type="button"
          onClick={onReturn}
          title={`${record.number}번 현장 부재 시 추첨 풀로 반환`}
          className={`absolute right-[10.5%] bottom-[4.5%] flex items-center justify-center gap-1 rounded-md border border-slate-700/75 bg-slate-900/90 font-bold text-slate-200 shadow-sm transition-colors hover:border-rose-500 hover:bg-rose-600 hover:text-white whitespace-nowrap ${
            ultraDense
              ? 'h-5 px-1.5 text-[9px]'
              : dense
                ? 'h-6 px-2 text-[10px]'
                : 'h-7 px-2.5 text-[11px]'
          }`}
        >
          <RotateCcw className={ultraDense ? 'h-2.5 w-2.5 shrink-0' : 'h-3 w-3 shrink-0'} />
          <span>{ultraDense ? '반환' : '부재 반환'}</span>
        </button>
      )}
    </div>
  );
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
  const grid = getBibGridConfig(records.length);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#060911]/92 p-2.5 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="당첨 번호 발표"
    >
      <div className="relative flex h-[calc(100dvh-1.25rem)] w-full max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-[#84CC16]/35 bg-[#0B1220] px-4 py-3.5 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:px-7 sm:py-5">
        {/* COMPACT SINGLE-ROW CELEBRATORY HEADER (shrink-0, zero scroll waste) */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/90 pb-3 sm:pb-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="shrink-0 rounded-full border-2 border-[#A3E635] p-0.5 shadow-md shadow-[#84CC16]/20">
              <PresidentAvatar emotion="cheer" faces={faces} size={56} />
            </div>

            {prize?.imageUrl && (
              <div className="hidden h-14 w-[74px] shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 sm:block">
                <img
                  src={prize.imageUrl}
                  alt={prize.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-[#A3E635] sm:text-sm">
                <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="whitespace-nowrap">FTP 폭발 당첨 발표</span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-num text-amber-300 whitespace-nowrap">
                  총 {records.length}명 당첨
                </span>
              </div>
              <h2 className="truncate text-xl font-black tracking-tight text-white sm:text-3xl">
                {prize?.name ?? records[0].prizeName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FULL-VIEWPORT NO-SCROLL MARATHON BIB STAGE */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden py-3 sm:py-4">
          {isSingle ? (
            <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-4">
              <div
                className="flex min-h-0 w-full max-w-[680px] flex-1 items-center justify-center"
                style={{ containerType: 'size' }}
              >
                <MarathonBibCard
                  record={records[0]}
                  orderIndex={0}
                  isSingle
                  dense={false}
                  ultraDense={false}
                  onReturn={() => onReturnWinner(records[0].id)}
                />
              </div>

              <button
                type="button"
                onClick={() => onReturnWinner(records[0].id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/85 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/70 hover:bg-rose-950/60 hover:text-rose-200 whitespace-nowrap sm:text-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>현장 부재 · 번호 반환</span>
              </button>
            </div>
          ) : (
            <div
              className="grid h-full w-full min-h-0"
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                gap: `${grid.gapPx}px`,
              }}
            >
              {records.map((rec, idx) => (
                <div
                  key={rec.id}
                  className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
                  style={{ containerType: 'size' }}
                >
                  <MarathonBibCard
                    record={rec}
                    orderIndex={idx}
                    isSingle={false}
                    dense={grid.dense}
                    ultraDense={grid.ultraDense}
                    onReturn={() => onReturnWinner(rec.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMPACT PRIMARY ACTION FOOTER (shrink-0) */}
        <div className="flex shrink-0 items-center justify-center border-t border-slate-800/80 pt-3 sm:pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#84CC16] px-8 py-2.5 text-base font-extrabold text-slate-950 transition-colors hover:bg-[#A3E635] whitespace-nowrap sm:px-10 sm:py-3 sm:text-lg"
          >
            확인 · 다음 추첨 준비 (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}

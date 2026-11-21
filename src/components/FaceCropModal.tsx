import {
  PointerEvent,
  WheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Check, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface FaceCropModalProps {
  imageSrc: string;
  slotTitle: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const VIEW_SIZE = 300;
const CROP_SIZE = 240;
const OUTPUT_SIZE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function FaceCropModal({
  imageSrc,
  slotTitle,
  onConfirm,
  onCancel,
}: FaceCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const baseScale = natSize ? CROP_SIZE / Math.min(natSize.w, natSize.h) : 1;
  const currentScale = baseScale * zoom;
  const dispW = natSize ? natSize.w * currentScale : CROP_SIZE;
  const dispH = natSize ? natSize.h * currentScale : CROP_SIZE;

  const clampOffset = useCallback(
    (x: number, y: number, targetZoom: number) => {
      if (!natSize) return { x: 0, y: 0 };
      const scale = (CROP_SIZE / Math.min(natSize.w, natSize.h)) * targetZoom;
      const maxX = Math.max(0, (natSize.w * scale - CROP_SIZE) / 2);
      const maxY = Math.max(0, (natSize.h * scale - CROP_SIZE) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [natSize]
  );

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setErrorMsg(null);
  };

  const handleZoomChange = (nextZoomRaw: number) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
    setZoom(nextZoom);
    setOffset((prev) => {
      // Scale offset proportionally around center, then clamp cleanly
      const ratio = zoom > 0 ? nextZoom / zoom : 1;
      return clampOffset(prev.x * ratio, prev.y * ratio, nextZoom);
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!natSize) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    setOffset(
      clampOffset(
        dragStartRef.current.startOffsetX + dx,
        dragStartRef.current.startOffsetY + dy,
        zoom
      )
    );
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!natSize) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    handleZoomChange(zoom + delta);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img || !natSize) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMsg('브라우저 캔버스를 초기화할 수 없습니다.');
      return;
    }

    const sx = (dispW / 2 - offset.x - CROP_SIZE / 2) / currentScale;
    const sy = (dispH / 2 - offset.y - CROP_SIZE / 2) / currentScale;
    const sw = CROP_SIZE / currentScale;
    const sh = CROP_SIZE / currentScale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    try {
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
      onConfirm(croppedDataUrl);
    } catch {
      setErrorMsg('이미지 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#04070E]/90 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="회장님 얼굴 영역 지정"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0D1424] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h3 className="text-base font-extrabold text-white">얼굴 영역 지정</h3>
            <p className="text-xs text-slate-400">{slotTitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="취소"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Interactive Circular Crop Canvas */}
        <div className="flex flex-col items-center gap-4 px-5 py-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Move className="h-3.5 w-3.5 text-[#A3E635]" />
            <span>사진을 드래그해 이동하고, 슬라이더나 마우스 휠로 확대/축소하세요.</span>
          </div>

          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
            className={`relative overflow-hidden rounded-xl border border-slate-700 bg-[#070B14] touch-none select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Movable & Zoomable Source Photo */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="얼굴 영역 편집 대상"
              onLoad={handleImageLoad}
              onError={() => setErrorMsg('이미지를 불러올 수 없습니다.')}
              draggable={false}
              style={{
                width: `${dispW}px`,
                height: `${dispH}px`,
                transform: `translate3d(${VIEW_SIZE / 2 + offset.x - dispW / 2}px, ${VIEW_SIZE / 2 + offset.y - dispH / 2}px, 0)`,
              }}
              className="pointer-events-none absolute top-0 left-0 max-w-none will-change-transform"
            />

            {/* Darkened Outer Mask with Crisp Circular Cutout */}
            <svg
              width={VIEW_SIZE}
              height={VIEW_SIZE}
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              <defs>
                <mask id="face-crop-circle-mask">
                  <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="white" />
                  <circle
                    cx={VIEW_SIZE / 2}
                    cy={VIEW_SIZE / 2}
                    r={CROP_SIZE / 2}
                    fill="black"
                  />
                </mask>
              </defs>

              <rect
                width={VIEW_SIZE}
                height={VIEW_SIZE}
                fill="rgba(4, 7, 14, 0.72)"
                mask="url(#face-crop-circle-mask)"
              />

              {/* Circular Crop Ring */}
              <circle
                cx={VIEW_SIZE / 2}
                cy={VIEW_SIZE / 2}
                r={CROP_SIZE / 2}
                fill="none"
                stroke="#A3E635"
                strokeWidth="2.5"
              />

              {/* Subtle Center Guide Lines while Dragging */}
              {isDragging && (
                <g opacity="0.55" stroke="#A3E635" strokeWidth="1" strokeDasharray="4 4">
                  <line
                    x1={VIEW_SIZE / 2}
                    y1={(VIEW_SIZE - CROP_SIZE) / 2}
                    x2={VIEW_SIZE / 2}
                    y2={(VIEW_SIZE + CROP_SIZE) / 2}
                  />
                  <line
                    x1={(VIEW_SIZE - CROP_SIZE) / 2}
                    y1={VIEW_SIZE / 2}
                    x2={(VIEW_SIZE + CROP_SIZE) / 2}
                    y2={VIEW_SIZE / 2}
                  />
                </g>
              )}
            </svg>
          </div>

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
          )}

          {/* Zoom Controls */}
          <div className="flex w-full max-w-[300px] flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400">크기 조절 (확대/축소)</span>
              <span className="font-mono-num font-bold text-[#A3E635]">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.2)}
                disabled={zoom <= MIN_ZOOM}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-35"
                aria-label="축소"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.02}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                aria-label="확대 배율 슬라이더"
                className="h-2 flex-1 cursor-pointer accent-[#A3E635]"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.2)}
                disabled={zoom >= MAX_ZOOM}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-35"
                aria-label="확대"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                title="위치 및 크기 초기화"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                aria-label="위치 초기화"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-[#0A101D] px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={!natSize}
            className="flex items-center gap-1.5 rounded-lg bg-[#84CC16] px-5 py-2 text-sm font-extrabold text-slate-950 transition-colors hover:bg-[#A3E635] disabled:opacity-40 whitespace-nowrap"
          >
            <Check className="h-4 w-4" />
            <span>이 영역으로 적용</span>
          </button>
        </div>
      </div>
    </div>
  );
}

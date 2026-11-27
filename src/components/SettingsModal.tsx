import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Database,
  Download,
  FileUp,
  Gift,
  Hash,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
  UserCircle2,
  X,
} from 'lucide-react';
import { AppStorageState, FaceEmotion, PresidentFaces, Prize } from '../types/raffle';
import { resizeImageFileToDataUrl } from '../utils/imageResize';
import {
  exportAppStateJson,
  normalizeAssetPath,
  parseImportedAppStateJson,
} from '../utils/storage';
import { FaceCropModal } from './FaceCropModal';
import { PresidentAvatar } from './PresidentAvatar';

interface SettingsModalProps {
  appState: AppStorageState;
  prizes: Prize[];
  faces: PresidentFaces;
  poolStart: number;
  poolEnd: number;
  availableCount: number;
  winnersCount: number;
  remainingMap: Record<string, number>;
  storageBackend: 'indexeddb' | 'localstorage' | 'default';
  onAddPrize: (prize: Omit<Prize, 'id'>) => void;
  onUpdatePrize: (prize: Prize) => void;
  onDeletePrize: (prizeId: string) => void;
  onUpdateFace: (emotion: FaceEmotion, dataUrl: string | null) => void;
  onResetPool: (start: number, end: number) => void;
  onImportState: (imported: AppStorageState) => void;
  onResetAllData: () => void;
  onClose: () => void;
}

type SettingsTab = 'prizes' | 'faces' | 'pool' | 'backup';

const RESET_CONFIRM_WORD = '초기화';

const FACE_SLOTS: { key: FaceEmotion; title: string; desc: string }[] = [
  {
    key: 'calm',
    title: '1단계 · 평온 / 대기',
    desc: '평소 웜업 대기 및 Z1~Z3 초반 가속 구간에 표시됩니다.',
  },
  {
    key: 'pain',
    title: '2단계 · 고통 / 전력질주',
    desc: 'Z4~Z6 역치 돌파 및 댄싱 MAX 스프린트 구간에 표시됩니다.',
  },
  {
    key: 'cheer',
    title: '3단계 · 환호 / 당첨',
    desc: 'FTP 폭발 직후 당첨 발표 화면과 환호 포즈에 표시됩니다.',
  },
];

export function SettingsModal({
  appState,
  prizes,
  faces,
  poolStart,
  poolEnd,
  availableCount,
  winnersCount,
  remainingMap,
  storageBackend,
  onAddPrize,
  onUpdatePrize,
  onDeletePrize,
  onUpdateFace,
  onResetPool,
  onImportState,
  onResetAllData,
  onClose,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('prizes');
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'ok' | 'error';
  } | null>(null);

  // Prize Add/Edit Form State
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [prizeName, setPrizeName] = useState('');
  const [prizePrice, setPrizePrice] = useState('');
  const [prizeQty, setPrizeQty] = useState(1);
  const [prizeImage, setPrizeImage] = useState('');
  const [uploadingPrizeImg, setUploadingPrizeImg] = useState(false);

  // Pool Range Form State
  const [rangeStart, setRangeStart] = useState(poolStart);
  const [rangeEnd, setRangeEnd] = useState(poolEnd);
  const [confirmResetPool, setConfirmResetPool] = useState(false);

  // Deeply tucked Danger Zone & 2-Step Typed Confirmation Popup
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [showResetConfirmPopup, setShowResetConfirmPopup] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Interactive Face Cropper State
  const [cropDraft, setCropDraft] = useState<{
    emotion: FaceEmotion;
    title: string;
    objectUrl: string;
  } | null>(null);

  useEffect(() => {
    setRangeStart(poolStart);
    setRangeEnd(poolEnd);
  }, [poolStart, poolEnd]);

  const showToast = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setStatusMessage({ text, tone });
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  };

  const resetPrizeForm = () => {
    setEditingPrizeId(null);
    setPrizeName('');
    setPrizePrice('');
    setPrizeQty(1);
    setPrizeImage('');
  };

  const startEditPrize = (prize: Prize) => {
    setEditingPrizeId(prize.id);
    setPrizeName(prize.name);
    setPrizePrice(prize.price);
    setPrizeQty(prize.quantity);
    setPrizeImage(prize.image);
  };

  const handlePrizeImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPrizeImg(true);
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, {
        maxSize: 640,
        quality: 0.84,
        squareCrop: false,
      });
      setPrizeImage(dataUrl);
      showToast('경품 이미지가 적용되었습니다.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '이미지 처리 중 오류가 발생했습니다.',
        'error'
      );
    } finally {
      setUploadingPrizeImg(false);
    }
  };

  const handleSubmitPrize = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = prizeName.trim();
    if (!trimmedName) {
      showToast('경품 이름을 입력해주세요.', 'error');
      return;
    }
    const safeQty = Math.max(1, Math.min(500, Math.floor(Number(prizeQty) || 1)));
    const normalizedImage = normalizeAssetPath(prizeImage);
    const trimmedPrice = prizePrice.trim();

    if (editingPrizeId) {
      onUpdatePrize({
        id: editingPrizeId,
        name: trimmedName,
        price: trimmedPrice,
        quantity: safeQty,
        image: normalizedImage,
      });
      showToast('경품 정보가 수정되었습니다.');
    } else {
      onAddPrize({
        name: trimmedName,
        price: trimmedPrice,
        quantity: safeQty,
        image: normalizedImage,
      });
      showToast('새 경품이 등록되었습니다.');
    }
    resetPrizeForm();
  };

  const closeCropModal = () => {
    if (cropDraft) {
      URL.revokeObjectURL(cropDraft.objectUrl);
      setCropDraft(null);
    }
  };

  const handleFaceFileUpload = (emotion: FaceEmotion, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (cropDraft) {
      URL.revokeObjectURL(cropDraft.objectUrl);
    }

    const slot = FACE_SLOTS.find((s) => s.key === emotion);
    const objectUrl = URL.createObjectURL(file);
    setCropDraft({
      emotion,
      title: slot ? slot.title : '회장님 얼굴',
      objectUrl,
    });
  };

  const handleConfirmFaceCrop = (croppedDataUrl: string) => {
    if (!cropDraft) return;
    onUpdateFace(cropDraft.emotion, croppedDataUrl);
    closeCropModal();
    showToast('지정한 영역으로 회장님 얼굴이 저장되었습니다.');
  };

  const handleApplyPoolRange = () => {
    const s = Math.max(1, Math.min(9999, Math.floor(Number(rangeStart) || 1)));
    const e = Math.max(s, Math.min(9999, Math.floor(Number(rangeEnd) || s)));
    if (e - s + 1 > 2000) {
      showToast('번호 풀은 최대 2,000개까지 생성할 수 있습니다.', 'error');
      return;
    }

    if (winnersCount > 0 && !confirmResetPool) {
      setConfirmResetPool(true);
      return;
    }

    onResetPool(s, e);
    setRangeStart(s);
    setRangeEnd(e);
    setConfirmResetPool(false);
    showToast(`${s}번 ~ ${e}번 (총 ${e - s + 1}개) 번호 풀이 생성되었습니다.`);
  };

  const handleExportJson = () => {
    exportAppStateJson(appState);
    showToast('현재 상태(경품·사진·번호 풀·당첨 기록)를 .json 파일로 백업했습니다.');
  };

  const handleImportJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseImportedAppStateJson(text);
      if (!parsed.ok) {
        showToast(parsed.error, 'error');
        return;
      }
      onImportState(parsed.state);
      setRangeStart(parsed.state.poolStart);
      setRangeEnd(parsed.state.poolEnd);
      showToast(
        `백업 복구 완료: 경품 ${parsed.state.prizes.length}개 · 남은 번호 ${parsed.state.availableNumbers.length}개 · 당첨 ${parsed.state.winners.length}건`
      );
    } catch {
      showToast('백업 파일을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  const openResetConfirmPopup = () => {
    setResetConfirmInput('');
    setShowResetConfirmPopup(true);
  };

  const canConfirmReset = resetConfirmInput.trim() === RESET_CONFIRM_WORD;

  const handleConfirmedResetAll = () => {
    if (!canConfirmReset) return;
    onResetAllData();
    setRangeStart(1);
    setRangeEnd(100);
    setConfirmResetPool(false);
    setShowResetConfirmPopup(false);
    setResetConfirmInput('');
    setDangerZoneOpen(false);
    showToast('모든 데이터가 초기 상태로 안전하게 초기화되었습니다.');
  };

  const previewPoolCount =
    rangeEnd >= rangeStart ? Math.min(2000, rangeEnd - rangeStart + 1) : 0;

  const previewNormalizedImg = normalizeAssetPath(prizeImage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050810]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="설정 및 경품 관리"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0D1424] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-xl font-extrabold text-white">설정 및 경품 관리</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#0A101D] px-6 py-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-900/90 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('prizes')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'prizes'
                  ? 'bg-[#84CC16] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="h-4 w-4 shrink-0" />
              <span>경품 관리 ({prizes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('faces')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'faces'
                  ? 'bg-[#84CC16] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCircle2 className="h-4 w-4 shrink-0" />
              <span>회장님 얼굴</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pool')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'pool'
                  ? 'bg-[#84CC16] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hash className="h-4 w-4 shrink-0" />
              <span>추첨 번호 풀</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'backup'
                  ? 'bg-[#84CC16] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span>백업 · 복구</span>
            </button>
          </div>

          {statusMessage && (
            <span
              className={`text-xs font-bold ${
                statusMessage.tone === 'error' ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {statusMessage.text}
            </span>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* TAB 1: PRIZE MANAGEMENT */}
          {activeTab === 'prizes' && (
            <div className="flex flex-col gap-6">
              {/* Add / Edit Prize Form */}
              <form
                onSubmit={handleSubmitPrize}
                className="rounded-xl border border-slate-800 bg-[#10192C] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {editingPrizeId ? '경품 수정' : '새 경품 등록'}
                  </h3>
                  {editingPrizeId && (
                    <button
                      type="button"
                      onClick={resetPrizeForm}
                      className="text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      수정 취소
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      경품 이름
                    </label>
                    <input
                      type="text"
                      value={prizeName}
                      onChange={(e) => setPrizeName(e.target.value)}
                      placeholder="예: 가민 포러너 965 GPS 워치"
                      className="w-full rounded-lg border border-slate-700 bg-[#090F1C] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#A3E635] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      금액
                    </label>
                    <input
                      type="text"
                      value={prizePrice}
                      onChange={(e) => setPrizePrice(e.target.value)}
                      placeholder="예: 150,000원"
                      className="w-full rounded-lg border border-slate-700 bg-[#090F1C] px-2.5 py-2 font-mono-num text-sm text-white placeholder-slate-500 focus:border-[#A3E635] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      수량
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={prizeQty}
                      onChange={(e) => setPrizeQty(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-700 bg-[#090F1C] px-3 py-2 font-mono-num text-sm text-white focus:border-[#A3E635] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      이미지 경로 또는 업로드
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={prizeImage}
                        onChange={(e) => setPrizeImage(e.target.value)}
                        placeholder="./images/prize1.jpg"
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#090F1C] px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-[#A3E635] focus:outline-none"
                      />
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingPrizeImg ? '...' : '파일'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePrizeImageFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {previewNormalizedImg && (
                      <img
                        src={previewNormalizedImg}
                        alt="경품 미리보기"
                        referrerPolicy="no-referrer"
                        className="h-10 w-14 rounded-md border border-slate-700 object-cover"
                      />
                    )}
                    <span className="text-xs text-slate-400">
                      사전 등록 파일(<code className="font-mono-num text-slate-300">src/data/prizes.ts</code>) 또는{' '}
                      <code className="font-mono-num text-[#A3E635]">./images/파일명</code> 상대 경로를 지원합니다.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#84CC16] px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-[#A3E635] whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingPrizeId ? '수정 저장' : '경품 추가'}</span>
                  </button>
                </div>
              </form>

              {/* Prize List */}
              <div className="flex flex-col divide-y divide-slate-800/80 border-t border-slate-800/80">
                {prizes.map((p) => {
                  const rem = remainingMap[p.id] ?? p.quantity;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Gift className="h-5 w-5 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-white">{p.name}</div>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 font-mono-num">
                            {p.price && <span className="font-bold text-amber-300">{p.price}</span>}
                            {p.price && (
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                            )}
                            <span>
                              남은 수량{' '}
                              <strong className={rem > 0 ? 'text-[#A3E635]' : 'text-slate-500'}>
                                {rem}
                              </strong>{' '}
                              / {p.quantity}개
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditPrize(p)}
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>수정</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePrize(p.id)}
                          disabled={prizes.length <= 1}
                          title={
                            prizes.length <= 1 ? '최소 1개의 경품은 유지해야 합니다' : '경품 삭제'
                          }
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/60 hover:bg-rose-950/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35 whitespace-nowrap"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>삭제</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PRESIDENT 3-STAGE FACES */}
          {activeTab === 'faces' && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-slate-400">
                회장님 얼굴 사진 3장을 업로드하면 스마트 로라 추첨 애니메이션 단계에 맞춰 캐릭터의 얼굴이 실시간으로 교체됩니다. 사진 선택 후 원 안에서 드래그·확대하여 원하는 얼굴 영역을 직접 맞출 수 있으며, 업로드된 사진은 자동으로 브라우저에 저장됩니다.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {FACE_SLOTS.map((slot) => {
                  const hasCustom = Boolean(faces[slot.key]);
                  return (
                    <div
                      key={slot.key}
                      className="flex flex-col items-center rounded-xl border border-slate-800 bg-[#10192C] p-5 text-center"
                    >
                      <div className="mb-3 rounded-full border-2 border-slate-700 p-1">
                        <PresidentAvatar emotion={slot.key} faces={faces} size={108} />
                      </div>
                      <h3 className="text-base font-extrabold text-white">{slot.title}</h3>
                      <p className="mt-1.5 min-h-[36px] text-xs leading-relaxed text-slate-400">
                        {slot.desc}
                      </p>

                      <div className="mt-4 flex w-full items-center justify-center gap-2">
                        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#84CC16] px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-[#A3E635]">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{hasCustom ? '사진 변경' : '사진 업로드'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFaceFileUpload(slot.key, e)}
                            className="hidden"
                          />
                        </label>
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateFace(slot.key, null);
                              showToast('기본 일러스트로 복원되었습니다.');
                            }}
                            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                            title="기본 얼굴로 복원"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: NUMBER POOL RANGE */}
          {activeTab === 'pool' && (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-slate-800 bg-[#10192C] p-5">
                <h3 className="text-base font-bold text-white">추첨 번호 범위 생성 / 초기화</h3>
                <p className="mt-1 text-sm text-slate-400">
                  현재 남은 번호는{' '}
                  <strong className="font-mono-num text-white">{availableCount}개</strong> (범위:{' '}
                  {poolStart} ~ {poolEnd}, 기존 당첨 {winnersCount}건)입니다.
                </p>

                <div className="mt-5 grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                      시작 번호
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={rangeStart}
                      onChange={(e) => {
                        setRangeStart(Number(e.target.value));
                        setConfirmResetPool(false);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-[#090F1C] px-3.5 py-2.5 font-mono-num text-lg font-bold text-white focus:border-[#A3E635] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                      끝 번호
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={rangeEnd}
                      onChange={(e) => {
                        setRangeEnd(Number(e.target.value));
                        setConfirmResetPool(false);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-[#090F1C] px-3.5 py-2.5 font-mono-num text-lg font-bold text-white focus:border-[#A3E635] focus:outline-none"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleApplyPoolRange}
                      disabled={previewPoolCount <= 0}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-extrabold transition-colors disabled:opacity-40 whitespace-nowrap ${
                        confirmResetPool
                          ? 'bg-rose-600 text-white hover:bg-rose-500'
                          : 'bg-[#84CC16] text-slate-950 hover:bg-[#A3E635]'
                      }`}
                    >
                      {confirmResetPool
                        ? '기존 당첨 초기화 확인 (클릭)'
                        : `번호 풀 생성/초기화 (${previewPoolCount}개)`}
                    </button>
                  </div>
                </div>

                {confirmResetPool && (
                  <p className="mt-3 text-xs font-semibold text-rose-300">
                    이미 추첨된 당첨 기록({winnersCount}건)이 있습니다. 다시 한 번 버튼을 누르면 당첨 기록을 비우고 새 번호 풀을 생성합니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP, RESTORE & DEEP DANGER ZONE RESET */}
          {activeTab === 'backup' && (
            <div className="flex flex-col gap-5">
              {/* Real-time Auto-Save Summary */}
              <div className="rounded-xl border border-slate-800 bg-[#10192C] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white">실시간 자동 저장 및 새로고침 복구</h3>
                  <span className="font-mono-num text-xs font-semibold text-[#A3E635]">
                    {storageBackend === 'localstorage'
                      ? 'localStorage 실시간 자동 저장 활성'
                      : 'localStorage + IndexedDB 이중 자동 저장 활성'}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                  추첨·재추첨·반환·경품 선택이 일어나는 즉시 브라우저에 자동 저장됩니다. 행사 도중 실수로 새로고침(F5)하거나 브라우저를 닫았다가 다시 열어도 남은 번호 풀, 경품별 남은 수량, 당첨 기록, 현재 선택된 경품까지 직전 상태 그대로 복원됩니다.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-800/80 pt-3.5 text-xs text-slate-400">
                  <span>
                    등록 경품 <strong className="font-mono-num text-white">{prizes.length}종</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    남은 번호 <strong className="font-mono-num text-white">{availableCount}개</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    당첨 기록 <strong className="font-mono-num text-white">{winnersCount}건</strong>
                  </span>
                </div>
              </div>

              {/* Emergency JSON Backup & Restore Controls */}
              <div className="rounded-xl border border-slate-800 bg-[#10192C] p-5">
                <h3 className="text-base font-bold text-white">비상용 JSON 백업 및 복구</h3>
                <p className="mt-1 text-sm text-slate-400">
                  현재 추첨 진행 상태 전체를 파일로 저장해 두거나, 다른 PC/브라우저에서 백업 파일을 불러와 추첨을 바로 이어갈 수 있습니다.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-2 rounded-lg bg-[#84CC16] px-4 py-2.5 text-sm font-extrabold text-slate-950 transition-colors hover:bg-[#A3E635] whitespace-nowrap"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>현재 상태 파일로 백업 (.json)</span>
                  </button>

                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:border-slate-600 hover:bg-slate-700 whitespace-nowrap">
                    <FileUp className="h-4 w-4 shrink-0 text-[#A3E635]" />
                    <span>백업 파일 불러오기</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportJsonFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Deeply Hidden Danger Zone Disclosure (prevents accidental clicks during live event) */}
              <div className="mt-2 rounded-xl border border-slate-800/80 bg-[#0A0F1B]">
                <button
                  type="button"
                  onClick={() => setDangerZoneOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <ShieldAlert className="h-4 w-4 text-rose-400/80" />
                    <span>위험 구역 · 전체 초기화 (행사 종료 후에만 사용)</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 transition-transform ${
                      dangerZoneOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {dangerZoneOpen && (
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rose-500/20 bg-[#140D18] px-5 py-4">
                    <div>
                      <h4 className="text-sm font-bold text-rose-200">
                        전체 데이터 초기화 (2단계 입력 확인 필요)
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-400">
                        당첨 기록, 남은 번호 풀, 수정한 경품·사진을 모두 삭제하고{' '}
                        <code className="font-mono-num text-slate-300">src/data/prizes.ts</code> 기본값으로 되돌립니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openResetConfirmPopup}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/70 px-4 py-2 text-xs font-extrabold text-rose-200 transition-colors hover:bg-rose-600 hover:text-white whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span>전체 초기화</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            완료
          </button>
        </div>
      </div>

      {/* 2-Step Typed Confirmation Popup Dialog for Full Reset */}
      {showResetConfirmPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          aria-describedby="reset-confirm-desc"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/45 bg-[#0F172A] p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="reset-confirm-title" className="text-lg font-extrabold text-white">
                  전체 초기화 최종 확인
                </h3>
                <p id="reset-confirm-desc" className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  등록된 경품({prizes.length}개), 회장님 얼굴 사진, 추첨 번호 풀 및 당첨 기록({winnersCount}건)이 영구 삭제되며 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-[#090F1C] p-3.5">
              <label
                htmlFor="reset-confirm-keyword"
                className="block text-xs font-semibold text-slate-300"
              >
                실수로 초기화되는 것을 방지하기 위해 아래 입력란에{' '}
                <strong className="text-rose-400">&ldquo;{RESET_CONFIRM_WORD}&rdquo;</strong>를 직접 입력해주세요.
              </label>
              <input
                id="reset-confirm-keyword"
                type="text"
                autoFocus
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirmReset) {
                    handleConfirmedResetAll();
                  }
                }}
                placeholder={RESET_CONFIRM_WORD}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0D1424] px-3 py-2 text-sm font-bold text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmPopup(false);
                  setResetConfirmInput('');
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!canConfirmReset}
                onClick={handleConfirmedResetAll}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-35 whitespace-nowrap"
              >
                전체 초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Circular Face Cropper Overlay */}
      {cropDraft && (
        <FaceCropModal
          imageSrc={cropDraft.objectUrl}
          slotTitle={cropDraft.title}
          onConfirm={handleConfirmFaceCrop}
          onCancel={closeCropModal}
        />
      )}
    </div>
  );
}

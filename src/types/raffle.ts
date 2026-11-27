export type PowerZone = 1 | 2 | 3 | 4 | 5 | 6;

export type DrawPhase =
  | 'IDLE'
  | 'WARMUP_Z1_Z3'
  | 'THRESHOLD_Z4_Z5'
  | 'SPRINT_Z6'
  | 'EXPLOSION';

export type FaceEmotion = 'calm' | 'pain' | 'cheer';

export interface PresidentFaces {
  calm: string | null;
  pain: string | null;
  cheer: string | null;
}

export interface Prize {
  id: string;
  name: string;
  price: string;
  quantity: number;
  image: string;
}

export interface WinnerRecord {
  id: string;
  prizeId: string;
  prizeName: string;
  number: number;
  drawnAt: string;
}

export interface PowerPoint {
  watts: number;
  zone: PowerZone;
}

export interface TelemetryState {
  watts: number;
  rpm: number;
  bpm: number;
  zone: PowerZone;
  wkg: number;
  progress: number;
  powerHistory: PowerPoint[];
}

export interface AppStorageState {
  version: number;
  poolStart: number;
  poolEnd: number;
  availableNumbers: number[];
  prizes: Prize[];
  selectedPrizeId: string;
  winners: WinnerRecord[];
  faces: PresidentFaces;
  soundEnabled: boolean;
}

export interface PowerZoneMeta {
  zone: PowerZone;
  code: string;
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  minWatts: number;
}

export const POWER_ZONES: PowerZoneMeta[] = [
  {
    zone: 1,
    code: 'Z1',
    label: 'Z1 회복 주행',
    shortLabel: '회복',
    color: '#94A3B8',
    glow: 'rgba(148, 163, 184, 0.35)',
    minWatts: 0,
  },
  {
    zone: 2,
    code: 'Z2',
    label: 'Z2 지구력',
    shortLabel: '지구력',
    color: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.45)',
    minWatts: 180,
  },
  {
    zone: 3,
    code: 'Z3',
    label: 'Z3 템포 가속',
    shortLabel: '템포',
    color: '#22C55E',
    glow: 'rgba(34, 197, 94, 0.45)',
    minWatts: 270,
  },
  {
    zone: 4,
    code: 'Z4',
    label: 'Z4 FTP 역치',
    shortLabel: '역치',
    color: '#FACC15',
    glow: 'rgba(250, 204, 21, 0.5)',
    minWatts: 370,
  },
  {
    zone: 5,
    code: 'Z5',
    label: 'Z5 VO2 MAX',
    shortLabel: 'VO2 MAX',
    color: '#FC6719',
    glow: 'rgba(252, 103, 25, 0.6)',
    minWatts: 520,
  },
  {
    zone: 6,
    code: 'Z6',
    label: 'Z6 FTP 폭발!',
    shortLabel: 'MAX 폭발',
    color: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.75)',
    minWatts: 720,
  },
];

export function getZoneFromWatts(watts: number): PowerZone {
  if (watts >= 720) return 6;
  if (watts >= 520) return 5;
  if (watts >= 370) return 4;
  if (watts >= 270) return 3;
  if (watts >= 180) return 2;
  return 1;
}

export function getZoneMeta(zone: PowerZone): PowerZoneMeta {
  return POWER_ZONES[zone - 1];
}

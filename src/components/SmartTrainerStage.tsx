import { useEffect, useRef, useState } from 'react';
import {
  DrawPhase,
  FaceEmotion,
  POWER_ZONES,
  PresidentFaces,
  TelemetryState,
  getZoneMeta,
} from '../types/raffle';
import { PresidentAvatar } from './PresidentAvatar';

interface SmartTrainerStageProps {
  phase: DrawPhase;
  telemetry: TelemetryState;
  faces: PresidentFaces;
  availableNumbers: number[];
  latestDrawnNumbers: number[];
}

interface Point2D {
  x: number;
  y: number;
}

const BALL_SPECS = [
  { id: 0, color: '#A3E635', seed: 0.3, radiusRatio: 0.78, label: 7 },
  { id: 1, color: '#38BDF8', seed: 0.9, radiusRatio: 0.6, label: 14 },
  { id: 2, color: '#FACC15', seed: 1.5, radiusRatio: 0.82, label: 23 },
  { id: 3, color: '#22C55E', seed: 2.1, radiusRatio: 0.5, label: 31 },
  { id: 4, color: '#F43F5E', seed: 2.7, radiusRatio: 0.72, label: 42 },
  { id: 5, color: '#A855F7', seed: 3.3, radiusRatio: 0.64, label: 55 },
  { id: 6, color: '#F8FAFC', seed: 3.9, radiusRatio: 0.8, label: 68 },
  { id: 7, color: '#FB923C', seed: 4.5, radiusRatio: 0.45, label: 77 },
  { id: 8, color: '#2DD4BF', seed: 5.1, radiusRatio: 0.68, label: 84 },
  { id: 9, color: '#EAB308', seed: 5.7, radiusRatio: 0.55, label: 91 },
  { id: 10, color: '#60A5FA', seed: 0.6, radiusRatio: 0.74, label: 19 },
  { id: 11, color: '#EC4899', seed: 1.8, radiusRatio: 0.42, label: 63 },
  { id: 12, color: '#34D399', seed: 3.0, radiusRatio: 0.84, label: 5 },
  { id: 13, color: '#FBBF24', seed: 4.2, radiusRatio: 0.58, label: 88 },
  { id: 14, color: '#818CF8', seed: 5.4, radiusRatio: 0.7, label: 36 },
  { id: 15, color: '#FB7185', seed: 2.4, radiusRatio: 0.62, label: 99 },
];

/**
 * 2-bone inverse kinematics for realistic cycling leg motion (hip -> knee -> pedal).
 * Bending knee forward (+X direction for a right-facing cyclist).
 */
function solveKnee(hip: Point2D, foot: Point2D, thighLen: number, shinLen: number): Point2D {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(thighLen - shinLen) + 2;
  const maxDist = thighLen + shinLen - 2;
  const dist = Math.max(minDist, Math.min(maxDist, rawDist));

  const cosAngle = (thighLen * thighLen + dist * dist - shinLen * shinLen) / (2 * thighLen * dist);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  const baseAngle = Math.atan2(dy, dx);
  const kneeAngle = baseAngle - Math.acos(clampedCos);

  return {
    x: hip.x + Math.cos(kneeAngle) * thighLen,
    y: hip.y + Math.sin(kneeAngle) * thighLen,
  };
}

function getEmotionForPhase(phase: DrawPhase): FaceEmotion {
  if (phase === 'EXPLOSION') return 'cheer';
  if (phase === 'THRESHOLD_Z4_Z5' || phase === 'SPRINT_Z6') return 'pain';
  return 'calm';
}

export function SmartTrainerStage({
  phase,
  telemetry,
  faces,
  availableNumbers,
  latestDrawnNumbers,
}: SmartTrainerStageProps) {
  const [crankAngle, setCrankAngle] = useState(0);
  const [drumAngle, setDrumAngle] = useState(0);
  const [roadOffset, setRoadOffset] = useState(0);
  const [fxTick, setFxTick] = useState(0);

  const rpmRef = useRef(telemetry.rpm);
  const wattsRef = useRef(telemetry.watts);
  const phaseRef = useRef(phase);
  rpmRef.current = telemetry.rpm;
  wattsRef.current = telemetry.watts;
  phaseRef.current = phase;

  // Smooth 60fps crank, raffle drum & road scrolling animation synced to live RPM/Watts
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let angleAcc = 0;
    let drumAcc = 0;
    let roadAcc = 0;
    let tickAcc = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const curPhase = phaseRef.current;
      const activeRpm = curPhase === 'EXPLOSION' ? 35 : Math.max(45, rpmRef.current);
      const radPerSec = (activeRpm / 60) * Math.PI * 2;
      angleAcc = (angleAcc + radPerSec * dt) % (Math.PI * 200);
      roadAcc = (roadAcc + activeRpm * 2.9 * dt) % 120;
      tickAcc += dt;

      // Raffle drum spins while drawing, powered directly by the bike's live wattage
      let drumDegPerSec = 0;
      if (curPhase === 'WARMUP_Z1_Z3') {
        drumDegPerSec = 140 + (wattsRef.current / 360) * 190;
      } else if (curPhase === 'THRESHOLD_Z4_Z5') {
        drumDegPerSec = 360 + ((wattsRef.current - 350) / 360) * 320;
      } else if (curPhase === 'SPRINT_Z6') {
        drumDegPerSec = 760 + ((wattsRef.current - 700) / 420) * 520;
      } else if (curPhase === 'EXPLOSION') {
        drumDegPerSec = 26;
      }
      drumAcc = (drumAcc + drumDegPerSec * dt) % 36000;

      setCrankAngle(angleAcc);
      setDrumAngle(drumAcc);
      setRoadOffset(roadAcc);
      setFxTick(tickAcc);

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const zoneMeta = getZoneMeta(telemetry.zone);
  const emotion = getEmotionForPhase(phase);
  const isDrawing =
    phase === 'WARMUP_Z1_Z3' || phase === 'THRESHOLD_Z4_Z5' || phase === 'SPRINT_Z6';
  const isDancing = phase === 'SPRINT_Z6';
  const isSweating = phase === 'THRESHOLD_Z4_Z5' || phase === 'SPRINT_Z6';
  const isVictory = phase === 'EXPLOSION';

  // Dynamic out-of-saddle dancing kinematics
  const danceWave = Math.sin(crankAngle);
  const danceBounce = Math.abs(Math.cos(crankAngle));
  const bikeRockDeg = isDancing
    ? danceWave * 4.5
    : phase === 'THRESHOLD_Z4_Z5'
      ? danceWave * 1.4
      : 0;
  const bikeRockX = isDancing ? danceWave * 10 : 0;
  const riderLiftY = isDancing
    ? -26 - danceBounce * 9
    : isVictory
      ? -14
      : -Math.abs(danceWave) * 3;
  const riderShiftX = isDancing ? 20 + danceWave * 6 : isVictory ? -6 : 0;

  // --- STAGE LAYOUT COORDINATES (viewBox 0 0 1020 560) ---
  // Left: TOWERING Giant Prize Raffle Machine reaching all the way to the top of the screen
  const floorY = 522;
  const machineCenter: Point2D = { x: 244, y: 214 };
  const drumRadius = 176; // Towering diameter = 352px (reaches y=38, beacon top y=12!)
  const machineSocket: Point2D = { x: 386, y: 482 };

  // Right: Smart Trainer + Road/TT Bike + President (clean headroom under the top-right HUD)
  const bikeShiftX = 336;
  const bikeShiftY = 118;
  const bb: Point2D = { x: 375 + bikeShiftX, y: 344 + bikeShiftY }; // 711, 462
  const crankRadius = 36;
  const rearHub: Point2D = { x: 228 + bikeShiftX, y: 344 + bikeShiftY }; // 564, 462
  const frontHub: Point2D = { x: 550 + bikeShiftX, y: 344 + bikeShiftY }; // 886, 462
  const seatTop: Point2D = { x: 310 + bikeShiftX, y: 228 + bikeShiftY }; // 646, 346
  const headTop: Point2D = { x: 502 + bikeShiftX, y: 224 + bikeShiftY }; // 838, 342
  const barGrip: Point2D = { x: 548 + bikeShiftX, y: 218 + bikeShiftY }; // 884, 336
  const trainerPowerPort: Point2D = { x: rearHub.x - 36, y: 490 }; // 528, 490

  // Left (far) & Right (near) pedal positions
  const rightPedal: Point2D = {
    x: bb.x + Math.cos(crankAngle) * crankRadius,
    y: bb.y + Math.sin(crankAngle) * crankRadius,
  };
  const leftPedal: Point2D = {
    x: bb.x + Math.cos(crankAngle + Math.PI) * crankRadius,
    y: bb.y + Math.sin(crankAngle + Math.PI) * crankRadius,
  };

  // Rider body landmarks
  const hip: Point2D = {
    x: 314 + bikeShiftX + riderShiftX,
    y: 214 + bikeShiftY + riderLiftY,
  };
  const shoulder: Point2D = {
    x: (isVictory ? 356 : 440) + bikeShiftX + riderShiftX * 0.72,
    y: (isVictory ? 128 : 148) + bikeShiftY + riderLiftY * 0.88 + (isDancing ? danceBounce * 5 : 0),
  };
  const headCenter: Point2D = {
    x: shoulder.x + (isVictory ? 14 : 44),
    y: shoulder.y - (isVictory ? 42 : 24),
  };

  // Leg IK calculations
  const thighLen = 88;
  const shinLen = 86;
  const rightKnee = solveKnee(hip, rightPedal, thighLen, shinLen);
  const leftKnee = solveKnee(
    { x: hip.x + 4, y: hip.y + 2 },
    leftPedal,
    thighLen,
    shinLen
  );

  // Arm pose (gripping drops vs celebratory raised arms in EXPLOSION)
  const handTarget: Point2D = isVictory
    ? { x: shoulder.x + 56, y: shoulder.y - 76 }
    : { x: barGrip.x + (isDancing ? danceWave * 5 : 0), y: barGrip.y + (isDancing ? 2 : 0) };
  const backHandTarget: Point2D = isVictory
    ? { x: shoulder.x - 40, y: shoulder.y - 80 }
    : { x: barGrip.x - 8, y: barGrip.y - 2 };
  const elbow: Point2D = isVictory
    ? { x: shoulder.x + 40, y: shoulder.y - 32 }
    : { x: (shoulder.x + handTarget.x) / 2 - 6, y: (shoulder.y + handTarget.y) / 2 + 22 };
  const backElbow: Point2D = isVictory
    ? { x: shoulder.x - 26, y: shoulder.y - 36 }
    : { x: (shoulder.x + backHandTarget.x) / 2 - 4, y: (shoulder.y + backHandTarget.y) / 2 + 18 };

  const flywheelDeg = ((crankAngle * 180) / Math.PI) * 3.2;

  const shakeClass =
    phase === 'SPRINT_Z6'
      ? 'animate-shake-intense'
      : phase === 'THRESHOLD_Z4_Z5'
        ? 'animate-shake-mild'
        : '';

  const uploadedFaceSrc = faces[emotion];

  // Dynamic sweat droplets coordinates
  const sweatDrops = isSweating
    ? [0, 1, 2, 3, 4].map((idx) => {
        const speed = phase === 'SPRINT_Z6' ? 2.5 : 1.7;
        const t = (fxTick * speed + idx * 0.21) % 1;
        const startX = headCenter.x - 14 - (idx % 3) * 8;
        const startY = headCenter.y - 18 + (idx % 2) * 14;
        const x = startX - t * (72 + idx * 14);
        const y = startY - t * (34 - idx * 5) + t * t * 92;
        const opacity = t < 0.15 ? t / 0.15 : 1 - t;
        return { id: idx, x, y, opacity };
      })
    : [];

  // Rolling preview number inside the raffle machine during spin
  const rollingNumber =
    availableNumbers.length > 0
      ? availableNumbers[
          Math.floor(fxTick * (isDancing ? 24 : 14)) % availableNumbers.length
        ]
      : 0;

  // Power Cable Bezier curve (from trainerPowerPort -> machineSocket)
  const cableStart = trainerPowerPort;
  const cableCtrl1: Point2D = { x: 488, y: 536 };
  const cableCtrl2: Point2D = { x: 430, y: 534 };
  const cableEnd = machineSocket;
  const cablePathD = `M ${cableStart.x} ${cableStart.y} C ${cableCtrl1.x} ${cableCtrl1.y}, ${cableCtrl2.x} ${cableCtrl2.y}, ${cableEnd.x} ${cableEnd.y}`;

  const evalCablePoint = (t: number): Point2D => {
    const u = 1 - t;
    const x =
      u * u * u * cableStart.x +
      3 * u * u * t * cableCtrl1.x +
      3 * u * t * t * cableCtrl2.x +
      t * t * t * cableEnd.x;
    const y =
      u * u * u * cableStart.y +
      3 * u * u * t * cableCtrl1.y +
      3 * u * t * t * cableCtrl2.y +
      t * t * t * cableEnd.y;
    return { x, y };
  };

  const energyPulseSpeed = isDancing ? 3.2 : isDrawing ? 1.8 : 0.45;
  const energyPulses = [0, 1, 2, 3, 4].map((idx) => {
    const t = (fxTick * energyPulseSpeed + idx * 0.2) % 1;
    const pt = evalCablePoint(t);
    return { id: idx, x: pt.x, y: pt.y, t };
  });

  // Raffle balls tumbling inside the giant glass drum
  const drumRad = (drumAngle * Math.PI) / 180;
  const raffleBalls = BALL_SPECS.map((ball, idx) => {
    if (!isDrawing && !isVictory) {
      // Resting naturally in the lower bowl of the huge drum when IDLE
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      const bx = machineCenter.x - 74 + col * 36 + (row % 2) * 14;
      const by = machineCenter.y + 114 - row * 30 + Math.sin(fxTick * 2 + idx) * 2;
      return { ...ball, x: bx, y: by };
    }
    // Swirling rapidly inside the giant drum synced to wattage & drumAngle
    const orbitSpeed = 1 + (idx % 3) * 0.35;
    const angle = drumRad * orbitSpeed + ball.seed * 2.1;
    const bounce = Math.sin(drumRad * 1.7 + idx * 1.3) * (isDancing ? 30 : 20);
    const r = Math.min(drumRadius - 22, Math.max(24, drumRadius * ball.radiusRatio + bounce));
    const bx = machineCenter.x + Math.cos(angle) * r;
    const by = machineCenter.y + Math.sin(angle) * r;
    return { ...ball, x: bx, y: by };
  });

  // Machine subtle vibration during Z5-Z6
  const machineJitterX = isDancing
    ? Math.sin(fxTick * 62) * 4
    : phase === 'THRESHOLD_Z4_Z5'
      ? Math.sin(fxTick * 42) * 1.8
      : 0;
  const machineJitterY = isDancing ? Math.cos(fxTick * 58) * 3 : 0;

  const primaryWinnerNumber = latestDrawnNumbers[0];
  const extraWinnerCount = Math.max(0, latestDrawnNumbers.length - 1);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0B111E] select-none ${shakeClass}`}
    >
      {/* Dynamic Zone Ambient Backlight */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 38% 52%, ${zoneMeta.glow} 0%, rgba(11, 17, 30, 0) 64%)`,
          opacity: phase === 'IDLE' ? 0.32 : phase === 'SPRINT_Z6' ? 1 : 0.72,
        }}
      />

      {/* Explosion Flash Overlay */}
      {isVictory && (
        <div
          className="pointer-events-none absolute inset-0 z-20 animate-flash-burst"
          style={{
            background:
              'radial-gradient(circle at 28% 45%, rgba(250, 204, 21, 0.8) 0%, rgba(252, 103, 25, 0.35) 45%, transparent 75%)',
          }}
        />
      )}

      {/* FULL-BLEED SVG STAGE: Giant Towering Raffle Machine (Left) + Smart Trainer Cyclist (Right) */}
      <div className="relative z-0 flex h-full w-full items-center justify-center p-1 sm:p-2">
        <svg
          viewBox="0 0 1020 560"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label="전선으로 연결된 초대형 경품 추첨기를 페달링 전력으로 돌리는 텐언더 회장님"
        >
          <defs>
            <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#121C32" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#080C14" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="jersey-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A3E635" />
              <stop offset="100%" stopColor="#65A30D" />
            </linearGradient>
            <linearGradient id="flame-outer" x1="1" y1="0.5" x2="0" y2="0.5">
              <stop offset="0%" stopColor="#FACC15" />
              <stop offset="45%" stopColor="#FC6719" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="flame-inner" x1="1" y1="0.5" x2="0" y2="0.5">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#FC6719" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="drum-glass" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
              <stop offset="65%" stopColor="#0F172A" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.88" />
            </radialGradient>
            <linearGradient id="ticket-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <clipPath id="president-head-clip">
              <circle cx={headCenter.x} cy={headCenter.y} r="35" />
            </clipPath>
            <clipPath id="drum-inner-clip">
              <circle cx={machineCenter.x} cy={machineCenter.y} r={drumRadius - 7} />
            </clipPath>
          </defs>

          {/* Zwift-inspired Perspective Virtual Road Floor */}
          <g>
            <polygon
              points={`10,${floorY + 26} 1010,${floorY + 26} 945,${floorY - 48} 75,${floorY - 48}`}
              fill="url(#floor-grad)"
            />
            <line
              x1="75"
              y1={floorY - 48}
              x2="10"
              y2={floorY + 26}
              stroke={zoneMeta.color}
              strokeWidth="2.5"
              opacity="0.65"
            />
            <line
              x1="945"
              y1={floorY - 48}
              x2="1010"
              y2={floorY + 26}
              stroke={zoneMeta.color}
              strokeWidth="2.5"
              opacity="0.65"
            />
            <line
              x1="75"
              y1={floorY - 48}
              x2="945"
              y2={floorY - 48}
              stroke="#1E293B"
              strokeWidth="1.5"
            />

            {/* Moving center speed dashes */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const xPos = 930 - ((i * 122 + roadOffset) % 920);
              return (
                <rect
                  key={i}
                  x={xPos}
                  y={floorY - 12}
                  width={phase === 'SPRINT_Z6' ? 72 : 44}
                  height="5"
                  rx="2.5"
                  fill={zoneMeta.color}
                  opacity={phase === 'IDLE' ? 0.2 : 0.65}
                />
              );
            })}
          </g>

          {/* Background Speed Lines during Z4-Z6 */}
          {(phase === 'THRESHOLD_Z4_Z5' || phase === 'SPRINT_Z6') && (
            <g opacity={phase === 'SPRINT_Z6' ? 0.68 : 0.32}>
              {[130, 210, 290, 370, 425].map((yPos, idx) => {
                const lineX =
                  1000 - ((fxTick * (phase === 'SPRINT_Z6' ? 1050 : 580) + idx * 205) % 1060);
                return (
                  <line
                    key={idx}
                    x1={lineX}
                    y1={yPos}
                    x2={lineX + (phase === 'SPRINT_Z6' ? 145 : 85)}
                    y2={yPos}
                    stroke={idx % 2 === 0 ? zoneMeta.color : '#38BDF8'}
                    strokeWidth={phase === 'SPRINT_Z6' ? 3 : 2}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          {/* ================================================================= */}
          {/* 1. POWER CABLE CONNECTING SMART TRAINER <-> GIANT RAFFLE MACHINE  */}
          {/* ================================================================= */}
          <g>
            {/* Floor shadow under cable */}
            <path
              d={`M ${cableStart.x} ${cableStart.y + 8} C ${cableCtrl1.x} ${cableCtrl1.y + 6}, ${cableCtrl2.x} ${cableCtrl2.y + 6}, ${cableEnd.x} ${cableEnd.y + 8}`}
              fill="none"
              stroke="#020617"
              strokeWidth="13"
              strokeLinecap="round"
              opacity="0.65"
            />
            {/* Outer Insulated Heavy-Duty Cable Jacket */}
            <path
              d={cablePathD}
              fill="none"
              stroke="#1E293B"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d={cablePathD}
              fill="none"
              stroke="#334155"
              strokeWidth="7.5"
              strokeLinecap="round"
            />
            {/* Inner Live Neon Conduit Core */}
            <path
              d={cablePathD}
              fill="none"
              stroke={isVictory ? '#FACC15' : zoneMeta.color}
              strokeWidth={isDancing ? 4.5 : isDrawing ? 3.5 : 2}
              strokeDasharray={isDrawing ? '12 10' : '6 10'}
              strokeDashoffset={fxTick * (isDancing ? 240 : isDrawing ? 130 : 28)}
              strokeLinecap="round"
              opacity={phase === 'IDLE' ? 0.45 : 0.95}
            />

            {/* Animated Electric Energy Packets Racing Bike -> Machine */}
            {energyPulses.map((pulse) => (
              <g key={pulse.id}>
                <circle
                  cx={pulse.x}
                  cy={pulse.y}
                  r={isDancing ? 8.5 : isDrawing ? 6.5 : 3.5}
                  fill={isVictory ? '#FACC15' : zoneMeta.color}
                  opacity={phase === 'IDLE' ? 0.35 : 0.45}
                />
                <circle
                  cx={pulse.x}
                  cy={pulse.y}
                  r={isDancing ? 4.2 : isDrawing ? 3 : 2}
                  fill="#FFFFFF"
                  opacity={phase === 'IDLE' ? 0.5 : 0.95}
                />
              </g>
            ))}

            {/* High-Voltage Lightning Arcs jumping over the cable in Z6 */}
            {isDancing && (
              <g>
                <polyline
                  points={`${cableStart.x},${cableStart.y - 6} ${480},${482 + Math.sin(fxTick * 62) * 14} ${448},${506} ${416},${474 + Math.cos(fxTick * 58) * 12} ${cableEnd.x},${cableEnd.y - 4}`}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={`${cableStart.x - 4},${cableStart.y + 4} ${466},${524 + Math.cos(fxTick * 70) * 10} ${434},${494} ${cableEnd.x + 4},${cableEnd.y + 4}`}
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {/* Heavy-duty Plug Connectors on both ends */}
            <rect
              x={cableStart.x - 8}
              y={cableStart.y - 8}
              width="16"
              height="16"
              rx="3"
              fill="#0F172A"
              stroke={zoneMeta.color}
              strokeWidth="2"
            />
            <rect
              x={cableEnd.x - 10}
              y={cableEnd.y - 9}
              width="18"
              height="18"
              rx="3"
              fill="#0F172A"
              stroke={zoneMeta.color}
              strokeWidth="2"
            />

            {/* Live Power Transfer Tag above Cable */}
            <g transform="translate(450, 488)">
              <rect
                x="-38"
                y="-11"
                width="76"
                height="22"
                rx="4"
                fill="#0D1526"
                stroke={isDrawing ? zoneMeta.color : '#334155'}
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill={isDrawing ? zoneMeta.color : '#94A3B8'}
                fontSize="12"
                fontWeight="800"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {`⚡ ${Math.round(telemetry.watts)}W`}
              </text>
            </g>
          </g>

          {/* ================================================================= */}
          {/* 2. TOWERING GIANT PRIZE RAFFLE MACHINE (LEFT, FULL HEIGHT)        */}
          {/* ================================================================= */}
          <g transform={`translate(${machineJitterX}, ${machineJitterY})`}>
            {/* Floor shadow under giant machine */}
            <ellipse
              cx={machineCenter.x}
              cy={floorY + 2}
              rx="168"
              ry="16"
              fill="#020617"
              opacity="0.82"
            />

            {/* Victory Golden Spotlight Halo behind Machine */}
            {isVictory && (
              <g opacity="0.72">
                <circle
                  cx={machineCenter.x}
                  cy={machineCenter.y}
                  r={drumRadius + 32}
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth="4"
                  strokeDasharray="18 14"
                />
                <circle
                  cx={machineCenter.x}
                  cy={machineCenter.y}
                  r={drumRadius + 16}
                  fill="none"
                  stroke="#A3E635"
                  strokeWidth="2.5"
                />
              </g>
            )}

            {/* Heavy Industrial Pedestal Base resting firmly on floor */}
            <path
              d={`M ${machineCenter.x - 152} ${floorY} L ${machineCenter.x + 152} ${floorY} L ${machineCenter.x + 132} 408 L ${machineCenter.x - 132} 408 Z`}
              fill="#0F172A"
              stroke="#334155"
              strokeWidth="3"
            />
            {/* A-frame Steel Struts holding the Giant Drum Axle */}
            <line
              x1={machineCenter.x - 122}
              y1="416"
              x2={machineCenter.x - 190}
              y2={machineCenter.y}
              stroke="#334155"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <line
              x1={machineCenter.x + 122}
              y1="416"
              x2={machineCenter.x + 190}
              y2={machineCenter.y}
              stroke="#334155"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Heavy Axle Bearings */}
            <circle
              cx={machineCenter.x - 190}
              cy={machineCenter.y}
              r="14"
              fill="#1E293B"
              stroke="#64748B"
              strokeWidth="3"
            />
            <circle
              cx={machineCenter.x + 190}
              cy={machineCenter.y}
              r="14"
              fill="#1E293B"
              stroke="#64748B"
              strokeWidth="3"
            />

            {/* Pedestal Brand Nameplate */}
            <rect
              x={machineCenter.x - 98}
              y="422"
              width="196"
              height="30"
              rx="5"
              fill="#1E293B"
              stroke="#334155"
              strokeWidth="1.8"
            />
            <text
              x={machineCenter.x}
              y="442"
              textAnchor="middle"
              fill={isVictory ? '#FACC15' : '#F8FAFC'}
              fontSize="17"
              fontWeight="900"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}
            >
              10under POWER LOTTO
            </text>

            {/* Ticket Dispenser Chute Slot on Pedestal */}
            <rect
              x={machineCenter.x - 60}
              y="464"
              width="120"
              height="36"
              rx="6"
              fill="#020617"
              stroke={isVictory ? '#FACC15' : zoneMeta.color}
              strokeWidth="2.4"
            />
            <rect
              x={machineCenter.x - 46}
              y="475"
              width="92"
              height="7"
              rx="3.5"
              fill={isVictory ? '#FACC15' : '#334155'}
            />

            {/* Power Intake LED Bar Stack on Right Side of Pedestal */}
            {[0, 1, 2, 3, 4].map((seg) => {
              const lit = telemetry.zone >= seg + 2 || isVictory;
              return (
                <rect
                  key={seg}
                  x={machineCenter.x + 92}
                  y={496 - seg * 10}
                  width="20"
                  height="6"
                  rx="2"
                  fill={lit ? (isVictory ? '#FACC15' : zoneMeta.color) : '#1E293B'}
                />
              );
            })}

            {/* GIANT TRANSPARENT ROTATING RAFFLE DRUM (Radius = 164!) */}
            <g>
              {/* Outer Glowing Steel Rim */}
              <circle
                cx={machineCenter.x}
                cy={machineCenter.y}
                r={drumRadius + 8}
                fill="#0D1526"
                stroke={isVictory ? '#FACC15' : isDancing ? '#EF4444' : zoneMeta.color}
                strokeWidth={isDancing || isVictory ? 6 : 3.5}
              />
              {/* Glass Drum Sphere */}
              <circle
                cx={machineCenter.x}
                cy={machineCenter.y}
                r={drumRadius}
                fill="url(#drum-glass)"
                stroke="#475569"
                strokeWidth="2.5"
              />

              {/* Rotating Mechanical Cage Spokes, Rim Markers & Scoop Fins */}
              <g transform={`rotate(${drumAngle}, ${machineCenter.x}, ${machineCenter.y})`}>
                {[0, 60, 120].map((deg) => (
                  <line
                    key={deg}
                    x1={machineCenter.x - Math.cos((deg * Math.PI) / 180) * (drumRadius - 5)}
                    y1={machineCenter.y - Math.sin((deg * Math.PI) / 180) * (drumRadius - 5)}
                    x2={machineCenter.x + Math.cos((deg * Math.PI) / 180) * (drumRadius - 5)}
                    y2={machineCenter.y + Math.sin((deg * Math.PI) / 180) * (drumRadius - 5)}
                    stroke="#475569"
                    strokeWidth="3.5"
                    opacity="0.52"
                  />
                ))}
                {/* Outer Ring Neon Bolts */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <circle
                      key={deg}
                      cx={machineCenter.x + Math.cos(rad) * (drumRadius + 8)}
                      cy={machineCenter.y + Math.sin(rad) * (drumRadius + 8)}
                      r={deg % 90 === 0 ? 5.5 : 4}
                      fill={
                        deg % 90 === 0
                          ? isVictory
                            ? '#FACC15'
                            : zoneMeta.color
                          : '#94A3B8'
                      }
                    />
                  );
                })}
                {/* Inner Tumbler Scoop Fins */}
                {[0, 90, 180, 270].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <line
                      key={deg}
                      x1={machineCenter.x + Math.cos(rad) * (drumRadius - 6)}
                      y1={machineCenter.y + Math.sin(rad) * (drumRadius - 6)}
                      x2={machineCenter.x + Math.cos(rad) * (drumRadius - 32)}
                      y2={machineCenter.y + Math.sin(rad) * (drumRadius - 32)}
                      stroke="#A3E635"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>

              {/* 16 Tumbling Numbered Raffle Balls Inside the Giant Drum */}
              <g clipPath="url(#drum-inner-clip)">
                {raffleBalls.map((ball) => (
                  <g key={ball.id}>
                    <circle
                      cx={ball.x}
                      cy={ball.y}
                      r="17"
                      fill={ball.color}
                      stroke="#0F172A"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx={ball.x - 5}
                      cy={ball.y - 5}
                      r="4.5"
                      fill="#FFFFFF"
                      opacity="0.45"
                    />
                    <text
                      x={ball.x}
                      y={ball.y + 5}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="13.5"
                      fontWeight="900"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      {ball.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Glass Specular Highlight Arc */}
              <path
                d={`M ${machineCenter.x - 106} ${machineCenter.y - 84} A 136 136 0 0 1 ${machineCenter.x + 56} ${machineCenter.y - 124}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.22"
              />

              {/* Giant Center Live Rolling Number Core Window */}
              <g>
                <circle
                  cx={machineCenter.x}
                  cy={machineCenter.y}
                  r={isDrawing ? 58 : 48}
                  fill="#090E1A"
                  stroke={isVictory ? '#FACC15' : isDrawing ? zoneMeta.color : '#334155'}
                  strokeWidth={isDrawing || isVictory ? 4.5 : 2.5}
                />
                {isDrawing ? (
                  <>
                    <text
                      x={machineCenter.x}
                      y={machineCenter.y - 18}
                      textAnchor="middle"
                      fill={zoneMeta.color}
                      fontSize="13"
                      fontWeight="800"
                      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                    >
                      추첨 중
                    </text>
                    <text
                      x={machineCenter.x}
                      y={machineCenter.y + 26}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="52"
                      fontWeight="900"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      {rollingNumber}
                    </text>
                  </>
                ) : isVictory && primaryWinnerNumber !== undefined ? (
                  <>
                    <text
                      x={machineCenter.x}
                      y={machineCenter.y - 16}
                      textAnchor="middle"
                      fill="#FACC15"
                      fontSize="13"
                      fontWeight="800"
                    >
                      당첨!
                    </text>
                    <text
                      x={machineCenter.x}
                      y={machineCenter.y + 24}
                      textAnchor="middle"
                      fill="#FACC15"
                      fontSize="48"
                      fontWeight="900"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      {primaryWinnerNumber}
                    </text>
                  </>
                ) : (
                  <text
                    x={machineCenter.x}
                    y={machineCenter.y + 8}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="20"
                    fontWeight="800"
                    style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}
                  >
                    READY
                  </text>
                )}
              </g>

              {/* Top Machine Beacon Crown (Reaches near top edge y=24!) */}
              <path
                d={`M ${machineCenter.x - 56} ${machineCenter.y - drumRadius - 6}
                    L ${machineCenter.x + 56} ${machineCenter.y - drumRadius - 6}
                    L ${machineCenter.x + 42} ${machineCenter.y - drumRadius - 28}
                    L ${machineCenter.x - 42} ${machineCenter.y - drumRadius - 28} Z`}
                fill="#1E293B"
                stroke={isVictory ? '#FACC15' : zoneMeta.color}
                strokeWidth="2.5"
              />
              {/* Blinking Top Beacon Light */}
              <circle
                cx={machineCenter.x}
                cy={machineCenter.y - drumRadius - 17}
                r="7.5"
                fill={
                  isVictory
                    ? '#FACC15'
                    : isDrawing
                      ? Math.sin(fxTick * 22) > 0
                        ? zoneMeta.color
                        : '#FFFFFF'
                      : '#475569'
                }
              />
            </g>

            {/* FINAL WINNING TICKET POPPING OUT OF THE GIANT RAFFLE MACHINE (ON EXPLOSION) */}
            {isVictory && primaryWinnerNumber !== undefined && (
              <g transform={`translate(${machineCenter.x}, ${machineCenter.y - 24})`}>
                <g
                  className="animate-card-pop"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                >
                  {/* Radiant Ticket Glow */}
                  <rect
                    x="-110"
                    y="-76"
                    width="220"
                    height="152"
                    rx="18"
                    fill="#FACC15"
                    opacity="0.32"
                  />
                  {/* Golden Perforated Raffle Ticket (번호표) */}
                  <path
                    d="M -98 -66 L 98 -66 L 98 -16 A 13 13 0 0 0 98 16 L 98 66 L -98 66 L -98 16 A 13 13 0 0 0 -98 -16 Z"
                    fill="url(#ticket-gold)"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                  />
                  {/* Inner Ticket Dashed Border */}
                  <rect
                    x="-84"
                    y="-54"
                    width="168"
                    height="108"
                    rx="8"
                    fill="none"
                    stroke="#78350F"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    opacity="0.55"
                  />
                  <text
                    x="0"
                    y="-30"
                    textAnchor="middle"
                    fill="#78350F"
                    fontSize="16"
                    fontWeight="900"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    최종 당첨 번호표
                  </text>
                  <text
                    x="0"
                    y="32"
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="72"
                    fontWeight="900"
                    style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                  >
                    #{primaryWinnerNumber}
                  </text>
                  {extraWinnerCount > 0 && (
                    <text
                      x="0"
                      y="54"
                      textAnchor="middle"
                      fill="#92400E"
                      fontSize="14.5"
                      fontWeight="800"
                      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                    >
                      외 {extraWinnerCount}명 동시 당첨!
                    </text>
                  )}
                </g>
              </g>
            )}
          </g>

          {/* ================================================================= */}
          {/* 3. Z6 MAX SPRINT: REAR TRAINER FIRE & LIGHTNING FX                */}
          {/* ================================================================= */}
          {isDancing && (
            <g>
              <path
                d={`M ${rearHub.x - 16} ${rearHub.y - 24}
                    Q ${rearHub.x - 84} ${rearHub.y - 38 + Math.sin(fxTick * 42) * 12} ${rearHub.x - 135 - Math.cos(fxTick * 38) * 18} ${rearHub.y - 4}
                    Q ${rearHub.x - 86} ${rearHub.y + 36 + Math.cos(fxTick * 48) * 10} ${rearHub.x - 16} ${rearHub.y + 24} Z`}
                fill="url(#flame-outer)"
              />
              <path
                d={`M ${rearHub.x - 16} ${rearHub.y - 12}
                    Q ${rearHub.x - 58} ${rearHub.y - 18 + Math.cos(fxTick * 50) * 7} ${rearHub.x - 95 - Math.sin(fxTick * 45) * 14} ${rearHub.y}
                    Q ${rearHub.x - 58} ${rearHub.y + 18} ${rearHub.x - 16} ${rearHub.y + 14} Z`}
                fill="url(#flame-inner)"
              />

              {/* Lightning bolts shooting from rear trainer directly into giant machine */}
              <polyline
                points={`${rearHub.x - 14},${rearHub.y - 34} ${rearHub.x - 76},${rearHub.y - 94 + Math.sin(fxTick * 55) * 14} ${rearHub.x - 50},${rearHub.y - 54} ${machineCenter.x + drumRadius + 8},${machineCenter.y + 52}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={`${rearHub.x + 4},${rearHub.y - 42} ${rearHub.x - 24},${rearHub.y - 112} ${rearHub.x - 2},${rearHub.y - 82} ${rearHub.x - 42},${rearHub.y - 146 + Math.cos(fxTick * 60) * 10}`}
                fill="none"
                stroke="#FACC15"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* ================================================================= */}
          {/* 4. SMART TRAINER + BIKE + PRESIDENT CHARACTER (RIGHT SIDE)        */}
          {/* ================================================================= */}
          <g transform={`translate(${bikeRockX}, 0) rotate(${bikeRockDeg}, ${bb.x}, ${floorY})`}>
            {/* Floor shadow */}
            <ellipse
              cx={392 + bikeShiftX}
              cy={floorY + 2}
              rx="215"
              ry="13"
              fill="#020617"
              opacity="0.78"
            />

            {/* Front Wheel Riser Block */}
            <path
              d={`M ${518 + bikeShiftX} ${floorY} L ${590 + bikeShiftX} ${floorY} L ${578 + bikeShiftX} ${floorY - 22} L ${530 + bikeShiftX} ${floorY - 22} Z`}
              fill="#1E293B"
              stroke="#334155"
              strokeWidth="2"
            />

            {/* Front Wheel */}
            <g>
              <circle cx={frontHub.x} cy={frontHub.y} r="56" fill="none" stroke="#0F172A" strokeWidth="11" />
              <circle cx={frontHub.x} cy={frontHub.y} r="50" fill="none" stroke="#334155" strokeWidth="3" />
              <circle cx={frontHub.x} cy={frontHub.y} r="50" fill="none" stroke="#A3E635" strokeWidth="2.5" strokeDasharray="18 34" />
              {[0, 45, 90, 135].map((deg) => (
                <line
                  key={deg}
                  x1={frontHub.x - Math.cos((deg * Math.PI) / 180) * 48}
                  y1={frontHub.y - Math.sin((deg * Math.PI) / 180) * 48}
                  x2={frontHub.x + Math.cos((deg * Math.PI) / 180) * 48}
                  y2={frontHub.y + Math.sin((deg * Math.PI) / 180) * 48}
                  stroke="#475569"
                  strokeWidth="1.5"
                />
              ))}
              <circle cx={frontHub.x} cy={frontHub.y} r="8" fill="#64748B" />
            </g>

            {/* Direct-Drive Smart Trainer Unit (Rear) */}
            <g>
              <path
                d={`M ${154 + bikeShiftX} ${floorY} L ${308 + bikeShiftX} ${floorY} L ${294 + bikeShiftX} ${floorY - 18} L ${172 + bikeShiftX} ${floorY - 18} Z`}
                fill="#1E293B"
                stroke="#334155"
                strokeWidth="2"
              />
              <path
                d={`M ${188 + bikeShiftX} ${floorY - 16} L ${202 + bikeShiftX} ${302 + bikeShiftY} Q ${226 + bikeShiftX} ${286 + bikeShiftY} ${254 + bikeShiftX} ${300 + bikeShiftY} L ${272 + bikeShiftX} ${floorY - 16} Z`}
                fill="#0F172A"
                stroke="#334155"
                strokeWidth="2.5"
              />
              {/* Spinning Smart Trainer Flywheel */}
              <g transform={`rotate(${flywheelDeg}, ${rearHub.x}, ${rearHub.y})`}>
                <circle
                  cx={rearHub.x}
                  cy={rearHub.y}
                  r="40"
                  fill="#1E293B"
                  stroke={isDancing ? '#EF4444' : zoneMeta.color}
                  strokeWidth={isDancing ? 5 : 3}
                />
                <circle cx={rearHub.x} cy={rearHub.y} r="27" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="10 8" />
                <line x1={rearHub.x - 34} y1={rearHub.y} x2={rearHub.x + 34} y2={rearHub.y} stroke="#94A3B8" strokeWidth="3" />
                <line x1={rearHub.x} y1={rearHub.y - 34} x2={rearHub.x} y2={rearHub.y + 34} stroke="#94A3B8" strokeWidth="3" />
                <circle cx={rearHub.x} cy={rearHub.y} r="9.5" fill={zoneMeta.color} />
              </g>
              {/* Smart Trainer LED Power Strip */}
              <rect
                x={200 + bikeShiftX}
                y={floorY - 30}
                width="52"
                height="6"
                rx="3"
                fill={zoneMeta.color}
              />
            </g>

            {/* FAR LEG */}
            <g opacity="0.82">
              <line
                x1={hip.x + 4}
                y1={hip.y + 2}
                x2={leftKnee.x}
                y2={leftKnee.y}
                stroke="#1E293B"
                strokeWidth="19"
                strokeLinecap="round"
              />
              <line
                x1={leftKnee.x}
                y1={leftKnee.y}
                x2={leftPedal.x}
                y2={leftPedal.y}
                stroke="#D99B72"
                strokeWidth="13.5"
                strokeLinecap="round"
              />
              <path
                d={`M ${leftPedal.x - 10} ${leftPedal.y + 4} L ${leftPedal.x + 21} ${leftPedal.y + 4} L ${leftPedal.x + 17} ${leftPedal.y - 7} L ${leftPedal.x - 6} ${leftPedal.y - 7} Z`}
                fill="#334155"
              />
            </g>

            {/* FAR ARM */}
            <g opacity="0.82">
              <path
                d={`M ${shoulder.x} ${shoulder.y + 2} Q ${backElbow.x} ${backElbow.y} ${backHandTarget.x} ${backHandTarget.y}`}
                fill="none"
                stroke="#D99B72"
                strokeWidth="12.5"
                strokeLinecap="round"
              />
            </g>

            {/* ROAD / TT CARBON BIKE FRAME */}
            <g>
              <line x1={rearHub.x} y1={rearHub.y - 11} x2={bb.x} y2={bb.y - 17} stroke="#64748B" strokeWidth="2.5" strokeDasharray="5 3" />
              <line x1={rearHub.x} y1={rearHub.y + 11} x2={bb.x} y2={bb.y + 17} stroke="#64748B" strokeWidth="2.5" strokeDasharray="5 3" />

              <line x1={rearHub.x} y1={rearHub.y} x2={bb.x} y2={bb.y} stroke="#334155" strokeWidth="7" strokeLinecap="round" />
              <line x1={rearHub.x} y1={rearHub.y} x2={338 + bikeShiftX} y2={244 + bikeShiftY} stroke="#475569" strokeWidth="6" strokeLinecap="round" />
              <line x1={bb.x} y1={bb.y} x2={seatTop.x + 12} y2={seatTop.y + 6} stroke="#E2E8F0" strokeWidth="10" strokeLinecap="round" />
              <line x1={bb.x} y1={bb.y} x2={headTop.x} y2={headTop.y + 16} stroke="#84CC16" strokeWidth="12" strokeLinecap="round" />
              <line x1={332 + bikeShiftX} y1={240 + bikeShiftY} x2={headTop.x} y2={headTop.y + 8} stroke="#F8FAFC" strokeWidth="9" strokeLinecap="round" />
              <line x1={headTop.x} y1={headTop.y + 6} x2={frontHub.x} y2={frontHub.y} stroke="#0F172A" strokeWidth="9" strokeLinecap="round" />
              <line x1={headTop.x} y1={headTop.y + 6} x2={frontHub.x} y2={frontHub.y} stroke="#A3E635" strokeWidth="2.8" strokeLinecap="round" />

              {/* Saddle */}
              <path
                d={`M ${seatTop.x - 18} ${seatTop.y + 2} L ${seatTop.x + 30} ${seatTop.y + 2} L ${seatTop.x + 20} ${seatTop.y + 10} L ${seatTop.x - 14} ${seatTop.y + 10} Z`}
                fill="#0F172A"
              />

              {/* Stem & Drop Handlebars / Aerobars */}
              <line x1={headTop.x} y1={headTop.y + 6} x2={542 + bikeShiftX} y2={204 + bikeShiftY} stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
              <path
                d={`M ${538 + bikeShiftX} ${204 + bikeShiftY} C ${570 + bikeShiftX} ${204 + bikeShiftY}, ${574 + bikeShiftX} ${238 + bikeShiftY}, ${544 + bikeShiftX} ${242 + bikeShiftY}`}
                fill="none"
                stroke="#0F172A"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <line x1={536 + bikeShiftX} y1={202 + bikeShiftY} x2={582 + bikeShiftX} y2={194 + bikeShiftY} stroke="#A3E635" strokeWidth="4" strokeLinecap="round" />

              {/* Chainring & Crank Arm */}
              <circle cx={bb.x} cy={bb.y} r="21" fill="#0F172A" stroke="#94A3B8" strokeWidth="3.5" />
              <line x1={bb.x} y1={bb.y} x2={rightPedal.x} y2={rightPedal.y} stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
              <circle cx={bb.x} cy={bb.y} r="6" fill="#A3E635" />
            </g>

            {/* RIDER TORSO (10under Cycling Jersey) */}
            <g>
              <circle cx={hip.x} cy={hip.y} r="21" fill="#0F172A" />
              <path
                d={`M ${hip.x - 14} ${hip.y - 6}
                    Q ${(hip.x + shoulder.x) / 2 - 20} ${(hip.y + shoulder.y) / 2 - 24} ${shoulder.x - 10} ${shoulder.y - 16}
                    L ${shoulder.x + 17} ${shoulder.y + 6}
                    Q ${(hip.x + shoulder.x) / 2 + 12} ${(hip.y + shoulder.y) / 2 + 17} ${hip.x + 15} ${hip.y + 10} Z`}
                fill="url(#jersey-grad)"
                stroke="#D9F99D"
                strokeWidth="1.5"
              />
              <text
                x={(hip.x + shoulder.x) / 2 - 1}
                y={(hip.y + shoulder.y) / 2 - 1}
                fill="#090F1C"
                fontSize={isVictory ? '22' : '26'}
                fontWeight="900"
                fontStyle="italic"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${isVictory ? -60 : -28}, ${(hip.x + shoulder.x) / 2 - 1}, ${(hip.y + shoulder.y) / 2 - 1})`}
                style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.02em' }}
              >
                10under
              </text>
            </g>

            {/* NEAR LEG */}
            <g>
              <line
                x1={hip.x}
                y1={hip.y}
                x2={rightKnee.x}
                y2={rightKnee.y}
                stroke="#0F172A"
                strokeWidth="21"
                strokeLinecap="round"
              />
              <line
                x1={hip.x}
                y1={hip.y}
                x2={rightKnee.x}
                y2={rightKnee.y}
                stroke="#A3E635"
                strokeWidth="3.2"
                strokeDasharray="16 55"
                strokeLinecap="round"
              />
              <line
                x1={rightKnee.x}
                y1={rightKnee.y}
                x2={rightPedal.x}
                y2={rightPedal.y}
                stroke="#F3B688"
                strokeWidth="14.5"
                strokeLinecap="round"
              />
              <line
                x1={rightKnee.x + (rightPedal.x - rightKnee.x) * 0.68}
                y1={rightKnee.y + (rightPedal.y - rightKnee.y) * 0.68}
                x2={rightPedal.x}
                y2={rightPedal.y}
                stroke="#F8FAFC"
                strokeWidth="14.5"
                strokeLinecap="round"
              />
              <path
                d={`M ${rightPedal.x - 10} ${rightPedal.y + 5} L ${rightPedal.x + 24} ${rightPedal.y + 5} L ${rightPedal.x + 19} ${rightPedal.y - 8} L ${rightPedal.x - 6} ${rightPedal.y - 8} Z`}
                fill="#FFFFFF"
                stroke="#84CC16"
                strokeWidth="2.5"
              />
            </g>

            {/* NEAR ARM */}
            <g>
              <path
                d={`M ${shoulder.x + 4} ${shoulder.y + 2} Q ${elbow.x} ${elbow.y} ${handTarget.x} ${handTarget.y}`}
                fill="none"
                stroke="#F3B688"
                strokeWidth="13.5"
                strokeLinecap="round"
              />
              <circle cx={handTarget.x} cy={handTarget.y} r="7" fill="#0F172A" stroke="#A3E635" strokeWidth="2" />
            </g>

            {/* PRESIDENT HEAD & AERO CYCLING HELMET */}
            <g>
              <circle
                cx={headCenter.x}
                cy={headCenter.y}
                r="37"
                fill="#0F172A"
                stroke={isDancing ? '#EF4444' : isVictory ? '#FACC15' : '#A3E635'}
                strokeWidth="3.5"
              />

              {uploadedFaceSrc ? (
                <image
                  href={uploadedFaceSrc}
                  x={headCenter.x - 35}
                  y={headCenter.y - 35}
                  width="70"
                  height="70"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#president-head-clip)"
                />
              ) : (
                <foreignObject
                  x={headCenter.x - 35}
                  y={headCenter.y - 35}
                  width="70"
                  height="70"
                  clipPath="url(#president-head-clip)"
                >
                  <div className="h-full w-full">
                    <PresidentAvatar emotion={emotion} faces={faces} size={70} />
                  </div>
                </foreignObject>
              )}

              {/* Aerodynamic Triathlon Helmet */}
              <path
                d={`M ${headCenter.x - 42} ${headCenter.y - 15}
                    C ${headCenter.x - 36} ${headCenter.y - 52}, ${headCenter.x + 27} ${headCenter.y - 54}, ${headCenter.x + 42} ${headCenter.y - 17}
                    Q ${headCenter.x + 12} ${headCenter.y - 25} ${headCenter.x - 42} ${headCenter.y - 15} Z`}
                fill="#0F172A"
                stroke="#A3E635"
                strokeWidth="2.8"
              />
              <path
                d={`M ${headCenter.x - 54} ${headCenter.y - 21} L ${headCenter.x - 23} ${headCenter.y - 36} L ${headCenter.x - 27} ${headCenter.y - 17} Z`}
                fill="#A3E635"
              />
              <path
                d={`M ${headCenter.x - 15} ${headCenter.y - 36} Q ${headCenter.x + 8} ${headCenter.y - 40} ${headCenter.x + 25} ${headCenter.y - 29}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>

            {/* Flying Sweat Drops (Z4~Z6) */}
            {sweatDrops.map((drop) => (
              <g key={drop.id} opacity={drop.opacity}>
                <path
                  d={`M ${drop.x} ${drop.y - 6} Q ${drop.x + 5} ${drop.y + 2} ${drop.x} ${drop.y + 6} Q ${drop.x - 5} ${drop.y + 2} ${drop.x} ${drop.y - 6} Z`}
                  fill="#38BDF8"
                />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* ===================================================================== */}
      {/* TOP-RIGHT FLOATING ZWIFT POWER HUD (Moved to Right Side!)             */}
      {/* ===================================================================== */}
      <div className="pointer-events-none absolute top-3 right-3.5 z-10 flex flex-col items-end gap-1.5 md:top-4 md:right-5">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-700/75 bg-[#0D1526]/90 px-4 py-2.5 backdrop-blur-md">
          {/* Top Row: Power W + Cadence RPM + Heart Rate BPM */}
          <div className="flex items-end gap-4">
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-5xl font-extrabold leading-none tracking-tight tabular-nums transition-colors duration-150 md:text-6xl"
                style={{
                  color: zoneMeta.color,
                  textShadow: telemetry.zone >= 5 ? `0 0 24px ${zoneMeta.glow}` : 'none',
                }}
              >
                {Math.round(telemetry.watts)}
              </span>
              <span className="font-display text-xl font-bold text-slate-400">W</span>
            </div>

            <div className="mb-1 h-9 w-px bg-slate-700/80" aria-hidden="true" />

            <div className="flex items-center gap-4 pb-0.5">
              <div>
                <div className="text-[11px] font-medium text-slate-400">케이던스</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold leading-none text-slate-100 tabular-nums md:text-3xl">
                    {Math.round(telemetry.rpm)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">RPM</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-400">심박수</div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`font-display text-2xl font-bold leading-none tabular-nums md:text-3xl ${
                      telemetry.bpm >= 175 ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {Math.round(telemetry.bpm)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">BPM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Z1~Z6 Segmented Power Zone Gauge */}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-6 gap-1.5">
              {POWER_ZONES.map((z) => {
                const isActive = telemetry.zone >= z.zone;
                const isCurrent = telemetry.zone === z.zone;
                return (
                  <div key={z.zone} className="flex flex-col gap-0.5">
                    <div
                      className="h-2 rounded-sm transition-all duration-150"
                      style={{
                        backgroundColor: isActive ? z.color : '#1E293B',
                        boxShadow: isCurrent ? `0 0 12px ${z.color}` : 'none',
                        opacity: isActive ? 1 : 0.45,
                      }}
                    />
                    <span
                      className="text-center font-mono-num text-[10px] font-bold leading-none"
                      style={{ color: isCurrent ? z.color : '#64748B' }}
                    >
                      {z.code}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span style={{ color: zoneMeta.color }}>{zoneMeta.label}</span>
              <span className="font-mono-num text-slate-400">
                {telemetry.wkg.toFixed(1)} W/kg
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM-RIGHT COMPACT LIVE POWER GRAPH & STATUS                        */}
      {/* ===================================================================== */}
      <div className="pointer-events-none absolute right-3.5 bottom-3 z-10 hidden flex-col gap-1 rounded-xl border border-slate-800/85 bg-[#0D1526]/86 px-3.5 py-2 backdrop-blur-sm sm:flex md:right-5">
        <div className="flex items-center justify-between gap-4 text-[11px] font-semibold">
          <span className="text-slate-300">
            {phase === 'IDLE' && '전력 대기 · 추첨기 준비'}
            {phase === 'WARMUP_Z1_Z3' && '전력 공급 — 추첨기 회전'}
            {phase === 'THRESHOLD_Z4_Z5' && '고속 회전 — 땀 폭발'}
            {phase === 'SPRINT_Z6' && 'MAX 과부하 — 댄싱 스프린트!'}
            {phase === 'EXPLOSION' && '최종 번호표 배출 완료!'}
          </span>
          <span
            className="font-mono-num font-bold"
            style={{ color: isVictory ? '#FACC15' : zoneMeta.color }}
          >
            {phase === 'IDLE'
              ? 'READY'
              : phase === 'EXPLOSION'
                ? 'MAX!'
                : `${Math.round(telemetry.progress * 100)}%`}
          </span>
        </div>
        <div className="flex h-6 w-52 items-end gap-[2px]">
          {telemetry.powerHistory.map((pt, idx) => {
            const heightPct = Math.max(10, Math.min(100, (pt.watts / 1120) * 100));
            const ptColor = getZoneMeta(pt.zone).color;
            return (
              <div
                key={idx}
                className="flex-1 rounded-t-[2px] transition-colors duration-150"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: ptColor,
                  opacity: 0.45 + (idx / Math.max(1, telemetry.powerHistory.length)) * 0.55,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

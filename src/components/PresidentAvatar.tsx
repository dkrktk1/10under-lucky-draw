import { FaceEmotion, PresidentFaces } from '../types/raffle';

interface PresidentAvatarProps {
  emotion: FaceEmotion;
  faces: PresidentFaces;
  size?: number;
  className?: string;
}

/**
 * Renders the President's uploaded face photo for the given emotion stage,
 * or a crisp, expressive built-in triathlon character face when no photo is set.
 */
export function PresidentAvatar({
  emotion,
  faces,
  size = 96,
  className = '',
}: PresidentAvatarProps) {
  const uploadedSrc = faces[emotion];

  if (uploadedSrc) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`relative overflow-hidden rounded-full bg-slate-800 ${className}`}
      >
        <img
          src={uploadedSrc}
          alt={`회장님 ${emotion === 'calm' ? '평온' : emotion === 'pain' ? '전력질주' : '환호'} 얼굴`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`rounded-full ${className}`}
      aria-label="회장님 기본 일러스트 얼굴"
    >
      <defs>
        <radialGradient id={`skin-${emotion}`} cx="45%" cy="38%" r="62%">
          <stop offset="0%" stopColor={emotion === 'pain' ? '#FFBE98' : '#FFD8B8'} />
          <stop offset="100%" stopColor={emotion === 'pain' ? '#F08A6C' : '#F3B688'} />
        </radialGradient>
      </defs>

      {/* Face base */}
      <circle cx="50" cy="50" r="48" fill={`url(#skin-${emotion})`} />

      {/* Hairline / sideburns */}
      <path d="M 8 44 Q 16 14 50 12 Q 84 14 92 44 Q 82 28 50 26 Q 18 28 8 44 Z" fill="#1E293B" />

      {emotion === 'calm' && (
        <>
          {/* Relaxed eyebrows */}
          <path d="M 27 37 Q 36 33 44 36" stroke="#1E293B" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M 56 36 Q 64 33 73 37" stroke="#1E293B" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          {/* Sporty wrap sunglasses */}
          <path
            d="M 19 42 L 81 42 L 77 56 Q 63 60 53 52 L 47 52 Q 37 60 23 56 Z"
            fill="#0F172A"
            stroke="#A3E635"
            strokeWidth="2.4"
          />
          <path d="M 24 45 L 44 45 L 36 53 L 24 52 Z" fill="#38BDF8" opacity="0.45" />
          <path d="M 55 45 L 75 45 L 72 52 L 60 53 Z" fill="#A3E635" opacity="0.5" />
          {/* Confident grin */}
          <path d="M 36 70 Q 50 79 65 69" stroke="#7C2D12" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        </>
      )}

      {emotion === 'pain' && (
        <>
          {/* Flushed exertion cheeks */}
          <ellipse cx="26" cy="60" rx="9" ry="5.5" fill="#EF4444" opacity="0.5" />
          <ellipse cx="74" cy="60" rx="9" ry="5.5" fill="#EF4444" opacity="0.5" />
          {/* Intense furrowed brows */}
          <path d="M 24 35 L 44 43" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
          <path d="M 76 35 L 56 43" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
          {/* Squeezed shut straining eyes (> <) */}
          <path d="M 28 45 L 41 50 L 28 55" stroke="#1E293B" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 72 45 L 59 50 L 72 55" stroke="#1E293B" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Sweat drop on temple */}
          <path d="M 81 30 Q 86 38 81 42 Q 76 38 81 30 Z" fill="#38BDF8" />
          {/* Gritted teeth grimace */}
          <rect x="33" y="65" width="34" height="14" rx="5" fill="#FFFFFF" stroke="#7F1D1D" strokeWidth="3" />
          <line x1="34" y1="72" x2="66" y2="72" stroke="#7F1D1D" strokeWidth="2" />
          <line x1="44" y1="65" x2="44" y2="79" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="56" y1="65" x2="56" y2="79" stroke="#CBD5E1" strokeWidth="1.5" />
        </>
      )}

      {emotion === 'cheer' && (
        <>
          {/* Happy flushed cheeks */}
          <ellipse cx="24" cy="58" rx="8" ry="5" fill="#FB923C" opacity="0.45" />
          <ellipse cx="76" cy="58" rx="8" ry="5" fill="#FB923C" opacity="0.45" />
          {/* Raised joyful brows */}
          <path d="M 26 32 Q 35 26 44 32" stroke="#1E293B" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M 56 32 Q 65 26 74 32" stroke="#1E293B" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          {/* Smiling crescent eyes */}
          <path d="M 27 48 Q 35 39 43 48" stroke="#1E293B" strokeWidth="3.8" strokeLinecap="round" fill="none" />
          <path d="M 57 48 Q 65 39 73 48" stroke="#1E293B" strokeWidth="3.8" strokeLinecap="round" fill="none" />
          {/* Big ecstatic open laugh */}
          <path d="M 31 62 Q 50 88 69 62 Z" fill="#991B1B" stroke="#7C2D12" strokeWidth="2.5" />
          <path d="M 35 63 L 65 63 Q 50 70 35 63 Z" fill="#FFFFFF" />
          <ellipse cx="50" cy="75" rx="9" ry="4.5" fill="#FB7185" />
        </>
      )}
    </svg>
  );
}

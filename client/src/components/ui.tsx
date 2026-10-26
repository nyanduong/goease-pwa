import { images } from '@goease/media';
import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from '../icons';

export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string | undefined;
  }>;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        'aria-describedby':
          [children.props['aria-describedby'], hint ? `${id}-hint` : '']
            .filter(Boolean)
            .join(' ') || undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

export function Notice({
  children,
  error = false,
  className = '',
}: {
  children: ReactNode;
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`notice ${error ? 'notice-error' : ''} ${className}`}
      role={error ? 'alert' : 'status'}
    >
      <span className="notice-icon" aria-hidden="true">
        {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      </span>
      <div className="notice-text min-w-0 flex-1 [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <img
        className="brand-mark block h-[36px] w-[36px] flex-[0_0_auto] object-contain"
        src={images.logo}
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
      />
      <span className="brand-name">GoEase</span>
    </span>
  );
}

export function Goe({
  className = '',
  size = 'medium',
}: {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  const dimensions = {
    small: 'h-[56px] w-[56px]',
    medium: 'h-[96px] w-[96px]',
    large: 'h-[160px] w-[160px]',
  };
  return (
    <img
      className={`goe-mascot goe-${size} block object-contain ${dimensions[size]} ${className}`}
      src={images.goeOriginal}
      alt="Goe, linh thú xanh dương của GoEase"
      width={1254}
      height={1254}
      loading="lazy"
    />
  );
}

export function HeroArtwork() {
  return (
    <div
      className="hero-artwork-frame"
      role="img"
      aria-label="Minh họa những ngọn đồi, dòng sông và ánh nắng bình minh ấm áp tại Việt Nam"
    >
      <svg
        viewBox="0 0 540 380"
        className="hero-artwork-svg block h-auto w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F9EFE0" />
            <stop offset="45%" stopColor="#EFE0C7" />
            <stop offset="100%" stopColor="#DFE8D9" />
          </linearGradient>
          <linearGradient id="hillGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#96B59E" />
            <stop offset="100%" stopColor="#679174" />
          </linearGradient>
          <linearGradient id="hillGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#456F57" />
            <stop offset="100%" stopColor="#204A37" />
          </linearGradient>
          <linearGradient id="riverGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CCDBC9" />
            <stop offset="100%" stopColor="#AEC8B4" />
          </linearGradient>
        </defs>

        {/* Sky background */}
        <rect width="540" height="380" rx="20" fill="url(#skyGrad)" />

        {/* Sun / Halo */}
        <circle cx="395" cy="115" r="54" fill="#E8B568" opacity="0.88" />
        <circle cx="395" cy="115" r="72" fill="#E8B568" opacity="0.22" />

        {/* Distant mountain silhouette */}
        <path
          d="M0 240 Q130 150 260 215 T540 185 L540 380 L0 380 Z"
          fill="url(#hillGrad1)"
          opacity="0.75"
        />
        <path d="M70 205 L130 140 L190 215 Z" fill="#EBF2E5" opacity="0.4" />

        {/* River */}
        <path
          d="M0 270 Q160 235 300 280 T540 255 L540 380 L0 380 Z"
          fill="url(#riverGrad)"
        />

        {/* Terraced foreground hills */}
        <path
          d="M-20 310 Q140 220 320 295 T560 270 L560 380 L-20 380 Z"
          fill="url(#hillGrad2)"
        />
        <path
          d="M110 322 Q230 285 370 322"
          stroke="#F5ECCF"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.65"
        />
        <path
          d="M70 348 Q210 312 410 348"
          stroke="#F5ECCF"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Little pagoda / pavilion silhouette */}
        <g transform="translate(185, 252) scale(0.65)" fill="#184C43">
          <path d="M30 45 L50 25 L70 45 Z" />
          <rect x="42" y="45" width="16" height="15" />
          <path d="M22 60 L78 60 L72 68 L28 68 Z" />
          <rect x="36" y="68" width="28" height="18" />
        </g>

        {/* Gentle boat on river */}
        <path
          d="M340 266 Q370 274 400 266 L395 273 Q370 277 345 273 Z"
          fill="#184C43"
          opacity="0.8"
        />

        {/* Distant birds */}
        <path
          d="M75 88 Q85 80 95 88 Q105 80 115 88"
          stroke="#456F57"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M120 102 Q128 95 136 102 Q144 95 152 102"
          stroke="#456F57"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
      <div className="hero-artwork-badge">
        <Goe size="small" />
        <div className="hero-artwork-badge-text">
          <strong>Goe cùng bạn</strong>
          <span>Lên kế hoạch theo cách của riêng mình</span>
        </div>
      </div>
    </div>
  );
}

export function Landscape() {
  return <HeroArtwork />;
}

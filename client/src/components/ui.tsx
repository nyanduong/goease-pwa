import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? 'notice-error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">↗</span>GoEase
      <span className="brand-dot">.</span>
    </span>
  );
}
export function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 600 460"
      role="img"
      aria-label="Minh họa những ngọn đồi, con đường và ánh nắng"
    >
      <rect width="600" height="460" rx="24" fill="#e2e9db" />
      <circle cx="455" cy="100" r="54" fill="#f2bd77" />
      <path d="M0 260 150 82 310 270 413 151 600 300V460H0Z" fill="#98b4a0" />
      <path d="m70 177 80-95 84 99-80-27Z" fill="#edf0df" />
      <path d="M0 310Q180 220 320 315T600 280V460H0Z" fill="#567c66" />
      <path d="M0 395Q160 275 350 370T600 350V460H0Z" fill="#254e40" />
      <path
        d="M285 460Q430 407 320 363T347 287Q291 343 375 364T368 460Z"
        fill="#f6e3bd"
      />
      <path
        d="M80 316v-42m-20 23h40m-34-12h28"
        stroke="#284d3c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M490 352v-65m-24 34h48m-41-17h35"
        stroke="#203f33"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M90 100q10-12 22 0m0 0q10-12 22 0"
        fill="none"
        stroke="#567c66"
        strokeWidth="3"
      />
    </svg>
  );
}

export function Goe() {
  return (
    <img
      className="goe-mascot"
      src="/images/goe-original.png"
      alt="Goe, linh thú xanh dương của GoEase"
      width={1254}
      height={1254}
    />
  );
}

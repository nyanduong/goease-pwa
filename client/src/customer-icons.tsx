import { forwardRef, type ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';
export * from './icons';

// SVG geometry supplied in the customer's React reference. Customer-only adapter.
const paths: Record<string, ReactNode> = {
  navigation: <path d="m21 3-7 18-3-8-8-3 18-7Z" />,
  arrowLeft: (
    <>
      <path d="m15 18-6-6 6-6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  house: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4z" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0v4c0 2-1 3-2 5h16c-1-2-2-3-2-5V8M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-5 3-8 8-8s8 3 8 8" />
    </>
  ),
  'user-round': (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  heart: (
    <path d="M20.4 5.6a5.1 5.1 0 0 0-7.2 0L12 6.8l-1.2-1.2a5.1 5.1 0 0 0-7.2 7.2L12 21l8.4-8.2a5.1 5.1 0 0 0 0-7.2Z" />
  ),
  star: (
    <path d="m12 2 3.1 6.5 7.1 1-5.1 5 .9 7-6-3.3-6.2 3.3 1.1-7-5.1-5 7-1z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  suitcase: (
    <>
      <rect x="5" y="5" width="14" height="15" rx="3" />
      <path d="M9 5V3h6v2M9 9v7M15 9v7M8 20v1M16 20v1" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h12" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  'calendar-plus': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5" />
    </>
  ),
  mountain: (
    <>
      <path d="m2 20 7.3-13 4.2 7 2.4-4L22 20z" />
      <path d="M7 11l2 1 2-1" />
    </>
  ),
  landmark: (
    <>
      <path d="M3 9h18M3 20h18M5 9v9M10 9v9M14 9v9M19 9v9M12 3 2 8h20z" />
    </>
  ),
  utensils: (
    <>
      <path d="M4 2v7a3 3 0 0 0 6 0V2M7 2v20M16 2c-4 4-4 10 0 13v7M16 2v13h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M17 14c3 0 5 2 5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  'message-circle': (
    <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 21l1.9-4.4a8.5 8.5 0 1 1 15.1-5.1z" />
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  'log-out': (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.9-1.1L14 3h-4l-.6 2.8a8 8 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 2.2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.9 1.1L10 21h4l.6-2.8a8 8 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.1Z" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="5" width="20" height="15" rx="3" />
      <path d="M17 12h5M4 5V3h14" />
    </>
  ),
  bookmark: <path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-5-7 5z" />,
  sparkles: (
    <>
      <path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
      <path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 8 4v5c0 5-3.5 8.8-8 11-4.5-2.2-8-6-8-11V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
    </>
  ),
  moon: <path d="M20.5 15a9 9 0 0 1-11.5-11A9 9 0 1 0 20.5 15Z" />,
  'help-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 1c0 2-3 2-3 4M12 17h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m3 5 9 8 9-8" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  'sliders-horizontal': (
    <>
      <path d="M4 7h16M4 17h16M9 4v6M16 14v6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  'external-link': (
    <>
      <path d="M13 4h7v7M20 4l-10 10" />
      <path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8 14-1 8 5-3 5 3-1-8" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.5 10.5 7-4M8.5 13.5l7 4" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h13v7a5 5 0 0 1-10 0V8zM17 9h2a3 3 0 0 1 0 6h-2M5 21h14" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
};

// Additional island glyph follows the same 24px rounded-stroke reference grid.
paths.island = (
  <>
    <path d="M3 19c2-2 4-3 8-3s7 1 10 3M3 22c2-1 4-1 6 0s4 1 6 0 4-1 6 0M11 16l2-9M13 7c-2-3-5-3-7-1 3-1 5 0 7 1Zm0 0c2-4 5-4 7-2-3 0-5 1-7 2Zm0 0c3-1 5 1 6 3-3-2-4-2-6-3Z" />
  </>
);

function icon(name: string) {
  return forwardRef<SVGSVGElement, IconProps>(function CustomerReferenceIcon(
    {
      size = 20,
      color = 'currentColor',
      weight = 'regular',
      mirrored,
      ...props
    },
    ref,
  ) {
    return (
      <svg
        aria-hidden={props['aria-label'] ? undefined : true}
        {...props}
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' || weight === 'fill' ? 2.2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          ...props.style,
          ...(mirrored ? { transform: 'scaleX(-1)' } : {}),
        }}
      >
        {name === 'house' && weight === 'fill' ? (
          <path
            fill="currentColor"
            strokeWidth="0"
            fillRule="evenodd"
            d="M2 10 12 2l10 8-2 1.5V21h-6v-7h-4v7H4v-9.5Z"
          />
        ) : (
          paths[name]
        )}
      </svg>
    );
  });
}

export const ArrowLeft = icon('arrowLeft');
export const ArrowRight = icon('arrowRight');
export const ChevronRight = icon('arrowRight');
export const ChevronDown = icon('chevronDown');
export const ChevronUp = icon('chevronUp');
export const House = icon('house');
export const Compass = icon('compass');
export const Map = icon('map');
export const MapPin = icon('map-pin');
export const Bell = icon('bell');
export const UserRound = icon('user-round');
export const Search = icon('search');
export const Bookmark = icon('heart');
export const Heart = icon('heart');
export const Star = icon('star');
export const Plus = icon('plus');
export const Minus = icon('minus');
export const Check = icon('check');
export const CalendarDays = icon('calendar');
export const Mountain = icon('mountain');
export const TreePalm = icon('island');
export const Landmark = icon('landmark');
export const Utensils = icon('utensils');
export const UsersRound = icon('users');
export const Clock = icon('clock');
export const Send = icon('send');
export const Settings = icon('settings');
export const Wallet = icon('wallet');
export const Sparkles = icon('sparkles');
export const Info = icon('info');
export const ShieldCheck = icon('shield');
export const Globe2 = icon('globe');
export const Mail = icon('mail');
export const Eye = icon('eye');
export const SlidersHorizontal = icon('sliders-horizontal');
export const X = icon('close');
export const ExternalLink = icon('external-link');
export const Sun = icon('sun');

export const Island = icon('island');

export const Suitcase = icon('suitcase');
export const LogOut = icon('logout');

export const NavigationArrow = icon('navigation');

import { Bookmark, Compass, House, Map, UserRound, Ellipsis } from '../icons';
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';

export function ScreenHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="customer-screen-header">
      <h1>{title}</h1>
      <div className="screen-header-actions">{children}</div>
    </header>
  );
}

export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [opened, setOpened] = useState(false);
  const [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    if (!opened || !ref.current) return;
    const panel = ref.current.querySelector('.customer-action-menu-panel');
    if (!panel) return;
    const limit =
      (window.visualViewport?.height ?? window.innerHeight) +
      (window.visualViewport?.offsetTop ?? 0) -
      8;
    const rect = panel.getBoundingClientRect();
    setAbove(
      rect.bottom > limit &&
        ref.current.getBoundingClientRect().top > rect.height + 8,
    );
  }, [opened]);
  return (
    <details
      ref={ref}
      className="customer-action-menu"
      data-placement={above ? 'above' : 'below'}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpened(next);
        if (!next) setAbove(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={label}>
        <Ellipsis size={22} weight="bold" aria-hidden="true" />
      </summary>
      <div
        className="customer-action-menu-panel"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button,a') && ref.current)
            ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}

const destinations = [
  { to: '/', label: 'Trang chủ', Icon: House },
  { to: '/explore', label: 'Khám phá', Icon: Compass },
  { to: '/trips', label: 'Chuyến đi', Icon: Map },
  { to: '/saved', label: 'Đã lưu', Icon: Bookmark },
  { to: '/account', label: 'Tài khoản', Icon: UserRound },
];

export function AppBottomNavigation({
  path,
  signedIn,
  onNavigate,
}: {
  path: string;
  signedIn: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav
      className="mobile-bottom-nav customer-bottom-navigation"
      aria-label="Điều hướng di động"
      style={
        {
          '--nav-index': Math.max(
            0,
            destinations.findIndex(
              ({ to }) =>
                path === to ||
                (to === '/trips' &&
                  (path.startsWith('/trips') || path === '/budget')),
            ),
          ),
        } as CSSProperties
      }
    >
      {destinations.map(({ to, label, Icon }) => {
        const selected =
          path === to ||
          (to === '/trips' &&
            (path.startsWith('/trips') || path === '/budget'));
        return (
          <a
            key={to}
            href={to}
            className={`mobile-nav-item ${selected ? 'active' : ''}`}
            aria-current={selected ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(!signedIn && to !== '/' ? '/login' : to);
            }}
          >
            <span className="bottom-nav-icon">
              <Icon
                size={24}
                weight={selected ? 'fill' : 'regular'}
                aria-hidden="true"
              />
            </span>
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// A viewport resize is presentation state only: no form/draft mutations or requests.
export function useMobileViewport() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const inset = Math.max(
        0,
        window.innerHeight - height - (viewport?.offsetTop ?? 0),
      );
      document.documentElement.style.setProperty(
        '--customer-viewport-height',
        `${height}px`,
      );
      document.documentElement.style.setProperty(
        '--customer-keyboard-inset',
        `${inset}px`,
      );
      setKeyboardOpen(inset > 120);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty(
        '--customer-viewport-height',
      );
      document.documentElement.style.removeProperty(
        '--customer-keyboard-inset',
      );
    };
  }, []);
  return keyboardOpen;
}

export function LoadingSkeleton({
  label = 'Đang tải nội dung…',
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="customer-skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} aria-hidden="true" />
      ))}
    </div>
  );
}

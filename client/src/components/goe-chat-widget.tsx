import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { images } from '@goease/media';
import { GoeChat } from './goe-chat';

type Position = { x: number; y: number };
type Dock = { side: 'left' | 'right'; ratio: number };
const positionKey = 'goease:goe-position:v1';
const launcherSize = 48;

function bounds() {
  const bars = [
    ...document.querySelectorAll(
      '.mobile-bottom-nav, .journey-save-bar, .quick-keep-bar, .quick-actions, .quick-action, .place-bottom',
    ),
  ]
    .filter((node) =>
      ['fixed', 'sticky'].includes(getComputedStyle(node).position),
    )
    .map((node) => node.getBoundingClientRect())
    .filter(
      (rect) =>
        rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight,
    );
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 12;
  const top = (viewport?.offsetTop ?? 0) + 12;
  const right = left + (viewport?.width ?? window.innerWidth) - 24;
  const bottom = Math.min(
    (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12,
    ...bars.map((rect) => rect.top - 12),
  );
  return {
    left,
    right: Math.max(left, right - launcherSize),
    top,
    bottom: Math.max(top, bottom - launcherSize),
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function GoeChatWidget({
  signedIn,
  tripId,
  onNavigate,
  onApplied,
}: {
  signedIn: boolean;
  tripId?: string | undefined;
  onNavigate: (path: string) => void;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [chatStyle, setChatStyle] = useState<CSSProperties>();
  const dock = useRef<Dock | null>(null);
  const drag = useRef<{
    pointerId: number;
    start: Position;
    origin: Position;
    current: Position;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    if (open) setVisible(true);
  }, [open]);

  useEffect(() => {
    if (open || !visible) return;
    // Keep the conversation mounted after the exit animation has finished.
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 220;
    const timer = window.setTimeout(() => setVisible(false), delay);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(positionKey) ?? 'null',
      );
      if (
        saved &&
        typeof saved === 'object' &&
        'side' in saved &&
        (saved.side === 'left' || saved.side === 'right') &&
        'ratio' in saved &&
        typeof saved.ratio === 'number' &&
        Number.isFinite(saved.ratio)
      )
        dock.current = { side: saved.side, ratio: clamp(saved.ratio, 0, 1) };
    } catch {
      /* Position is optional when storage is unavailable. */
    }
    const fit = () => {
      const limits = bounds();
      if (!dock.current) {
        const rect = launcher.current?.getBoundingClientRect();
        dock.current = {
          side: 'right',
          ratio: rect
            ? clamp(
                (rect.top - limits.top) /
                  Math.max(1, limits.bottom - limits.top),
                0,
                1,
              )
            : 1,
        };
      }
      const next = {
        x: limits[dock.current.side],
        y: limits.top + dock.current.ratio * (limits.bottom - limits.top),
      };
      setPosition((previous) =>
        previous?.x === next.x && previous.y === next.y ? previous : next,
      );
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    // Routes and bottom actions can change without a viewport resize.
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = new MutationObserver(scheduleFit);
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      subtree: true,
    });
    const resize = new ResizeObserver(scheduleFit);
    resize.observe(document.body);
    return () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !position || !panel.current) return;
    const element = panel.current;
    const place = () => {
      const limits = bounds();
      const right = limits.right + launcherSize;
      const bottom = limits.bottom + launcherSize;
      const gap = 12;
      const onLeft = position.x + launcherSize / 2 < (limits.left + right) / 2;
      const sideRoom = onLeft
        ? right - position.x - launcherSize - gap
        : position.x - gap - limits.left;
      let width = Math.min(400, right - limits.left);
      let maxHeight = Math.min(560, bottom - limits.top);
      let x: number;
      let y: number;
      if (sideRoom >= 300) {
        width = Math.min(width, sideRoom);
        x = onLeft ? position.x + launcherSize + gap : position.x - width - gap;
        const height = Math.min(element.scrollHeight + 2, maxHeight);
        y = clamp(
          position.y + launcherSize / 2 - height / 2,
          limits.top,
          bottom - height,
        );
      } else {
        const above = position.y - gap - limits.top;
        const below = bottom - position.y - launcherSize - gap;
        const openAbove = above >= below;
        maxHeight = Math.max(1, Math.min(maxHeight, openAbove ? above : below));
        const height = Math.min(element.scrollHeight + 2, maxHeight);
        x = clamp(
          onLeft ? position.x : position.x + launcherSize - width,
          limits.left,
          right - width,
        );
        y = openAbove
          ? position.y - gap - height
          : position.y + launcherSize + gap;
      }
      const next = {
        left: x,
        top: y,
        right: 'auto',
        bottom: 'auto',
        width,
        height: maxHeight,
        maxHeight,
        transformOrigin: `${clamp(position.x + launcherSize / 2 - x, 0, width)}px ${clamp(position.y + launcherSize / 2 - y, 0, maxHeight)}px`,
      };
      setChatStyle((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, position]);

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    setTilt(0);
    if (
      !current.moved &&
      event.type === 'pointerup' &&
      event.pointerType === 'touch'
    ) {
      suppressClick.current = true;
      setStarted(true);
      setOpen((value) => !value);
    }
    if (current.moved) {
      suppressClick.current = true;
      const limits = bounds();
      const side =
        current.current.x + launcherSize / 2 < window.innerWidth / 2
          ? 'left'
          : 'right';
      const y = clamp(current.current.y, limits.top, limits.bottom);
      dock.current = {
        side,
        ratio: (y - limits.top) / Math.max(1, limits.bottom - limits.top),
      };
      setPosition({ x: limits[side], y });
      try {
        localStorage.setItem(positionKey, JSON.stringify(dock.current));
      } catch {
        /* Dragging works without storage. */
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog[open]')
      ) {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        panel.current?.contains(target) ||
        launcher.current?.contains(target) ||
        document.querySelector('dialog[open]')
      )
        return;
      // Let the page receive the click and keep focus on the clicked control.
      setOpen(false);
    };
    window.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };

  return (
    <>
      {started && (
        <div
          ref={panel}
          id="goe-floating-chat"
          className="goe-floating-chat"
          data-side={dock.current?.side ?? 'right'}
          data-open={open}
          style={chatStyle}
          role="dialog"
          aria-label="Trò chuyện với Goe"
          aria-hidden={!open}
          inert={!open}
          hidden={!open && !visible}
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.animationName === 'goe-chat-close' &&
              !open
            )
              setVisible(false);
          }}
        >
          <GoeChat
            embedded
            signedIn={signedIn}
            initialTripId={tripId}
            onClose={close}
            onApplied={onApplied}
            onNavigate={(next) => {
              close();
              onNavigate(next);
            }}
          />
        </div>
      )}
      <button
        ref={launcher}
        type="button"
        className={`goe-chat-launcher${dragging ? ' is-dragging' : ''}`}
        style={
          position
            ? ({
                left: position.x,
                top: position.y,
                right: 'auto',
                bottom: 'auto',
                '--goe-tilt': `${tilt}deg`,
              } as CSSProperties)
            : undefined
        }
        aria-label={open ? 'Thu gọn chat Goe' : 'Trò chuyện với Goe'}
        aria-expanded={open}
        aria-controls={started ? 'goe-floating-chat' : undefined}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          const rect = event.currentTarget.getBoundingClientRect();
          const origin = { x: rect.left, y: rect.top };
          drag.current = {
            pointerId: event.pointerId,
            start: { x: event.clientX, y: event.clientY },
            origin,
            current: origin,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || current.pointerId !== event.pointerId) return;
          const dx = event.clientX - current.start.x;
          const dy = event.clientY - current.start.y;
          if (!current.moved && Math.hypot(dx, dy) < 6) return;
          current.moved = true;
          const limits = bounds();
          setTilt(
            clamp((current.origin.x + dx - current.current.x) * 0.7, -12, 12),
          );
          current.current = {
            x: clamp(current.origin.x + dx, limits.left, limits.right),
            y: clamp(current.origin.y + dy, limits.top, limits.bottom),
          };
          setDragging(true);
          setPosition(current.current);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onClick={(event) => {
          const dragged = suppressClick.current;
          suppressClick.current = false;
          if (dragged && event.detail !== 0) return;
          setStarted(true);
          if (open) close();
          else setOpen(true);
        }}
      >
        <img src={images.goeMascot} alt="" draggable={false} />
      </button>
    </>
  );
}

import { companionChatLayout } from '../mascot/placement';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { MascotRenderer } from '../mascot/renderer';
import { useMascot, useMascotBehavior } from '../mascot/context';
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
  const surface = document
    .querySelector('.customer-ui.customer-v2')
    ?.getBoundingClientRect();
  const left = Math.max(viewport?.offsetLeft ?? 0, surface?.left ?? 0) + 12;
  const top = (viewport?.offsetTop ?? 0) + 12;
  const right =
    Math.min(
      (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
      surface?.right ?? window.innerWidth,
    ) - 12;
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
  const { controller, preferences, update, motionAllowed } = useMascot();
  const lastAutomaticAction = useMascotBehavior();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (preferences.hidden) setOpen(false);
  }, [preferences.hidden]);
  useEffect(() => () => controller.setChannel('drag', null), [controller]);
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
      if (drag.current) return;
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
    const place = () => {
      const next = companionChatLayout(position, bounds(), launcherSize);
      setChatStyle((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, position]);

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    controller.setChannel('drag', null);
    setTilt(0);
    if (
      !current.moved &&
      event.type === 'pointerup' &&
      event.pointerType === 'touch'
    ) {
      suppressClick.current = true;
      controller.play('touch', true);
      setStarted(true);
      setOpen((value) => !value);
    }
    if (current.moved) {
      suppressClick.current = true;
      const limits = bounds();
      const side =
        current.current.x < (limits.left + limits.right) / 2 ? 'left' : 'right';
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
      {preferences.hidden && (
        <button
          className="mascot-restore"
          onClick={() => update({ hidden: false })}
        >
          Hiện Goe
        </button>
      )}
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
        hidden={preferences.hidden}
        data-last-automatic-action={lastAutomaticAction ?? undefined}
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
          controller.setChannel('cursor', null);
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
          if (!current) {
            if (event.pointerType === 'mouse' && !open && motionAllowed) {
              const rect = event.currentTarget.getBoundingClientRect();
              const right = event.clientX >= rect.left + rect.width / 2;
              const down = event.clientY >= rect.top + rect.height / 2;
              controller.followCursor(down ? (right ? 2 : 3) : right ? 1 : 0);
            }
            return;
          }
          if (current.pointerId !== event.pointerId) return;
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
          controller.setChannel('drag', 'dragging');
          setPosition(current.current);
        }}
        onPointerLeave={() => controller.setChannel('cursor', null)}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onClick={(event) => {
          const dragged = suppressClick.current;
          suppressClick.current = false;
          if (dragged && event.detail !== 0) return;
          controller.setChannel('cursor', null);
          controller.play('touch', true);
          setStarted(true);
          if (open) close();
          else setOpen(true);
        }}
      >
        <MascotRenderer />
      </button>
    </>
  );
}

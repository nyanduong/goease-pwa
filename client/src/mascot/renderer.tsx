import { spriteFrameAt } from './sprite-timing';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { images } from '@goease/media';
import { animations } from './manifest';
import { useMascot } from './context';

/** CSS sprite atlas when verified; explicitly static cutout + motion fallback otherwise. */
export function MascotRenderer({
  className = '',
  assetUrlOverride,
}: {
  className?: string;
  assetUrlOverride?: string | undefined;
}) {
  const { controller, motionAllowed } = useMascot();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const definition = animations[snapshot.action];
  const [loaded, setLoaded] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const atlas = definition.assetStatus === 'reviewed' ? definition.atlas : null;
  const atlasUrl = assetUrlOverride ?? atlas?.url;
  const ready = atlas && loaded === atlasUrl && definition.frameCount > 1;
  useEffect(() => {
    if (!atlasUrl) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setLoaded(atlasUrl);
    };
    image.onerror = () => {
      if (active) setLoaded(null);
    };
    image.src = atlasUrl;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [atlasUrl]);
  useEffect(() => {
    setFrame(0);
    if (!ready || !motionAllowed) return;
    let raf = 0;
    let start: number | null = null;
    let previous = -1;
    const draw = (now: number) => {
      start ??= now;
      const next = spriteFrameAt(now - start, definition);
      if (next !== previous) {
        previous = next;
        setFrame(next);
      }
      if (definition.loop || next < definition.frameCount - 1)
        raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, motionAllowed, definition, snapshot.revision]);
  const displayFrame =
    snapshot.action === 'follow-cursor' && motionAllowed
      ? snapshot.lookFrame
      : frame;
  const style: CSSProperties | undefined = ready
    ? {
        backgroundImage: `url(${atlasUrl})`,
        backgroundSize: `${atlas.columns * 100}% ${100 / (atlas.rowHeight ?? 1 / atlas.rows)}%`,
        backgroundPosition: `${atlas.columns > 1 ? (displayFrame / (atlas.columns - 1)) * 100 : 0}% ${((atlas.rowStart ?? atlas.row / atlas.rows) / (1 - (atlas.rowHeight ?? 1 / atlas.rows))) * 100}%`,
        transformOrigin: `${definition.anchor[0] * 100}% ${definition.anchor[1] * 100}%`,
      }
    : undefined;
  return (
    <span
      className={`mascot-renderer ${className}`}
      data-action={snapshot.action}
      data-renderer={ready ? 'sprite' : 'static-fallback'}
      data-motion={motionAllowed ? definition.fallbackMotion : 'none'}
      aria-hidden="true"
    >
      {ready ? (
        <span className="mascot-sprite" style={style} />
      ) : fallbackFailed ? (
        <span className="mascot-image-fallback">G</span>
      ) : (
        <img
          src={images.goeMascot}
          draggable={false}
          alt=""
          onError={() => setFallbackFailed(true)}
        />
      )}
    </span>
  );
}

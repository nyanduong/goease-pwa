type Point = { x: number; y: number };
type Bounds = { left: number; right: number; top: number; bottom: number };
const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(low, high), Math.max(low, value));

/** Bounds describe launcher positions. Panel geometry never depends on hidden DOM height. */
export function companionChatLayout(
  position: Point,
  limits: Bounds,
  size = 48,
) {
  const right = limits.right + size;
  const bottom = limits.bottom + size;
  const gap = 12;
  const onLeft = position.x + size / 2 < (limits.left + right) / 2;
  const sideRoom = onLeft
    ? right - position.x - size - gap
    : position.x - gap - limits.left;
  let width = Math.min(400, right - limits.left);
  let height = Math.min(560, bottom - limits.top);
  let left: number;
  let top: number;
  if (sideRoom >= 300) {
    width = Math.min(width, sideRoom);
    left = onLeft ? position.x + size + gap : position.x - width - gap;
    top = clamp(
      position.y + size / 2 - height / 2,
      limits.top,
      bottom - height,
    );
  } else {
    const above = position.y - gap - limits.top;
    const below = bottom - position.y - size - gap;
    const openAbove = above >= below;
    height = Math.max(1, Math.min(height, openAbove ? above : below));
    left = clamp(
      onLeft ? position.x : position.x + size - width,
      limits.left,
      right - width,
    );
    top = openAbove ? position.y - gap - height : position.y + size + gap;
  }
  return {
    left,
    top,
    right: 'auto',
    bottom: 'auto',
    width,
    height,
    maxHeight: height,
    transformOrigin: `${clamp(position.x + size / 2 - left, 0, width)}px ${clamp(position.y + size / 2 - top, 0, height)}px`,
  };
}

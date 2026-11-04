export function spriteFrameAt(
  elapsedMs: number,
  definition: { frameCount: number; fps: number; loop: boolean },
) {
  if (
    definition.frameCount < 1 ||
    definition.fps <= 0 ||
    !Number.isFinite(elapsedMs)
  )
    return 0;
  const elapsed = Math.floor((Math.max(0, elapsedMs) * definition.fps) / 1000);
  return definition.loop
    ? elapsed % definition.frameCount
    : Math.min(elapsed, definition.frameCount - 1);
}

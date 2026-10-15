import {
  interpolatePipRect,
  type PipRect,
  pipEaseOutProgress,
} from './pip-window-geometry';

export async function animateYouTubePipRect(
  pip: Window,
  from: PipRect,
  target: PipRect,
  update: (rect: PipRect) => Promise<unknown>,
  options: { cancelled?: () => boolean } = {}
): Promise<boolean> {
  const cancelled = () => pip.closed || options.cancelled?.();
  if (cancelled()) return false;
  if (
    Object.keys(from).every(
      (key) => from[key as keyof PipRect] === target[key as keyof PipRect]
    )
  )
    return true;
  const duration = 320;
  const start = pip.performance.now();
  let progress = 0;
  let previous = from;
  // The visible PiP owns the clock. Worker timers and the hidden opener are
  // throttled, which otherwise turns native window motion into large jumps.
  // Await updates so a slow window manager never builds a queue of stale frames.
  while (progress < 1) {
    const time = await new Promise<number>((resolve) => {
      let timer = 0;
      const frame = pip.requestAnimationFrame((now) => {
        pip.clearTimeout(timer);
        resolve(now);
      });
      timer = pip.setTimeout(() => {
        pip.cancelAnimationFrame(frame);
        resolve(pip.performance.now());
      }, 50);
    });
    if (cancelled()) return false;
    progress = Math.min(1, Math.max(0, (time - start) / duration));
    const eased = pipEaseOutProgress(time - start);
    const rect = interpolatePipRect(from, target, eased);
    if (
      Object.keys(rect).some(
        (key) => rect[key as keyof PipRect] !== previous[key as keyof PipRect]
      )
    ) {
      await update(rect);
      previous = rect;
    }
  }
  return !cancelled();
}

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PipRect } from './pip-window-geometry';
import { animateYouTubePipRect } from './youtube-pip-animation';

const from = { left: 100, top: 200, width: 360, height: 237 };
const target = { ...from, left: 1000, top: 600 };
beforeEach(() => {
  vi.useFakeTimers();
  let time = 0;
  vi.spyOn(window.performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => {
      time += 16;
      callback(time);
    }, 0)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) =>
    window.clearTimeout(id)
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('eases out without overshoot, lands exactly, and never queues native updates', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const update = vi.fn(async (_rect: PipRect) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => window.setTimeout(resolve, 8));
    inFlight -= 1;
  });
  const animation = animateYouTubePipRect(window, from, target, update);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await animation).toBe(true);
  expect(update.mock.calls.length).toBeGreaterThan(15);
  expect(update).toHaveBeenLastCalledWith(target);
  expect(update.mock.calls.some(([rect]) => rect.left > target.left)).toBe(
    false
  );
  const positions = update.mock.calls.map(([rect]) => rect.left);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(maxInFlight).toBe(1);
});

it('stops a landing immediately when a new drag cancels it', async () => {
  let cancelled = false;
  const update = vi.fn(async () => {
    cancelled = true;
  });
  const animation = animateYouTubePipRect(window, from, target, update, {
    cancelled: () => cancelled,
  });
  await vi.advanceTimersByTimeAsync(100);
  expect(await animation).toBe(false);
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).not.toHaveBeenCalledWith(target);
});

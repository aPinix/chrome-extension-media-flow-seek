// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { animateYouTubePipReturn } from './youtube-pip-return';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('uses page frames to return the playing video from its current position to the source', async () => {
  vi.useFakeTimers();
  const target = document.createElement('div');
  const video = document.createElement('video');
  document.body.append(target);
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
  });
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    top: 100,
    width: 640,
    height: 360,
  } as DOMRect);
  const pip = {
    outerWidth: 360,
    innerWidth: 360,
    outerHeight: 237,
    innerHeight: 203,
    closed: false,
    performance: window.performance,
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id: number) => window.cancelAnimationFrame(id),
    setTimeout: (callback: () => void, delay: number) =>
      window.setTimeout(callback, delay),
    clearTimeout: (id: number) => window.clearTimeout(id),
  } as Window;
  let time = 0;
  vi.spyOn(window.performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => {
      time += 70;
      callback(time);
    }, 0)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) =>
    window.clearTimeout(id)
  );
  const send = vi.fn(async (request) =>
    request.destination
      ? {
          windowId: 2,
          from: { left: 1000, top: 700, width: 360, height: 237 },
          rect: { left: 40, top: 160, width: 640, height: 394 },
        }
      : {}
  );
  vi.stubGlobal('chrome', { runtime: { sendMessage: send } });
  const returning = animateYouTubePipReturn(pip, video, target);
  await vi.advanceTimersByTimeAsync(500);
  await returning;
  const frames = send.mock.calls
    .map(([request]) => request)
    .filter((request) => !request.destination);
  expect(frames.length).toBeGreaterThan(3);
  expect(frames[0].x).toBeGreaterThan(40);
  expect(frames.at(-1)).toEqual(
    expect.objectContaining({
      action: 'return',
      windowId: 2,
      x: 40,
      y: 160,
      width: 640,
      height: 394,
    })
  );
  expect(send.mock.calls[0]?.[0].destination).toEqual(
    expect.objectContaining({ left: 20, top: 100, width: 640, height: 360 })
  );
});

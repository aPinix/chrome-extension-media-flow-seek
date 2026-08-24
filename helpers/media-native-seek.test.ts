// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DeferredMediaSeek,
  installNativePlayerSeekBridge,
  tryNativePlayerSeek,
} from '@/helpers/media';

const createRect = (
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect;

const createTimeRanges = (ranges: Array<[number, number]>): TimeRanges => ({
  length: ranges.length,
  start: (index: number) => ranges[index]?.[0] ?? 0,
  end: (index: number) => ranges[index]?.[1] ?? 0,
});

const createIncrementalPlayer = (
  withTrack = true,
  duration = Infinity,
  clampDirectSeek = false
) => {
  const player = document.createElement('div');
  const video = document.createElement('video');
  const clock = document.createElement('span');
  const control = document.createElement('div');
  const track = document.createElement('div');
  const directAssignments: number[] = [];
  let currentTime = 0;

  clock.textContent = '0:00 / 2:00';
  player.append(video, clock, control);
  if (withTrack) control.append(track);
  document.body.append(player);

  video.getBoundingClientRect = () => createRect(100, 100, 800, 450);
  control.getBoundingClientRect = () => createRect(110, 490, 780, 32);
  track.getBoundingClientRect = () => createRect(110, 501, 780, 8);

  Object.defineProperties(video, {
    buffered: {
      configurable: true,
      value: createTimeRanges([[0, 10]]),
    },
    currentSrc: {
      configurable: true,
      value: `blob:https://example.test/${crypto.randomUUID()}`,
    },
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (time: number) => {
        directAssignments.push(time);
        currentTime = clampDirectSeek ? Math.min(time, 10) : time;
      },
    },
    duration: { configurable: true, value: duration },
    seekable: {
      configurable: true,
      value: createTimeRanges([[0, 10]]),
    },
  });

  return {
    control,
    directAssignments,
    setCurrentTimeFromPlayer: (time: number) => {
      currentTime = time;
    },
    video,
  };
};

describe('native player seeking', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('hands an unloaded target to a nearby custom timeline', () => {
    const { control, video } = createIncrementalPlayer();
    let clickedAt = 0;
    control.addEventListener('click', (event) => {
      clickedAt = (event as MouseEvent).clientX;
      event.preventDefault();
    });

    expect(tryNativePlayerSeek(video, 96)).toBe(true);
    expect(clickedAt).toBeCloseTo(734);
  });

  it('does not click an unrelated wide control without a timeline track', () => {
    const { control, video } = createIncrementalPlayer(false);
    const clickListener = vi.fn();
    control.addEventListener('click', clickListener);

    expect(tryNativePlayerSeek(video, 96)).toBe(false);
    expect(clickListener).not.toHaveBeenCalled();
  });

  it('waits for the native player before falling back to currentTime', () => {
    vi.useFakeTimers();
    const { control, directAssignments, video } = createIncrementalPlayer();
    control.className = 'player-timeline';
    control.addEventListener('click', () => undefined);
    const seek = new DeferredMediaSeek(video, 150);

    seek.schedule(96);
    vi.advanceTimersByTime(150);
    expect(directAssignments).toEqual([]);

    vi.advanceTimersByTime(1499);
    expect(directAssignments).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(directAssignments).toEqual([96]);
  });

  it('cancels the fallback once the native player reaches the target', () => {
    vi.useFakeTimers();
    const { control, directAssignments, setCurrentTimeFromPlayer, video } =
      createIncrementalPlayer();
    control.className = 'player-timeline';
    control.addEventListener('click', () => {
      setCurrentTimeFromPlayer(96);
    });
    const seek = new DeferredMediaSeek(video, 150);

    seek.schedule(96);
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(2000);

    expect(video.currentTime).toBe(96);
    expect(directAssignments).toEqual([]);
  });

  it('uses the native timeline when a finite-duration player clamps an unloaded seek', () => {
    vi.useFakeTimers();
    const { control, directAssignments, setCurrentTimeFromPlayer, video } =
      createIncrementalPlayer(true, 120, true);
    const nativeClick = vi.fn((event: Event) => {
      setCurrentTimeFromPlayer(96);
      event.preventDefault();
    });
    control.addEventListener('click', nativeClick);
    const seek = new DeferredMediaSeek(video, 150);

    seek.schedule(96);
    vi.advanceTimersByTime(150);

    expect(directAssignments).toEqual([96]);
    expect(nativeClick).toHaveBeenCalledOnce();
    expect(video.currentTime).toBe(96);
  });

  it('does not overwrite a seek the site confirms it handled', () => {
    vi.useFakeTimers();
    const { control, directAssignments, video } = createIncrementalPlayer();
    control.addEventListener('click', (event) => event.preventDefault());
    const seek = new DeferredMediaSeek(video, 150);

    seek.schedule(96);
    vi.advanceTimersByTime(2150);

    expect(directAssignments).toEqual([]);
  });

  it('invokes a framework timeline handler through the main-world bridge', () => {
    vi.useFakeTimers();
    const { control, directAssignments, video } = createIncrementalPlayer();
    let clickedAt = 0;
    const reactClickHandler = vi.fn(
      (event: { pageX: number; preventDefault: () => void }) => {
        clickedAt = event.pageX;
        event.preventDefault();
      }
    );
    Object.defineProperty(control, '__reactProps$steam', {
      configurable: true,
      value: { onClick: reactClickHandler },
    });
    const uninstallBridge = installNativePlayerSeekBridge(document);
    const seek = new DeferredMediaSeek(video, 150);

    try {
      seek.stage(30);
      vi.advanceTimersByTime(500);
      seek.stage(96);
      vi.advanceTimersByTime(500);
      expect(reactClickHandler).not.toHaveBeenCalled();

      seek.commit();
      vi.advanceTimersByTime(2000);

      expect(reactClickHandler).toHaveBeenCalledOnce();
      expect(clickedAt).toBeCloseTo(734);
      expect(directAssignments).toEqual([]);
    } finally {
      uninstallBridge();
    }
  });
});

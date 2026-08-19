import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DeferredMediaSeek,
  getMediaProgress,
  getMediaSeekRange,
  getMediaSeekTarget,
  isMediaTimeBuffered,
} from '@/helpers/media';

const createVideo = (
  duration: number,
  currentTime: number,
  seekableRanges: Array<[number, number]> = [],
  playerText?: string
): HTMLVideoElement => {
  const player = playerText
    ? ({ parentElement: null, textContent: playerText } as HTMLElement)
    : null;

  return {
    currentSrc: 'blob:https://example.test/video',
    duration,
    currentTime,
    parentElement: player,
    seekable: {
      length: seekableRanges.length,
      start: (index: number) => seekableRanges[index]?.[0],
      end: (index: number) => seekableRanges[index]?.[1],
    },
  } as HTMLVideoElement;
};

const createBufferedMedia = (
  bufferedRanges: Array<[number, number]>,
  onSeek?: (time: number) => void
): HTMLMediaElement => {
  let currentTime = 0;
  const media = {
    buffered: {
      length: bufferedRanges.length,
      start: (index: number) => bufferedRanges[index]?.[0],
      end: (index: number) => bufferedRanges[index]?.[1],
    },
  } as HTMLMediaElement;

  Object.defineProperty(media, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (time: number) => {
      currentTime = time;
      onSeek?.(time);
    },
  });

  return media;
};

const createClampingMedia = (): {
  extendBuffer: (end: number) => void;
  media: HTMLMediaElement;
} => {
  let bufferedEnd = 20;
  let currentTime = 10;
  const events = new EventTarget();
  const media = {
    addEventListener: events.addEventListener.bind(events),
    buffered: {
      get length() {
        return 1;
      },
      start: () => 0,
      end: () => bufferedEnd,
    },
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as HTMLMediaElement;

  Object.defineProperty(media, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (time: number) => {
      currentTime = Math.min(time, bufferedEnd);
    },
  });

  return {
    media,
    extendBuffer: (end: number) => {
      bufferedEnd = end;
      events.dispatchEvent(new Event('progress'));
    },
  };
};

describe('getMediaSeekRange', () => {
  it('uses the complete timeline for on-demand videos', () => {
    const range = getMediaSeekRange(createVideo(120, 30, [[20, 40]]));

    expect(range).toEqual({ start: 0, end: 120, duration: 120 });
  });

  it('uses the latest seekable window for live and DVR video', () => {
    const video = createVideo(Infinity, 135, [
      [10, 20],
      [100, 160],
    ]);
    const range = getMediaSeekRange(video);

    expect(range).toEqual({ start: 100, end: 160, duration: 60 });
    if (!range) {
      throw new Error('Expected a seekable media range');
    }
    expect(getMediaProgress(video, range)).toBeCloseTo(0.5833, 3);
  });

  it('uses a custom player total for an incrementally loaded static stream', () => {
    const video = createVideo(Infinity, 20, [[0, 27]], '0:20 / 2:04');
    const range = getMediaSeekRange(video);

    expect(range).toEqual({ start: 0, end: 124, duration: 124 });
    if (!range) {
      throw new Error('Expected a static media range');
    }
    expect(getMediaProgress(video, range)).toBeCloseTo(0.1613, 3);
  });

  it('supports hour-long duration hints and ignores unrelated time pairs', () => {
    const video = createVideo(
      Infinity,
      65,
      [[0, 80]],
      'Chapter 0:05 / 0:30 – Playing 0:01:05 / 1:02:03'
    );

    expect(getMediaSeekRange(video)).toEqual({
      start: 0,
      end: 3723,
      duration: 3723,
    });
  });

  it('uses the precise appended end once it passes a rounded player total', () => {
    const video = createVideo(Infinity, 124.9, [[0, 124.97]], '2:04 / 2:04');

    expect(getMediaSeekRange(video)).toEqual({
      start: 0,
      end: 124.97,
      duration: 124.97,
    });
  });

  it('does not treat a growing zero-based MSE buffer as total duration', () => {
    expect(getMediaSeekRange(createVideo(Infinity, 20, [[0, 27]]))).toBeNull();
  });

  it('rejects media that has no seekable timeline yet', () => {
    expect(getMediaSeekRange(createVideo(Number.NaN, 0))).toBeNull();
  });
});

describe('DeferredMediaSeek', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits only the final target from a stream of scrub updates', () => {
    vi.useFakeTimers();
    const soughtTimes: number[] = [];
    const media = createBufferedMedia([], (time) => soughtTimes.push(time));
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(30);
    vi.advanceTimersByTime(100);
    seek.schedule(120);
    vi.advanceTimersByTime(100);
    seek.schedule(300);

    vi.advanceTimersByTime(149);
    expect(soughtTimes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(soughtTimes).toEqual([300]);
  });

  it('stages only the final unloaded gesture target until commit', () => {
    vi.useFakeTimers();
    const soughtTimes: number[] = [];
    const media = createBufferedMedia([], (time) => soughtTimes.push(time));
    const seek = new DeferredMediaSeek(media, 150);

    seek.stage(30);
    vi.advanceTimersByTime(500);
    seek.stage(120);
    vi.advanceTimersByTime(500);
    seek.stage(300);
    vi.advanceTimersByTime(500);

    expect(soughtTimes).toEqual([]);

    seek.commit();
    expect(soughtTimes).toEqual([300]);
  });

  it('keeps staged buffered targets immediate', () => {
    const soughtTimes: number[] = [];
    const media = createBufferedMedia([[0, 60]], (time) =>
      soughtTimes.push(time)
    );
    const seek = new DeferredMediaSeek(media, 150);

    seek.stage(20);
    seek.stage(40);
    seek.commit();

    expect(soughtTimes).toEqual([20, 40]);
  });

  it('seeks immediately while the scrub target is already buffered', () => {
    vi.useFakeTimers();
    const soughtTimes: number[] = [];
    const media = createBufferedMedia([[0, 60]], (time) =>
      soughtTimes.push(time)
    );
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(20);
    seek.schedule(40);

    expect(soughtTimes).toEqual([20, 40]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops a pending unloaded seek when scrubbing returns to buffered media', () => {
    vi.useFakeTimers();
    const soughtTimes: number[] = [];
    const media = createBufferedMedia([[0, 60]], (time) =>
      soughtTimes.push(time)
    );
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(300);
    seek.schedule(40);
    vi.runAllTimers();

    expect(soughtTimes).toEqual([40]);
  });

  it('cancels an uncommitted target when an overlay is removed', () => {
    vi.useFakeTimers();
    const media = { currentTime: 0 } as HTMLMediaElement;
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(300);
    seek.cancel();
    vi.runAllTimers();

    expect(media.currentTime).toBe(0);
  });

  it('cancels an explicitly staged target when an overlay is removed', () => {
    const media = { currentTime: 0 } as HTMLMediaElement;
    const seek = new DeferredMediaSeek(media, 150);

    seek.stage(300);
    seek.cancel();
    seek.commit();

    expect(media.currentTime).toBe(0);
  });

  it('keeps forcing an unloaded target as a clamped stream grows', () => {
    vi.useFakeTimers();
    const { extendBuffer, media } = createClampingMedia();
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(100);
    vi.advanceTimersByTime(150);
    expect(media.currentTime).toBe(20);

    extendBuffer(60);
    vi.runOnlyPendingTimers();
    expect(media.currentTime).toBe(60);

    extendBuffer(110);
    vi.runOnlyPendingTimers();
    expect(media.currentTime).toBe(100);

    extendBuffer(120);
    vi.runOnlyPendingTimers();
    expect(media.currentTime).toBe(100);
  });

  it('stops forcing a clamped target when seeking is cancelled', () => {
    vi.useFakeTimers();
    const { extendBuffer, media } = createClampingMedia();
    const seek = new DeferredMediaSeek(media, 150);

    seek.schedule(100);
    vi.advanceTimersByTime(150);
    expect(media.currentTime).toBe(20);

    seek.cancel();
    extendBuffer(60);
    vi.runOnlyPendingTimers();

    expect(media.currentTime).toBe(20);
  });
});

describe('getMediaSeekTarget', () => {
  it('maps and clamps timeline positions for on-demand video', () => {
    const range = { start: 0, end: 120, duration: 120 };

    expect(getMediaSeekTarget(range, 50, 50, 200)).toEqual({
      progress: 0,
      time: 0,
    });
    expect(getMediaSeekTarget(range, 150, 50, 200)).toEqual({
      progress: 0.5,
      time: 60,
    });
    expect(getMediaSeekTarget(range, 250, 50, 200)).toEqual({
      progress: 1,
      time: 120,
    });
    expect(getMediaSeekTarget(range, -100, 50, 200)?.time).toBe(0);
    expect(getMediaSeekTarget(range, 500, 50, 200)?.time).toBe(120);
  });

  it('maps the visible live/DVR window and rejects invalid dimensions', () => {
    const range = { start: 100, end: 160, duration: 60 };

    expect(getMediaSeekTarget(range, 75, 25, 100)).toEqual({
      progress: 0.5,
      time: 130,
    });
    expect(getMediaSeekTarget(range, 75, 25, 0)).toBeNull();
  });
});

describe('isMediaTimeBuffered', () => {
  it('supports disjoint buffered ranges', () => {
    const media = createBufferedMedia([
      [0, 30],
      [90, 120],
    ]);

    expect(isMediaTimeBuffered(media, 20)).toBe(true);
    expect(isMediaTimeBuffered(media, 60)).toBe(false);
    expect(isMediaTimeBuffered(media, 100)).toBe(true);
  });
});

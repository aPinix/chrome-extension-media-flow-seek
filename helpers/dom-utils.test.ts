// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DOMUtils } from '@/helpers/dom-utils';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('DOMUtils mouse video discovery', () => {
  it('checks immediately while throttling subsequent pointer movement', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const check = DOMUtils.createMouseCheckThrottler(callback);

    check(new MouseEvent('mousemove'));
    check(new MouseEvent('mousemove'));

    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    check(new MouseEvent('mousemove'));

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not reconcile overlays during a pressed-button drag', () => {
    const callback = vi.fn();
    const check = DOMUtils.createMouseCheckThrottler(callback);

    check(new MouseEvent('mousemove', { buttons: 1 }));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('DOMUtils YouTube hover previews', () => {
  const createVisibleVideo = (): HTMLVideoElement => {
    const video = document.createElement('video');
    video.getBoundingClientRect = () =>
      ({
        bottom: 180,
        height: 160,
        left: 10,
        right: 294,
        top: 20,
        width: 284,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    return video;
  };

  it('adds an overlay to YouTube thumbnail preview videos for wheel control', () => {
    const preview = document.createElement('ytd-moving-thumbnail-renderer');
    const video = createVisibleVideo();
    const createOverlay = vi.fn();
    preview.appendChild(video);
    document.body.appendChild(preview);

    DOMUtils.checkForVideos({
      createOverlay,
      debugMode: false,
      hasOverlay: () => false,
      shouldRun: () => true,
    });

    expect(DOMUtils.isYouTubeHoverPreview(video)).toBe(true);
    expect(createOverlay).toHaveBeenCalledWith(video);
    expect(video.hasAttribute('data-scrub-enabled')).toBe(true);
  });

  it('keeps an existing overlay when a video moves into a thumbnail', () => {
    const thumbnail = document.createElement('ytd-thumbnail');
    const video = createVisibleVideo();
    const removeOverlay = vi.fn();
    thumbnail.appendChild(video);
    document.body.appendChild(thumbnail);
    video.setAttribute('data-scrub-enabled', 'true');

    DOMUtils.checkForVideos({
      createOverlay: vi.fn(),
      debugMode: false,
      hasOverlay: () => true,
      removeOverlay,
      shouldRun: () => true,
    });

    expect(removeOverlay).not.toHaveBeenCalled();
    expect(video.hasAttribute('data-scrub-enabled')).toBe(true);
  });

  it('still creates overlays for ordinary watch-page videos', () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    const video = createVisibleVideo();
    const createOverlay = vi.fn();
    player.appendChild(video);
    document.body.appendChild(player);

    DOMUtils.checkForVideos({
      createOverlay,
      debugMode: false,
      hasOverlay: () => false,
      shouldRun: () => true,
    });

    expect(DOMUtils.isYouTubeHoverPreview(video)).toBe(false);
    expect(createOverlay).toHaveBeenCalledWith(video);
  });
});

describe('DOMUtils video removal observation', () => {
  it('requests immediate pruning when a temporary video is removed', async () => {
    const host = document.createElement('div');
    const video = document.createElement('video');
    const callback = vi.fn();
    host.appendChild(video);
    document.body.appendChild(host);
    const observer = DOMUtils.observeNewVideos(callback);

    video.remove();

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    observer.disconnect();
  });
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.tiktok.com/@example/video/1"}
import { expect, it, vi } from 'vitest';
import { setupSocialVideo } from '@/helpers/social-video';

it('remembers native TikTok volume separately without changing playback speed', () => {
  const set = vi.fn((_value, callback) => callback?.());
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((key, callback) => {
          expect(key).toBe('mfs-tiktok-audio');
          callback({
            'mfs-tiktok-audio': { volume: 0.25, muted: false },
            'mfs-instagram-audio': { volume: 0.9, muted: true },
          });
        }),
        set,
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  const video = document.createElement('video');
  video.playbackRate = 1.25;
  video.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 300, bottom: 500 }) as DOMRect;
  Object.defineProperty(video, 'paused', { value: false });
  document.body.append(video);
  const controller = setupSocialVideo(video, () => ({
    instagramPlaybackSpeed: 2,
    tiktokPlaybackSpeed: 1.25,
  }));
  try {
    expect(video.volume).toBe(0.25);
    expect(video.playbackRate).toBe(1.25);
    const nativeSlider = document.createElement('input');
    nativeSlider.type = 'range';
    nativeSlider.setAttribute('aria-label', 'Volume');
    document.body.append(nativeSlider);
    nativeSlider.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    );
    video.volume = 0.6;
    video.dispatchEvent(new Event('volumechange'));
    controller.cleanup();
    expect(set).toHaveBeenLastCalledWith(
      {
        'mfs-tiktok-audio': { volume: 0.6, muted: false },
      },
      expect.any(Function)
    );
    nativeSlider.remove();
  } finally {
    controller.cleanup();
    video.remove();
    vi.unstubAllGlobals();
  }
});

it('restores TikTok volume after a browser-session restart and ignores site resets', async () => {
  const saved: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((key, callback) => callback({ [key]: saved[key] })),
        set: vi.fn((value, callback) => {
          Object.assign(saved, value);
          callback?.();
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.resetModules();
  const firstModule = await import('./social-video');
  const first = document.createElement('video');
  document.body.append(first);
  const controller = firstModule.setupSocialVideo(first, () => ({}));
  controller.remember({ volume: 0.19, muted: false });
  expect(saved['mfs-tiktok-audio']).toEqual({ volume: 0.19, muted: false });
  vi.resetModules();
  const freshModule = await import('./social-video');
  const next = document.createElement('video');
  document.body.append(next);
  const nextController = freshModule.setupSocialVideo(next, () => ({}));
  try {
    expect(next.volume).toBe(0.19);
    next.volume = 1;
    next.dispatchEvent(new Event('volumechange'));
    next.dispatchEvent(new Event('loadedmetadata'));
    expect(next.volume).toBe(0.19);
    expect(saved['mfs-tiktok-audio']).toEqual({ volume: 0.19, muted: false });
    expect(saved['mfs-instagram-audio']).toBeUndefined();
  } finally {
    controller.cleanup();
    nextController.cleanup();
    first.remove();
    next.remove();
    vi.unstubAllGlobals();
  }
});

it('applies independent TikTok speed and auto-skip changes immediately', () => {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((_key, callback) => callback({})),
        set: vi.fn((_value, callback) => callback?.()),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  const settings = {
    instagramPlaybackSpeed: 0.5,
    instagramAutoSkip: true,
    tiktokPlaybackSpeed: 1.5,
    tiktokAutoSkip: false,
  };
  const video = document.createElement('video');
  video.loop = true;
  video.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      right: 300,
      bottom: 500,
      width: 300,
      height: 500,
    }) as DOMRect;
  const scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  Object.defineProperties(scroller, {
    clientHeight: { value: 500 },
    scrollHeight: { value: 1500 },
  });
  scroller.scrollBy = vi.fn();
  scroller.append(video);
  document.body.append(scroller);
  const controller = setupSocialVideo(video, () => settings);
  try {
    expect(video.playbackRate).toBe(1.5);
    expect(video.loop).toBe(true);
    video.dispatchEvent(new Event('ended'));
    expect(scroller.scrollBy).not.toHaveBeenCalled();
    settings.tiktokPlaybackSpeed = 2;
    settings.tiktokAutoSkip = true;
    document.dispatchEvent(new Event('mfs-tiktok-settings'));
    expect(video.playbackRate).toBe(2);
    expect(video.loop).toBe(false);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    video.dispatchEvent(new Event('ended'));
    expect(scroller.scrollBy).not.toHaveBeenCalled();
    dialog.remove();
    video.dispatchEvent(new Event('ended'));
    video.dispatchEvent(new Event('ended'));
    expect(scroller.scrollBy).toHaveBeenCalledExactlyOnceWith({
      top: 500,
      behavior: 'smooth',
    });
    settings.tiktokAutoSkip = false;
    document.dispatchEvent(new Event('mfs-tiktok-settings'));
    expect(video.loop).toBe(true);
    controller.cleanup();
    expect(video.playbackRate).toBe(1);
  } finally {
    controller.cleanup();
    scroller.remove();
    vi.unstubAllGlobals();
  }
});

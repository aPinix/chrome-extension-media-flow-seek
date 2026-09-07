// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { setupSocialPageControls } from '@/helpers/social-page-controls';
import type { ContentSettingsT } from '@/types/content';

afterEach(() => {
  document.body.replaceChildren();
  document.querySelector('.mfs-viewport-portal')?.remove();
  vi.unstubAllGlobals();
});

it.each(['instagram', 'tiktok'] as const)(
  'shows independent %s controls above the action rail and saves changes',
  (site) => {
    const set = vi.fn();
    vi.stubGlobal('chrome', { storage: { sync: { set } } });
    const settings: Partial<ContentSettingsT> = {
      [`${site}ShowPlaybackSpeed`]: true,
      [`${site}ShowAutoSkip`]: true,
      [`${site}PlaybackSpeed`]: 1.5,
      [`${site}AutoSkip`]: false,
    };
    const article = document.createElement('article');
    const video = document.createElement('video');
    video.getBoundingClientRect = () =>
      ({
        top: 20,
        bottom: 620,
        left: 100,
        right: 400,
        width: 300,
        height: 600,
      }) as DOMRect;
    const rail = document.createElement('aside');
    rail.getBoundingClientRect = () =>
      ({
        top: 250,
        bottom: 620,
        left: 410,
        right: 458,
        width: 48,
        height: 370,
      }) as DOMRect;
    const like = document.createElement('button');
    like.setAttribute('aria-label', 'Like');
    like.getBoundingClientRect = () =>
      ({
        top: 320,
        bottom: 368,
        left: 410,
        right: 458,
        width: 48,
        height: 48,
      }) as DOMRect;
    rail.append(like);
    article.append(video, rail);
    document.body.append(article);
    const controller = setupSocialPageControls(
      video,
      site,
      () => settings,
      (key, value) => {
        Object.assign(settings, { [key]: value });
      }
    );
    try {
      const toolbar = document.querySelector<HTMLElement>(
        '.mfs-social-page-controls'
      );
      article.style.backgroundColor = 'white';
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(toolbar?.dataset.appearance).toBe('light');
      article.style.backgroundColor = 'rgb(16, 16, 16)';
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(toolbar?.dataset.appearance).toBe('dark');
      expect(toolbar?.style.top).toBe('122px');
      expect(toolbar?.style.left).toBe('408px');
      expect(toolbar?.parentElement?.style.overflow).toBe('hidden');
      const speed = toolbar?.querySelector<HTMLButtonElement>(
        '[data-mfs-action="playback-speed"]'
      );
      const menu = toolbar?.querySelector<HTMLElement>('[role="menu"]');
      const options = toolbar?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]'
      );
      expect(menu?.hidden).toBe(true);
      speed?.click();
      expect(menu?.hidden).toBe(false);
      expect(document.activeElement?.textContent).toBe('1.5×');
      options?.[4]?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
      expect(document.activeElement?.textContent).toBe('2×');
      options?.[5]?.click();
      expect(menu?.hidden).toBe(true);
      expect(document.activeElement).toBe(speed);
      speed?.click();
      speed?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      expect(menu?.hidden).toBe(true);
      speed?.click();
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(menu?.hidden).toBe(true);
      expect(set).toHaveBeenCalledWith({ [`${site}PlaybackSpeed`]: 2 });
      const skip = toolbar?.querySelector<HTMLButtonElement>('[role="switch"]');
      skip?.click();
      expect(set).toHaveBeenCalledWith({ [`${site}AutoSkip`]: true });
      expect(skip?.getAttribute('aria-checked')).toBe('true');
      Object.assign(settings, { [`${site}ShowPlaybackSpeed`]: false });
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(speed?.parentElement?.style.display).toBe('none');
      expect(skip?.parentElement?.style.display).toBe('flex');
      Object.assign(settings, { [`${site}ShowAutoSkip`]: false });
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(document.querySelector('.mfs-social-page-controls')).toBeNull();
      expect(settings[`${site}AutoSkip`]).toBe(true);
    } finally {
      controller.cleanup();
    }
  }
);

it('never shows a toolbar for an offscreen video', () => {
  const video = document.createElement('video');
  document.body.append(video);
  video.getBoundingClientRect = () =>
    ({
      left: 100,
      right: 400,
      top: 1500,
      bottom: 2100,
      width: 300,
      height: 600,
    }) as DOMRect;
  const controller = setupSocialPageControls(video, 'tiktok', () => ({
    tiktokShowPlaybackSpeed: true,
  }));
  expect(document.querySelector('.mfs-social-page-controls')).toBeNull();
  controller.cleanup();
});

it.each(['instagram', 'tiktok'] as const)(
  'restores %s controls after a speed change and page rerender while paused',
  async (site) => {
    vi.stubGlobal('chrome', { storage: { sync: { set: vi.fn() } } });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const flush = async () => {
      await Promise.resolve();
      frames.splice(0).forEach((callback) => {
        callback(0);
      });
    };
    const settings: Partial<ContentSettingsT> = {
      [`${site}ShowPlaybackSpeed`]: true,
      [`${site}ShowAutoSkip`]: true,
      [`${site}PlaybackSpeed`]: 1,
    };
    const video = document.createElement('video');
    video.getBoundingClientRect = () =>
      ({
        top: 20,
        bottom: 620,
        left: 100,
        right: 400,
        width: 300,
        height: 600,
      }) as DOMRect;
    document.body.append(video);
    const controller = setupSocialPageControls(video, site, () => settings);
    try {
      const toolbar = document.querySelector('.mfs-social-page-controls');
      if (!toolbar) throw new Error('Expected playback controls');
      Object.assign(settings, { [`${site}PlaybackSpeed`]: 2 });
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(
        toolbar
          .querySelector('[data-mfs-action="playback-speed"]')
          ?.getAttribute('title')
      ).toBe('Playback speed: 2×');
      document.querySelector('.mfs-viewport-portal')?.remove();
      await flush();
      expect(toolbar.isConnected).toBe(true);
      toolbar.remove();
      await flush();
      expect(toolbar.isConnected).toBe(true);
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.getClientRects = () =>
        [video.getBoundingClientRect()] as unknown as DOMRectList;
      document.body.append(dialog);
      await flush();
      expect(toolbar.isConnected).toBe(false);
      dialog.remove();
      await flush();
      expect(toolbar.isConnected).toBe(true);
      expect(toolbar.querySelector('[role="switch"]')).not.toBeNull();
      await flush();
      await Promise.resolve();
      expect(frames).toHaveLength(0);
    } finally {
      controller.cleanup();
      vi.restoreAllMocks();
    }
  }
);

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
      expect(rail.firstElementChild).toBe(like);
      if (site === 'tiktok') {
        expect(toolbar?.parentElement).toBe(rail);
        expect(rail.childElementCount).toBe(2);
        expect(rail.style.position).toBe('relative');
        expect(toolbar?.style.top).toBe('auto');
        expect(toolbar?.style.bottom).toBe('calc(100% + 20px)');
        expect(toolbar?.style.left).toBe('50%');
        expect(document.querySelector('.mfs-viewport-portal')).toBeNull();
      } else {
        expect(rail.childElementCount).toBe(1);
        expect(toolbar?.style.top).toBe('122px');
        expect(toolbar?.style.left).toBe('408px');
        expect(toolbar?.parentElement?.style.overflow).toBe('hidden');
      }
      const speed = toolbar?.querySelector<HTMLButtonElement>(
        '[data-mfs-action="playback-speed"]'
      );
      const menu = toolbar?.querySelector<HTMLElement>('[role="menu"]');
      const options = toolbar?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]'
      );
      expect(menu?.hidden).toBe(true);
      speed?.querySelector('span')?.click();
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
      skip?.querySelector<HTMLElement>('span:last-child')?.click();
      expect(set).toHaveBeenCalledWith({ [`${site}AutoSkip`]: true });
      expect(skip?.getAttribute('aria-checked')).toBe('true');
      Object.assign(settings, { [`${site}ShowPlaybackSpeed`]: false });
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(speed?.parentElement?.style.display).toBe('none');
      expect(skip?.parentElement?.style.display).toBe('flex');
      Object.assign(settings, { [`${site}ShowAutoSkip`]: false });
      document.dispatchEvent(new Event(`mfs-${site}-settings`));
      expect(document.querySelector('.mfs-social-page-controls')).toBeNull();
      expect(rail.style.position).toBe('');
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

it('places popup controls above native bottom buttons, ignoring an offscreen dialog', () => {
  const popup = document.createElement('div');
  popup.setAttribute('role', 'dialog');
  popup.getBoundingClientRect = () => new DOMRect(0, 0, 900, 700);
  const video = document.createElement('video');
  video.getBoundingClientRect = () => new DOMRect(100, 0, 400, 650);
  const native = document.createElement('div');
  const pip = document.createElement('button');
  const soundHost = document.createElement('div');
  const sound = document.createElement('button');
  sound.dataset.e2e = 'browse-sound';
  sound.getBoundingClientRect = soundHost.getBoundingClientRect = () => new DOMRect(600, 610, 40, 40);
  pip.getBoundingClientRect = () => new DOMRect(552, 610, 40, 40);
  soundHost.append(sound);
  native.append(pip, soundHost);
  popup.append(video, native);
  const hidden = document.createElement('div');
  hidden.setAttribute('role', 'dialog');
  hidden.getBoundingClientRect = () => new DOMRect(0, window.innerHeight, 550, 64);
  document.body.append(popup, hidden);
  const controller = setupSocialPageControls(video, 'tiktok', () => ({tiktokShowPlaybackSpeed: true, tiktokShowAutoSkip: true}));
  try {
    const toolbar = soundHost.querySelector<HTMLElement>('.mfs-social-page-controls');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.style.flexDirection).toBe('row');
    expect(toolbar?.style.right).toBe('0px');
    expect(toolbar?.style.bottom).toBe('calc(100% + 12px)');
    expect(toolbar?.querySelector<HTMLElement>('[role="menu"]')?.style.bottom).toBe('54px');
  } finally {
    controller.cleanup();
  }
  expect(soundHost.children).toHaveLength(1);
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
    if (site === 'tiktok') {
      const rail = document.createElement('aside');
      const like = document.createElement('button');
      like.setAttribute('aria-label', 'Like');
      rail.getBoundingClientRect = like.getBoundingClientRect = () =>
        ({
          top: 250,
          bottom: 620,
          left: 410,
          right: 458,
          width: 48,
          height: 370,
        }) as DOMRect;
      rail.append(like);
      document.body.append(rail);
    }
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
      dialog.getBoundingClientRect = video.getBoundingClientRect;
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

it('keeps TikTok controls attached while the rail scrolls above the viewport and restores its styles', () => {
  const video = document.createElement('video');
  const rail = document.createElement('aside');
  const like = document.createElement('button');
  like.setAttribute('aria-label', 'Like');
  rail.style.setProperty('position', 'static', 'important');
  let offset = 0;
  video.getBoundingClientRect = () =>
    ({
      top: 20 - offset,
      bottom: 620 - offset,
      left: 100,
      right: 400,
      width: 300,
      height: 600,
    }) as DOMRect;
  rail.getBoundingClientRect = like.getBoundingClientRect = () =>
    ({
      top: 100 - offset,
      bottom: 500 - offset,
      left: 410,
      right: 458,
      width: 48,
      height: 400,
    }) as DOMRect;
  rail.append(like);
  document.body.append(video, rail);
  const controller = setupSocialPageControls(video, 'tiktok', () => ({
    tiktokShowPlaybackSpeed: true,
    tiktokShowAutoSkip: true,
  }));
  const toolbar = rail.querySelector<HTMLElement>('.mfs-social-page-controls');
  expect(toolbar).not.toBeNull();
  const position = toolbar?.style.cssText;
  offset = 300;
  document.dispatchEvent(new Event('mfs-tiktok-settings'));
  expect(toolbar?.parentElement).toBe(rail);
  expect(toolbar?.style.cssText).toBe(position);
  expect(rail.firstElementChild).toBe(like);
  controller.cleanup();
  expect(rail.style.position).toBe('static');
  expect(rail.style.getPropertyPriority('position')).toBe('important');
  expect(rail.childElementCount).toBe(1);
});

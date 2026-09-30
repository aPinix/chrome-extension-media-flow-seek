// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=test-video"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MINI_PLAYER_GEOMETRY,
  MINI_PLAYER_GEOMETRY_KEY,
} from './mini-player-settings';
import { FloatingPlayer } from './player-floating';
import { DEFAULT_PLAYER_TOOLS } from './player-tools-settings';

let floating: FloatingPlayer;
let video: HTMLVideoElement;
let player: HTMLElement;
let root: ShadowRoot;
let paused: boolean;
let originalBottom: number;
let settings: typeof DEFAULT_PLAYER_TOOLS;
let stored: unknown;
const set = vi.fn(async () => {});
const report = vi.fn();
const onFloat = vi.fn();
let storageChanged: (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string
) => void;
const rect = (top: number, width = 640, height = 360) => ({
  x: 0,
  y: top,
  left: 0,
  right: width,
  top,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
});
const control = (label: string) => {
  const node = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!node) throw new Error(`Missing control: ${label}`);
  return node;
};
const ready = async () => {
  await vi.waitFor(() => expect(floating.inMini).toBe(true));
};
const makeFloating = () =>
  new FloatingPlayer(
    video,
    root,
    () => settings,
    true,
    report,
    () => {},
    () => ({ range: null, enabled: false }),
    onFloat
  );
beforeEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/watch?v=test-video');
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 768,
  });
  paused = false;
  originalBottom = -40;
  settings = {
    ...DEFAULT_PLAYER_TOOLS,
    backward: 7,
    forward: 7,
    arrowKeySeekingEnabled: false,
  };
  stored = undefined;
  set.mockReset();
  report.mockReset();
  onFloat.mockReset();
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: async () => ({ [MINI_PLAYER_GEOMETRY_KEY]: stored }), set },
      onChanged: {
        addListener: (listener: typeof storageChanged) => {
          storageChanged = listener;
        },
        removeListener: vi.fn(),
      },
    },
  });
  document.body.innerHTML =
    '<ytd-masthead></ytd-masthead><div id="player"><div id="movie_player" style="width:640px"><div class="html5-video-container"><video></video></div><div class="ytp-right-controls"></div></div></div><div id="tools"></div>';
  player = document.querySelector('#movie_player') as HTMLElement;
  video = document.querySelector('video') as HTMLVideoElement;
  root = (document.querySelector('#tools') as HTMLElement).attachShadow({
    mode: 'open',
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return this.tagName === 'YTD-MASTHEAD'
        ? rect(0, 1024, 56)
        : rect(originalBottom - 360);
    }
  );
  Object.defineProperties(video, {
    paused: { configurable: true, get: () => paused },
    duration: { configurable: true, value: 120 },
    videoWidth: { configurable: true, value: 1600 },
    videoHeight: { configurable: true, value: 900 },
  });
  video.currentTime = 30;
  vi.spyOn(video, 'play').mockImplementation(async () => {
    paused = false;
    video.dispatchEvent(new Event('play'));
  });
  vi.spyOn(video, 'pause').mockImplementation(() => {
    paused = true;
    video.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    originalBottom = 400;
    floating.update();
  });
  floating = makeFloating();
});
afterEach(() => {
  floating.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
describe('YouTube mini player', () => {
  it.each([
    [1920, 800],
    [900, 1600],
  ])(
    'fits %s × %s video dimensions and repairs YouTube sizing offsets',
    async (width, height) => {
      floating.reset();
      const container = video.closest('.html5-video-container') as HTMLElement;
      video.style.cssText =
        'left:80px;top:50px;max-width:640px;object-fit:contain';
      container.style.cssText = 'left:40px;top:25px;max-height:360px';
      const videoStyle = video.getAttribute('style');
      const containerStyle = container.getAttribute('style');
      Object.defineProperties(video, {
        videoWidth: { configurable: true, value: width },
        videoHeight: { configurable: true, value: height },
      });
      floating.update();
      await ready();
      expect(
        Number.parseFloat(player.style.width) /
          Number.parseFloat(player.style.height)
      ).toBeCloseTo(width / height);
      video.style.setProperty('left', '200px', 'important');
      video.style.setProperty('top', '100px', 'important');
      container.style.setProperty('max-height', '100px', 'important');
      video.dispatchEvent(new Event('resize'));
      expect(video.style.left).toBe('0px');
      expect(video.style.top).toBe('0px');
      expect(video.style.objectFit).toBe('cover');
      expect(container.style.maxHeight).toBe('none');
      Object.defineProperties(video, {
        videoWidth: { configurable: true, value: 1200 },
        videoHeight: { configurable: true, value: 900 },
      });
      video.dispatchEvent(new Event('resize'));
      expect(
        Number.parseFloat(player.style.width) /
          Number.parseFloat(player.style.height)
      ).toBeCloseTo(4 / 3);
      originalBottom = 400;
      floating.update();
      expect(video.getAttribute('style')).toBe(videoStyle);
      expect(container.getAttribute('style')).toBe(containerStyle);
      expect(video.currentTime).toBe(30);
    }
  );
  it('floats the same player at the top left and restores original styles without interrupting playback', async () => {
    floating.reset();
    const parent = player.parentNode;
    const originalStyle = player.getAttribute('style');
    onFloat.mockClear();
    floating.update();
    await ready();
    expect(player.style.left).toBe('16px');
    expect(player.style.width).toBe('360px');
    video.style.setProperty('width', '360px', 'important');
    floating.update();
    expect(video.style.width).toBe('100%');
    expect(player.parentNode).toBe(parent);
    expect(player.querySelector('video')).toBe(video);
    expect(video.currentTime).toBe(30);
    expect(video.pause).not.toHaveBeenCalled();
    expect(onFloat).toHaveBeenCalledOnce();
    originalBottom = 400;
    floating.update();
    expect(floating.inMini).toBe(false);
    expect(player.getAttribute('style')).toBe(originalStyle);
    expect(
      document.documentElement.dataset.mfsMiniPlayerActive
    ).toBeUndefined();
  });
  it('starts only for playing videos above the viewport and keeps a paused floating video', async () => {
    floating.reset();
    paused = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(floating.inMini).toBe(false);
    originalBottom = 1200;
    await video.play();
    expect(floating.inMini).toBe(false);
    originalBottom = -40;
    floating.update();
    expect(floating.inMini).toBe(true);
    video.pause();
    expect(floating.inMini).toBe(true);
  });
  it('promotes the same player and controls to the browser top layer and cleans up promotion', async () => {
    floating.reset();
    const host = root.host as HTMLElement;
    const originalHostStyle = host.getAttribute('style');
    player.showPopover = vi.fn();
    player.hidePopover = vi.fn();
    host.showPopover = vi.fn();
    host.hidePopover = vi.fn();
    const parent = player.parentElement;
    floating.update();
    await ready();
    expect(player.showPopover).toHaveBeenCalledOnce();
    expect(host.showPopover).toHaveBeenCalledOnce();
    expect(player.getAttribute('popover')).toBe('manual');
    expect(player.parentElement).toBe(parent);
    expect(player.querySelector('video')).toBe(video);
    floating.restoreMini();
    expect(player.hidePopover).toHaveBeenCalledOnce();
    expect(host.hidePopover).toHaveBeenCalledOnce();
    expect(player.hasAttribute('popover')).toBe(false);
    expect(host.hasAttribute('popover')).toBe(false);
    expect(host.getAttribute('style') || null).toBe(originalHostStyle);
  });
  it('restores layout even when navigation already removed a top-layer player', async () => {
    floating.reset();
    const host = root.host as HTMLElement;
    player.showPopover = vi.fn();
    host.showPopover = vi.fn();
    player.hidePopover = vi.fn(() => {
      throw new DOMException('Popover is already unavailable');
    });
    host.hidePopover = vi.fn(() => {
      throw new DOMException('Popover is already unavailable');
    });
    floating.update();
    await ready();
    player.remove();
    expect(() => floating.restoreMini()).not.toThrow();
    expect(floating.inMini).toBe(false);
    expect(player.hasAttribute('popover')).toBe(false);
    expect(host.hasAttribute('popover')).toBe(false);
    expect(player.style.position).toBe('');
  });
  it('releases theater stacking without lifting the full-size background above the header', async () => {
    floating.reset();
    const theater = document.createElement('div');
    theater.id = 'full-bleed-container';
    theater.style.cssText =
      'position:static;z-index:1;isolation:isolate;contain:paint;transform:translateZ(0);overflow-x:clip;overflow-y:clip';
    const parent = player.parentElement as HTMLElement;
    parent.before(theater);
    theater.append(parent);
    const originalStyle = theater.getAttribute('style');
    floating.update();
    await ready();
    expect(theater.style.zIndex).toBe('auto');
    expect(theater.style.position).toBe('static');
    expect(theater.style.isolation).toBe('auto');
    expect(theater.style.contain).toBe('none');
    expect(theater.style.transform).toBe('none');
    expect(theater.style.overflow).toBe('visible');
    floating.restoreMini();
    expect(theater.getAttribute('style')).toBe(originalStyle);
    expect(player.parentElement).toBe(parent);
  });
  it('seeks independently of arrow-key enablement and controls volume and playback', async () => {
    await ready();
    control('Seek backward 7 seconds').click();
    expect(
      control('Seek backward 7 seconds').querySelector('text')?.textContent
    ).toBe('7');
    expect(video.currentTime).toBe(23);
    control('Seek forward 7 seconds').click();
    expect(video.currentTime).toBe(30);
    control('Pause').click();
    expect(paused).toBe(true);
    control('Play').click();
    expect(paused).toBe(false);
    control('Mute').click();
    expect(video.muted).toBe(true);
    const volume = control('Mini player volume') as HTMLInputElement;
    volume.value = '.4';
    volume.dispatchEvent(new Event('input'));
    expect(video.volume).toBe(0.4);
    expect(video.muted).toBe(false);
    const seek = control('Mini player seek') as HTMLInputElement;
    seek.value = '65';
    seek.dispatchEvent(new Event('input'));
    expect(video.currentTime).toBe(65);
    settings.backward = settings.forward = 12;
    floating.update();
    expect(
      control('Seek forward 12 seconds').querySelector('text')?.textContent
    ).toBe('12');
  });
  it('closes without pausing, rearms on returning or changing media, and returns to the original player', async () => {
    await ready();
    control('Close mini player').click();
    floating.update();
    expect(floating.inMini).toBe(false);
    expect(video.pause).not.toHaveBeenCalled();
    originalBottom = 400;
    floating.update();
    originalBottom = -40;
    floating.update();
    expect(floating.inMini).toBe(true);
    control('Close mini player').click();
    floating.reset();
    floating.update();
    expect(floating.inMini).toBe(true);
    control('Back to top').click();
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'instant',
    });
    expect(floating.inMini).toBe(false);
  });
  it('preserves saved geometry across viewport changes and accepts live resets', async () => {
    floating.cleanup();
    stored = { x: 600, y: 200, width: 400 };
    floating = makeFloating();
    await ready();
    expect(player.style.left).toBe('600px');
    Object.defineProperty(window, 'innerWidth', { value: 320 });
    floating.update();
    expect(Number.parseFloat(player.style.width)).toBeLessThanOrEqual(304);
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    floating.update();
    expect(player.style.left).toBe('600px');
    expect(player.style.width).toBe('400px');
    expect(set).not.toHaveBeenCalled();
    storageChanged(
      {
        [MINI_PLAYER_GEOMETRY_KEY]: { newValue: DEFAULT_MINI_PLAYER_GEOMETRY },
      },
      'local'
    );
    expect(player.style.left).toBe('16px');
    expect(player.style.width).toBe('360px');
  });
  it('saves keyboard changes on release and reports failures visibly', async () => {
    await ready();
    const handle = control(
      'Move mini player. Use arrow keys; Shift for fine adjustments.'
    );
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(player.style.left).toBe('26px');
    expect(set).not.toHaveBeenCalled();
    handle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(set).toHaveBeenCalledWith({
      [MINI_PLAYER_GEOMETRY_KEY]: expect.objectContaining({ x: 26 }),
    });
    const resize = control('Resize mini player');
    resize.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true })
    );
    expect(player.style.width).toBe('361px');
    set.mockRejectedValueOnce(new Error('Storage unavailable'));
    resize.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    await vi.waitFor(() =>
      expect(root.querySelector('[role="status"]')?.textContent).toContain(
        'Could not save'
      )
    );
    expect(floating.inMini).toBe(true);
  });
  it('saves pointer movement and resizing only on completion', async () => {
    await ready();
    const handle = control(
      'Move mini player. Use arrow keys; Shift for fine adjustments.'
    );
    handle.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, clientX: 20, clientY: 110 })
    );
    handle.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 80, clientY: 150 })
    );
    expect(player.style.left).toBe('76px');
    expect(set).not.toHaveBeenCalled();
    handle.dispatchEvent(new MouseEvent('pointerup'));
    expect(set).toHaveBeenCalledOnce();
    const resize = control('Resize mini player');
    resize.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, clientX: 436 })
    );
    resize.dispatchEvent(new MouseEvent('pointermove', { clientX: 496 }));
    expect(player.style.width).toBe('420px');
    resize.dispatchEvent(new MouseEvent('pointerup'));
    expect(set).toHaveBeenCalledTimes(2);
  });
  it('keeps keyboard controls accessible without leaving pointer-clicked controls revealed', async () => {
    await ready();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(
      root.querySelector('.mini-controls')?.getAttribute('data-keyboard')
    ).toBe('true');
    document.dispatchEvent(new MouseEvent('pointerdown'));
    expect(
      root.querySelector('.mini-controls')?.getAttribute('data-keyboard')
    ).toBe('false');
  });
  it('supports direct scrubbing and finer seeking when the pointer moves upwards', async () => {
    await ready();
    const seek = control('Mini player seek');
    vi.spyOn(seek, 'getBoundingClientRect').mockReturnValue(rect(200, 120, 20));
    seek.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, clientX: 30, clientY: 200 })
    );
    expect(video.currentTime).toBe(30);
    seek.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 50, clientY: 200 })
    );
    expect(video.currentTime).toBe(50);
    seek.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 70, clientY: 152 })
    );
    expect(video.currentTime).toBeCloseTo(50 + 20 / 3);
    expect(root.querySelector('.mini-seek-hint')?.textContent).toBe(
      'Precise seeking'
    );
    seek.dispatchEvent(new MouseEvent('pointerup'));
    expect(
      root.querySelector('.mini-controls')?.getAttribute('data-seeking')
    ).toBe('false');
    expect((root.querySelector('.mini-seek-hint') as HTMLElement).hidden).toBe(
      true
    );
    expect(set).not.toHaveBeenCalled();
  });
  it('restores for ads, fullscreen, PiP, disabling, navigation and cleanup', async () => {
    await ready();
    player.classList.add('ad-showing');
    floating.update();
    expect(floating.inMini).toBe(false);
    player.classList.remove('ad-showing');
    floating.update();
    expect(floating.inMini).toBe(true);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: player,
    });
    floating.update();
    expect(floating.inMini).toBe(false);
    Object.defineProperty(document, 'fullscreenElement', { value: null });
    floating.update();
    Object.defineProperty(document, 'pictureInPictureElement', {
      configurable: true,
      value: video,
    });
    floating.update();
    expect(floating.inMini).toBe(false);
    Object.defineProperty(document, 'pictureInPictureElement', { value: null });
    floating.update();
    settings.miniPlayer = false;
    floating.update();
    expect(floating.inMini).toBe(false);
    settings.miniPlayer = true;
    floating.update();
    expect(floating.inMini).toBe(true);
    window.history.replaceState(null, '', '/shorts/test');
    floating.update();
    expect(floating.inMini).toBe(false);
    window.history.replaceState(null, '', '/watch?v=new');
    floating.update();
    player
      .querySelector('.ytp-right-controls')
      ?.replaceWith(document.createElement('div'));
    floating.update();
    expect(floating.inMini).toBe(true);
    floating.cleanup();
    expect(player.style.position).toBe('');
    expect(root.childElementCount).toBe(0);
    expect(player.querySelector('video')).toBe(video);
  });
});

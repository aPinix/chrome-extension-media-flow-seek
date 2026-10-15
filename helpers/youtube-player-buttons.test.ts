// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type YouTubePlayerButtonState,
  YouTubePlayerButtons,
} from './youtube-player-buttons';

let buttons: YouTubePlayerButtons;
const actions = {
  onLoop: vi.fn(),
  onEdit: vi.fn(),
  onBoost: vi.fn(),
  onCinema: vi.fn(),
  onInfoCards: vi.fn(),
  onScreenshot: vi.fn(),
  onFilters: vi.fn(),
  onPip: vi.fn(),
  onBookmarks: vi.fn(),
  onEditBookmarks: vi.fn(),
  onAdvanced: vi.fn(),
};
const state = (): YouTubePlayerButtonState => ({
  boost: { level: 2, active: false, available: true },
  cinema: { enabled: true, active: false, available: true },
  loop: {
    enabled: true,
    active: false,
    available: true,
    expanded: false,
    hasSections: true,
  },
  infoCards: { enabled: true, visible: true, available: true },
  screenshot: { enabled: true, available: true },
  filters: { enabled: true, available: true, expanded: false },
  pip: { enabled: true, available: true },
  bookmarks: { enabled: true, available: true, expanded: false },
});
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML =
    '<div id="movie_player"><video class="html5-main-video"></video><div class="ytp-right-controls"><span><button class="ytp-autonav-toggle-button"></button></span><button class="ytp-subtitles-button"></button></div></div>';
  buttons = new YouTubePlayerButtons(
    document.querySelector('video') as HTMLVideoElement,
    actions
  );
});
afterEach(() => {
  buttons.cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('YouTube toolbar ownership', () => {
  it('bookmarks on click, opens the editor on hold without adding, and supports Shift+Enter', async () => {
    vi.useFakeTimers();
    buttons.update(state());
    buttons.bookmarksButton.click();
    expect(actions.onBookmarks).toHaveBeenCalledOnce();
    actions.onBookmarks.mockClear();
    buttons.bookmarksButton.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    await vi.advanceTimersByTimeAsync(600);
    buttons.bookmarksButton.dispatchEvent(
      new Event('pointerup', { bubbles: true })
    );
    buttons.bookmarksButton.click();
    expect(actions.onEditBookmarks).toHaveBeenCalledOnce();
    expect(actions.onBookmarks).not.toHaveBeenCalled();
    buttons.bookmarksButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    );
    expect(actions.onEditBookmarks).toHaveBeenCalledTimes(2);
    const next = state();
    next.bookmarks.enabled = false;
    buttons.update(next);
    expect(buttons.bookmarksButton.isConnected).toBe(false);
  });
  it('opens loop editing on hold without toggling on release and has no separate edit button', async () => {
    vi.useFakeTimers();
    buttons.update(state());
    expect(document.querySelector('.mfs-loop-edit-button')).toBeNull();
    buttons.loopButton.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    await vi.advanceTimersByTimeAsync(600);
    buttons.loopButton.dispatchEvent(new Event('pointerup', { bubbles: true }));
    buttons.loopButton.click();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onLoop).not.toHaveBeenCalled();
    expect(buttons.loopButton.nextElementSibling?.textContent).toContain(
      'Hold to edit loop sections'
    );
    buttons.loopButton.click();
    expect(actions.onLoop).toHaveBeenCalledOnce();
  });
  it('detects overflow inside modern flex controls and restores inline after widening', () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const controls = document.querySelector(
      '.ytp-right-controls'
    ) as HTMLElement;
    const chrome = document.createElement('div');
    chrome.className = 'ytp-chrome-bottom';
    controls.before(chrome);
    chrome.innerHTML =
      '<div class="ytp-chrome-controls" style="display:flex"><div class="ytp-left-controls" style="display:flex;flex:1;min-width:0"><button style="width:40px"></button><span style="width:40px;margin-left:12px"></span><div style="width:100px"></div><div class="ytp-chapter-container" style="width:300px"></div></div></div>';
    chrome.firstElementChild?.append(controls);
    controls.style.display = 'flex';
    controls.innerHTML =
      '<div class="ytp-right-controls-left" style="display:flex;width:80px"><button class="ytp-subtitles-button" style="width:48px"></button><button class="ytp-settings-button" style="width:48px"></button></div><div class="ytp-right-controls-right" style="display:flex;width:64px"><button style="width:48px"></button><button style="width:48px"></button></div>';
    let availableWidth = 576;
    Object.defineProperty(chrome, 'clientWidth', { get: () => availableWidth });
    const left = chrome.querySelector('.ytp-left-controls') as HTMLElement;
    Object.defineProperty(left, 'offsetWidth', {
      get: () => availableWidth - 576,
    });
    buttons.update(state());
    // The allocated left/right widths fit, but their actual controls do not.
    expect(buttons.toolbar.dataset.stacked).toBe('true');
    availableWidth = 816;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('false');
    availableWidth = 576;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('true');
  });

  it('moves all custom controls above crowded native controls and restores the row on resize', () => {
    let resize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const controls = document.querySelector(
      '.ytp-right-controls'
    ) as HTMLElement;
    const chrome = document.createElement('div');
    chrome.className = 'ytp-chrome-bottom';
    controls.before(chrome);
    const left = document.createElement('div');
    left.className = 'ytp-left-controls';
    chrome.append(left, controls);
    let availableWidth = 520;
    Object.defineProperty(chrome, 'clientWidth', { get: () => availableWidth });
    Object.defineProperty(left, 'offsetWidth', { value: 180 });
    chrome.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 464,
        left: 0,
        right: availableWidth,
        width: availableWidth,
        height: 64,
      }) as DOMRect;
    for (const child of controls.children)
      Object.defineProperty(child, 'offsetWidth', { value: 48 });
    buttons.update(state());
    expect(buttons.toolbar.dataset.stacked).toBe('true');
    expect(buttons.toolbar.style.bottom).toBe('72px');
    expect(buttons.toolbar.style.maxWidth).toBe('520px');
    expect(buttons.toolbar.querySelectorAll('button')).toHaveLength(8);
    expect(controls.querySelector('.ytp-subtitles-button')?.parentElement).toBe(
      controls
    );
    // Eight custom buttons, two native controls, and the left controls fit
    // exactly. Do not reserve extra space that forces a second row early.
    availableWidth = 660;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('false');
    expect(buttons.toolbar.style.bottom).toBe('');
    availableWidth = 659;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('true');
    availableWidth = 660;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('false');
    availableWidth = 280;
    resize?.();
    expect(buttons.toolbar.dataset.stacked).toBe('true');
    expect(buttons.toolbar.style.maxWidth).toBe('280px');
    buttons.cleanup();
    expect(disconnect).toHaveBeenCalled();
  });

  it('uses rendered native control widths instead of larger declared widths', () => {
    const controls = document.querySelector(
      '.ytp-right-controls'
    ) as HTMLElement;
    const chrome = document.createElement('div');
    chrome.className = 'ytp-chrome-bottom';
    controls.before(chrome);
    chrome.append(controls);
    Object.defineProperty(chrome, 'clientWidth', { value: 496 });
    chrome.getBoundingClientRect = () => ({ width: 248 }) as DOMRect;
    for (const child of controls.children) {
      const element = child as HTMLElement;
      element.style.width = '48px';
      element.getBoundingClientRect = () => ({ width: 16 }) as DOMRect;
    }
    buttons.update(state());
    // 432px custom + 64px native, even when the player is scaled to 50%.
    expect(buttons.toolbar.dataset.stacked).toBe('false');
  });

  it('recalculates the layout when features are disabled', () => {
    const controls = document.querySelector(
      '.ytp-right-controls'
    ) as HTMLElement;
    const chrome = document.createElement('div');
    chrome.className = 'ytp-chrome-bottom';
    controls.before(chrome);
    chrome.append(controls);
    Object.defineProperty(chrome, 'clientWidth', { value: 320 });
    for (const child of controls.children)
      Object.defineProperty(child, 'offsetWidth', { value: 48 });
    buttons.update(state());
    expect(buttons.toolbar.dataset.stacked).toBe('true');
    const next = state();
    next.cinema.enabled =
      next.loop.enabled =
      next.infoCards.enabled =
      next.screenshot.enabled =
      next.filters.enabled =
      next.pip.enabled =
      next.bookmarks.enabled =
        false;
    buttons.update(next);
    expect(buttons.toolbar.dataset.stacked).toBe('false');
  });

  it('shows a second-line options hint only on buttons with long-press controls', () => {
    buttons.update(state());
    buttons.update(state());
    for (const button of [
      buttons.boostButton,
      buttons.cinemaButton,
      buttons.screenshotButton,
    ]) {
      const tip = button.nextElementSibling as HTMLElement;
      expect(tip.dataset.advanced).toBe('true');
      expect(tip.querySelectorAll('.mfs-tooltip-hint')).toHaveLength(1);
      expect(tip.querySelector('.mfs-tooltip-hint')?.textContent).toBe(
        'Hold for options'
      );
      expect(
        tip.querySelector('.mfs-tooltip-heading .ytp-tooltip-keyboard-shortcut')
      ).not.toBeNull();
    }
    for (const button of [buttons.infoCardsButton, buttons.filtersButton]) {
      expect(
        button.nextElementSibling?.querySelector('.mfs-tooltip-hint')
      ).toBeNull();
    }
  });
  it('keeps inactive toggles clickable and exposes boxed native-style shortcut hints', () => {
    const next = state();
    next.infoCards.visible = false;
    buttons.update(next);
    for (const [button, key] of [
      [buttons.boostButton, 'B'],
      [buttons.cinemaButton, 'D'],
      [buttons.infoCardsButton, 'E'],
      [buttons.loopButton, 'R'],
      [buttons.screenshotButton, 'S'],
      [buttons.filtersButton, 'V'],
    ] as const) {
      expect(button.style.opacity).toBe('1');
      expect(button.disabled).toBe(false);
      expect(
        button.nextElementSibling?.querySelector(
          '.ytp-tooltip-keyboard-shortcut'
        )?.textContent
      ).toBe(key);
      expect(button.getAttribute('aria-keyshortcuts')).toContain(key);
    }
    expect(
      buttons.cinemaButton.querySelector('.mfs-toggle-fill')
    ).not.toBeNull();
    expect(
      buttons.infoCardsButton.querySelectorAll('.mfs-toggle-detail')
    ).toHaveLength(2);
    const native = document.querySelector(
      '.ytp-subtitles-button'
    ) as HTMLElement;
    native.style.width = '56px';
    native.style.height = '56px';
    buttons.update(next);
    expect(buttons.cinemaButton.style.width).toBe('56px');
    expect(buttons.cinemaButton.style.height).toBe('56px');
  });
  it.each(['boost', 'cinema', 'screenshot'] as const)(
    'opens %s options on a hold without triggering its click',
    async (kind) => {
      vi.useFakeTimers();
      buttons.update(state());
      const button = buttons[`${kind}Button`];
      const action =
        kind === 'boost'
          ? actions.onBoost
          : kind === 'cinema'
            ? actions.onCinema
            : actions.onScreenshot;
      button.dispatchEvent(
        new MouseEvent('pointerdown', { button: 0, bubbles: true })
      );
      await vi.advanceTimersByTimeAsync(599);
      expect(actions.onAdvanced).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(actions.onAdvanced).toHaveBeenCalledExactlyOnceWith(kind);
      button.dispatchEvent(new Event('pointerup', { bubbles: true }));
      button.click();
      expect(action).not.toHaveBeenCalled();
      button.dispatchEvent(
        new MouseEvent('pointerdown', { button: 0, bubbles: true })
      );
      button.dispatchEvent(new Event('pointerup', { bubbles: true }));
      button.click();
      expect(action).toHaveBeenCalledOnce();
    }
  );
  it.each(['pointerleave', 'pointercancel', 'pointerup'] as const)(
    'cancels a hold on %s',
    async (type) => {
      vi.useFakeTimers();
      buttons.update(state());
      buttons.boostButton.dispatchEvent(
        new MouseEvent('pointerdown', { button: 0, bubbles: true })
      );
      buttons.boostButton.dispatchEvent(new Event(type, { bubbles: true }));
      await vi.advanceTimersByTimeAsync(700);
      expect(actions.onAdvanced).not.toHaveBeenCalled();
    }
  );
  it('cancels holds after movement, disablement, and cleanup, and supports Shift+Enter', async () => {
    vi.useFakeTimers();
    buttons.update(state());
    buttons.boostButton.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    buttons.boostButton.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 20 })
    );
    await vi.advanceTimersByTimeAsync(700);
    expect(actions.onAdvanced).not.toHaveBeenCalled();
    buttons.boostButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    );
    expect(actions.onAdvanced).toHaveBeenCalledExactlyOnceWith('boost');
    actions.onAdvanced.mockClear();
    buttons.boostButton.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    const next = state();
    next.boost.available = false;
    buttons.update(next);
    await vi.advanceTimersByTimeAsync(700);
    expect(actions.onAdvanced).not.toHaveBeenCalled();
    buttons.update(state());
    buttons.boostButton.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    buttons.cleanup();
    await vi.advanceTimersByTimeAsync(700);
    expect(actions.onAdvanced).not.toHaveBeenCalled();
  });
  it('anchors every tooltip to its button instead of a stale native tooltip position', () => {
    const nativeTip = document.createElement('div');
    nativeTip.className = 'ytp-tooltip';
    nativeTip.style.top = '200px';
    nativeTip.innerHTML =
      '<div class="ytp-tooltip-text-wrapper"><span class="ytp-tooltip-text" style="font-size:14px">Old seek tooltip</span></div>';
    document.querySelector('#movie_player')?.append(nativeTip);
    buttons.update(state());
    for (const button of [
      buttons.boostButton,
      buttons.cinemaButton,
      buttons.loopButton,
      buttons.infoCardsButton,
      buttons.screenshotButton,
      buttons.filtersButton,
    ]) {
      Object.defineProperties(button, {
        offsetLeft: { value: button === buttons.loopButton ? 40 : 0 },
        offsetWidth: { value: button === buttons.loopButton ? 32 : 40 },
      });
      button.dispatchEvent(new Event('pointerenter'));
      const tip = button.nextElementSibling as HTMLElement;
      expect(tip.getAttribute('role')).toBe('tooltip');
      expect(tip.style.top).toBe('');
      expect(tip.style.bottom).toBe('calc(100% + 12px)');
      expect(tip.style.left).toBe(
        button === buttons.loopButton ? '56px' : '20px'
      );
      expect(tip.style.fontSize).toBe('14px');
      nativeTip.style.top = '400px';
      button.focus();
      expect(tip.style.top).toBe('');
    }
    expect(buttons.toolbar.querySelector('style')?.textContent).toContain(
      'bottom:calc(100% + 12px)'
    );
  });
  it('keeps tooltip centers in local coordinates when the player is scaled or resized', () => {
    buttons.update(state());
    const button = buttons.loopButton;
    Object.defineProperties(button, {
      offsetLeft: { value: 40 },
      offsetTop: { value: 8 },
      offsetWidth: { value: 32 },
    });
    button.getBoundingClientRect = () => new DOMRect(480, 700, 64, 96);
    buttons.container.getBoundingClientRect = () =>
      new DOMRect(400, 700, 144, 96);
    button.dispatchEvent(new Event('pointerenter'));
    const tip = button.nextElementSibling as HTMLElement;
    expect(tip.style.left).toBe('56px');
    expect(tip.style.bottom).toBe('calc(100% + 4px)');
    buttons.container.style.transform = 'scale(0.75)';
    button.focus();
    expect(tip.style.left).toBe('56px');
    expect(tip.style.top).toBe('');
  });
  it.each(Array.from({ length: 256 }, (_, i) => i))(
    'keeps the correct order for feature combination %i',
    (mask) => {
      const next = state();
      next.boost.level = mask & 1 ? 2 : 0;
      next.cinema.enabled = Boolean(mask & 2);
      next.loop.enabled = Boolean(mask & 4);
      next.infoCards.enabled = Boolean(mask & 8);
      next.screenshot.enabled = Boolean(mask & 16);
      next.filters.enabled = Boolean(mask & 32);
      next.pip.enabled = Boolean(mask & 64);
      next.bookmarks.enabled = Boolean(mask & 128);
      buttons.update(next);
      const controls = document.querySelector(
        '.ytp-right-controls'
      ) as HTMLElement;
      expect(controls.querySelectorAll('.mfs-youtube-controls')).toHaveLength(
        mask ? 1 : 0
      );
      const expected = [
        mask & 1 && 'Boost Volume',
        mask & 2 && 'Cinema Mode',
        mask & 4 && 'Loop Sections',
        mask & 128 && 'Bookmarks',
        mask & 8 && 'Info Cards',
        mask & 16 && 'Screenshot',
        mask & 32 && 'Video Filters',
        mask & 64 && 'Picture-in-Picture',
      ].filter(Boolean);
      expect(
        [...controls.querySelectorAll('.mfs-player-button')].map((node) =>
          node.getAttribute('aria-label')
        )
      ).toEqual(expected);
      if (mask) expect(controls.firstElementChild).toBe(buttons.toolbar);
    }
  );
  it('opens PiP from its native-style button and blocks unavailable playback', () => {
    const next = state();
    buttons.update(next);
    expect(buttons.pipButton.querySelector('svg rect')).not.toBeNull();
    expect(buttons.pipButton.getAttribute('aria-keyshortcuts')).toBe('P');
    expect(buttons.pipButton.nextElementSibling?.textContent).toContain(
      'Open Picture-in-Picture'
    );
    buttons.pipButton.click();
    expect(actions.onPip).toHaveBeenCalledOnce();
    next.pip.available = false;
    buttons.update(next);
    buttons.pipButton.click();
    expect(actions.onPip).toHaveBeenCalledOnce();
    expect(buttons.pipButton.disabled).toBe(true);
    buttons.cleanup();
    buttons.pipButton.click();
    expect(actions.onPip).toHaveBeenCalledOnce();
  });
  it('sets action tooltips and accurate pressed states and blocks unavailable controls', () => {
    const next = state();
    next.cinema.active = true;
    next.infoCards.visible = false;
    next.loop.expanded = true;
    buttons.update(next);
    expect(buttons.cinemaButton.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.infoCardsButton.getAttribute('aria-pressed')).toBe('false');
    expect(buttons.loopButton.getAttribute('aria-expanded')).toBe('true');
    expect(buttons.toolbar.textContent).toContain('Turn off Cinema Mode');
    expect(buttons.toolbar.textContent).toContain('Show Info Cards');
    buttons.cinemaButton.click();
    buttons.infoCardsButton.click();
    buttons.loopButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    );
    buttons.screenshotButton.click();
    buttons.filtersButton.click();
    expect(buttons.filtersButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(buttons.filtersButton.getAttribute('aria-expanded')).toBe('false');
    expect(actions.onFilters).toHaveBeenCalledOnce();
    expect(buttons.screenshotButton.hasAttribute('aria-pressed')).toBe(false);
    expect(buttons.toolbar.textContent).toContain('Save video frame as PNG');
    expect(actions.onScreenshot).toHaveBeenCalledOnce();
    expect(actions.onCinema).toHaveBeenCalledOnce();
    expect(actions.onInfoCards).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    next.cinema.available = false;
    next.infoCards.available = false;
    next.loop.available = false;
    next.boost.available = false;
    next.screenshot.available = false;
    next.filters.available = false;
    buttons.update(next);
    for (const button of [
      buttons.cinemaButton,
      buttons.infoCardsButton,
      buttons.loopButton,
      buttons.boostButton,
      buttons.screenshotButton,
      buttons.filtersButton,
    ]) {
      expect(button.disabled).toBe(true);
      button.click();
    }
    expect(actions.onCinema).toHaveBeenCalledOnce();
    expect(actions.onInfoCards).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onBoost).not.toHaveBeenCalled();
    expect(actions.onScreenshot).toHaveBeenCalledOnce();
    expect(actions.onFilters).toHaveBeenCalledOnce();
  });
  it('preserves focused buttons, reattaches to replaced controls, and disposes every control', () => {
    buttons.update(state());
    buttons.cinemaButton.focus();
    buttons.update(state());
    expect(document.activeElement).toBe(buttons.cinemaButton);
    const old = document.querySelector('.ytp-right-controls') as HTMLElement;
    const replacement = document.createElement('div');
    replacement.className = 'ytp-right-controls';
    replacement.innerHTML = '<button class="ytp-subtitles-button"></button>';
    old.replaceWith(replacement);
    buttons.update(state());
    buttons.update(state());
    expect(replacement.firstElementChild).toBe(buttons.toolbar);
    expect(document.querySelectorAll('.mfs-youtube-controls')).toHaveLength(1);
    expect(old.querySelector('.mfs-youtube-controls')).toBeNull();
    buttons.cleanup();
    buttons.update(state());
    buttons.cinemaButton.click();
    buttons.infoCardsButton.click();
    buttons.screenshotButton.click();
    buttons.filtersButton.click();
    expect(document.querySelector('.mfs-youtube-controls')).toBeNull();
    expect(actions.onCinema).not.toHaveBeenCalled();
    expect(actions.onInfoCards).not.toHaveBeenCalled();
    expect(actions.onScreenshot).not.toHaveBeenCalled();
    expect(actions.onFilters).not.toHaveBeenCalled();
  });
  it('does not attach controls for secondary videos', () => {
    const secondary = document.createElement('video');
    document.querySelector('#movie_player')?.append(secondary);
    buttons.cleanup();
    buttons = new YouTubePlayerButtons(secondary, actions);
    buttons.update(state());
    expect(document.querySelector('.mfs-youtube-controls')).toBeNull();
  });
});

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
  document.body.replaceChildren();
});

describe('YouTube toolbar ownership', () => {
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
    for (const button of [
      buttons.loopButton,
      buttons.editButton,
      buttons.infoCardsButton,
      buttons.filtersButton,
    ]) {
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
      buttons.editButton,
      buttons.infoCardsButton,
      buttons.screenshotButton,
      buttons.filtersButton,
    ]) {
      Object.defineProperties(button, {
        offsetLeft: { value: button === buttons.editButton ? 40 : 0 },
        offsetWidth: { value: button === buttons.editButton ? 32 : 40 },
      });
      button.dispatchEvent(new Event('pointerenter'));
      const tip = button.nextElementSibling as HTMLElement;
      expect(tip.getAttribute('role')).toBe('tooltip');
      expect(tip.style.top).toBe('');
      expect(tip.style.bottom).toBe('calc(100% + 12px)');
      expect(tip.style.left).toBe(
        button === buttons.editButton ? '56px' : '20px'
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
    const button = buttons.editButton;
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
  it.each(Array.from({ length: 64 }, (_, i) => i))(
    'keeps the correct order for feature combination %i',
    (mask) => {
      const next = state();
      next.boost.level = mask & 1 ? 2 : 0;
      next.cinema.enabled = Boolean(mask & 2);
      next.loop.enabled = Boolean(mask & 4);
      next.infoCards.enabled = Boolean(mask & 8);
      next.screenshot.enabled = Boolean(mask & 16);
      next.filters.enabled = Boolean(mask & 32);
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
        mask & 4 && 'Edit loop sections',
        mask & 8 && 'Info Cards',
        mask & 16 && 'Screenshot',
        mask & 32 && 'Video Filters',
      ].filter(Boolean);
      expect(
        [...controls.querySelectorAll('.mfs-player-button')].map((node) =>
          node.getAttribute('aria-label')
        )
      ).toEqual(expected);
      if (mask) expect(controls.firstElementChild).toBe(buttons.toolbar);
    }
  );
  it('sets action tooltips and accurate pressed states and blocks unavailable controls', () => {
    const next = state();
    next.cinema.active = true;
    next.infoCards.visible = false;
    next.loop.expanded = true;
    buttons.update(next);
    expect(buttons.cinemaButton.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.infoCardsButton.getAttribute('aria-pressed')).toBe('false');
    expect(buttons.editButton.getAttribute('aria-expanded')).toBe('true');
    expect(buttons.toolbar.textContent).toContain('Turn off Cinema Mode');
    expect(buttons.toolbar.textContent).toContain('Show Info Cards');
    buttons.cinemaButton.click();
    buttons.infoCardsButton.click();
    buttons.editButton.click();
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
      buttons.editButton,
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

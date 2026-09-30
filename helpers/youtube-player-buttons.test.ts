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
  document.body.replaceChildren();
});

describe('YouTube toolbar ownership', () => {
  it.each(Array.from({ length: 16 }, (_, i) => i))(
    'keeps the correct order for feature combination %i',
    (mask) => {
      const next = state();
      next.boost.level = mask & 1 ? 2 : 0;
      next.cinema.enabled = Boolean(mask & 2);
      next.loop.enabled = Boolean(mask & 4);
      next.infoCards.enabled = Boolean(mask & 8);
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
    expect(actions.onCinema).toHaveBeenCalledOnce();
    expect(actions.onInfoCards).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    next.cinema.available = false;
    next.infoCards.available = false;
    next.loop.available = false;
    next.boost.available = false;
    buttons.update(next);
    for (const button of [
      buttons.cinemaButton,
      buttons.infoCardsButton,
      buttons.loopButton,
      buttons.editButton,
      buttons.boostButton,
    ]) {
      expect(button.disabled).toBe(true);
      button.click();
    }
    expect(actions.onCinema).toHaveBeenCalledOnce();
    expect(actions.onInfoCards).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onBoost).not.toHaveBeenCalled();
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
    expect(document.querySelector('.mfs-youtube-controls')).toBeNull();
    expect(actions.onCinema).not.toHaveBeenCalled();
    expect(actions.onInfoCards).not.toHaveBeenCalled();
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

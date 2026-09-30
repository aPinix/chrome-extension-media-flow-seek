// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YouTubeCinemaSetting } from './youtube-cinema-setting';
import { YouTubeInfoCardsSetting } from './youtube-info-cards-setting';
import { YouTubeSettings } from './youtube-settings';

let preferences: Record<string, unknown>;
const set = vi.fn();
const get = vi.fn();
const changed = { addListener: vi.fn(), removeListener: vi.fn() };
beforeEach(() => {
  preferences = {
    hideEndScreens: true,
    hideCards: false,
    dimming: 65,
    backward: 8,
  };
  set.mockReset().mockImplementation(async (data) => {
    preferences = data.playerTools;
  });
  get
    .mockReset()
    .mockImplementation(async () => ({ playerTools: preferences }));
  changed.addListener.mockClear();
  vi.stubGlobal('chrome', {
    storage: { sync: { get, set }, onChanged: changed },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const readySwitch = async (name: string) => {
  const toggle = screen.getByRole('switch', { name });
  await waitFor(() =>
    expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
  );
  return toggle;
};

describe('YouTube button settings', () => {
  it('defaults new buttons on while preserving existing visibility and dimming', async () => {
    render(
      <>
        <YouTubeCinemaSetting />
        <YouTubeInfoCardsSetting />
      </>
    );
    const cinema = await readySwitch('Show Cinema Mode button on YouTube');
    const cards = await readySwitch('Show Info Cards button on YouTube');
    expect(cinema.getAttribute('aria-checked')).toBe('true');
    expect(cards.getAttribute('aria-checked')).toBe('true');
    expect(
      (
        screen.getByRole('slider', {
          name: 'Cinema page dimming',
        }) as HTMLInputElement
      ).value
    ).toBe('65');
    expect(set).not.toHaveBeenCalled();
    fireEvent.click(cards);
    fireEvent.click(cinema);
    await waitFor(() =>
      expect(preferences).toMatchObject({
        youtubeInfoCardsEnabled: false,
        youtubeCinemaEnabled: false,
      })
    );
    expect(preferences).toMatchObject({
      hideEndScreens: true,
      hideCards: false,
      dimming: 65,
      backward: 8,
    });
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    cleanup();
    render(
      <>
        <YouTubeCinemaSetting />
        <YouTubeInfoCardsSetting />
      </>
    );
    expect(
      (await readySwitch('Show Cinema Mode button on YouTube')).getAttribute(
        'aria-checked'
      )
    ).toBe('false');
    expect(
      (await readySwitch('Show Info Cards button on YouTube')).getAttribute(
        'aria-checked'
      )
    ).toBe('false');
  });
  it('resets saved dimming to 80 without changing card visibility or availability', async () => {
    render(<YouTubeCinemaSetting />);
    await readySwitch('Show Cinema Mode button on YouTube');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset cinema dimming to 80 percent' })
    );
    await waitFor(() => expect(preferences.dimming).toBe(80));
    expect(preferences.hideEndScreens).toBe(true);
    expect(preferences.youtubeCinemaEnabled).toBe(true);
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('80');
  });
  it('reports failed writes and restores the saved availability', async () => {
    set.mockRejectedValueOnce(new Error('Storage quota exceeded'));
    render(<YouTubeInfoCardsSetting />);
    const toggle = await readySwitch('Show Info Cards button on YouTube');
    fireEvent.click(toggle);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save Info Cards settings.'
    );
    await waitFor(() =>
      expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
    );
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(preferences.hideEndScreens).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(preferences.youtubeInfoCardsEnabled).toBe(false)
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('reports failed loads and keeps controls unavailable', async () => {
    get.mockRejectedValue(new Error('Storage unavailable'));
    render(<YouTubeCinemaSetting />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load Cinema Mode settings.'
    );
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(
      true
    );
  });
  it('renders one shared preview, highlights the hovered or focused setting, and identifies the timeline', async () => {
    render(
      <YouTubeSettings
        chapteredTimelineEnabled
        extensionEnabled
        onChapteredTimelineEnabledChange={vi.fn()}
      />
    );
    await readySwitch('Show Info Cards button on YouTube');
    const featureSwitches = screen
      .getAllByRole('switch')
      .filter((node) => node.getAttribute('aria-label')?.startsWith('Show '));
    expect(
      featureSwitches.map((node) => node.getAttribute('aria-label'))
    ).toEqual([
      'Show Boost Volume button on YouTube',
      'Show Cinema Mode button on YouTube',
      'Show Loop Sections button on YouTube',
      'Show Info Cards button on YouTube',
    ]);
    const preview = screen.getByRole('img', {
      name: 'YouTube player controls: Boost Volume, Cinema Mode, Loop Sections, Info Cards',
    });
    expect(
      preview.querySelector('button, input, [tabindex]:not([tabindex="-1"])')
    ).toBeNull();
    const video = preview.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/video/video-preview.mp4');
    expect(video?.loop).toBe(true);
    expect(screen.queryByText('YouTube player buttons')).toBeNull();
    for (const feature of [
      'Boost Volume',
      'Cinema Mode',
      'Loop Sections',
      'Info Cards',
    ]) {
      const toggle = screen.getByRole('switch', {
        name: `Show ${feature} button on YouTube`,
      });
      fireEvent.mouseOver(toggle);
      expect(preview.getAttribute('aria-label')).toBe(
        `YouTube player controls with ${feature} highlighted`
      );
    }
    fireEvent.focus(
      screen.getByRole('switch', { name: 'Show Cinema Mode button on YouTube' })
    );
    expect(preview.getAttribute('aria-label')).toBe(
      'YouTube player controls with Cinema Mode highlighted'
    );
    fireEvent.mouseOver(screen.getByText('Chaptered Timeline'));
    expect(preview.getAttribute('aria-label')).toBe(
      'YouTube player controls: Boost Volume, Cinema Mode, Loop Sections, Info Cards'
    );
    expect(
      screen.getByText(
        'Timeline feature: show YouTube chapter divisions and names'
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Preview Loop Sections' })
    ).toBeTruthy();
  });
});

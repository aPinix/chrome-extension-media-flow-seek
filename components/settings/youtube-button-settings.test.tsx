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
import { YouTubeFiltersSetting } from './youtube-filters-setting';
import { YouTubeInfoCardsSetting } from './youtube-info-cards-setting';
import { YouTubeScreenshotSetting } from './youtube-screenshot-setting';
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
  it('saves Cinema preset and custom colors without changing dimming and reports storage errors', async () => {
    render(<YouTubeCinemaSetting />);
    await readySwitch('Show Cinema Mode button on YouTube');
    expect(
      screen
        .getByRole('button', { name: 'Cinema Cinema Mode preset' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Ocean Cinema Mode preset' })
    );
    await waitFor(() => expect(preferences.cinemaColor).toBe('#172554'));
    expect(preferences.dimming).toBe(65);
    const custom = screen.getByLabelText('Custom Cinema Mode color');
    expect(custom.getAttribute('type')).toBe('color');
    fireEvent.click(custom);
    await waitFor(() =>
      expect(custom.closest('label')?.hasAttribute('data-selected')).toBe(true)
    );
    expect(custom.closest('label')?.classList.contains('ring-2')).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Ocean Cinema Mode preset' })
        .getAttribute('aria-pressed')
    ).toBe('false');
    fireEvent.change(custom, { target: { value: '#abcdef' } });
    await waitFor(() => expect(preferences.cinemaColor).toBe('#abcdef'));
    set.mockRejectedValueOnce(new Error('Storage failed'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Sunset Cinema Mode preset' })
    );
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not save Cinema Mode settings.'
    );
    expect(preferences.cinemaColor).toBe('#abcdef');
    expect(preferences.dimming).toBe(65);
    fireEvent.change(custom, { target: { value: '#000000' } });
    await waitFor(() => expect(preferences.cinemaColor).toBe('#000000'));
    expect(custom.closest('label')?.hasAttribute('data-selected')).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Cinema Cinema Mode preset' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });
  it('temporarily shows the hovered Cinema preset and reverts to the selected name', async () => {
    render(<YouTubeCinemaSetting />);
    await readySwitch('Show Cinema Mode button on YouTube');
    expect(screen.getByText('(Cinema)')).toBeTruthy();
    const sunset = screen.getByRole('button', {
      name: 'Sunset Cinema Mode preset',
    });
    fireEvent.mouseEnter(sunset);
    expect(screen.getByText('(Sunset)')).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
    fireEvent.mouseLeave(sunset);
    expect(screen.getByText('(Cinema)')).toBeTruthy();
    fireEvent.click(sunset);
    await waitFor(() =>
      expect(sunset.getAttribute('aria-pressed')).toBe('true')
    );
    expect(screen.getByText('(Sunset)')).toBeTruthy();
    const ocean = screen.getByRole('button', {
      name: 'Ocean Cinema Mode preset',
    });
    fireEvent.mouseEnter(ocean);
    expect(screen.getByText('(Ocean)')).toBeTruthy();
    fireEvent.mouseLeave(ocean);
    expect(screen.getByText('(Sunset)')).toBeTruthy();
    const custom = screen.getByLabelText('Custom Cinema Mode color');
    fireEvent.mouseEnter(custom.closest('label') as HTMLLabelElement);
    expect(screen.getByText('(Custom: #431407)')).toBeTruthy();
    fireEvent.mouseLeave(custom.closest('label') as HTMLLabelElement);
    expect(screen.getByText('(Sunset)')).toBeTruthy();
  });
  it('persists screenshot filter effects independently of both button choices', async () => {
    render(
      <>
        <YouTubeScreenshotSetting />
        <YouTubeFiltersSetting />
      </>
    );
    const effects = await readySwitch(
      'Include video filter effects in screenshots'
    );
    expect(effects.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(effects);
    await waitFor(() =>
      expect(preferences.youtubeScreenshotIncludeFilters).toBe(true)
    );
    fireEvent.click(await readySwitch('Show Video Filters button on YouTube'));
    await waitFor(() => expect(preferences.youtubeFiltersEnabled).toBe(false));
    expect(preferences.youtubeScreenshotIncludeFilters).toBe(true);
    fireEvent.click(await readySwitch('Show Screenshot button on YouTube'));
    await waitFor(() =>
      expect(
        screen.queryByRole('switch', {
          name: 'Include video filter effects in screenshots',
        })
      ).toBeNull()
    );
    expect(preferences.youtubeScreenshotIncludeFilters).toBe(true);
    cleanup();
    render(<YouTubeFiltersSetting />);
    expect(
      (await readySwitch('Show Video Filters button on YouTube')).getAttribute(
        'aria-checked'
      )
    ).toBe('false');
  });
  it('reports effects storage failures without changing the saved screenshot choice', async () => {
    set.mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<YouTubeScreenshotSetting />);
    const effects = await readySwitch(
      'Include video filter effects in screenshots'
    );
    fireEvent.click(effects);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save Screenshot settings.'
    );
    await waitFor(() =>
      expect(effects.getAttribute('aria-disabled')).not.toBe('true')
    );
    expect(effects.getAttribute('aria-checked')).toBe('false');
    expect(preferences.youtubeScreenshotIncludeFilters).toBeUndefined();
  });
  it('enables Screenshot by default and persists its availability without changing other preferences', async () => {
    render(<YouTubeScreenshotSetting />);
    const toggle = await readySwitch('Show Screenshot button on YouTube');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(preferences.youtubeScreenshotEnabled).toBe(false)
    );
    expect(preferences).toMatchObject({
      hideEndScreens: true,
      dimming: 65,
      backward: 8,
    });
    cleanup();
    render(<YouTubeScreenshotSetting />);
    expect(
      (await readySwitch('Show Screenshot button on YouTube')).getAttribute(
        'aria-checked'
      )
    ).toBe('false');
  });
  it('reports Screenshot storage failures and restores the saved choice', async () => {
    set.mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<YouTubeScreenshotSetting />);
    const toggle = await readySwitch('Show Screenshot button on YouTube');
    fireEvent.click(toggle);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save Screenshot settings.'
    );
    await waitFor(() =>
      expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
    );
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
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
      'Show Screenshot button on YouTube',
      'Show Video Filters button on YouTube',
    ]);
    const preview = screen.getByRole('img', {
      name: 'YouTube player controls: Boost Volume, Cinema Mode, Loop Sections, Info Cards, Screenshot, Video Filters',
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
      'Screenshot',
      'Video Filters',
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
      'YouTube player controls: Boost Volume, Cinema Mode, Loop Sections, Info Cards, Screenshot, Video Filters'
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

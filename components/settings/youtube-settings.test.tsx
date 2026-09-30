// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { YouTubeSettings } from './youtube-settings';

vi.mock('./youtube-boost-setting', () => ({ YouTubeBoostSetting: () => null }));
vi.mock('./youtube-cinema-setting', () => ({
  YouTubeCinemaSetting: () => null,
}));
vi.mock('./youtube-loop-setting', () => ({ YouTubeLoopSetting: () => null }));
vi.mock('./youtube-info-cards-setting', () => ({
  YouTubeInfoCardsSetting: () => null,
}));
vi.mock('./youtube-mini-player-setting', () => ({
  YouTubeMiniPlayerSetting: () => null,
}));

afterEach(cleanup);

describe('YouTubeSettings', () => {
  it('renders the chaptered timeline copy and accessible switch', () => {
    const onChange = vi.fn();
    render(
      <YouTubeSettings
        chapteredTimelineEnabled={false}
        extensionEnabled
        onChapteredTimelineEnabledChange={onChange}
      />
    );

    expect(screen.getByText('Chaptered Timeline')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Chaptered Timeline beta information',
      }).textContent
    ).toBe('Beta');
    expect(
      screen.getByText(
        'Timeline feature: show YouTube chapter divisions and names'
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Use chaptered timeline on YouTube',
      })
    );
    expect(onChange.mock.calls[0]?.[0]).toBe(true);
    expect(screen.queryByText('Hover Thumbnails')).toBeNull();
  });

  it('disables the switch when the extension is disabled', () => {
    render(
      <YouTubeSettings
        chapteredTimelineEnabled
        extensionEnabled={false}
        onChapteredTimelineEnabledChange={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole('switch', {
          name: 'Use chaptered timeline on YouTube',
        })
        .getAttribute('aria-disabled')
    ).toBe('true');
  });
});

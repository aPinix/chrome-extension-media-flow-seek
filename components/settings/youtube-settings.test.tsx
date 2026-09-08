// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { YouTubeSettings } from './youtube-settings';

vi.mock('./youtube-boost-setting', () => ({ YouTubeBoostSetting: () => null }));
vi.mock('./youtube-loop-setting', () => ({ YouTubeLoopSetting: () => null }));

afterEach(cleanup);

describe('YouTubeSettings', () => {
  it('renders the chaptered timeline copy and accessible switch', () => {
    const onChange = vi.fn();
    const onThumbnailChange = vi.fn();
    render(
      <YouTubeSettings
        chapteredTimelineEnabled={false}
        extensionEnabled
        onChapteredTimelineEnabledChange={onChange}
        onThumbnailPreviewEnabledChange={onThumbnailChange}
        thumbnailPreviewEnabled={false}
      />
    );

    expect(screen.getByText('Chaptered Timeline')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Chaptered Timeline beta information',
      }).textContent
    ).toBe('Beta');
    expect(
      screen.getByText('Show YouTube chapter divisions and names')
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Use chaptered timeline on YouTube',
      })
    );
    expect(onChange.mock.calls[0]?.[0]).toBe(true);
    expect(screen.getByText('Hover Thumbnails')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('switch', { name: 'Show hover thumbnails on YouTube' })
    );
    expect(onThumbnailChange.mock.calls[0]?.[0]).toBe(true);
  });

  it('disables the switch when the extension is disabled', () => {
    render(
      <YouTubeSettings
        chapteredTimelineEnabled
        extensionEnabled={false}
        onChapteredTimelineEnabledChange={vi.fn()}
        onThumbnailPreviewEnabledChange={vi.fn()}
        thumbnailPreviewEnabled
      />
    );

    expect(
      screen
        .getByRole('switch', {
          name: 'Use chaptered timeline on YouTube',
        })
        .getAttribute('aria-disabled')
    ).toBe('true');
    expect(
      screen
        .getByRole('switch', { name: 'Show hover thumbnails on YouTube' })
        .getAttribute('aria-disabled')
    ).toBe('true');
  });
});

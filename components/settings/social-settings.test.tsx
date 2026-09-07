// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InstagramSettings } from './instagram-settings';
import { TikTokSettings } from './tiktok-settings';

afterEach(cleanup);
it.each([
  ['Instagram', InstagramSettings],
  ['TikTok', TikTokSettings],
] as const)(
  'groups %s visibility toggles with their feature',
  (name, Component) => {
    const showSpeed = vi.fn();
    const showSkip = vi.fn();
    const toggleSkip = vi.fn();
    const { container } = render(
      <Component
        autoSkip={false}
        extensionEnabled
        onAutoSkipChange={toggleSkip}
        onPlaybackSpeedChange={vi.fn()}
        onShowAutoSkipChange={showSkip}
        onShowPlaybackSpeedChange={showSpeed}
        playbackSpeed={1}
        showAutoSkip={false}
        showPlaybackSpeed={false}
      />
    );
    expect(container.querySelectorAll('.card-list-item')).toHaveLength(2);
    const speedVisibility = screen.getByRole('switch', {
      name: `Show ${name} playback speed on page`,
    });
    expect(speedVisibility.closest('.card-list-item')?.textContent).toContain(
      'Playback Speed'
    );
    const skipVisibility = screen.getByRole('switch', {
      name: `Show ${name} auto-skip on page`,
    });
    expect(skipVisibility.closest('.card-list-item')?.textContent).toContain(
      'Auto-Skip'
    );
    fireEvent.click(speedVisibility);
    fireEvent.click(skipVisibility);
    expect(showSpeed).toHaveBeenCalledWith(true, expect.anything());
    expect(showSkip).toHaveBeenCalledWith(true, expect.anything());
    expect(toggleSkip).not.toHaveBeenCalled();
  }
);

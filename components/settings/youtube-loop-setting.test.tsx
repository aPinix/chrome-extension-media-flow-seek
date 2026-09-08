// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { YouTubeLoopSetting } from './youtube-loop-setting';

const set = vi.fn();
beforeEach(() => {
  set.mockReset();
  vi.stubGlobal('chrome', {
    storage: {
      sync: {
        get: async () => ({ playerTools: { backward: 8, miniPlayer: true } }),
        set,
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('defaults off and persists enabling Loop without losing other preferences', async () => {
  render(<YouTubeLoopSetting />);
  const toggle = screen.getByRole('switch', { name: 'Enable Loop Sections on YouTube' });
  await waitFor(() =>
    expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
  );
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(set).toHaveBeenCalledWith({
      playerTools: expect.objectContaining({
        youtubeLoop: true,
        backward: 8,
        miniPlayer: true,
      }),
    })
  );
});
it('keeps Loop disabled when the extension is disabled', async () => {
  render(<YouTubeLoopSetting disabled />);
  await waitFor(() =>
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe(
      'true'
    )
  );
});

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
it('defaults on and persists disabling Loop without losing other preferences', async () => {
  render(<YouTubeLoopSetting />);
  const toggle = screen.getByRole('switch', {
    name: 'Show Loop Sections button on YouTube',
  });
  await waitFor(() =>
    expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
  );
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(set).toHaveBeenCalledWith({
      playerTools: expect.objectContaining({
        youtubeLoop: false,
        backward: 8,
        miniPlayer: true,
      }),
    })
  );
});
it('keeps Loop disabled when the extension is disabled', async () => {
  render(<YouTubeLoopSetting disabled />);
  await waitFor(() =>
    expect(
      screen
        .getByRole('switch', { name: 'Show Loop Sections button on YouTube' })
        .getAttribute('aria-disabled')
    ).toBe('true')
  );
});

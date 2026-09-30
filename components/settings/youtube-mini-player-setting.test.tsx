// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_MINI_PLAYER_GEOMETRY,
  MINI_PLAYER_GEOMETRY_KEY,
} from '@/helpers/mini-player-settings';
import { YouTubeMiniPlayerSetting } from './youtube-mini-player-setting';

const save = vi.fn(async () => {});
const reset = vi.fn(async () => {});
beforeEach(() => {
  save.mockReset();
  reset.mockReset();
  vi.stubGlobal('chrome', {
    storage: {
      sync: {
        get: async () => ({
          playerTools: { dimming: 65, hideEndScreens: true },
        }),
        set: save,
      },
      local: { set: reset },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const ready = async () => {
  const toggle = screen.getByRole('switch', {
    name: 'Use Mini Player on YouTube',
  });
  await waitFor(() =>
    expect(toggle.getAttribute('aria-disabled')).not.toBe('true')
  );
  return toggle;
};
it('defaults on and persists disabling without losing other settings', async () => {
  render(<YouTubeMiniPlayerSetting />);
  const toggle = await ready();
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      playerTools: expect.objectContaining({
        miniPlayer: false,
        dimming: 65,
        hideEndScreens: true,
      }),
    })
  );
});
it('resets device geometry without changing synced preferences', async () => {
  render(<YouTubeMiniPlayerSetting />);
  await ready();
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset position and size' })
  );
  await waitFor(() =>
    expect(reset).toHaveBeenCalledWith({
      [MINI_PLAYER_GEOMETRY_KEY]: DEFAULT_MINI_PLAYER_GEOMETRY,
    })
  );
  expect(save).not.toHaveBeenCalled();
});
it('shows reset and preference storage failures', async () => {
  reset.mockRejectedValueOnce(new Error('Storage unavailable'));
  save.mockRejectedValueOnce(new Error('Storage unavailable'));
  render(<YouTubeMiniPlayerSetting />);
  const toggle = await ready();
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset position and size' })
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Could not reset')
  );
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Could not save Mini Player'
    )
  );
  expect(toggle.getAttribute('aria-checked')).toBe('true');
});
it('disables the feature and reset control with the extension', () => {
  render(<YouTubeMiniPlayerSetting disabled />);
  expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe('true');
  expect(
    (
      screen.getByRole('button', {
        name: 'Reset position and size',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});

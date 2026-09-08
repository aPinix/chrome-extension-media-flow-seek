// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { YouTubeBoostSetting } from './youtube-boost-setting';

const set = vi.fn(async () => {});
beforeEach(() => {
  set.mockClear();
  vi.stubGlobal('chrome', { storage: {
    sync: { get: async () => ({ playerTools: { backward: 8 } }), set },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('reveals a 2–10 multiplier slider only when enabled and preserves other preferences', async () => {
  render(<YouTubeBoostSetting />);
  const toggle = screen.getByRole('switch', { name: 'Enable Boost Volume' });
  await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
  expect(screen.queryByRole('slider')).toBeNull();
  fireEvent.click(toggle);
  const slider = await screen.findByRole('slider', { name: 'Volume boost multiplier' });
  expect(slider.getAttribute('min')).toBe('2');
  expect(slider.getAttribute('max')).toBe('10');
  expect((slider as HTMLInputElement).value).toBe('2');
  expect(set).toHaveBeenCalledWith({ playerTools: expect.objectContaining({ backward: 8, youtubeBoostEnabled: true, youtubeBoost: 2 }) });
});

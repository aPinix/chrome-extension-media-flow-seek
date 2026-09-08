// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ArrowSeekSettings } from './arrow-seek-settings';

let preferences: Record<string, unknown>;
const set = vi.fn();
beforeEach(() => {
  preferences = { backward: 3, forward: 10, miniPlayer: true };
  set.mockReset().mockImplementation(async (data) => {
    preferences = data.playerTools;
  });
  vi.stubGlobal('chrome', {
    storage: {
      sync: { get: async () => ({ playerTools: preferences }), set },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('saves one interval for both directions without overwriting other preferences', async () => {
  render(<ArrowSeekSettings />);
  const rewind = screen.getByLabelText(
    'Seek interval (secs)'
  ) as HTMLInputElement;
  await waitFor(() => expect(rewind.value).toBe('3'));
  fireEvent.change(rewind, { target: { value: '7' } });
  fireEvent.blur(rewind);
  await waitFor(() => expect(preferences.backward).toBe(7));
  expect(preferences.forward).toBe(7);
  expect(preferences.miniPlayer).toBe(true);
});

it('restores the default on blur for empty or invalid intervals', async () => {
  render(<ArrowSeekSettings />);
  const forward = screen.getByLabelText(
    'Seek interval (secs)'
  ) as HTMLInputElement;
  await waitFor(() => expect(forward.disabled).toBe(false));
  for (const value of ['', '0', '-5', '86401', '1.5']) {
    fireEvent.change(forward, { target: { value } });
    fireEvent.blur(forward);
    await waitFor(() => expect(forward.value).toBe('5'));
    await waitFor(() => expect(preferences.backward).toBe(5));
    expect(preferences.forward).toBe(5);
  }
  expect(screen.queryByRole('alert')).toBeNull();
});

it('resets both directions to five seconds from the single input', async () => {
  render(<ArrowSeekSettings />);
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Seek interval (secs)') as HTMLInputElement).value
    ).toBe('3')
  );
  expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset seek interval to 5 seconds' })
  );
  await waitFor(() => expect(preferences.backward).toBe(5));
  expect(preferences.forward).toBe(5);
});

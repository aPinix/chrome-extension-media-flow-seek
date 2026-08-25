// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppSlider } from './app-slider';

afterEach(cleanup);

describe('AppSlider', () => {
  it('uses the AppSegment inactive surface for its non-progress track', () => {
    const { container } = render(<AppSlider aria-label="Speed" value={25} />);

    expect(screen.getByRole('group', { name: 'Speed' })).toBeTruthy();
    expect(
      screen
        .getByRole('group', { name: 'Speed' })
        .getAttribute('data-thumb-alignment')
    ).toBe('center');
    const track = container.querySelector('[data-slot="app-slider-track"]');
    expect(track?.className).toContain('bg-slate-200');
    expect(track?.className).toContain('dark:bg-slate-800');
  });
});

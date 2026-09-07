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
    const range = container.querySelector('[data-slot="app-slider-range"]');
    const thumb = container.querySelector('[data-slot="app-slider-thumb"]');
    expect(screen.getByRole('group', { name: 'Speed' }).className).toContain(
      'group/app-slider'
    );
    expect(track?.className).toContain('bg-slate-200');
    expect(track?.className).toContain('dark:bg-slate-800');
    expect(track?.className).toContain('transition-[scale,background-color]');
    expect(track?.className).toContain('group-hover/app-slider:bg-slate-300');
    expect(track?.className).toContain(
      'dark:group-hover/app-slider:bg-slate-700'
    );
    expect(track?.className).toContain('group-hover/app-slider:scale-y-[1.15]');
    expect(track?.className).toContain('group-active/app-slider:scale-y-125');
    expect(range?.className).toContain('group-hover/app-slider:bg-brand-400');
    expect(range?.className).toContain('group-active/app-slider:bg-brand-300');
    expect(range?.className).toContain(
      'transition-[width,inset-inline-start,height,bottom,background-color]'
    );
    expect(range?.className).toContain('data-dragging:transition-none');
    expect(thumb?.className).toContain(
      'transition-[inset-inline-start,bottom]'
    );
    expect(thumb?.className).toContain('data-dragging:transition-none');
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EXTRA_FEATURE_PREVIEW_SOURCES,
  ExtraFeaturePreviewTooltip,
} from './extra-feature-preview-tooltip';

afterEach(cleanup);

describe('ExtraFeaturePreviewTooltip', () => {
  it('provides an image preview for every Extra Features row', () => {
    expect(EXTRA_FEATURE_PREVIEW_SOURCES).toEqual({
      'Timeline Show on Hover':
        '/images/extra-feature/extra-feature-timeline-hover.jpg',
      'Hover Thumbnails':
        '/images/extra-feature/extra-feature-hover-thumbnails.jpg',
      'Minimal Player':
        '/images/extra-feature/extra-feature-minimal-player.jpg',
      'Match Site Color': '/images/extra-feature/extra-feature-match-color.jpg',
    });
  });

  it('shows the feature image when its info icon is hovered', async () => {
    const user = userEvent.setup();
    render(<ExtraFeaturePreviewTooltip featureName="Hover Thumbnails" />);

    const trigger = screen.getByRole('button', {
      name: 'Preview Hover Thumbnails',
    });
    await user.hover(trigger);

    const preview = await screen.findByRole('img', {
      name: 'Hover Thumbnails feature preview',
    });
    expect(preview.getAttribute('src')).toBe(
      '/images/extra-feature/extra-feature-hover-thumbnails.jpg'
    );
    expect(preview.className).toContain('aspect-video');
    const tooltip = screen.getByLabelText('Hover Thumbnails image preview');
    expect(tooltip.className).toContain('p-0');
    expect(tooltip.className).toContain('pointer-events-none');
    expect(
      document.querySelector('[data-slot="tooltip-positioner"]')?.className
    ).toContain('pointer-events-none');
    expect(tooltip.className).toContain('bg-[rgba(51,51,51,0.4)]');
    expect(tooltip.className).toContain('border-[rgba(255,255,255,0.1)]');
    expect(tooltip.className).toContain('shadow-2xl');
    expect(tooltip.className).toContain('shadow-black/60');
    expect(tooltip.className).not.toContain('ring-1');
    expect(document.querySelector('[data-slot="tooltip-arrow"]')).toBeNull();
  });
});

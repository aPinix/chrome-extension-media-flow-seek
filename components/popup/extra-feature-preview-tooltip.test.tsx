// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ExtraFeaturePreview } from './extra-feature-preview';
import {
  EXTRA_FEATURE_PREVIEW_NAMES,
  ExtraFeaturePreviewTooltip,
} from './extra-feature-preview-tooltip';

afterEach(cleanup);

describe('ExtraFeaturePreviewTooltip', () => {
  it.each(EXTRA_FEATURE_PREVIEW_NAMES)(
    'composes %s without a screenshot',
    (featureName) => {
      const { container } = render(
        <ExtraFeaturePreview featureName={featureName} />
      );
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('video')?.getAttribute('src')).toBe(
        '/video/video-preview.mp4'
      );
      expect(
        container.querySelector('[data-testid="feature-preview-progress"]')
      ).not.toBeNull();
      expect(container.querySelector('.mfs-thumbnail-frame') !== null).toBe(
        featureName === 'Hover Thumbnails'
      );
      expect(container.querySelector('.mfs-volume-pill') !== null).toBe(
        featureName === 'Minimal Player'
      );
    }
  );

  it('keeps the animated seekbar anchored to the bottom', () => {
    render(<ExtraFeaturePreview featureName="Timeline Show on Hover" />);
    const track = screen.getByTestId('feature-preview-progress').parentElement;
    expect(track?.classList.contains('bottom-0')).toBe(true);
    expect(track?.classList.contains('absolute')).toBe(true);
    expect(track?.classList.contains('feature-preview-hover-timeline')).toBe(
      true
    );
  });

  it('shows the composed feature preview when its info icon is hovered', async () => {
    const user = userEvent.setup();
    render(<ExtraFeaturePreviewTooltip featureName="Hover Thumbnails" />);

    const trigger = screen.getByRole('button', {
      name: 'Preview Hover Thumbnails',
    });
    await user.hover(trigger);

    const preview = await screen.findByRole('img', {
      name: 'Hover Thumbnails feature preview',
    });
    expect(preview.querySelector('video')).not.toBeNull();
    const tooltip = screen.getByLabelText('Hover Thumbnails preview');
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

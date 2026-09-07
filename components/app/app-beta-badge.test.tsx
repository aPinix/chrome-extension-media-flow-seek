// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AppBetaBadge } from './app-beta-badge';

afterEach(cleanup);

describe('AppBetaBadge', () => {
  it('exposes feature-specific beta guidance on hover', async () => {
    const user = userEvent.setup();
    render(
      <AppBetaBadge
        featureName="Minimal Player"
        tooltip={
          <>
            <strong>Feature-specific</strong> guidance
          </>
        }
      />
    );

    const badge = screen.getByRole('button', {
      name: 'Minimal Player beta information',
    });
    expect(badge.textContent).toBe('Beta');

    await user.hover(badge);
    const emphasizedText = await screen.findByText('Feature-specific');
    const tooltip = emphasizedText.closest(
      '[data-slot="tooltip-content"]'
    ) as HTMLElement;
    expect(tooltip.textContent).toBe('Feature-specific guidance');
    expect(tooltip.querySelector('strong')?.textContent).toBe(
      'Feature-specific'
    );
    expect(tooltip.className).toContain('block');
    expect(tooltip.className).toContain('w-fit');
    expect(tooltip.className).toContain('max-w-xs');
    expect(tooltip.className).not.toContain('whitespace-nowrap');
    expect(tooltip.className).toContain('text-white/80');
    expect(tooltip.className).toContain('[&_strong]:text-white');
    expect(tooltip.className).toContain('pointer-events-none');
    expect(
      document.querySelector('[data-slot="tooltip-positioner"]')?.className
    ).toContain('pointer-events-none');
    expect(tooltip.className).toContain('bg-[rgba(51,51,51,0.4)]');
    expect(tooltip.className).toContain('border-[rgba(255,255,255,0.1)]');
    expect(tooltip.className).toContain('px-3.5');
    expect(tooltip.className).toContain('py-2');
    expect(tooltip.className).toContain(
      '[backdrop-filter:saturate(180%)_blur(20px)]'
    );
    expect(document.querySelector('[data-slot="tooltip-arrow"]')).toBeNull();
  });
});

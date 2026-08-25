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
        tooltip="Feature-specific guidance"
      />
    );

    const badge = screen.getByRole('button', {
      name: 'Minimal Player beta information',
    });
    expect(badge.textContent).toBe('Beta');

    await user.hover(badge);
    expect(await screen.findByText('Feature-specific guidance')).toBeTruthy();
  });
});

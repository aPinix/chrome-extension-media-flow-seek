// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MinimalPlayerDescription } from './minimal-player-description';

afterEach(cleanup);

describe('MinimalPlayerDescription', () => {
  it('explains the hold-to-bypass shortcut accessibly', () => {
    render(<MinimalPlayerDescription />);

    expect(screen.getByLabelText('Shift key').tagName).toBe('KBD');
    expect(
      screen.getByText(/Hold.*to use the site's original controls/).textContent
    ).toContain("Hold Shift to use the site's original controls");
  });
});

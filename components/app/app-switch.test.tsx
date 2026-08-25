// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppSwitch } from './app-switch';

afterEach(cleanup);

describe('AppSwitch', () => {
  it('keeps the thumb at its normal scale when disabled', () => {
    const { container } = render(<AppSwitch disabled />);
    const thumb = container.querySelector('[data-slot="switch-thumb"]');

    expect(thumb?.className).toContain(
      'group-data-disabled/switch:scale-x-100!'
    );
  });
});

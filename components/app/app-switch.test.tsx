// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppSwitch } from './app-switch';

afterEach(cleanup);

describe('AppSwitch', () => {
  it('uses the app brand color when checked and focused', () => {
    const { container } = render(<AppSwitch checked />);
    const root = container.querySelector('[data-slot="switch"]');

    expect(root?.className).toContain('data-checked:border-brand');
    expect(root?.className).toContain('data-checked:bg-brand');
    expect(root?.className).toContain('focus-visible:border-brand');
    expect(root?.className).toContain('focus-visible:ring-brand/30');
    expect(root?.className).toContain(
      'group-has-[:focus-visible]/field-label:data-checked:border-brand'
    );
  });

  it('keeps the thumb at its normal scale when disabled', () => {
    const { container } = render(<AppSwitch disabled />);
    const thumb = container.querySelector('[data-slot="switch-thumb"]');

    expect(thumb?.className).toContain(
      'group-data-disabled/switch:scale-x-100!'
    );
  });
});

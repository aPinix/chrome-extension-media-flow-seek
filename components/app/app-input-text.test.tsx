// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppInputText } from './app-input-text';

afterEach(cleanup);

describe('AppInputText', () => {
  it('uses a visible border with a smooth primary focus transition', () => {
    render(<AppInputText aria-label="Value" />);

    const input = screen.getByRole('textbox', { name: 'Value' });
    expect(input.className).toContain('border-slate-300');
    expect(input.className).toContain('dark:border-slate-700');
    expect(input.className).toContain('focus-visible:border-primary');
    expect(input.className).toContain('focus-visible:ring-inset');
    expect(input.className).toContain('border-color');
    expect(input.className).toContain('duration-300');
    expect(input.className).toContain('ease-in-out');
  });
});

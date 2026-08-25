// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppSegment } from './app-segment';

afterEach(cleanup);

const options = [
  { label: 'Full', value: 'full' },
  { label: 'Top', value: 'top' },
] as const;

describe('AppSegment', () => {
  it('renders an accessible radio group with the shared inactive surface', () => {
    render(
      <AppSegment
        label="Video area"
        onValueChange={vi.fn()}
        options={options}
        value="full"
      />
    );

    const group = screen.getByRole('group', { name: 'Video area' });
    expect(group.className).toContain('bg-slate-200');
    expect(group.className).toContain('dark:bg-slate-800');
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(
      (
        within(group).getByRole('radio', {
          name: 'Full',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it('changes values and reports preview intent', async () => {
    const user = userEvent.setup();
    const onOptionPreview = vi.fn();
    const onValueChange = vi.fn();
    render(
      <AppSegment
        label="Video area"
        onOptionPreview={onOptionPreview}
        onValueChange={onValueChange}
        options={options}
        value="full"
      />
    );

    const group = screen.getByRole('group', { name: 'Video area' });
    const top = within(group).getByRole('radio', { name: 'Top' });
    fireEvent.mouseEnter(top.closest('label') as HTMLLabelElement);
    expect(onOptionPreview).toHaveBeenLastCalledWith('top');

    await user.click(top);
    expect(onValueChange).toHaveBeenCalledWith('top');

    fireEvent.mouseLeave(group);
    expect(onOptionPreview).toHaveBeenLastCalledWith(null);
  });

  it('uses a slightly darker inactive surface when embedded in an input', () => {
    render(
      <AppSegment
        embedded
        label="Input unit"
        onValueChange={vi.fn()}
        options={options}
        value="full"
      />
    );

    const group = screen.getByRole('group', { name: 'Input unit' });
    expect(group.className).toContain('bg-slate-300/80');
    expect(group.className).toContain('dark:bg-slate-700');
    expect(group.className).not.toContain('bg-slate-200');
  });
});

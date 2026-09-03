// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckIcon, GlobeIcon, XIcon } from 'lucide-react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppToggler } from './app-toggler';

afterEach(cleanup);

const originalAnimate = Element.prototype.animate;
const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);

beforeAll(() => {
  Element.prototype.animate = animate;
});

afterAll(() => {
  Element.prototype.animate = originalAnimate;
});

const options = [
  {
    icon: GlobeIcon,
    label: 'Default',
    tooltip: 'Use default',
    value: 'default',
  },
  { icon: CheckIcon, label: 'On', value: 'on' },
  { icon: XIcon, label: 'Off', value: 'off' },
] as const;

describe('AppToggler', () => {
  it('renders an accessible radio group and reports selection changes', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AppToggler
        label="Website access"
        onValueChange={onValueChange}
        options={options}
        value="default"
      />
    );

    const group = screen.getByRole('group', { name: 'Website access' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);

    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(onValueChange).toHaveBeenCalledWith('off');
  });

  it('slides one indicator behind the selected option', () => {
    animate.mockClear();
    const { rerender } = render(
      <AppToggler
        label="Website access"
        onValueChange={vi.fn()}
        options={options}
        value="default"
      />
    );
    const indicator = document.querySelector<HTMLElement>(
      '[data-slot="app-toggler-indicator"]'
    );

    expect(indicator?.style.transform).toBe('translateX(0rem)');

    rerender(
      <AppToggler
        label="Website access"
        onValueChange={vi.fn()}
        options={options}
        value="off"
      />
    );

    expect(indicator?.style.transform).toBe('translateX(3.25rem)');
    expect(indicator?.className).toContain('transition-');
    expect(indicator?.className).toContain('motion-reduce:transition-none');
    expect(animate).toHaveBeenCalledWith(
      [
        { marginInlineStart: '-0.125rem', width: '1.75rem' },
        { marginInlineStart: '0', width: '1.5rem' },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  });
});

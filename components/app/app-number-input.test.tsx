// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppNumberInput } from './app-number-input';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup() {
  const commit = vi.fn();
  function Example() {
    const [value, setValue] = useState('15');
    return (
      <AppNumberInput
        label="Seconds"
        max={30}
        min={0.1}
        onCommit={commit}
        onValueChange={setValue}
        value={value}
      />
    );
  }
  render(<Example />);
  return {
    commit,
    input: screen.getByLabelText('Seconds') as HTMLInputElement,
  };
}
it('steps by one, Shift-steps by ten, and clamps at both limits', () => {
  const { input, commit } = setup();
  const plus = screen.getByRole('button', { name: 'Increase Seconds' });
  const minus = screen.getByRole('button', { name: 'Decrease Seconds' });
  fireEvent.click(plus);
  expect(input.value).toBe('16');
  fireEvent.click(minus, { shiftKey: true });
  expect(input.value).toBe('6');
  fireEvent.click(minus, { shiftKey: true });
  expect(input.value).toBe('0.1');
  expect((minus as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(plus, { shiftKey: true });
  expect(input.value).toBe('10.1');
  fireEvent.click(plus, { shiftKey: true });
  fireEvent.click(plus, { shiftKey: true });
  expect(input.value).toBe('30');
  expect(commit).toHaveBeenLastCalledWith('30');
});
it('supports typed values', () => {
  const { input, commit } = setup();
  fireEvent.change(input, { target: { value: '7.5' } });
  fireEvent.blur(input);
  expect(commit).toHaveBeenLastCalledWith('7.5');
});

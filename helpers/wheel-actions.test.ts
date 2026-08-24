import { describe, expect, it } from 'vitest';

import {
  getPrimaryModifierLabel,
  isHorizontalWheelAction,
  matchesPrimaryWheelModifier,
} from '@/helpers/wheel-actions';

const modifiers = (
  values: Partial<
    Pick<WheelEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>
  >
) => ({
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...values,
});

describe('wheel actions', () => {
  it('maps Primary to Command on macOS and Ctrl on Windows', () => {
    expect(getPrimaryModifierLabel('MacIntel')).toBe('Command');
    expect(getPrimaryModifierLabel('Win32')).toBe('Ctrl');
    expect(
      matchesPrimaryWheelModifier(modifiers({ metaKey: true }), 'MacIntel')
    ).toBe(true);
    expect(
      matchesPrimaryWheelModifier(modifiers({ ctrlKey: true }), 'Win32')
    ).toBe(true);
  });

  it('rejects extra modifiers so the predefined command stays unambiguous', () => {
    expect(
      matchesPrimaryWheelModifier(
        modifiers({ ctrlKey: true, shiftKey: true }),
        'Win32'
      )
    ).toBe(false);
  });

  it('requires a dominant axis and ignores tiny deltas', () => {
    expect(isHorizontalWheelAction({ deltaX: 10, deltaY: 1 })).toBe(true);
    expect(isHorizontalWheelAction({ deltaX: 1, deltaY: 0 })).toBe(false);
  });
});

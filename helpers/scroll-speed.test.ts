import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCROLL_SPEED_FACTOR,
  FAST_SCROLL_MULTIPLIER,
  getPlayerLayerWheelDeltaPixels,
  getScrollSpeedMultiplier,
  getWheelDeltaPixels,
  hasScrollSpeedHotkey,
  isScrollSpeedHotkeyCode,
  normalizeScrollHotkeys,
  normalizeScrollSpeedFactor,
  ScrollHotkeyE,
  SLOW_SCROLL_MULTIPLIER,
} from '@/helpers/scroll-speed';

const hotkeyState = (altKey = false, shiftKey = false) => ({
  altKey,
  shiftKey,
});

describe('scroll speed hotkeys', () => {
  it('uses Alt for fast scrolling and Alt+Shift for slow scrolling', () => {
    expect(getScrollSpeedMultiplier(hotkeyState(true))).toBe(
      FAST_SCROLL_MULTIPLIER
    );
    expect(getScrollSpeedMultiplier(hotkeyState(true, true))).toBe(
      SLOW_SCROLL_MULTIPLIER
    );
  });

  it('uses normal speed when no configured hotkey matches', () => {
    expect(getScrollSpeedMultiplier(hotkeyState())).toBe(1);
    expect(getScrollSpeedMultiplier(hotkeyState(false, true))).toBe(1);
  });

  it('keeps every key used by a configured hotkey available to the overlay', () => {
    expect(isScrollSpeedHotkeyCode('AltLeft')).toBe(true);
    expect(isScrollSpeedHotkeyCode('ShiftRight')).toBe(true);
    expect(isScrollSpeedHotkeyCode('ControlLeft')).toBe(false);
    expect(hasScrollSpeedHotkey(hotkeyState(true))).toBe(true);
    expect(hasScrollSpeedHotkey(hotkeyState())).toBe(false);
  });

  it('applies customized fast and slow hotkeys', () => {
    expect(
      getScrollSpeedMultiplier(
        hotkeyState(false, true),
        ScrollHotkeyE.Shift,
        ScrollHotkeyE.Alt
      )
    ).toBe(FAST_SCROLL_MULTIPLIER);
    expect(
      getScrollSpeedMultiplier(
        hotkeyState(true),
        ScrollHotkeyE.Shift,
        ScrollHotkeyE.Alt
      )
    ).toBe(SLOW_SCROLL_MULTIPLIER);
  });

  it('scales normal, fast, and slow seeking from the configured base factor', () => {
    expect(
      getScrollSpeedMultiplier(
        hotkeyState(),
        ScrollHotkeyE.Alt,
        ScrollHotkeyE.AltShift,
        2
      )
    ).toBe(2);
    expect(
      getScrollSpeedMultiplier(
        hotkeyState(true),
        ScrollHotkeyE.Alt,
        ScrollHotkeyE.AltShift,
        2
      )
    ).toBe(2 * FAST_SCROLL_MULTIPLIER);
    expect(
      getScrollSpeedMultiplier(
        hotkeyState(true, true),
        ScrollHotkeyE.Alt,
        ScrollHotkeyE.AltShift,
        2
      )
    ).toBe(2 * SLOW_SCROLL_MULTIPLIER);
  });

  it('normalizes stored base factors to the supported slider range', () => {
    expect(normalizeScrollSpeedFactor(undefined)).toBe(
      DEFAULT_SCROLL_SPEED_FACTOR
    );
    expect(normalizeScrollSpeedFactor(0)).toBe(0.25);
    expect(normalizeScrollSpeedFactor(1.12)).toBe(1);
    expect(normalizeScrollSpeedFactor(10)).toBe(3);
  });

  it('normalizes invalid or conflicting stored hotkeys', () => {
    expect(normalizeScrollHotkeys('invalid', ScrollHotkeyE.Shift)).toEqual({
      fastScrollHotkey: ScrollHotkeyE.Alt,
      slowScrollHotkey: ScrollHotkeyE.Shift,
    });
    expect(
      normalizeScrollHotkeys(ScrollHotkeyE.Shift, ScrollHotkeyE.Shift)
    ).toEqual({
      fastScrollHotkey: ScrollHotkeyE.Alt,
      slowScrollHotkey: ScrollHotkeyE.AltShift,
    });
  });
});

describe('getWheelDeltaPixels', () => {
  it('prefers horizontal input and falls back to a vertical mouse wheel', () => {
    expect(
      getWheelDeltaPixels({ deltaMode: 0, deltaX: 12, deltaY: 40 }, 800)
    ).toBe(12);
    expect(
      getWheelDeltaPixels({ deltaMode: 0, deltaX: 0, deltaY: 40 }, 800)
    ).toBe(40);
  });

  it('normalizes line and page deltas to pixels', () => {
    expect(
      getWheelDeltaPixels({ deltaMode: 1, deltaX: 2, deltaY: 0 }, 800)
    ).toBe(32);
    expect(
      getWheelDeltaPixels({ deltaMode: 2, deltaX: -1, deltaY: 0 }, 800)
    ).toBe(-800);
  });

  it('only captures vertical input through a player layer with a speed hotkey', () => {
    const verticalWheel = { deltaMode: 0, deltaX: 0, deltaY: 40 };

    expect(getPlayerLayerWheelDeltaPixels(verticalWheel, 800, false)).toBe(0);
    expect(getPlayerLayerWheelDeltaPixels(verticalWheel, 800, true)).toBe(40);
    expect(
      getPlayerLayerWheelDeltaPixels(
        { deltaMode: 0, deltaX: 12, deltaY: 40 },
        800,
        false
      )
    ).toBe(12);
  });
});

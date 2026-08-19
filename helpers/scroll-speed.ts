export const FAST_SCROLL_MULTIPLIER = 3;
export const SLOW_SCROLL_MULTIPLIER = 0.25;

export const ScrollHotkeyE = {
  Alt: 'alt',
  Shift: 'shift',
  AltShift: 'alt+shift',
} as const;
export type ScrollHotkeyT = (typeof ScrollHotkeyE)[keyof typeof ScrollHotkeyE];

export const DEFAULT_FAST_SCROLL_HOTKEY: ScrollHotkeyT = ScrollHotkeyE.Alt;
export const DEFAULT_SLOW_SCROLL_HOTKEY: ScrollHotkeyT = ScrollHotkeyE.AltShift;

type ScrollHotkeyState = Pick<WheelEvent, 'altKey' | 'shiftKey'>;
type WheelDeltaState = Pick<WheelEvent, 'deltaMode' | 'deltaX' | 'deltaY'>;

export type ScrollHotkeyConfigT = {
  fastScrollHotkey: ScrollHotkeyT;
  slowScrollHotkey: ScrollHotkeyT;
};

export const isScrollHotkey = (value: unknown): value is ScrollHotkeyT =>
  Object.values(ScrollHotkeyE).includes(value as ScrollHotkeyT);

export const normalizeScrollHotkeys = (
  fastScrollHotkey: unknown,
  slowScrollHotkey: unknown
): ScrollHotkeyConfigT => {
  const fast = isScrollHotkey(fastScrollHotkey)
    ? fastScrollHotkey
    : DEFAULT_FAST_SCROLL_HOTKEY;
  const slow = isScrollHotkey(slowScrollHotkey)
    ? slowScrollHotkey
    : DEFAULT_SLOW_SCROLL_HOTKEY;

  if (fast === slow) {
    return {
      fastScrollHotkey: DEFAULT_FAST_SCROLL_HOTKEY,
      slowScrollHotkey: DEFAULT_SLOW_SCROLL_HOTKEY,
    };
  }

  return { fastScrollHotkey: fast, slowScrollHotkey: slow };
};

const hotkeyUsesCode = (hotkey: ScrollHotkeyT, code: string): boolean => {
  const isAlt = code === 'AltLeft' || code === 'AltRight';
  const isShift = code === 'ShiftLeft' || code === 'ShiftRight';

  if (hotkey === ScrollHotkeyE.Alt) return isAlt;
  if (hotkey === ScrollHotkeyE.Shift) return isShift;
  return isAlt || isShift;
};

export const isScrollSpeedHotkeyCode = (
  code: string,
  fastScrollHotkey: ScrollHotkeyT = DEFAULT_FAST_SCROLL_HOTKEY,
  slowScrollHotkey: ScrollHotkeyT = DEFAULT_SLOW_SCROLL_HOTKEY
): boolean =>
  hotkeyUsesCode(fastScrollHotkey, code) ||
  hotkeyUsesCode(slowScrollHotkey, code);

const matchesHotkey = (
  state: ScrollHotkeyState,
  hotkey: ScrollHotkeyT
): boolean => {
  if (hotkey === ScrollHotkeyE.Alt) {
    return state.altKey && !state.shiftKey;
  }
  if (hotkey === ScrollHotkeyE.Shift) {
    return state.shiftKey && !state.altKey;
  }
  return state.altKey && state.shiftKey;
};

export const hasScrollSpeedHotkey = (
  state: ScrollHotkeyState,
  fastScrollHotkey: ScrollHotkeyT = DEFAULT_FAST_SCROLL_HOTKEY,
  slowScrollHotkey: ScrollHotkeyT = DEFAULT_SLOW_SCROLL_HOTKEY
): boolean =>
  matchesHotkey(state, fastScrollHotkey) ||
  matchesHotkey(state, slowScrollHotkey);

export const getScrollSpeedMultiplier = (
  state: ScrollHotkeyState,
  fastScrollHotkey: ScrollHotkeyT = DEFAULT_FAST_SCROLL_HOTKEY,
  slowScrollHotkey: ScrollHotkeyT = DEFAULT_SLOW_SCROLL_HOTKEY
): number => {
  if (matchesHotkey(state, fastScrollHotkey)) {
    return FAST_SCROLL_MULTIPLIER;
  }
  if (matchesHotkey(state, slowScrollHotkey)) {
    return SLOW_SCROLL_MULTIPLIER;
  }
  return 1;
};

export const getWheelDeltaPixels = (
  { deltaMode, deltaX, deltaY }: WheelDeltaState,
  pageWidth: number
): number => {
  // Horizontal input remains the primary gesture. The vertical fallback also
  // lets a conventional mouse wheel use the held speed hotkey.
  const delta = deltaX !== 0 ? deltaX : deltaY;

  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageWidth;
  return delta;
};

/**
 * Resolve wheel input captured from a custom player's layer above the video.
 * Ordinary vertical scrolling must keep reaching the page, while a configured
 * speed hotkey intentionally enables the existing vertical-wheel fallback.
 */
export const getPlayerLayerWheelDeltaPixels = (
  state: WheelDeltaState,
  pageWidth: number,
  hasSpeedHotkey: boolean
): number => {
  if (state.deltaX === 0 && !hasSpeedHotkey) return 0;
  return getWheelDeltaPixels(state, pageWidth);
};

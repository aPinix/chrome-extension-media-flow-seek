export const isMacPlatform = (platform = navigator.platform): boolean =>
  /Mac|iPhone|iPad|iPod/i.test(platform);

export const getPrimaryModifierLabel = (
  platform = navigator.platform
): 'Command' | 'Ctrl' => (isMacPlatform(platform) ? 'Command' : 'Ctrl');

export const isPrimaryWheelModifierCode = (
  code: string,
  platform = navigator.platform
): boolean =>
  isMacPlatform(platform)
    ? code === 'MetaLeft' || code === 'MetaRight'
    : code === 'ControlLeft' || code === 'ControlRight';

type WheelModifierState = Pick<
  WheelEvent,
  'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
>;

export const matchesPrimaryWheelModifier = (
  event: WheelModifierState,
  platform = navigator.platform
): boolean => {
  const primaryKey = isMacPlatform(platform) ? event.metaKey : event.ctrlKey;
  const hasUnexpectedPrimaryKey = isMacPlatform(platform)
    ? event.ctrlKey
    : event.metaKey;
  return (
    primaryKey && !event.altKey && !event.shiftKey && !hasUnexpectedPrimaryKey
  );
};

const WHEEL_ACTION_AXIS_THRESHOLD_PX = 2;

export const isHorizontalWheelAction = (
  event: Pick<WheelEvent, 'deltaX' | 'deltaY'>
): boolean =>
  Math.abs(event.deltaX) >= WHEEL_ACTION_AXIS_THRESHOLD_PX &&
  Math.abs(event.deltaX) > Math.abs(event.deltaY);

export type WheelPlaybackActionT = 'play' | 'pause';

/**
 * With the platform's default natural scrolling, a physical left swipe emits
 * a positive horizontal wheel delta and a right swipe emits a negative one.
 */
export const getWheelPlaybackAction = (
  event: Pick<WheelEvent, 'deltaX'>
): WheelPlaybackActionT => (event.deltaX > 0 ? 'pause' : 'play');

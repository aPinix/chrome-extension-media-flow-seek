export const isMacPlatform = (platform = navigator.platform): boolean =>
  /Mac|iPhone|iPad|iPod/i.test(platform);

export const getPrimaryModifierLabel = (
  platform = navigator.platform
): 'Command' | 'Ctrl' => (isMacPlatform(platform) ? 'Command' : 'Ctrl');

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

import { createNotificationFunction } from './notification-shared';

export const showToggleNotification = (
  isEnabled: boolean,
  triggeredBy: 'hotkey' | 'popup'
): void => {
  const showNotification = createNotificationFunction();
  showNotification(isEnabled, triggeredBy);
};

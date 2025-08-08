import { createNotificationFunction } from './notification-shared';

export class NotificationHelper {
  static showToggleNotification(
    isEnabled: boolean,
    triggeredBy: 'hotkey' | 'popup'
  ): void {
    const showNotification = createNotificationFunction();
    showNotification(isEnabled, triggeredBy);
  }
}

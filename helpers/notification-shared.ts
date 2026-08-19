import { EXT_URL } from '@/config/variables.config';

import { getAppLogoBase64 } from './logo';

// Shared notification logic that can be used both in content scripts and injected scripts
export const createNotificationFunction = () => {
  const notificationUrl = EXT_URL;
  const notificationLogo = getAppLogoBase64();

  return function showToggleNotification(
    isEnabled: boolean,
    triggeredBy: 'hotkey' | 'popup',
    extensionUrl = notificationUrl,
    extensionLogo = notificationLogo
  ): void {
    const NOTIFICATION_ID = 'media-flow-seek-notification';
    const NOTIFICATION_DURATION = 3000;
    type NotificationElement = HTMLDivElement & {
      __mfsDismissTimer?: ReturnType<typeof setTimeout>;
    };

    const updateNotificationElement = (
      notification: NotificationElement,
      enabled: boolean,
      trigger: string
    ) => {
      const status = enabled ? 'Enabled' : 'Disabled';
      const triggerText = trigger === 'hotkey' ? 'Hotkey' : 'Popup';

      notification.innerHTML = `
        <div class="mfs-notification-content ${enabled ? 'mfs-notification-enabled' : 'mfs-notification-disabled'}">
          <div class="mfs-notification-logo-container">
            <a class="mfs-notification-logo-link" href="${extensionUrl}" target="_blank" rel="noopener noreferrer">
              <img class="mfs-notification-logo" src="${extensionLogo}" alt="BetterVideo" />
            </a>
          </div>
          <div class="mfs-notification-text">
            <span class="mfs-notification-title">BetterVideo <span class="mfs-notification-status">${status}</span></span>
            <span class="mfs-notification-subtitle">${triggerText}</span>
          </div>
        </div>
      `;
    };

    // Add styles if not already present
    if (!document.getElementById('mfs-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'mfs-notification-styles';
      styles.textContent = `
          .mfs-notification {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) scale(0.94);
            transform-origin: center;
            background: rgb(255 255 255 / 0.8);
            color: rgb(15 23 42);
            padding: 12px 20px 12px 12px;
            border: 1px solid rgb(255 255 255 / 0.4);
            border-radius: 9999px;
            box-shadow:
              0 2px 4px rgb(15 23 42 / 0.06),
              0 12px 30px -10px rgb(15 23 42 / 0.22),
              0 24px 60px -24px rgb(15 23 42 / 0.28),
              inset 0 1px 0 rgb(255 255 255 / 0.72),
              inset 0 0 0 1px rgb(15 23 42 / 0.035);
            -webkit-backdrop-filter: saturate(180%) blur(20px);
            backdrop-filter: saturate(180%) blur(20px);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            opacity: 0;
            filter: blur(5px);
            pointer-events: none;
            box-sizing: border-box;
            transition:
              transform 360ms cubic-bezier(0.16, 1, 0.3, 1),
              opacity 220ms ease,
              filter 320ms ease,
              box-shadow 240ms ease;
            max-width: calc(100vw - 24px);
            white-space: nowrap;
            will-change: transform, opacity, filter;
          }
          .mfs-notification-show {
            transform: translateX(-50%) scale(1);
            opacity: 1;
            filter: blur(0);
            pointer-events: auto;
          }
          .mfs-notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .mfs-notification-logo-container {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .mfs-notification-logo-link {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mfs-notification-logo {
            width: 22px;
            height: 22px;
            object-fit: contain;
          }
          .mfs-notification-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .mfs-notification-title {
            font-weight: 600;
            line-height: 1.2;
            font-size: 14px;
          }
          .mfs-notification-subtitle {
            font-size: 12px;
            opacity: 0.62;
            line-height: 1.2;
          }
          .mfs-notification-enabled .mfs-notification-status {
            color: rgb(22 163 74);
          }
          .mfs-notification-disabled .mfs-notification-status {
            color: rgb(220 38 38);
          }
          @media (prefers-color-scheme: dark) {
            .mfs-notification {
              background: rgb(51 51 51 / 0.8);
              color: rgb(248 250 252);
              border-color: rgb(255 255 255 / 0.14);
              box-shadow:
                0 2px 6px rgb(0 0 0 / 0.22),
                0 16px 36px -12px rgb(0 0 0 / 0.55),
                0 28px 70px -28px rgb(0 0 0 / 0.65),
                inset 0 1px 0 rgb(255 255 255 / 0.12),
                inset 0 0 0 1px rgb(0 0 0 / 0.12);
            }
            .mfs-notification-enabled .mfs-notification-status {
              color: rgb(74 222 128);
            }
            .mfs-notification-disabled .mfs-notification-status {
              color: rgb(248 113 113);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .mfs-notification {
              transition: opacity 160ms ease;
              filter: none;
            }
          }
          @media (max-width: 480px) {
            .mfs-notification {
              bottom: 20px;
              padding: 10px 18px 10px 10px;
              font-size: 13px;
            }
            .mfs-notification-logo-container {
              width: 28px;
              height: 28px;
            }
            .mfs-notification-logo {
              width: 20px;
              height: 20px;
            }
            .mfs-notification-title {
              font-size: 13px;
            }
            .mfs-notification-subtitle {
              font-size: 11px;
            }
          }
        `;
      document.head.appendChild(styles);
    }

    const existingNotifications = document.querySelectorAll(
      `#${NOTIFICATION_ID}`
    );
    let notification = existingNotifications[0] as
      | NotificationElement
      | undefined;
    let isNewNotification = false;

    // Clean up duplicates created by older versions of the notification code.
    for (let index = 1; index < existingNotifications.length; index += 1) {
      existingNotifications[index]?.remove();
    }

    if (!notification) {
      notification = document.createElement('div') as NotificationElement;
      notification.id = NOTIFICATION_ID;
      notification.className = 'mfs-notification';
      document.body.appendChild(notification);
      isNewNotification = true;
    }

    updateNotificationElement(notification, isEnabled, triggeredBy);

    if (!notification.classList.contains('mfs-notification-show')) {
      const showNotification = () => {
        notification.classList.add('mfs-notification-show');
      };

      if (isNewNotification) {
        // Let the browser paint the initial hidden state before revealing it.
        requestAnimationFrame(() => requestAnimationFrame(showNotification));
      } else {
        requestAnimationFrame(showNotification);
      }
    }

    if (notification.__mfsDismissTimer !== undefined) {
      clearTimeout(notification.__mfsDismissTimer);
    }

    notification.__mfsDismissTimer = setTimeout(() => {
      notification.classList.remove('mfs-notification-show');
      notification.__mfsDismissTimer = undefined;
    }, NOTIFICATION_DURATION);
  };
};

// Function string that can be injected into pages
export const getNotificationFunctionString = () => {
  const func = createNotificationFunction();
  return `(${func.toString()})`;
};

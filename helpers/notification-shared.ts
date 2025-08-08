import { EXT_URL } from '@/config/variables.config';

import { getAppLogoBase64 } from './logo';

// Shared notification logic that can be used both in content scripts and injected scripts
export const createNotificationFunction = () => {
  return function showToggleNotification(
    isEnabled: boolean,
    triggeredBy: 'hotkey' | 'popup'
  ): void {
    const NOTIFICATION_ID = 'media-flow-seek-notification';
    const NOTIFICATION_DURATION = 3000;

    const removeNotification = () => {
      const existing = document.getElementById(NOTIFICATION_ID);
      if (existing) {
        existing.classList.remove('mfs-notification-show');
        setTimeout(() => {
          existing.remove();
        }, 300);
      }
    };

    const createNotificationElement = (enabled: boolean, trigger: string) => {
      const notification = document.createElement('div');
      notification.id = NOTIFICATION_ID;
      notification.className = 'mfs-notification';

      const icon = enabled ? '✅' : '🚫';
      const status = enabled ? 'Enabled' : 'Disabled';
      const triggerText = trigger === 'hotkey' ? '⌨️ Hotkey' : '🖱️ Popup';

      notification.innerHTML = `
        <div class="mfs-notification-content ${enabled ? 'mfs-notification-enabled' : 'mfs-notification-disabled'}">
          <div class="mfs-notification-icon-circle">
            <div class="mfs-notification-icon">${icon}</div>
          </div>
          <div class="mfs-notification-text">
            <span class="mfs-notification-title">Media Flow Seek ${status}</span>
            <span class="mfs-notification-subtitle">${triggerText}</span>
          </div>

          <div class="mfs-notification-separator"></div>

          <div class="mfs-notification-via">
            <a href="${EXT_URL}" target="_blank" rel="noopener noreferrer">
              <img src="${getAppLogoBase64()}" alt="Extension icon" />
            </a>
          </div>
        </div>
      `;

      // Add styles if not already present
      if (!document.getElementById('mfs-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'mfs-notification-styles';
        styles.textContent = `
          .mfs-notification {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgb(0 0 0 / 0.8);
            color: white;
            padding: 12px 20px 12px 12px;
            border-radius: 9999px;
            box-shadow: 4px 12px 40px 6px rgb(0 0 0 / .4);
            backdrop-filter: saturate(180%) blur(20px);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(16px);
            border: 1px solid rgb(255 255 255 / 0.1);
            max-width: 90vw;
            white-space: nowrap;
          }
          .mfs-notification-show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
          .mfs-notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .mfs-notification-icon-circle {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .mfs-notification-content.mfs-notification-enabled .mfs-notification-icon-circle {
            background: rgb(0 255 0 / 0.25);
          }
          .mfs-notification-content.mfs-notification-disabled .mfs-notification-icon-circle {
            background: rgb(255 0 0 / 0.25);
          }
          .mfs-notification-icon {
            font-size: 16px;
            line-height: 1;
          }
          .mfs-notification-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .mfs-notification-separator {
            width: 1px;
            height: 26px;
            background: rgb(255 255 255 / 0.2);
          }
          .mfs-notification-via {
            display: flex;
            align-items: center;
          }
          .mfs-notification-via img {
            width: 24px;
            height: 24px;
            object-fit: contain;
          }
          .mfs-notification-title {
            font-weight: 600;
            line-height: 1.2;
            font-size: 14px;
          }
          .mfs-notification-subtitle {
            font-size: 12px;
            opacity: 0.7;
            line-height: 1.2;
          }
          @media (max-width: 480px) {
            .mfs-notification {
              bottom: 20px;
              padding: 10px 20px;
              font-size: 13px;
            }
            .mfs-notification-icon-circle {
              width: 28px;
              height: 28px;
            }
            .mfs-notification-icon {
              font-size: 14px;
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

      return notification;
    };

    // Remove existing notification first
    removeNotification();

    const notification = createNotificationElement(isEnabled, triggeredBy);
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('mfs-notification-show');
    });

    // Auto-remove after duration
    setTimeout(() => {
      removeNotification();
    }, NOTIFICATION_DURATION);
  };
};

// Function string that can be injected into pages
export const getNotificationFunctionString = () => {
  const func = createNotificationFunction();
  return `(${func.toString()})`;
};

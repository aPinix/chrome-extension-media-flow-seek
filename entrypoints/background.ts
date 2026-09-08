import { EXT_URL } from '@/config/variables.config';
import { getAppLogoBase64 } from '@/helpers/logo';
import { createNotificationFunction } from '@/helpers/notification-shared';
import { registerLibraryBackground } from '@/helpers/saved-media';

const FAVICON_DATA_URL_REQUEST = 'GET_FAVICON_DATA_URL';
const MAX_FAVICON_BYTES = 1024 * 1024;

type FaviconDataUrlRequest = {
  type: typeof FAVICON_DATA_URL_REQUEST;
  fallbackUrl?: string;
};

const isFaviconDataUrlRequest = (
  message: unknown
): message is FaviconDataUrlRequest =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  message.type === FAVICON_DATA_URL_REQUEST;

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }

  return btoa(binary);
};

const fetchFaviconAsDataUrl = async (url: string): Promise<string | null> => {
  if (url.startsWith('data:image/') && url.length <= MAX_FAVICON_BYTES * 2) {
    return url;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (!(parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:')) {
    return null;
  }

  try {
    const response = await fetch(parsedUrl.href, { credentials: 'omit' });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!contentType?.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FAVICON_BYTES) return null;

    return `data:${contentType};base64,${encodeBase64(new Uint8Array(buffer))}`;
  } catch {
    return null;
  }
};

export default defineBackground(() => {
  registerLibraryBackground();
  // Content scripts cannot reliably read pixels from cross-origin favicons.
  // Fetch them from the extension origin and return a canvas-safe data URL.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isFaviconDataUrlRequest(message)) return;

    const candidateUrls = [sender.tab?.favIconUrl, message.fallbackUrl].filter(
      (url, index, urls): url is string =>
        Boolean(url) && urls.indexOf(url) === index
    );

    void (async () => {
      for (const candidateUrl of candidateUrls) {
        const dataUrl = await fetchFaviconAsDataUrl(candidateUrl);
        if (dataUrl) {
          sendResponse({ dataUrl });
          return;
        }
      }

      sendResponse({});
    })();

    return true;
  });

  // Listen for command shortcuts
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-extension') {
      // Get current settings
      const result = await chrome.storage.sync.get(['isEnabled']);
      const currentEnabled = result.isEnabled ?? true;
      const newEnabled = !currentEnabled;

      // Update storage
      await chrome.storage.sync.set({ isEnabled: newEnabled });

      // Send message to all content scripts to update their state
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              isEnabled: newEnabled,
              showNotification: false,
            });
          } catch (_error) {
            // Tab might not have content script, ignore error
          }
        }
      }

      // Show custom notification on active tab
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (
          activeTab?.id &&
          activeTab.url &&
          !activeTab.url.startsWith('chrome://') &&
          !activeTab.url.startsWith('chrome-extension://')
        ) {
          // Try to send message to existing content script first
          try {
            await chrome.tabs.sendMessage(activeTab.id, {
              action: 'updateEnabled',
              isEnabled: newEnabled,
              triggeredBy: 'hotkey',
            });
          } catch (_messageError) {
            // If no content script, inject notification directly
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: createNotificationFunction(),
              args: [newEnabled, 'hotkey', EXT_URL, getAppLogoBase64()],
            });
          }
        }
      } catch (error) {
        console.log('Could not show notification on active tab:', error);
      }

      console.log(
        `Extension ${newEnabled ? 'enabled' : 'disabled'} via hotkey`
      );
    }
  });
});

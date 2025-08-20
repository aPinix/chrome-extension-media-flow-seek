import { createNotificationFunction } from '../helpers/notification-shared';

export default defineBackground(() => {
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
            });
          } catch (error) {
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
          } catch (messageError) {
            // If no content script, inject notification directly
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: createNotificationFunction(),
              args: [newEnabled, 'hotkey'],
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

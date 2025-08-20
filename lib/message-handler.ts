import { DOMUtils } from '@/helpers/dom-utils';
import { NotificationHelper } from '@/helpers/notification-helper';
import type { OverlayCreator } from '@/helpers/overlay-creator';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import type { ChromeMessageT } from '@/types/content';

export interface MessageHandlerDependencies {
  settingsManager: SettingsManager;
  videoStateManager: VideoStateManager;
  overlayCreator: OverlayCreator;
  checkForVideos: () => void;
  getDebugColorBackground: () => string;
  getDebugImageBackground: () => string;
}

export class MessageHandler {
  private dependencies: MessageHandlerDependencies;

  constructor(dependencies: MessageHandlerDependencies) {
    this.dependencies = dependencies;
  }

  initialize(): void {
    chrome.runtime.onMessage.addListener(
      (message: ChromeMessageT, sender, sendResponse) => {
        this.handleMessage(message, sendResponse);
      }
    );
  }

  private handleMessage(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    // Handle both action and type for backward compatibility
    const messageType = message.action || message.type;

    if (settingsManager.isDebugEnabled()) {
      console.log('📨 Received message:', { messageType, message });
    }

    switch (messageType) {
      case 'updateEnabled':
        this.handleUpdateEnabled(message, sendResponse);
        break;

      case 'updateScrollInversion':
        this.handleUpdateScrollInversion(message, sendResponse);
        break;

      case 'updateTimelineHover':
        this.handleUpdateTimelineHover(message, sendResponse);
        break;

      case 'updateTimelinePosition':
        this.handleUpdateTimelinePosition(message, sendResponse);
        break;

      case 'updateTimelineHeight':
        this.handleUpdateTimelineHeight(message, sendResponse);
        break;

      case 'updateDomainRules':
        this.handleUpdateDomainRules(message, sendResponse);
        break;

      case 'updateDebug':
        this.handleUpdateDebug(message, sendResponse);
        break;

      case 'updateBetaFeatures':
        this.handleUpdateBetaFeatures(message, sendResponse);
        break;

      case 'SETTINGS_UPDATED':
        this.handleSettingsUpdated(message, sendResponse);
        break;

      default:
        if (settingsManager.isDebugEnabled()) {
          console.log('❌ Unknown message type:', messageType, message);
        }
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  private handleUpdateEnabled(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    settingsManager.updateSetting('isEnabled', message.isEnabled);

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated extension enabled from popup:',
        message.isEnabled
      );
    }

    if (!message.isEnabled) {
      // Remove existing overlays when disabled
      if (settingsManager.isDebugEnabled()) {
        console.log('🚫 Extension disabled, removing overlays');
      }

      DOMUtils.removeExistingScrubWrappers();
      DOMUtils.removeOverlayAttributes();
      videoStateManager.clear();
    } else {
      // Extension is enabled, check for videos again
      if (settingsManager.isDebugEnabled()) {
        console.log('✅ Extension enabled, checking for videos');
      }
      setTimeout(() => checkForVideos(), 100);
    }

    // Show notification for toggle; default to 'popup' unless specified
    const source: 'hotkey' | 'popup' =
      message.triggeredBy === 'hotkey' ? 'hotkey' : 'popup';
    NotificationHelper.showToggleNotification(message.isEnabled, source);

    sendResponse({ success: true });
  }

  private handleUpdateScrollInversion(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager } = this.dependencies;

    settingsManager.updateSetting(
      'invertHorizontalScroll',
      message.invertHorizontalScroll
    );

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated scroll inversion from popup:',
        message.invertHorizontalScroll
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateTimelineHover(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager } = this.dependencies;

    settingsManager.updateSetting(
      'showTimelineOnHover',
      message.showTimelineOnHover
    );

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline hover from popup:',
        message.showTimelineOnHover
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateTimelinePosition(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager } = this.dependencies;

    settingsManager.updateSetting('timelinePosition', message.timelinePosition);

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline position from popup:',
        message.timelinePosition
      );
    }

    // Update existing timelines
    videoStateManager.updateTimelinePosition(
      message.timelinePosition,
      settingsManager.getTimelineHeight(),
      settingsManager.getTimelineHeightUnit()
    );

    sendResponse({ success: true });
  }

  private handleUpdateTimelineHeight(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager } = this.dependencies;

    settingsManager.updateSetting('timelineHeight', message.timelineHeight);
    if (message.timelineHeightUnit) {
      settingsManager.updateSetting(
        'timelineHeightUnit',
        message.timelineHeightUnit
      );
    }

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline height from popup:',
        message.timelineHeight
      );
      if (message.timelineHeightUnit) {
        console.log(
          '📤 Updated timeline height unit from popup:',
          message.timelineHeightUnit
        );
      }
    }

    // Update existing timelines
    videoStateManager.updateTimelineHeight(
      message.timelineHeight,
      message.timelineHeightUnit || settingsManager.getTimelineHeightUnit(),
      settingsManager.getTimelinePosition()
    );

    sendResponse({ success: true });
  }

  private handleUpdateDomainRules(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    settingsManager.updateSetting('domainRules', message.domainRules);

    if (settingsManager.isDebugEnabled()) {
      console.log('📤 Updated domain rules from popup:', message.domainRules);
    }

    // Check if extension should run with new rules
    if (!settingsManager.shouldRun()) {
      if (settingsManager.isDebugEnabled()) {
        console.log(
          '🚫 Current domain not allowed with new rules, removing overlays'
        );
      }

      DOMUtils.removeExistingScrubWrappers();
      DOMUtils.removeOverlayAttributes();
      videoStateManager.clear();
    } else {
      // Domain is now allowed, check for videos again
      if (settingsManager.isDebugEnabled()) {
        console.log('✅ Current domain is now allowed, checking for videos');
      }
      setTimeout(() => checkForVideos(), 100);
    }

    sendResponse({ success: true });
  }

  private handleUpdateDebug(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const {
      settingsManager,
      videoStateManager,
      getDebugColorBackground,
      getDebugImageBackground,
    } = this.dependencies;

    settingsManager.updateSetting('isDebugEnabled', message.isDebugEnabled);

    if (message.isDebugEnabled) {
      console.log(
        '📤 Updated debug enabled from popup:',
        message.isDebugEnabled
      );
    }

    // Update debug mode for all existing overlays
    videoStateManager.updateDebugMode(
      message.isDebugEnabled,
      getDebugColorBackground,
      getDebugImageBackground
    );

    sendResponse({ success: true });
  }

  private handleUpdateBetaFeatures(
    message: ChromeMessageT,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    settingsManager.updateSetting(
      'isBetaFeaturesEnabled',
      message.isBetaFeaturesEnabled
    );

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated beta features enabled from popup:',
        message.isBetaFeaturesEnabled
      );
    }

    // Check if extension should run with new beta features setting
    if (!settingsManager.shouldRun()) {
      // Remove all overlays if extension should not run on current domain
      videoStateManager.clear();
    } else {
      // Re-check for videos to ensure overlays are created if needed
      checkForVideos();
    }

    sendResponse({ success: true });
  }

  private handleSettingsUpdated(
    message: any,
    sendResponse: (response: any) => void
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    let shouldUpdateOverlays = false;
    let wasHotkeyToggle = false;

    // Handle hotkey toggle (legacy support)
    if (typeof message.isEnabled === 'boolean' && !message.settings) {
      settingsManager.updateSetting('isEnabled', message.isEnabled);
      wasHotkeyToggle = true;

      if (settingsManager.isDebugEnabled()) {
        console.log(
          '⌨️ Updated extension enabled from hotkey:',
          message.isEnabled
        );
      }

      if (!message.isEnabled) {
        // Remove existing overlays when disabled
        if (settingsManager.isDebugEnabled()) {
          console.log('🚫 Extension disabled via hotkey, removing overlays');
        }

        DOMUtils.removeExistingScrubWrappers();
        DOMUtils.removeOverlayAttributes();
        videoStateManager.clear();
      } else {
        // Extension is enabled, check for videos again
        if (settingsManager.isDebugEnabled()) {
          console.log('✅ Extension enabled via hotkey, checking for videos');
        }
        setTimeout(() => checkForVideos(), 100);
      }
    }

    // Handle full settings update from popup
    if (message.settings) {
      const settings = message.settings;

      // Update all settings in the settings manager
      if (typeof settings.isEnabled === 'boolean') {
        settingsManager.updateSetting('isEnabled', settings.isEnabled);
      }
      if (typeof settings.isDebugEnabled === 'boolean') {
        settingsManager.updateSetting(
          'isDebugEnabled',
          settings.isDebugEnabled
        );
      }
      if (typeof settings.invertHorizontalScroll === 'boolean') {
        settingsManager.updateSetting(
          'invertHorizontalScroll',
          settings.invertHorizontalScroll
        );
      }
      if (typeof settings.showTimelineOnHover === 'boolean') {
        settingsManager.updateSetting(
          'showTimelineOnHover',
          settings.showTimelineOnHover
        );
      }
      if (settings.timelinePosition) {
        settingsManager.updateSetting(
          'timelinePosition',
          settings.timelinePosition
        );
      }
      if (typeof settings.timelineHeight === 'number') {
        settingsManager.updateSetting(
          'timelineHeight',
          settings.timelineHeight
        );
      }
      if (settings.timelineHeightUnit) {
        settingsManager.updateSetting(
          'timelineHeightUnit',
          settings.timelineHeightUnit
        );
      }
      if (settings.actionArea) {
        settingsManager.updateSetting('actionArea', settings.actionArea);
        shouldUpdateOverlays = true; // Action area changes require overlay updates
      }
      if (typeof settings.actionAreaSize === 'number') {
        settingsManager.updateSetting(
          'actionAreaSize',
          settings.actionAreaSize
        );
        shouldUpdateOverlays = true; // Action area size changes require overlay updates
      }

      if (settingsManager.isDebugEnabled()) {
        console.log('🔧 Settings updated from popup:', settings);
        if (settings.actionArea) {
          console.log('🎯 Action area changed to:', settings.actionArea);
        }
      }

      // If extension is enabled and we need to update overlays
      if (settingsManager.isEnabled() && shouldUpdateOverlays) {
        if (settingsManager.isDebugEnabled()) {
          console.log('🔄 Updating existing overlays for action area change');
        }

        // Update all existing overlays immediately for action area changes
        const { overlayCreator } = this.dependencies;
        overlayCreator.updateAllOverlaysForActionArea();
      }
    }

    // Show notification for hotkey toggle only
    if (wasHotkeyToggle) {
      NotificationHelper.showToggleNotification(message.isEnabled, 'hotkey');
    }

    sendResponse({ success: true });
  }
}

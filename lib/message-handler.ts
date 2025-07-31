import { DOMUtils } from '@/helpers/dom-utils';
import { SettingsManager } from '@/helpers/settings-manager';
import { VideoStateManager } from '@/helpers/video-state';
import { ChromeMessageT } from '@/types/content';

export interface MessageHandlerDependencies {
  settingsManager: SettingsManager;
  videoStateManager: VideoStateManager;
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

    switch (message.action) {
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

      default:
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
}

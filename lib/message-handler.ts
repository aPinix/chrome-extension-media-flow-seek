import { DOMUtils } from '@/helpers/dom-utils';
import { showToggleNotification } from '@/helpers/notification-helper';
import type { OverlayCreator } from '@/helpers/overlay-creator';
import {
  normalizeScrollHotkeys,
  normalizeScrollSpeedFactor,
} from '@/helpers/scroll-speed';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import {
  ActionAreaE,
  type ActionAreaT,
  type ChromeMessageT,
} from '@/types/content';

export interface MessageHandlerDependencies {
  settingsManager: SettingsManager;
  videoStateManager: VideoStateManager;
  overlayCreator: OverlayCreator;
  checkForVideos: () => void;
  getDebugColorBackground: () => string;
  getDebugImageBackground: () => string;
}

type MessageResponse = {
  success: boolean;
  error?: string;
};

type SendResponse = (response: MessageResponse) => void;

export class MessageHandler {
  private dependencies: MessageHandlerDependencies;

  constructor(dependencies: MessageHandlerDependencies) {
    this.dependencies = dependencies;
  }

  initialize(): void {
    chrome.runtime.onMessage.addListener(
      (message: ChromeMessageT, _sender, sendResponse) => {
        this.handleMessage(message, sendResponse);
      }
    );
  }

  private handleMessage(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;

    // Handle both action and type for backward compatibility
    const messageType = message.action || message.type;

    if (settingsManager.isDebugEnabled()) {
      console.log('📨 Received message:', { messageType, message });
    }

    switch (messageType) {
      case 'updateEnabled':
        this.handleUpdateEnabled(message, sendResponse);
        break;

      case 'updateScrollSeeking':
        this.handleUpdateScrollSeeking(message, sendResponse);
        break;

      case 'updateScrollInversion':
        this.handleUpdateScrollInversion(message, sendResponse);
        break;

      case 'updateScrollHotkeys':
        this.handleUpdateScrollHotkeys(message, sendResponse);
        break;

      case 'updateScrollSpeedFactor':
        this.handleUpdateScrollSpeedFactor(message, sendResponse);
        break;

      case 'updateWheelActions':
        this.handleUpdateWheelActions(message, sendResponse);
        break;

      case 'updateTimelineHover':
        this.handleUpdateTimelineHover(message, sendResponse);
        break;

      case 'updateTimelineSeeking':
        this.handleUpdateTimelineSeeking(message, sendResponse);
        break;

      case 'updateDragVideoToSeek':
        this.handleUpdateDragVideoToSeek(message, sendResponse);
        break;

      case 'updateHideVideoControls':
        this.handleUpdateHideVideoControls(message, sendResponse);
        break;

      case 'updateColorizedTimeline':
        this.handleUpdateColorizedTimeline(message, sendResponse);
        break;

      case 'updateYouTubeChapteredTimeline':
        this.handleUpdateYouTubeChapteredTimeline(message, sendResponse);
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

      case 'previewActionArea':
        this.handlePreviewActionArea(message, sendResponse);
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
    sendResponse: SendResponse
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
    showToggleNotification(message.isEnabled, source);

    sendResponse({ success: true });
  }

  private handlePreviewActionArea(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator } = this.dependencies;

    if (message.previewActionArea === null) {
      overlayCreator.clearActionAreaPreview();
      sendResponse({ success: true });
      return;
    }

    const validActionAreas = Object.values(ActionAreaE) as ActionAreaT[];
    if (
      !validActionAreas.includes(message.previewActionArea as ActionAreaT) ||
      typeof message.actionAreaSize !== 'number'
    ) {
      sendResponse({ success: false, error: 'Invalid action area preview' });
      return;
    }

    overlayCreator.previewActionArea(
      message.previewActionArea as ActionAreaT,
      message.actionAreaSize,
      message.actionAreaSizeUnit === 'px' ? 'px' : '%'
    );
    sendResponse({ success: true });
  }

  private handleUpdateScrollInversion(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;

    if (typeof message.invertHorizontalScroll !== 'boolean') {
      sendResponse({ success: false, error: 'Invalid scroll inversion' });
      return;
    }

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

  private handleUpdateScrollSeeking(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.isScrollSeekingEnabled !== 'boolean') {
      sendResponse({ success: false, error: 'Invalid scroll seeking setting' });
      return;
    }

    settingsManager.updateSetting(
      'isScrollSeekingEnabled',
      message.isScrollSeekingEnabled
    );
    overlayCreator.updateScrollSeekingState();
    this.reconcileOverlayPresence();
    sendResponse({ success: true });
  }

  private handleUpdateScrollHotkeys(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;
    const hotkeys = normalizeScrollHotkeys(
      message.fastScrollHotkey ?? settingsManager.getFastScrollHotkey(),
      message.slowScrollHotkey ?? settingsManager.getSlowScrollHotkey()
    );

    settingsManager.updateSetting('fastScrollHotkey', hotkeys.fastScrollHotkey);
    settingsManager.updateSetting('slowScrollHotkey', hotkeys.slowScrollHotkey);

    if (settingsManager.isDebugEnabled()) {
      console.log('📤 Updated scroll hotkeys from popup:', hotkeys);
    }

    sendResponse({ success: true });
  }

  private handleUpdateScrollSpeedFactor(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;

    settingsManager.updateSetting(
      'scrollSpeedFactor',
      normalizeScrollSpeedFactor(message.scrollSpeedFactor)
    );
    sendResponse({ success: true });
  }

  private handleUpdateWheelActions(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;

    if (typeof message.isPlayPauseWheelEnabled === 'boolean') {
      settingsManager.updateSetting(
        'isPlayPauseWheelEnabled',
        message.isPlayPauseWheelEnabled
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateTimelineHover(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager } = this.dependencies;

    settingsManager.updateSetting(
      'showTimelineOnHover',
      message.showTimelineOnHover
    );
    this.dependencies.overlayCreator.updateTimelineSeekingState();
    this.reconcileOverlayPresence();

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline hover from popup:',
        message.showTimelineOnHover
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateTimelineSeeking(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.isTimelineSeekingEnabled !== 'boolean') {
      sendResponse({
        success: false,
        error: 'Invalid timeline seeking setting',
      });
      return;
    }

    settingsManager.updateSetting(
      'isTimelineSeekingEnabled',
      message.isTimelineSeekingEnabled
    );
    overlayCreator.updateTimelineSeekingState();
    overlayCreator.updateVideoDraggingState();
    overlayCreator.updateVideoControlsVisibility();
    overlayCreator.updateScrollSeekingState();
    this.reconcileOverlayPresence();

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline seeking from popup:',
        message.isTimelineSeekingEnabled
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateHideVideoControls(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.hideVideoControls !== 'boolean') {
      sendResponse({
        success: false,
        error: 'Invalid hide video controls setting',
      });
      return;
    }

    settingsManager.updateSetting(
      'hideVideoControls',
      message.hideVideoControls
    );
    overlayCreator.updateVideoControlsVisibility();
    overlayCreator.updateScrollSeekingState();
    this.reconcileOverlayPresence();

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated hide video controls from popup:',
        message.hideVideoControls
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateDragVideoToSeek(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.dragVideoToSeek !== 'boolean') {
      sendResponse({
        success: false,
        error: 'Invalid drag video to seek setting',
      });
      return;
    }

    settingsManager.updateSetting('dragVideoToSeek', message.dragVideoToSeek);
    overlayCreator.updateVideoDraggingState();
    overlayCreator.updateScrollSeekingState();
    this.reconcileOverlayPresence();

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated drag video to seek from popup:',
        message.dragVideoToSeek
      );
    }

    sendResponse({ success: true });
  }

  private handleUpdateColorizedTimeline(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.colorizedTimeline !== 'boolean') {
      sendResponse({
        success: false,
        error: 'Invalid colorized timeline setting',
      });
      return;
    }

    settingsManager.updateSetting(
      'colorizedTimeline',
      message.colorizedTimeline
    );
    overlayCreator.updateTimelineColorization();

    sendResponse({ success: true });
  }

  private handleUpdateYouTubeChapteredTimeline(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    if (typeof message.isYouTubeChapteredTimelineEnabled !== 'boolean') {
      sendResponse({
        success: false,
        error: 'Invalid YouTube chaptered timeline setting',
      });
      return;
    }

    settingsManager.updateSetting(
      'isYouTubeChapteredTimelineEnabled',
      message.isYouTubeChapteredTimelineEnabled
    );
    overlayCreator.updateYouTubeChapteredTimelineState();
    sendResponse({ success: true });
  }

  private handleUpdateTimelinePosition(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

    settingsManager.updateSetting('timelinePosition', message.timelinePosition);

    if (settingsManager.isDebugEnabled()) {
      console.log(
        '📤 Updated timeline position from popup:',
        message.timelinePosition
      );
    }

    overlayCreator.updateTimelineLayoutWithAnimation();
    overlayCreator.previewTimelines();

    sendResponse({ success: true });
  }

  private handleUpdateTimelineHeight(
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { overlayCreator, settingsManager } = this.dependencies;

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

    overlayCreator.updateTimelineLayoutWithAnimation();
    overlayCreator.previewTimelines();

    sendResponse({ success: true });
  }

  private handleUpdateDomainRules(
    message: ChromeMessageT,
    sendResponse: SendResponse
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

  private reconcileOverlayPresence(): void {
    const { checkForVideos, settingsManager, videoStateManager } =
      this.dependencies;

    if (!settingsManager.shouldRun()) {
      DOMUtils.removeExistingScrubWrappers();
      DOMUtils.removeOverlayAttributes();
      videoStateManager.clear();
      return;
    }

    checkForVideos();
  }

  private handleUpdateDebug(
    message: ChromeMessageT,
    sendResponse: SendResponse
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
    sendResponse: SendResponse
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
    message: ChromeMessageT,
    sendResponse: SendResponse
  ): void {
    const { settingsManager, videoStateManager, checkForVideos } =
      this.dependencies;

    let shouldUpdateOverlays = false;
    let shouldUpdateTimelineSeeking = false;
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
      if (typeof settings.isScrollSeekingEnabled === 'boolean') {
        settingsManager.updateSetting(
          'isScrollSeekingEnabled',
          settings.isScrollSeekingEnabled
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (typeof settings.scrollSpeedFactor === 'number') {
        settingsManager.updateSetting(
          'scrollSpeedFactor',
          normalizeScrollSpeedFactor(settings.scrollSpeedFactor)
        );
      }
      if (settings.fastScrollHotkey && settings.slowScrollHotkey) {
        const hotkeys = normalizeScrollHotkeys(
          settings.fastScrollHotkey,
          settings.slowScrollHotkey
        );
        settingsManager.updateSetting(
          'fastScrollHotkey',
          hotkeys.fastScrollHotkey
        );
        settingsManager.updateSetting(
          'slowScrollHotkey',
          hotkeys.slowScrollHotkey
        );
      }
      if (typeof settings.isPlayPauseWheelEnabled === 'boolean') {
        settingsManager.updateSetting(
          'isPlayPauseWheelEnabled',
          settings.isPlayPauseWheelEnabled
        );
      }
      if (typeof settings.showTimelineOnHover === 'boolean') {
        settingsManager.updateSetting(
          'showTimelineOnHover',
          settings.showTimelineOnHover
        );
      }
      if (typeof settings.isTimelineSeekingEnabled === 'boolean') {
        settingsManager.updateSetting(
          'isTimelineSeekingEnabled',
          settings.isTimelineSeekingEnabled
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (typeof settings.dragVideoToSeek === 'boolean') {
        settingsManager.updateSetting(
          'dragVideoToSeek',
          settings.dragVideoToSeek
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (typeof settings.hideVideoControls === 'boolean') {
        settingsManager.updateSetting(
          'hideVideoControls',
          settings.hideVideoControls
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (typeof settings.colorizedTimeline === 'boolean') {
        settingsManager.updateSetting(
          'colorizedTimeline',
          settings.colorizedTimeline
        );
        this.dependencies.overlayCreator.updateTimelineColorization();
      }
      if (settings.timelinePosition) {
        settingsManager.updateSetting(
          'timelinePosition',
          settings.timelinePosition
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (typeof settings.timelineHeight === 'number') {
        settingsManager.updateSetting(
          'timelineHeight',
          settings.timelineHeight
        );
        shouldUpdateTimelineSeeking = true;
      }
      if (settings.timelineHeightUnit) {
        settingsManager.updateSetting(
          'timelineHeightUnit',
          settings.timelineHeightUnit
        );
        shouldUpdateTimelineSeeking = true;
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
      if (
        settings.actionAreaSizeUnit === 'px' ||
        settings.actionAreaSizeUnit === '%'
      ) {
        settingsManager.updateSetting(
          'actionAreaSizeUnit',
          settings.actionAreaSizeUnit
        );
        shouldUpdateOverlays = true;
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
      if (shouldUpdateTimelineSeeking) {
        this.dependencies.overlayCreator.updateTimelineSeekingState();
        this.dependencies.overlayCreator.updateVideoDraggingState();
        this.dependencies.overlayCreator.updateVideoControlsVisibility();
        this.dependencies.overlayCreator.updateScrollSeekingState();
        this.reconcileOverlayPresence();
      }
    }

    // Show notification for hotkey toggle only
    if (wasHotkeyToggle && message.showNotification !== false) {
      showToggleNotification(message.isEnabled, 'hotkey');
    }

    sendResponse({ success: true });
  }
}

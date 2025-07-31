import { DOMUtils } from '@/helpers/dom-utils';
import { getProgressColorSync } from '@/helpers/domains';
import { OverlayCreator } from '@/helpers/overlay-creator';
import { SettingsManager } from '@/helpers/settings-manager';
import { VideoStateManager } from '@/helpers/video-state';
import { MessageHandler } from '@/lib/message-handler';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Initialize managers
    const settingsManager = new SettingsManager();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager
    );

    // Debug utility functions
    const getDebugColorBackground = (): string => {
      return settingsManager.isDebugEnabled()
        ? `background-color: rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.1);`
        : '';
    };

    const getDebugImageBackground = (): string => {
      return settingsManager.isDebugEnabled()
        ? `
          background-size: 16px 16px;
          background-image: repeating-linear-gradient(
            315deg,
            rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.3) 0 1px,
            #0000 0 50%
          );
        `
        : '';
    };

    // Create overlay function that uses the overlay creator
    const createScrubOverlay = (video: HTMLVideoElement): void => {
      overlayCreator.createScrubOverlay(video);
    };

    // Check for videos function
    const checkForVideos = (): void => {
      DOMUtils.checkForVideos({
        debugMode: settingsManager.isDebugEnabled(),
        shouldRun: () => settingsManager.shouldRun(),
        createOverlay: createScrubOverlay,
      });
    };

    // Initialize message handler
    const messageHandler = new MessageHandler({
      settingsManager,
      videoStateManager,
      checkForVideos,
      getDebugColorBackground,
      getDebugImageBackground,
    });

    // Initialize extension
    const initializeExtension = async (): Promise<void> => {
      // Initialize settings
      await settingsManager.initialize();

      const debugMode = settingsManager.isDebugEnabled();
      if (debugMode) {
        const settings = settingsManager.getSettings();
        console.log('📜 Loaded extension enabled setting:', settings.isEnabled);
        console.log(
          '📜 Loaded debug enabled setting:',
          settings.isDebugEnabled
        );
        console.log(
          '📜 Loaded scroll inversion setting:',
          settings.invertHorizontalScroll
        );
        console.log(
          '📜 Loaded timeline hover setting:',
          settings.showTimelineOnHover
        );
        console.log(
          '📜 Loaded timeline position setting:',
          settings.timelinePosition
        );
        console.log(
          '📜 Loaded timeline height setting:',
          settings.timelineHeight
        );
        console.log(
          '📜 Loaded timeline height unit setting:',
          settings.timelineHeightUnit
        );
        console.log('📜 Loaded domain rules:', settings.domainRules);
      }

      // Initialize message handler
      messageHandler.initialize();

      // Check for videos after settings are loaded
      checkForVideos();

      // Check again after delays for async content
      setTimeout(() => {
        if (debugMode) console.log('🕐 Delayed video check (500ms)');
        checkForVideos();
      }, 500);

      setTimeout(() => {
        if (debugMode) console.log('🕐 Delayed video check (2s)');
        checkForVideos();
      }, 2000);
    };

    // Initialize extension
    initializeExtension();

    // Watch for new video elements being added to DOM
    const observer = DOMUtils.observeNewVideos(
      checkForVideos,
      settingsManager.isDebugEnabled()
    );

    // Also check when mouse moves (fallback for edge cases)
    const throttledMouseCheck = DOMUtils.createMouseCheckThrottler(
      checkForVideos,
      settingsManager.isDebugEnabled()
    );
    document.addEventListener('mousemove', throttledMouseCheck);
  },
});

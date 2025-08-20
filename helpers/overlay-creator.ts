import { EXT_URL } from '@/config/variables.config';
import { DOMUtils } from '@/helpers/dom-utils';
import { getProgressColorSync } from '@/helpers/domains';
import { getAppLogoBase64 } from '@/helpers/logo';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import {
  ActionAreaE,
  type ActionAreaT,
  type VideoStateT,
} from '@/types/content';

export class OverlayCreator {
  private settingsManager: SettingsManager;
  private videoStateManager: VideoStateManager;
  private updatingScrollVideos = new Map<HTMLVideoElement, boolean>();
  private keyboardEventListenerAdded = false;
  private pressedKeys = new Set<string>();
  private checkForVideos: () => void;
  private isFastHideStyleInjected = false;

  constructor(
    settingsManager: SettingsManager,
    videoStateManager: VideoStateManager,
    checkForVideos: () => void
  ) {
    this.settingsManager = settingsManager;
    this.videoStateManager = videoStateManager;
    this.checkForVideos = checkForVideos;
    this.setupKeyboardEventListener();
  }

  private setupKeyboardEventListener(): void {
    if (this.keyboardEventListenerAdded) return;

    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Handle focus loss - clear all pressed keys when window loses focus
    window.addEventListener('blur', this.clearAllPressedKeys.bind(this));

    // Handle visibility change - clear all pressed keys when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAllPressedKeys();
      }
    });

    this.keyboardEventListenerAdded = true;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Ignore auto-repeat keydown events to prevent repeated work
    if (event.repeat) return;

    // Track pressed keys and check if this is the first key
    const wasEmpty = this.pressedKeys.size === 0;
    this.pressedKeys.add(event.code);

    // Only run disable path on first key down transition
    if (!wasEmpty) return;

    // Disable the extension when any key is pressed (same as popup disable)
    // This prevents interference with default video controls
    this.settingsManager.updateSetting('isEnabled', false);

    if (this.settingsManager.isDebugEnabled()) {
      console.log('🚫 Extension disabled by key press, fast-hiding overlays');
    }

    // 1) Instant visual hide via CSS so it feels immediate
    this.fastHideOverlays();

    // 2) Defer heavier DOM removals to the next frame to keep input-to-paint fast
    requestAnimationFrame(() => {
      DOMUtils.removeExistingScrubWrappers();
      DOMUtils.removeOverlayAttributes();
      this.videoStateManager.clear();

      if (this.settingsManager.isDebugEnabled()) {
        console.log('🧹 Overlays removed and state cleared (deferred)');
      }
    });

    if (this.settingsManager.isDebugEnabled()) {
      console.log(
        '🎯 PRESSED KEYS:',
        this.pressedKeys.size,
        '- Extension disabled'
      );
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    // Remove the released key from pressed keys
    this.pressedKeys.delete(event.code);

    if (this.settingsManager.isDebugEnabled()) {
      console.log('🎯 PRESSED KEYS:', this.pressedKeys.size);
    }

    // If no keys are pressed, re-enable the extension (same as popup enable)
    if (this.pressedKeys.size === 0) {
      this.settingsManager.updateSetting('isEnabled', true);

      if (this.settingsManager.isDebugEnabled()) {
        console.log('✅ Extension enabled by key release, checking for videos');
      }

      // Remove fast-hide artifacts so overlays can be recreated
      document.documentElement.classList.remove('mfs-disabled');
      const s = document.getElementById('mfs-fast-hide');
      if (s) s.remove();
      this.isFastHideStyleInjected = false;

      // Extension is enabled, check for videos again (same as popup enable logic)
      setTimeout(() => this.checkForVideos(), 100);
    }
  }

  private clearAllPressedKeys(): void {
    if (this.settingsManager.isDebugEnabled()) {
      console.log(
        '🎯 Clearing all pressed keys (was:',
        this.pressedKeys.size,
        ')'
      );
    }
    this.pressedKeys.clear();
    this.settingsManager.updateSetting('isEnabled', true);

    if (this.settingsManager.isDebugEnabled()) {
      console.log('✅ Extension enabled by focus change, checking for videos');
    }

    // Remove fast-hide artifacts so overlays can be recreated
    document.documentElement.classList.remove('mfs-disabled');
    const s = document.getElementById('mfs-fast-hide');
    if (s) s.remove();
    this.isFastHideStyleInjected = false;

    // Extension is enabled, check for videos again (same as popup enable logic)
    setTimeout(() => this.checkForVideos(), 100);
  }

  private fastHideOverlays(): void {
    // Add a lightweight class that CSS can key off if needed
    document.documentElement.classList.add('mfs-disabled');

    // Fallback: ensure scrub wrappers are immediately hidden without heavy DOM ops
    if (!this.isFastHideStyleInjected) {
      const style = document.createElement('style');
      style.id = 'mfs-fast-hide';
      style.textContent = `.scrub-wrapper { display: none !important; visibility: hidden !important; }`;
      document.head.appendChild(style);
      this.isFastHideStyleInjected = true;
    }
  }

  createScrubOverlay(video: HTMLVideoElement): void {
    const debugMode = this.settingsManager.isDebugEnabled();

    if (debugMode) {
      console.log('🎯 Creating scrub overlay for video:', video);
    }

    // Remove existing overlay if any
    const existingOverlay = this.videoStateManager.get(video);
    if (existingOverlay) {
      if (debugMode) console.log('🗑️ Removing existing overlay');
      this.videoStateManager.delete(video);
      this.updatingScrollVideos.delete(video); // Clean up scroll update flag
    }

    // Track hover state for timeline display
    let isHovering = false;
    let scrubTimeout: number | null = null;
    let isSettingInitialScroll = false;

    // Create overlay div
    const scrubOverlay = this.createOverlayElement();
    const videoId = this.generateVideoId(video);
    scrubOverlay.setAttribute('data-video-id', videoId);

    // Forward mouse events
    this.setupMouseEventForwarding(scrubOverlay, video, debugMode);

    // Create content div
    const scrubOverlayScrollContent = this.createScrollContentElement();
    scrubOverlay.appendChild(scrubOverlayScrollContent);

    // Create timeline bar
    const scrubTimeline = this.createTimelineElement(video);
    const scrubTimelineProgressIndicator =
      this.createProgressIndicatorElement(video);
    scrubTimeline.appendChild(scrubTimelineProgressIndicator);

    // Create and position wrapper
    const { scrubWrapper, debugIndicator } =
      this.createWrapperAndDebugIndicator(video, videoId);

    // Add elements to wrapper
    scrubWrapper.appendChild(scrubOverlay);
    scrubWrapper.appendChild(scrubTimeline);

    // Only add debug indicator to DOM if debug is enabled
    if (this.settingsManager.isDebugEnabled()) {
      scrubWrapper.appendChild(debugIndicator);
    }

    // Insert wrapper into DOM
    this.insertWrapperIntoDOM(video, scrubWrapper);

    // Setup overlay functionality
    const updateOverlaySize = this.createOverlaySizeUpdater(
      video,
      scrubWrapper
    );
    const updateContentWidth = this.createContentWidthUpdater(
      video,
      scrubOverlayScrollContent,
      scrubOverlay,
      (value) => {
        isSettingInitialScroll = value;
      }
    );

    // Set initial width and setup metadata listener
    updateContentWidth();
    video.addEventListener('loadedmetadata', updateContentWidth);

    // Setup scroll handling
    this.setupScrollHandling(
      video,
      scrubOverlay,
      scrubOverlayScrollContent,
      scrubTimeline,
      () => isSettingInitialScroll,
      (value) => {
        isSettingInitialScroll = value;
      },
      (timeout) => {
        scrubTimeout = timeout;
      },
      () => scrubTimeout,
      () => isHovering,
      debugMode
    );

    // Setup hover events
    this.setupHoverEvents(
      video,
      scrubOverlay,
      scrubTimeline,
      () => isHovering,
      (value) => {
        isHovering = value;
      }
    );

    // Setup video sync events
    this.setupVideoSyncEvents(video, scrubOverlay, scrubOverlayScrollContent);

    // Setup resize handling
    window.addEventListener('resize', updateOverlaySize);
    const resizeObserver = new ResizeObserver(updateOverlaySize);
    resizeObserver.observe(video);

    // Setup timeline progress updates during playback
    this.setupTimelineProgressUpdates(video, scrubTimeline);

    // Store state
    const videoState: VideoStateT = {
      overlay: scrubOverlay,
      scrollContent: scrubOverlayScrollContent,
      timeline: scrubTimeline,
      wrapper: scrubWrapper,
      debugIndicator: debugIndicator,
      isUserScrubbing: false,
    };

    this.videoStateManager.set(video, videoState);

    if (debugMode) console.log('✅ Scrub overlay created successfully');
  }

  private generateVideoId(video: HTMLVideoElement): string {
    const index = Array.from(document.querySelectorAll('video')).indexOf(video);
    return `video-${index}-${video.src || video.currentSrc || 'unknown'}`;
  }

  private getDebugColorBackground(): string {
    const debugMode = this.settingsManager.isDebugEnabled();
    return debugMode
      ? `background-color: rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.1);`
      : '';
  }

  private getDebugImageBackground(): string {
    const debugMode = this.settingsManager.isDebugEnabled();
    return debugMode
      ? `
        background-size: 16px 16px;
        background-image: repeating-linear-gradient(
          315deg,
          rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.3) 0 1px,
          #0000 0 50%
        );
      `
      : '';
  }

  private createOverlayElement(): HTMLDivElement {
    const scrubOverlay = document.createElement('div');
    scrubOverlay.style.cssText = `
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0px;
      top: 0px;
      overflow-x: scroll;
      overflow-y: hidden;
      border-radius: inherit;
      background-color: rgb(0 0 0 / 0);
      pointer-events: auto;
      ${this.getDebugColorBackground()}
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;

    // Add WebKit scrollbar hiding styles
    const style = document.createElement('style');
    style.textContent = `
      .scrub-overlay::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    scrubOverlay.classList.add('scrub-overlay');

    return scrubOverlay;
  }

  private createScrollContentElement(): HTMLDivElement {
    const scrollContent = document.createElement('div');
    scrollContent.style.cssText = `
      height: 100%;
      min-width: 100%;
      background-color: rgb(0 0 0 / 0);
      ${this.getDebugImageBackground()}
    `;
    scrollContent.classList.add('scrub-overlay-scroll-content');
    return scrollContent;
  }

  private createTimelineElement(video: HTMLVideoElement): HTMLDivElement {
    const timeline = document.createElement('div');
    const heightValue =
      this.settingsManager.getTimelineHeightUnit() === '%'
        ? `${this.settingsManager.getTimelineHeight()}%`
        : `${this.settingsManager.getTimelineHeight()}px`;

    const topPosition =
      this.settingsManager.getTimelinePosition() === 'top'
        ? '0px'
        : `calc(100% - ${heightValue})`;

    timeline.style.cssText = `
      width: 100%;
      height: ${heightValue};
      position: absolute;
      left: 0px;
      top: ${topPosition};
      background: rgb(255 255 255 / 0.3);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    timeline.classList.add('scrub-timeline');
    return timeline;
  }

  private createProgressIndicatorElement(
    video: HTMLVideoElement
  ): HTMLDivElement {
    const progressIndicator = document.createElement('div');
    progressIndicator.style.cssText = `
      width: 0%;
      height: 100%;
      background-color: rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.8);
    `;
    progressIndicator.classList.add('scrub-timeline-progress-indicator');
    return progressIndicator;
  }

  private createWrapperAndDebugIndicator(
    video: HTMLVideoElement,
    videoId: string
  ): {
    scrubWrapper: HTMLDivElement;
    debugIndicator: HTMLAnchorElement;
  } {
    const videoRect = video.getBoundingClientRect();
    const videoContainer = video.parentElement || document.body;

    // Make sure the container has relative positioning
    if (getComputedStyle(videoContainer).position === 'static') {
      videoContainer.style.position = 'relative';
    }

    // Get video's position relative to its container
    const containerRect = videoContainer.getBoundingClientRect();
    const relativeTop = videoRect.top - containerRect.top;
    const relativeLeft = videoRect.left - containerRect.left;

    // Remove existing scrub wrapper for this specific video if it exists
    const existingScrubWrapper = Array.from(
      videoContainer.querySelectorAll('.scrub-wrapper')
    ).find((wrapper) => {
      const overlayInWrapper = wrapper.querySelector(
        `[data-video-id="${videoId}"]`
      );
      return overlayInWrapper !== null;
    });
    if (existingScrubWrapper) {
      existingScrubWrapper.remove();
    }

    // Create scrub wrapper div
    const scrubWrapper = document.createElement('div');
    scrubWrapper.style.cssText = `
      position: absolute;
      top: ${relativeTop}px;
      left: ${relativeLeft}px;
      width: ${video.offsetWidth}px;
      height: ${video.offsetHeight}px;
      pointer-events: none;
    `;
    scrubWrapper.classList.add('scrub-wrapper');

    // Create debug indicator
    const debugIndicator = this.createDebugIndicator();

    return { scrubWrapper, debugIndicator };
  }

  private createDebugIndicator(): HTMLAnchorElement {
    const debugIndicator = document.createElement('a');
    debugIndicator.href = EXT_URL;
    debugIndicator.target = '_blank';
    debugIndicator.rel = 'noopener noreferrer';
    debugIndicator.title = 'View Media Flow Seek on Chrome Web Store';
    debugIndicator.style.cssText = `
      width: auto;
      height: auto;
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: auto;
      text-decoration: none;
      transition: opacity 0.2s;
    `;
    debugIndicator.classList.add('scrub-debug-indicator');

    // Add extension icon and debug text
    debugIndicator.innerHTML = `
      <img
        src="${getAppLogoBase64()}"
        alt="Extension Icon"
        style="width: 14px; height: 14px; opacity: 0.9;"
      />
      <div style="display: flex; flex-direction: column; gap: 1px;">
        <div style="color: #fff; font-weight: 600; font-size: 10px;">Media Flow Seek (Extension)</div>
        <div style="color: #ccc; font-size: 9px; line-height: 1.2;">Debug mode enabled</div>
      </div>
    `;

    return debugIndicator;
  }

  private insertWrapperIntoDOM(
    video: HTMLVideoElement,
    scrubWrapper: HTMLDivElement
  ): void {
    const videoContainer = video.parentElement || document.body;

    // Insert wrapper right after the video element
    if (video.nextSibling) {
      videoContainer.insertBefore(scrubWrapper, video.nextSibling);
    } else {
      videoContainer.appendChild(scrubWrapper);
    }
  }

  private setupMouseEventForwarding(
    scrubOverlay: HTMLDivElement,
    video: HTMLVideoElement,
    debugMode: boolean
  ): void {
    const forwardMouseEvent = (eventType: string) => {
      scrubOverlay.addEventListener(eventType, (e) => {
        const mouseEvent = e as MouseEvent;
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();

        // Create and dispatch a new event on the video element
        const forwardedEvent = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
          button: mouseEvent.button,
          buttons: mouseEvent.buttons,
          detail: mouseEvent.detail,
        });

        video.dispatchEvent(forwardedEvent);

        if (debugMode) {
          console.log(`🖱️ ${eventType} event forwarded to video element`);
        }
      });
    };

    // Forward common video interaction events
    [
      // 'click',
      // 'dblclick',
      // 'contextmenu',
      // 'mouseover',
      // 'mousemove',
      // 'mouseout',
      // 'mouseenter',
      // 'mouseleave',
    ].forEach(forwardMouseEvent);
  }

  /**
   * Finds the actual visible container for a video element by looking for parent elements
   * with similar dimensions (within margin) and overflow properties that clip content.
   * This is useful for cases like YouTube Shorts where the video element is larger than its visible container.
   */
  private findVisibleVideoContainer(
    video: HTMLVideoElement,
    margin: number = 100
  ): HTMLElement | null {
    const videoRect = video.getBoundingClientRect();
    const videoWidth = videoRect.width;
    const videoHeight = videoRect.height;

    let currentElement = video.parentElement;

    while (currentElement && currentElement !== document.body) {
      const elementRect = currentElement.getBoundingClientRect();
      const elementWidth = elementRect.width;
      const elementHeight = elementRect.height;

      // Check if dimensions are similar (within margin)
      const widthDiff = Math.abs(elementWidth - videoWidth);
      const heightDiff = Math.abs(elementHeight - videoHeight);

      if (widthDiff <= margin && heightDiff <= margin) {
        const computedStyle = window.getComputedStyle(currentElement);
        const overflow = computedStyle.overflow;
        const overflowX = computedStyle.overflowX;
        const overflowY = computedStyle.overflowY;

        // Check for clipping properties
        const hasClipping =
          overflow === 'hidden' ||
          overflowX === 'hidden' ||
          overflowY === 'hidden' ||
          overflow === 'clip' ||
          overflowX === 'clip' ||
          overflowY === 'clip' ||
          computedStyle.clipPath !== 'none';

        if (hasClipping) {
          return currentElement;
        }
      }

      currentElement = currentElement.parentElement;
    }

    return null;
  }

  /**
   * Calculate overlay dimensions based on action area setting and size
   * Single source of truth for action area positioning logic
   */
  private calculateActionAreaDimensions(
    targetHeight: number,
    actionArea: ActionAreaT
  ): { top: number; height: number } {
    const actionAreaSize = this.settingsManager.getActionAreaSize();
    const sizeRatio = actionAreaSize / 100; // Convert percentage to ratio

    switch (actionArea) {
      case ActionAreaE.Top:
        return { top: 0, height: targetHeight * sizeRatio };
      case ActionAreaE.Middle:
        const middleHeight = targetHeight * sizeRatio;
        return {
          top: (targetHeight - middleHeight) / 2,
          height: middleHeight,
        };
      case ActionAreaE.Bottom:
        const bottomHeight = targetHeight * sizeRatio;
        return {
          top: targetHeight - bottomHeight,
          height: bottomHeight,
        };
      case ActionAreaE.Full:
        return { top: 0, height: targetHeight };
      default:
        return { top: 0, height: targetHeight };
    }
  }

  private createOverlaySizeUpdater(
    video: HTMLVideoElement,
    scrubWrapper: HTMLDivElement
  ): () => void {
    return () => {
      if (!scrubWrapper || !video) return;

      // Try to find the actual visible container first
      const visibleContainer = this.findVisibleVideoContainer(video);
      const targetElement = visibleContainer || video;

      const targetRect = targetElement.getBoundingClientRect();
      const videoContainer = video.parentElement || document.body;
      const containerRect = videoContainer.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top;
      const relativeLeft = targetRect.left - containerRect.left;

      // Always position wrapper to match the full video area
      scrubWrapper.style.top = `${relativeTop}px`;
      scrubWrapper.style.left = `${relativeLeft}px`;
      scrubWrapper.style.width = `${targetRect.width}px`;
      scrubWrapper.style.height = `${targetRect.height}px`;

      // Get the scrub-overlay element within this wrapper
      const scrubOverlay = scrubWrapper.querySelector(
        '.scrub-overlay'
      ) as HTMLDivElement;
      if (!scrubOverlay) return;

      // Get the action area setting to determine which part should be active
      const actionArea = this.settingsManager.getActionArea();

      // Calculate overlay dimensions using centralized logic
      const { top: overlayTop, height: overlayHeight } =
        this.calculateActionAreaDimensions(targetRect.height, actionArea);

      // Update the scrub-overlay to match the calculated area
      scrubOverlay.style.top = `${overlayTop}px`;
      scrubOverlay.style.left = '0px';
      scrubOverlay.style.width = `${targetRect.width}px`;
      scrubOverlay.style.height = `${overlayHeight}px`;

      // Add debug logging if needed
      if (this.settingsManager.isDebugEnabled()) {
        if (visibleContainer) {
          console.log('🎯 Using visible container instead of video element:', {
            video: { width: video.offsetWidth, height: video.offsetHeight },
            container: { width: targetRect.width, height: targetRect.height },
            element: visibleContainer,
          });
        }
        if (actionArea !== 'full') {
          console.log('🎯 Action area applied to scrub-overlay:', {
            actionArea,
            originalHeight: targetRect.height,
            overlayHeight,
            overlayTop,
          });
        }
      }
    };
  }

  // Method to update all existing overlays when action area changes
  // Uses the same approach as keydown/keyup: remove then recreate
  updateAllOverlaysForActionArea(): void {
    const debugMode = this.settingsManager.isDebugEnabled();

    // Always log ActionArea changes for debugging
    if (debugMode) {
      console.log('🔄 ActionArea changed - removing and recreating overlays');
    }

    // Step 1: Remove overlays immediately
    // Fast hide first for immediate visual feedback
    this.fastHideOverlays();

    // Remove DOM elements and clear state
    requestAnimationFrame(() => {
      DOMUtils.removeExistingScrubWrappers();
      DOMUtils.removeOverlayAttributes();
      this.videoStateManager.clear();

      if (debugMode) {
        console.log('🚫 Overlays removed for ActionArea change');
      }

      // Step 2: Recreate overlays with new ActionArea (same as keyup)
      // Remove fast-hide artifacts
      document.documentElement.classList.remove('mfs-disabled');
      const s = document.getElementById('mfs-fast-hide');
      if (s) s.remove();
      this.isFastHideStyleInjected = false;

      // Recreate overlays with new ActionArea settings
      setTimeout(() => {
        if (debugMode) {
          console.log('✅ Recreating overlays with new ActionArea');
        }
        this.checkForVideos();

        // Step 3: Flash the newly created overlays with the new action area
        setTimeout(() => {
          this.flashOverlaysBlue();
        }, 50); // Small delay to ensure overlays are fully created
      }, 100);
    });
  }

  private flashOverlaysBlue(): void {
    const debugMode = this.settingsManager.isDebugEnabled();

    if (debugMode) {
      console.log('💙 Flashing overlays blue for action area change feedback');
    }

    // Find all existing scrub overlays
    const overlays = document.querySelectorAll('[data-video-id]');

    overlays.forEach((overlay) => {
      if (overlay instanceof HTMLElement) {
        // Store original background
        const originalBackground = overlay.style.backgroundColor;

        // Flash blue with slower, smoother animation
        overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.4)'; // blue-500 with 40% opacity (slightly more visible)
        overlay.style.transition =
          'background-color 0.4s cubic-bezier(0.4, 0, 0.6, 1)'; // Slower with smooth easing

        // Restore original background after flash
        setTimeout(() => {
          overlay.style.backgroundColor = originalBackground;
          // Keep the same smooth transition for fade out
          overlay.style.transition =
            'background-color 0.5s cubic-bezier(0.4, 0, 0.6, 1)';

          // Remove transition after restoration to avoid interfering with other animations
          setTimeout(() => {
            overlay.style.transition = '';
          }, 500);
        }, 400); // Hold the blue color longer
      }
    });
  }

  private createContentWidthUpdater(
    video: HTMLVideoElement,
    scrollContent: HTMLDivElement,
    overlay: HTMLDivElement,
    setIsSettingInitialScroll: (value: boolean) => void
  ): () => void {
    let syncInterval: number | null = null;

    return () => {
      if (!scrollContent || !overlay) return;

      const baseWidth = video.offsetWidth || 800; // Fallback width if video not loaded
      let finalWidth = baseWidth * 3; // Default minimum scrollable width

      // Check if we have a valid duration
      const hasValidDuration =
        video.duration &&
        !isNaN(video.duration) &&
        isFinite(video.duration) &&
        video.duration > 0;

      if (hasValidDuration) {
        // Make content width proportional to video duration
        const durationMinutes = video.duration / 60;
        const contentWidth = Math.max(baseWidth, baseWidth * durationMinutes);
        const minScrollableWidth = baseWidth * 3;
        finalWidth = Math.max(contentWidth, minScrollableWidth);
      } else {
        // For videos without duration (live streams, not loaded yet, etc.)
        // Use a more generous default width to ensure scrollability
        const fallbackWidth = baseWidth * 5; // More generous fallback
        finalWidth = Math.max(finalWidth, fallbackWidth);

        // Try to get duration again after a delay
        setTimeout(() => {
          if (video.duration && video.duration > 0) {
            // Recursively call this updater when duration becomes available
            const updater = this.createContentWidthUpdater(
              video,
              scrollContent,
              overlay,
              setIsSettingInitialScroll
            );
            updater();
          }
        }, 1000);
      }

      scrollContent.style.width = `${finalWidth}px`;

      // Clear existing sync interval to avoid duplicates
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }

      // Sync scroll position with video position
      const checkOverlayReady = () => {
        const currentHasValidDuration =
          video.duration &&
          !isNaN(video.duration) &&
          isFinite(video.duration) &&
          video.duration > 0;

        if (currentHasValidDuration && video.currentTime !== undefined) {
          setIsSettingInitialScroll(true);

          const progress = video.currentTime / video.duration;
          const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;

          // Apply inversion when setting scroll position
          const targetScroll =
            this.settingsManager.shouldInvertHorizontalScroll()
              ? progress * maxScroll
              : (1 - progress) * maxScroll;

          overlay.scrollLeft = targetScroll;

          // Keep the flag set until next frame to ensure scroll event is ignored
          requestAnimationFrame(() => {
            setIsSettingInitialScroll(false);
          });
        }
      };

      // Only start sync interval if we have valid duration or if this is a retry
      if (hasValidDuration || video.currentTime !== undefined) {
        syncInterval = window.setInterval(checkOverlayReady, 500);
      }
    };
  }

  private setupScrollHandling(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    scrollContent: HTMLDivElement,
    timeline: HTMLDivElement,
    getIsSettingInitialScroll: () => boolean,
    setIsSettingInitialScroll: (value: boolean) => void,
    setScrubTimeout: (timeout: number | null) => void,
    getScrubTimeout: () => number | null,
    getIsHovering: () => boolean,
    debugMode: boolean
  ): void {
    overlay.addEventListener('scroll', () => {
      if (!video.duration || !scrollContent || !timeline) return;

      // Don't process scroll events when setting initial position
      if (getIsSettingInitialScroll()) {
        if (debugMode) {
          console.log('🚫 Ignoring scroll event - setting initial position');
        }
        return;
      }

      const videoState = this.videoStateManager.get(video);
      if (!videoState) return;

      // Immediately sync scroll position to current video time when user starts scrolling
      if (!videoState.isUserScrubbing && overlay) {
        const progress = video.currentTime / video.duration;
        const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;

        // Apply inversion when setting scroll position
        const targetScroll = this.settingsManager.shouldInvertHorizontalScroll()
          ? progress * maxScroll
          : (1 - progress) * maxScroll;
        overlay.scrollLeft = targetScroll;

        if (debugMode) {
          console.log('🔄 Synced scroll position to current video time:', {
            currentTime: video.currentTime,
            progress,
            targetScroll,
            scrollLeft: overlay.scrollLeft,
          });
        }
      }

      videoState.isUserScrubbing = true;

      const scrollLeft = overlay.scrollLeft;
      const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;
      let scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0;

      // Apply inversion to scroll progress based on setting
      if (!this.settingsManager.shouldInvertHorizontalScroll()) {
        scrollProgress = 1 - scrollProgress;
      }

      const newTime = scrollProgress * video.duration;

      // Show timeline bar and update progress
      timeline.style.opacity = '1';
      const progressBar = timeline.firstElementChild as HTMLElement;
      if (progressBar) {
        progressBar.style.width = `${scrollProgress * 100}%`;
      }

      // Clear existing timeout
      const currentTimeout = getScrubTimeout();
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }

      // Set flag to false after user stops scrubbing
      const timeout = window.setTimeout(() => {
        videoState.isUserScrubbing = false;

        // Handle timeline visibility after scrubbing ends
        if (timeline) {
          const shouldShowOnHover =
            this.settingsManager.shouldShowTimelineOnHover() && getIsHovering();
          if (!shouldShowOnHover) {
            timeline.style.opacity = '0';
          } else {
            // If timeline should remain visible, update progress to reflect actual video time
            const progress = video.currentTime / video.duration;
            const progressBar = timeline.firstElementChild as HTMLElement;
            if (progressBar) {
              progressBar.style.width = `${progress * 100}%`;
            }
          }
        }
      }, 150);

      setScrubTimeout(timeout);
      video.currentTime = newTime;
    });
  }

  private setupHoverEvents(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    timeline: HTMLDivElement,
    getIsHovering: () => boolean,
    setIsHovering: (value: boolean) => void
  ): void {
    overlay.addEventListener('mouseenter', () => {
      setIsHovering(true);
      if (
        !this.settingsManager.shouldShowTimelineOnHover() ||
        !timeline ||
        !video.duration
      )
        return;

      // Show timeline on hover
      timeline.style.opacity = '1';

      // Update progress bar to show current video time (only if not scrubbing)
      const videoState = this.videoStateManager.get(video);
      if (videoState && !videoState.isUserScrubbing) {
        const progress = video.currentTime / video.duration;
        const progressBar = timeline.firstElementChild as HTMLElement;
        if (progressBar) {
          progressBar.style.width = `${progress * 100}%`;
        }
      }
    });

    overlay.addEventListener('mouseleave', () => {
      setIsHovering(false);
      const videoState = this.videoStateManager.get(video);
      if (
        !this.settingsManager.shouldShowTimelineOnHover() ||
        !timeline ||
        (videoState && videoState.isUserScrubbing)
      )
        return;

      // Hide timeline when not hovering (unless user is scrubbing)
      timeline.style.opacity = '0';
    });
  }

  private setupVideoSyncEvents(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    scrollContent: HTMLDivElement
  ): void {
    // Sync scroll position only on actual seek events (not during normal playback)
    video.addEventListener('seeked', () => {
      const videoState = this.videoStateManager.get(video);
      if (
        !video.duration ||
        !scrollContent ||
        !overlay ||
        (videoState && videoState.isUserScrubbing)
      )
        return;

      const progress = video.currentTime / video.duration;
      const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;

      // Apply inversion when setting scroll position
      const targetScroll = this.settingsManager.shouldInvertHorizontalScroll()
        ? progress * maxScroll
        : (1 - progress) * maxScroll;

      overlay.scrollLeft = targetScroll;
    });
  }

  private setupTimelineProgressUpdates(
    video: HTMLVideoElement,
    timeline: HTMLDivElement
  ): void {
    video.addEventListener('timeupdate', () => {
      const videoState = this.videoStateManager.get(video);
      if (
        !this.settingsManager.shouldShowTimelineOnHover() ||
        !timeline ||
        (videoState && videoState.isUserScrubbing) ||
        !video.duration
      )
        return;

      // Only update if timeline is visible (user is hovering)
      if (timeline.style.opacity === '1') {
        const progress = video.currentTime / video.duration;
        const progressBar = timeline.firstElementChild as HTMLElement;
        if (progressBar) {
          progressBar.style.width = `${progress * 100}%`;
        }
      }
    });
  }
}

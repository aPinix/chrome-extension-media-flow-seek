import { getProgressColorSync } from '@/helpers/domains';
import { getAppLogoBase64 } from '@/helpers/logo';
import { SettingsManager } from '@/helpers/settings-manager';
import { VideoStateManager } from '@/helpers/video-state';
import { VideoStateT } from '@/types/content';

export class OverlayCreator {
  private settingsManager: SettingsManager;
  private videoStateManager: VideoStateManager;
  private updatingScrollVideos = new Map<HTMLVideoElement, boolean>();

  constructor(
    settingsManager: SettingsManager,
    videoStateManager: VideoStateManager
  ) {
    this.settingsManager = settingsManager;
    this.videoStateManager = videoStateManager;
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
    scrubWrapper.appendChild(debugIndicator);

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
      () => isSettingInitialScroll,
      (value) => {
        isSettingInitialScroll = value;
      },
      debugMode
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
    let videoContainer = video.parentElement || document.body;

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
    debugIndicator.href =
      'https://chromewebstore.google.com/detail/media-flow-seek/phhigkiikolopghmahejjlojejpocagg?authuser=0&hl=en';
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
      display: ${this.settingsManager.isDebugEnabled() ? 'flex' : 'none'};
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: auto;
      text-decoration: none;
      transition: opacity 0.2s;
    `;
    debugIndicator.classList.add('scrub-debug-indicator');

    // Add hover effect
    debugIndicator.addEventListener('mouseenter', () => {
      debugIndicator.style.opacity = '0.7';
    });
    debugIndicator.addEventListener('mouseleave', () => {
      debugIndicator.style.opacity = '1';
    });

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
      'click',
      'dblclick',
      'contextmenu',
      'mouseover',
      'mousemove',
      'mouseout',
      'mouseenter',
      'mouseleave',
    ].forEach(forwardMouseEvent);
  }

  private createOverlaySizeUpdater(
    video: HTMLVideoElement,
    scrubWrapper: HTMLDivElement
  ): () => void {
    return () => {
      if (!scrubWrapper || !video) return;

      const videoRect = video.getBoundingClientRect();
      const videoContainer = video.parentElement || document.body;
      const containerRect = videoContainer.getBoundingClientRect();
      const relativeTop = videoRect.top - containerRect.top;
      const relativeLeft = videoRect.left - containerRect.left;

      // Update wrapper to match video size and position
      scrubWrapper.style.top = `${relativeTop}px`;
      scrubWrapper.style.left = `${relativeLeft}px`;
      scrubWrapper.style.width = `${video.offsetWidth}px`;
      scrubWrapper.style.height = `${video.offsetHeight}px`;
    };
  }

  private createContentWidthUpdater(
    video: HTMLVideoElement,
    scrollContent: HTMLDivElement,
    overlay: HTMLDivElement,
    getIsSettingInitialScroll: () => boolean,
    setIsSettingInitialScroll: (value: boolean) => void,
    debugMode: boolean
  ): () => void {
    return () => {
      if (video.duration && scrollContent && overlay) {
        // Make content width proportional to video duration
        const baseWidth = video.offsetWidth;
        const durationMinutes = video.duration / 60;
        const contentWidth = Math.max(baseWidth, baseWidth * durationMinutes);
        const minScrollableWidth = baseWidth * 3;
        const finalWidth = Math.max(contentWidth, minScrollableWidth);

        scrollContent.style.width = `${finalWidth}px`;

        // Sync scroll position with video position
        const checkOverlayReady = () => {
          if (video.duration && video.currentTime) {
            setIsSettingInitialScroll(true);

            // if (debugMode) {
            //   console.log(
            //     '🔧 Setting isSettingInitialScroll = true before sync'
            //   );
            // }

            const progress = video.currentTime / video.duration;
            const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;

            // Apply inversion when setting scroll position
            const targetScroll =
              this.settingsManager.shouldInvertHorizontalScroll()
                ? progress * maxScroll
                : (1 - progress) * maxScroll;

            // if (debugMode) {
            //   console.log(
            //     '🎯 About to set overlay.scrollLeft to:',
            //     targetScroll
            //   );
            // }

            overlay.scrollLeft = targetScroll;

            // Keep the flag set until next frame to ensure scroll event is ignored
            requestAnimationFrame(() => {
              setIsSettingInitialScroll(false);
              // if (debugMode) {
              //   console.log(
              //     '🔧 Reset isSettingInitialScroll = false after sync'
              //   );
              // }
            });

            // if (debugMode) {
            //   console.log(
            //     '✅ Synced scroll position to video after width update:',
            //     {
            //       currentTime: video.currentTime,
            //       progress,
            //       targetScroll,
            //       scrollLeft: overlay.scrollLeft,
            //       invertHorizontalScroll:
            //         this.settingsManager.shouldInvertHorizontalScroll(),
            //     },
            //     video,
            //     overlay,
            //     scrollContent
            //   );
            // }
          }
        };

        // sync scroll position every 500ms
        setInterval(checkOverlayReady, 500);
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

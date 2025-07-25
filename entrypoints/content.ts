import { getDefaultDomainRules, getProgressColorSync } from '@/helpers/domains';
import { getAppLogoBase64 } from '@/helpers/logo';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // console.log('🔴 Content script loaded for video scrubbing!');

    // Debug flag to control logging and visual indicators
    let DEBUG_MODE = false;

    // Per-video state management
    const videoStates = new Map<
      HTMLVideoElement,
      {
        overlay: HTMLDivElement;
        scrollContent: HTMLDivElement;
        timeline: HTMLDivElement;
        wrapper: HTMLDivElement;
        debugIndicator: HTMLAnchorElement;
        isUserScrubbing: boolean;
      }
    >();

    // Extension enabled state
    let isEnabled = true;

    // Horizontal scroll inversion state
    let invertHorizontalScroll = false;

    // Timeline hover state
    let showTimelineOnHover = false;

    // Timeline height state
    const timelineDefaultHeight = 6;
    let timelineHeight = timelineDefaultHeight;
    let timelineHeightUnit: 'px' | '%' = 'px';

    // Timeline position state
    let timelinePosition: 'top' | 'bottom' = 'bottom';

    // Domain rules with whitelist/blacklist/wildcard support
    let domainRules = getDefaultDomainRules();

    // Check if current domain should run the extension
    const shouldRun = (): boolean => {
      if (!isEnabled) return false;

      const currentHostname = window.location.hostname.toLowerCase();
      let shouldRunDomain = false;

      // Filter enabled rules, but always include global rule
      const enabledRules = domainRules.filter(
        (rule) => rule.domain === '*' || rule.enabled
      );

      // Sort by specificity (specific domains first, wildcard last)
      const sortedRules = [...enabledRules].sort((a, b) => {
        if (a.domain === '*') return 1;
        if (b.domain === '*') return -1;
        return 0;
      });

      // Check rules in order of specificity
      for (const rule of sortedRules) {
        if (rule.domain === '*') {
          // Wildcard rule applies to all domains
          shouldRunDomain = rule.type === 'whitelist';
        } else {
          const ruleDomain = rule.domain.toLowerCase();

          // Check for exact match or subdomain match
          const isMatch =
            currentHostname === ruleDomain ||
            currentHostname.endsWith('.' + ruleDomain);

          if (isMatch) {
            // Specific domain rule takes precedence
            shouldRunDomain = rule.type === 'whitelist';
            break;
          }
        }
      }

      return shouldRunDomain;
    };

    // Merge existing rules with new defaults
    const mergeDomainRules = (existingRules: any[]) => {
      const defaults = getDefaultDomainRules();
      const merged = [...existingRules];

      // Add any missing default domains
      defaults.forEach((defaultRule) => {
        const exists = merged.find(
          (rule) => rule.domain === defaultRule.domain
        );
        if (!exists) {
          merged.push(defaultRule);
        }
      });

      return merged;
    };

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateEnabled') {
        isEnabled = message.isEnabled;
        if (DEBUG_MODE)
          console.log('📤 Updated extension enabled from popup:', isEnabled);

        if (!isEnabled) {
          // Remove existing overlays when disabled
          if (DEBUG_MODE)
            console.log('🚫 Extension disabled, removing overlays');
          const existingOverlays = document.querySelectorAll('.scrub-wrapper');
          existingOverlays.forEach((overlay) => overlay.remove());

          // Remove scrub-enabled attributes
          const videos = document.querySelectorAll('video[data-scrub-enabled]');
          videos.forEach((video) =>
            video.removeAttribute('data-scrub-enabled')
          );

          // Clear video states
          videoStates.clear();
        } else {
          // Extension is enabled, check for videos again
          if (DEBUG_MODE)
            console.log('✅ Extension enabled, checking for videos');
          setTimeout(() => checkForVideos(), 100);
        }

        sendResponse({ success: true });
      } else if (message.action === 'updateScrollInversion') {
        invertHorizontalScroll = message.invertHorizontalScroll;
        if (DEBUG_MODE)
          console.log(
            '📤 Updated scroll inversion from popup:',
            invertHorizontalScroll
          );
        sendResponse({ success: true });
      } else if (message.action === 'updateTimelineHover') {
        showTimelineOnHover = message.showTimelineOnHover;
        if (DEBUG_MODE)
          console.log(
            '📤 Updated timeline hover from popup:',
            showTimelineOnHover
          );
        sendResponse({ success: true });
      } else if (message.action === 'updateTimelinePosition') {
        timelinePosition = message.timelinePosition;
        if (DEBUG_MODE)
          console.log(
            '📤 Updated timeline position from popup:',
            timelinePosition
          );

        // Update existing timelines if any
        videoStates.forEach((state, video) => {
          if (state.timeline) {
            const heightValue =
              timelineHeightUnit === '%'
                ? `${timelineHeight}%`
                : `${timelineHeight}px`;

            // Update position based on timeline position setting
            if (timelinePosition === 'top') {
              state.timeline.style.top = '0px';
            } else {
              state.timeline.style.top = `calc(100% - ${heightValue})`;
            }
          }
        });

        sendResponse({ success: true });
      } else if (message.action === 'updateTimelineHeight') {
        timelineHeight = message.timelineHeight;
        timelineHeightUnit = message.timelineHeightUnit ?? 'px';
        if (DEBUG_MODE) {
          console.log('📤 Updated timeline height from popup:', timelineHeight);
          console.log(
            '📤 Updated timeline height unit from popup:',
            timelineHeightUnit
          );
        }

        // Update existing timelines if any
        videoStates.forEach((state, video) => {
          if (state.timeline) {
            const heightValue =
              timelineHeightUnit === '%'
                ? `${timelineHeight}%`
                : `${timelineHeight}px`;
            state.timeline.style.height = heightValue;

            // Update position to account for new height and position setting
            if (timelinePosition === 'top') {
              state.timeline.style.top = '0px';
            } else {
              state.timeline.style.top = `calc(100% - ${heightValue})`;
            }
          }
        });

        sendResponse({ success: true });
      } else if (message.action === 'updateDomainRules') {
        domainRules = message.domainRules;
        if (DEBUG_MODE)
          console.log('📤 Updated domain rules from popup:', domainRules);

        // Check if extension should run with new rules
        if (!shouldRun()) {
          if (DEBUG_MODE)
            console.log(
              '🚫 Current domain not allowed with new rules, removing overlays'
            );
          // Remove existing overlays
          const existingOverlays = document.querySelectorAll('.scrub-wrapper');
          existingOverlays.forEach((overlay) => overlay.remove());

          // Remove scrub-enabled attributes
          const videos = document.querySelectorAll('video[data-scrub-enabled]');
          videos.forEach((video) =>
            video.removeAttribute('data-scrub-enabled')
          );

          // Clear video states
          videoStates.clear();
        } else {
          // Domain is now allowed, check for videos again
          if (DEBUG_MODE)
            console.log(
              '✅ Current domain is now allowed, checking for videos'
            );
          setTimeout(() => checkForVideos(), 100);
        }

        sendResponse({ success: true });
      } else if (message.action === 'updateDebug') {
        DEBUG_MODE = message.isDebugEnabled;
        if (DEBUG_MODE)
          console.log('📤 Updated debug enabled from popup:', DEBUG_MODE);

        // Update debug indicator visibility and background patterns for all existing overlays
        videoStates.forEach((state, video) => {
          if (state.debugIndicator) {
            state.debugIndicator.style.display = DEBUG_MODE ? 'flex' : 'none';
          }

          // Update debug background pattern on scroll content
          if (state.scrollContent) {
            const currentStyle = state.scrollContent.style.cssText;
            // Remove existing background-image and background-size if they exist
            const styleWithoutDebug = currentStyle
              .replace(/background-image:[^;]*;?/g, '')
              .replace(/background-size:[^;]*;?/g, '');

            // Apply new style with or without debug background
            state.scrollContent.style.cssText = `
              ${styleWithoutDebug}
              height: 100%;
              min-width: 100%;
              background-color: rgb(0 0 0 / 0);
              ${getDebugImageBackground()}
            `;
          }

          // Update debug background color on overlay
          if (state.overlay) {
            const currentOverlayStyle = state.overlay.style.cssText;
            const styleWithoutDebugColor = currentOverlayStyle.replace(
              /background-color:[^;]*;?/g,
              ''
            );

            state.overlay.style.cssText = `
              ${styleWithoutDebugColor}
              width: 100%;
              height: 100%;
              position: absolute;
              left: 0px;
              top: 0px;
              overflow-x: scroll;
              overflow-y: hidden;
              border-radius: inherit;
              pointer-events: auto;
              scrollbar-width: none;
              -ms-overflow-style: none;
              ${getDebugColorBackground()}
            `;
          }
        });

        sendResponse({ success: true });
      }
    });

    // Initialize settings and wait for them to load before checking for videos
    const initializeExtension = async () => {
      await new Promise((resolve) => {
        chrome.storage.sync.get(
          [
            'isEnabled',
            'isDebugEnabled',
            'invertHorizontalScroll',
            'showTimelineOnHover',
            'timelinePosition',
            'timelineHeight',
            'timelineHeightUnit',
            'domainRules',
          ],
          (result) => {
            isEnabled = result.isEnabled ?? true;
            DEBUG_MODE = result.isDebugEnabled ?? false;
            invertHorizontalScroll = result.invertHorizontalScroll ?? false;
            showTimelineOnHover = result.showTimelineOnHover ?? false;
            timelinePosition = result.timelinePosition ?? 'bottom';
            timelineHeight = result.timelineHeight ?? timelineDefaultHeight;
            timelineHeightUnit = result.timelineHeightUnit ?? 'px';

            const existingRules = result.domainRules;
            domainRules = existingRules
              ? mergeDomainRules(existingRules)
              : getDefaultDomainRules();

            if (DEBUG_MODE) {
              console.log('📜 Loaded extension enabled setting:', isEnabled);
              console.log('📜 Loaded debug enabled setting:', DEBUG_MODE);
              console.log(
                '📜 Loaded scroll inversion setting:',
                invertHorizontalScroll
              );
              console.log(
                '📜 Loaded timeline hover setting:',
                showTimelineOnHover
              );
              console.log(
                '📜 Loaded timeline position setting:',
                timelinePosition
              );
              console.log('📜 Loaded timeline height setting:', timelineHeight);
              console.log(
                '📜 Loaded timeline height unit setting:',
                timelineHeightUnit
              );
              console.log('📜 Loaded domain rules:', domainRules);
            }
            resolve(undefined);
          }
        );
      });

      // Check for videos after settings are loaded
      checkForVideos();

      // Check again after delays for async content
      setTimeout(() => {
        if (DEBUG_MODE) console.log('🕐 Delayed video check (500ms)');
        checkForVideos();
      }, 500);

      setTimeout(() => {
        if (DEBUG_MODE) console.log('🕐 Delayed video check (2s)');
        checkForVideos();
      }, 2000);
    };

    // Initialize extension
    initializeExtension();

    const getDebugColorBackground = () => {
      return DEBUG_MODE
        ? `
        background-color: rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.1);
      `
        : '';
    };

    const getDebugImageBackground = () => {
      return DEBUG_MODE
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

    const createScrubOverlay = (video: HTMLVideoElement) => {
      if (DEBUG_MODE)
        console.log('🎯 Creating scrub overlay for video:', video);

      // Remove existing overlay if any
      const existingOverlay = videoStates.get(video);
      if (existingOverlay) {
        if (DEBUG_MODE) console.log('🗑️ Removing existing overlay');
        existingOverlay.overlay.remove();
        existingOverlay.scrollContent.remove();
        existingOverlay.timeline.remove();
        existingOverlay.debugIndicator.remove();
        existingOverlay.wrapper.remove();
        videoStates.delete(video);
      }

      // Track hover state for timeline display
      let isHovering = false;

      // Track when user is actively scrubbing
      let scrubTimeout: number | null = null;
      let isSettingInitialScroll = false;

      // Create overlay div
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
        ${getDebugColorBackground()}
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

      // Add unique identifier for this video's overlay
      const videoId = `video-${Array.from(document.querySelectorAll('video')).indexOf(video)}-${video.src || video.currentSrc || 'unknown'}`;
      scrubOverlay.setAttribute('data-video-id', videoId);

      // Forward mouse events to the appropriate target (custom target or video)
      const forwardMouseEvent = (eventType: string) => {
        scrubOverlay.addEventListener(eventType, (e) => {
          const mouseEvent = e as MouseEvent;
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();

          // Forward events to the video element
          const forwardTarget = video;

          // Create and dispatch a new event on the target element
          const forwardedEvent = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            clientX: mouseEvent.clientX,
            clientY: mouseEvent.clientY,
            button: mouseEvent.button,
            buttons: mouseEvent.buttons,
            detail: mouseEvent.detail,
          });

          forwardTarget.dispatchEvent(forwardedEvent);

          if (DEBUG_MODE)
            console.log(`🖱️ ${eventType} event forwarded to video element`);
        });
      };

      // Forward common video interaction events
      forwardMouseEvent('click');
      forwardMouseEvent('dblclick'); // Often used for fullscreen
      forwardMouseEvent('contextmenu'); // Right-click menu
      forwardMouseEvent('mouseover'); // Hover to show controls
      forwardMouseEvent('mousemove'); // Hover to show controls
      forwardMouseEvent('mouseout'); // Mouse leave to hide controls
      forwardMouseEvent('mouseenter'); // Non-bubbling hover
      forwardMouseEvent('mouseleave'); // Non-bubbling leave

      // Create content div that represents video length
      const scrubOverlayScrollContent = document.createElement('div');
      scrubOverlayScrollContent.style.cssText = `
        height: 100%;
        min-width: 100%;
        background-color: rgb(0 0 0 / 0);
        ${getDebugImageBackground()}
      `;

      scrubOverlay.appendChild(scrubOverlayScrollContent);
      scrubOverlayScrollContent.classList.add('scrub-overlay-scroll-content');

      // Create timeline bar that appears during scrubbing
      const scrubTimeline = document.createElement('div');
      const heightValue =
        timelineHeightUnit === '%'
          ? `${timelineHeight}%`
          : `${timelineHeight}px`;

      // Set timeline position based on setting
      const topPosition =
        timelinePosition === 'top' ? '0px' : `calc(100% - ${heightValue})`;

      scrubTimeline.style.cssText = `
        width: 100%;
        height: ${heightValue};
        position: absolute;
        left: 0px;
        top: ${topPosition};
        background: rgb(255 255 255 / 0.3);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Create progress indicator within timeline
      const scrubTimelineProgressIndicator = document.createElement('div');
      scrubTimelineProgressIndicator.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: rgb(from ${getProgressColorSync(window.location.hostname)} r g b / 0.8);
      `;

      scrubTimeline.appendChild(scrubTimelineProgressIndicator);
      scrubTimeline.classList.add('scrub-timeline');
      scrubTimelineProgressIndicator.classList.add(
        'scrub-timeline-progress-indicator'
      );

      // Position overlay over video with exact video dimensions
      const videoRect = video.getBoundingClientRect();

      // Get video container
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

      // Create scrub wrapper div that matches video size and position
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

      // Create debug indicator anchor
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
        display: ${DEBUG_MODE ? 'flex' : 'none'};
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

      // Add all scrub elements to wrapper
      scrubWrapper.appendChild(scrubOverlay);
      scrubWrapper.appendChild(scrubTimeline);
      scrubWrapper.appendChild(debugIndicator);

      // Insert wrapper right after the video element
      if (video.nextSibling) {
        videoContainer.insertBefore(scrubWrapper, video.nextSibling);
      } else {
        videoContainer.appendChild(scrubWrapper);
      }

      // Function to update wrapper size and position to match video
      const updateOverlaySize = () => {
        if (!scrubWrapper || !video || !scrubOverlay || !scrubTimeline) return;

        const videoRect = video.getBoundingClientRect();
        const containerRect = videoContainer.getBoundingClientRect();
        const relativeTop = videoRect.top - containerRect.top;
        const relativeLeft = videoRect.left - containerRect.left;

        // Update only the wrapper to match video size and position
        scrubWrapper.style.top = `${relativeTop}px`;
        scrubWrapper.style.left = `${relativeLeft}px`;
        scrubWrapper.style.width = `${video.offsetWidth}px`;
        scrubWrapper.style.height = `${video.offsetHeight}px`;
      };

      // Update content width based on video duration
      const updateContentWidth = () => {
        if (video.duration && scrubOverlayScrollContent && scrubOverlay) {
          // Make content width proportional to video duration
          // Base width multiplied by duration in minutes
          const baseWidth = video.offsetWidth;
          const durationMinutes = video.duration / 60;
          const contentWidth = Math.max(baseWidth, baseWidth * durationMinutes);

          // Ensure content is always at least 2x the overlay width for scrollability
          const minScrollableWidth = baseWidth * 3;
          const finalWidth = Math.max(contentWidth, minScrollableWidth);

          scrubOverlayScrollContent.style.width = `${finalWidth}px`;

          // Set initial scroll position after overlay/content width is updated,
          // so the user can scroll both left and right (not stuck at edge)
          // and there's always space to scrub in either direction.
          // This runs in rAF to ensure DOM/layout is ready.
          requestAnimationFrame(() => {
            // Check if element is actually scrollable before setting scroll position
            const scrollWidth = scrubOverlayScrollContent.offsetWidth;
            const clientWidth = scrubOverlay.offsetWidth;
            const maxScrollLeft = scrollWidth - clientWidth;

            if (maxScrollLeft <= 0) {
              if (DEBUG_MODE) {
                console.log('⚠️ Element not scrollable yet:', {
                  scrollWidth,
                  clientWidth,
                  maxScrollLeft,
                  video,
                });
              }
              // Try again after a short delay
              setTimeout(() => {
                const newScrollWidth = scrubOverlayScrollContent.offsetWidth;
                const newClientWidth = scrubOverlay.offsetWidth;
                const newMaxScrollLeft = newScrollWidth - newClientWidth;

                if (newMaxScrollLeft > 0) {
                  isSettingInitialScroll = true;
                  // console.log('#### SCROLL LEFT (delayed)', video);
                  scrubOverlay.scrollLeft = 1;
                  // console.log(
                  //   '#### SCROLL LEFT RESULT:',
                  //   scrubOverlay.scrollLeft
                  // );
                  isSettingInitialScroll = false;
                }
              }, 50);
              return;
            }

            // Prevent scroll listener from interfering with initial position
            isSettingInitialScroll = true;

            // Set scroll position
            scrubOverlay.scrollLeft = 1;
            // console.log('#### SCROLL LEFT RESULT:', scrubOverlay.scrollLeft);
            isSettingInitialScroll = false;

            if (DEBUG_MODE) {
              console.log(
                '✅ Initial scroll position set after width update:',
                {
                  scrollLeft: scrubOverlay.scrollLeft,
                  maxScroll: finalWidth,
                  invertHorizontalScroll,
                },
                video
              );
            }
          });
        }
      };

      // Set initial width
      updateContentWidth();

      // Update width when video metadata loads
      video.addEventListener('loadedmetadata', updateContentWidth);

      // Handle scrolling to scrub video
      scrubOverlay.addEventListener('scroll', () => {
        if (!video.duration || !scrubOverlayScrollContent || !scrubTimeline)
          return;

        // Don't process scroll events when setting initial position
        if (isSettingInitialScroll) return;

        const videoState = videoStates.get(video);
        if (!videoState) return;

        // Immediately sync scroll position to current video time when user starts scrolling
        if (!videoState.isUserScrubbing && scrubOverlay) {
          const progress = video.currentTime / video.duration;
          const maxScroll =
            scrubOverlayScrollContent.offsetWidth - scrubOverlay.offsetWidth;
          // Apply inversion when setting scroll position
          const targetScroll = invertHorizontalScroll
            ? progress * maxScroll
            : (1 - progress) * maxScroll;
          scrubOverlay.scrollLeft = targetScroll;

          if (DEBUG_MODE) {
            console.log('🔄 Synced scroll position to current video time:', {
              currentTime: video.currentTime,
              progress,
              targetScroll,
              scrollLeft: scrubOverlay.scrollLeft,
            });
          }
        }

        videoState.isUserScrubbing = true;

        const scrollLeft = scrubOverlay!.scrollLeft;
        const maxScroll =
          scrubOverlayScrollContent.offsetWidth - scrubOverlay!.offsetWidth;
        let scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0;

        // Apply inversion to scroll progress based on setting
        if (!invertHorizontalScroll) {
          scrollProgress = 1 - scrollProgress;
        }

        const newTime = scrollProgress * video.duration;

        // Show timeline bar and update progress
        scrubTimeline.style.opacity = '1';
        const progressBar = scrubTimeline.firstElementChild as HTMLElement;
        if (progressBar) {
          progressBar.style.width = `${scrollProgress * 100}%`;
        }

        // Clear existing timeout
        if (scrubTimeout) {
          clearTimeout(scrubTimeout);
        }

        // Set flag to false after user stops scrubbing
        scrubTimeout = window.setTimeout(() => {
          videoState.isUserScrubbing = false;

          // Handle timeline visibility after scrubbing ends
          if (scrubTimeline) {
            const shouldShowOnHover = showTimelineOnHover && isHovering;
            if (!shouldShowOnHover) {
              scrubTimeline.style.opacity = '0';
            } else {
              // If timeline should remain visible, update progress to reflect actual video time
              const progress = video.currentTime / video.duration;
              const progressBar =
                scrubTimeline.firstElementChild as HTMLElement;
              if (progressBar) {
                progressBar.style.width = `${progress * 100}%`;
              }
            }
          }
        }, 150);

        video.currentTime = newTime;
      });

      // Handle hover events for timeline display
      scrubOverlay.addEventListener('mouseenter', () => {
        isHovering = true;
        if (!showTimelineOnHover || !scrubTimeline || !video.duration) return;

        // Show timeline on hover
        scrubTimeline.style.opacity = '1';

        // Update progress bar to show current video time (only if not scrubbing)
        const videoState = videoStates.get(video);
        if (videoState && !videoState.isUserScrubbing) {
          const progress = video.currentTime / video.duration;
          const progressBar = scrubTimeline.firstElementChild as HTMLElement;
          if (progressBar) {
            progressBar.style.width = `${progress * 100}%`;
          }
        }
      });

      scrubOverlay.addEventListener('mouseleave', () => {
        isHovering = false;
        const videoState = videoStates.get(video);
        if (
          !showTimelineOnHover ||
          !scrubTimeline ||
          (videoState && videoState.isUserScrubbing)
        )
          return;

        // Hide timeline when not hovering (unless user is scrubbing)
        scrubTimeline.style.opacity = '0';
      });

      // Sync scroll position only on actual seek events (not during normal playback)
      video.addEventListener('seeked', () => {
        const videoState = videoStates.get(video);
        if (
          !video.duration ||
          !scrubOverlayScrollContent ||
          !scrubOverlay ||
          (videoState && videoState.isUserScrubbing)
        )
          return;

        const progress = video.currentTime / video.duration;
        const maxScroll =
          scrubOverlayScrollContent.offsetWidth - scrubOverlay.offsetWidth;
        // Apply inversion when setting scroll position
        const targetScroll = invertHorizontalScroll
          ? progress * maxScroll
          : (1 - progress) * maxScroll;

        scrubOverlay.scrollLeft = targetScroll;
      });

      // Update overlay size on window resize
      window.addEventListener('resize', updateOverlaySize);

      // Update overlay size when video dimensions change
      const resizeObserver = new ResizeObserver(updateOverlaySize);
      resizeObserver.observe(video);

      // Update timeline progress during hover when video is playing
      video.addEventListener('timeupdate', () => {
        const videoState = videoStates.get(video);
        if (
          !showTimelineOnHover ||
          !scrubTimeline ||
          (videoState && videoState.isUserScrubbing) ||
          !video.duration
        )
          return;

        // Only update if timeline is visible (user is hovering)
        if (scrubTimeline.style.opacity === '1') {
          const progress = video.currentTime / video.duration;
          const progressBar = scrubTimeline.firstElementChild as HTMLElement;
          if (progressBar) {
            progressBar.style.width = `${progress * 100}%`;
          }
        }
      });

      videoStates.set(video, {
        overlay: scrubOverlay,
        scrollContent: scrubOverlayScrollContent,
        timeline: scrubTimeline,
        wrapper: scrubWrapper,
        debugIndicator: debugIndicator,
        isUserScrubbing: false,
      });

      if (DEBUG_MODE) console.log('✅ Scrub overlay created successfully');
    };

    const checkForVideos = () => {
      if (DEBUG_MODE) console.log('🔍 Checking for video tags...');
      if (DEBUG_MODE) console.log('📍 Current URL:', window.location.href);
      if (DEBUG_MODE) console.log('📍 Page title:', document.title);

      // Check if extension should run
      if (!shouldRun()) {
        if (DEBUG_MODE)
          console.log(
            '🚫 Extension is disabled or current domain is not allowed by domain rules, skipping video check.'
          );
        return;
      }

      // Check in main document
      let videos = Array.from(document.querySelectorAll('video'));

      // Debug: log all video elements found
      if (DEBUG_MODE && videos.length > 0) {
        videos.forEach((video, index) => {
          console.log(`📺 Video ${index + 1}:`, {
            element: video,
            src: video.src,
            currentSrc: video.currentSrc,
            readyState: video.readyState,
            networkState: video.networkState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
            paused: video.paused,
            style: video.style.cssText,
            classes: video.className,
            id: video.id,
            hidden: video.hidden,
            offsetWidth: video.offsetWidth,
            offsetHeight: video.offsetHeight,
            parentElement: video.parentElement?.tagName,
            hasAttribute: video.hasAttribute('data-scrub-enabled'),
          });
        });
      }

      // Also check in iframes (common on video sites)
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeVideos = Array.from(
              iframeDoc.querySelectorAll('video')
            );
            videos = [...videos, ...iframeVideos];
          }
        } catch (e) {
          // Cross-origin iframe, can't access
          if (DEBUG_MODE)
            console.log('⚠️ Cross-origin iframe detected, skipping');
        }
      });

      // Check in shadow DOM
      const elementsWithShadow = document.querySelectorAll('*');
      elementsWithShadow.forEach((element) => {
        if (element.shadowRoot) {
          const shadowVideos = Array.from(
            element.shadowRoot.querySelectorAll('video')
          );
          videos = [...videos, ...shadowVideos];
        }
      });

      if (DEBUG_MODE)
        console.log(
          `📺 Found ${videos.length} video element(s) (including iframes and shadow DOM)`
        );

      if (videos.length > 0) {
        videos.forEach((video, index) => {
          try {
            // Check if video is visible and has dimensions
            const isVisible = video.offsetWidth > 0 && video.offsetHeight > 0;
            const hasAttribute = video.hasAttribute('data-scrub-enabled');

            if (DEBUG_MODE) {
              console.log(`📺 Video ${index + 1} analysis:`, {
                isVisible,
                hasAttribute,
                offsetWidth: video.offsetWidth,
                offsetHeight: video.offsetHeight,
                readyState: video.readyState,
              });
            }

            // Always try to create overlay if video is visible, even if attribute exists
            if (isVisible) {
              if (!hasAttribute) {
                if (DEBUG_MODE)
                  console.log(
                    `✅ Setting up scrub overlay for video ${index + 1}:`,
                    video
                  );
                createScrubOverlay(video as HTMLVideoElement);
                video.setAttribute('data-scrub-enabled', 'true');
              } else {
                // Force recreation if overlay doesn't exist but attribute is set
                const videoId = `video-${index}-${video.src || video.currentSrc || 'unknown'}`;
                const existingOverlay = document.querySelector(
                  `[data-video-id="${videoId}"]`
                );

                if (!existingOverlay) {
                  if (DEBUG_MODE)
                    console.log(
                      `🔄 Recreating missing overlay for video ${index + 1}:`,
                      video
                    );
                  // Remove attribute and recreate
                  video.removeAttribute('data-scrub-enabled');
                  createScrubOverlay(video as HTMLVideoElement);
                  video.setAttribute('data-scrub-enabled', 'true');
                } else {
                  if (DEBUG_MODE)
                    console.log(
                      `⏭️ Video ${index + 1} already has scrub overlay`
                    );
                }
              }
            } else {
              if (DEBUG_MODE)
                console.log(
                  `⚠️ Video ${index + 1} not visible, skipping overlay creation`
                );

              // Try again later for invisible videos
              setTimeout(() => {
                if (
                  video.offsetWidth > 0 &&
                  video.offsetHeight > 0 &&
                  !video.hasAttribute('data-scrub-enabled')
                ) {
                  if (DEBUG_MODE)
                    console.log(
                      `🔄 Retrying overlay creation for previously invisible video ${index + 1}`
                    );
                  createScrubOverlay(video as HTMLVideoElement);
                  video.setAttribute('data-scrub-enabled', 'true');
                }
              }, 1000);
            }
          } catch (error) {
            if (DEBUG_MODE)
              console.error(`❌ Error processing video ${index + 1}:`, error);
          }
        });
      } else {
        if (DEBUG_MODE) console.log('❌ No video elements found');
      }
    };

    // Watch for new video elements being added to DOM
    const observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any added nodes are video elements or contain video elements
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO') {
                if (DEBUG_MODE)
                  console.log('🆕 New video element detected:', element);
                hasNewVideos = true;
              } else if (element.querySelector('video')) {
                if (DEBUG_MODE)
                  console.log(
                    '🆕 New element containing video detected:',
                    element
                  );
                hasNewVideos = true;
              }
            }
          });
        }
      });

      if (hasNewVideos) {
        if (DEBUG_MODE)
          console.log('🔄 MutationObserver triggered video check');
        // Add small delay to let DOM settle
        setTimeout(() => {
          checkForVideos();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check when mouse moves (fallback for edge cases)
    let mouseCheckTimeout: number | null = null;
    document.addEventListener('mousemove', () => {
      // Throttle checks to avoid spam
      if (mouseCheckTimeout) return;

      mouseCheckTimeout = window.setTimeout(() => {
        if (DEBUG_MODE) console.log('🖱️ Mouse movement triggered video check');
        checkForVideos();
        mouseCheckTimeout = null;
      }, 1000); // Check at most every 1 second
    });
  },
});

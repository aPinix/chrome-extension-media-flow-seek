export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // console.log('🔴 Content script loaded for video scrubbing!');

    // Debug flag to control logging
    const DEBUG = false;

    let currentVideo: HTMLVideoElement | null = null;
    let scrubOverlay: HTMLDivElement | null = null;
    let scrubOverlayScrollContent: HTMLDivElement | null = null;
    let scrubTimeline: HTMLDivElement | null = null;
    let isUserScrubbing = false;

    // Extension enabled state
    let isEnabled = true;

    // Horizontal scroll inversion state
    let invertHorizontalScroll = false;

    // Timeline hover state
    let showTimelineOnHover = false;

    // Timeline height state
    const timelineDefaultHeight = 6;
    let timelineHeight = timelineDefaultHeight;

    // Domain rules with whitelist/blacklist/wildcard support
    let domainRules = [
      { domain: '*', type: 'blacklist', enabled: true },
      { domain: 'youtube.com', type: 'whitelist', enabled: true },
      { domain: 'vimeo.com', type: 'whitelist', enabled: false },
      { domain: 'dailymotion.com', type: 'whitelist', enabled: false },
      { domain: 'twitch.tv', type: 'whitelist', enabled: false },
      { domain: 'tiktok.com', type: 'whitelist', enabled: false },
      { domain: 'instagram.com', type: 'whitelist', enabled: false },
      { domain: 'facebook.com', type: 'whitelist', enabled: false },
      { domain: 'x.com', type: 'whitelist', enabled: false },
    ];

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
        } else if (currentHostname.includes(rule.domain.toLowerCase())) {
          // Specific domain rule takes precedence
          shouldRunDomain = rule.type === 'whitelist';
          break;
        }
      }

      return shouldRunDomain;
    };

    // Default domain rules
    const getDefaultDomainRules = () => [
      { domain: '*', type: 'blacklist', enabled: true },
      { domain: 'youtube.com', type: 'whitelist', enabled: true },
      { domain: 'vimeo.com', type: 'whitelist', enabled: false },
      { domain: 'dailymotion.com', type: 'whitelist', enabled: false },
      { domain: 'twitch.tv', type: 'whitelist', enabled: false },
      { domain: 'tiktok.com', type: 'whitelist', enabled: false },
      { domain: 'instagram.com', type: 'whitelist', enabled: false },
      { domain: 'facebook.com', type: 'whitelist', enabled: false },
      { domain: 'x.com', type: 'whitelist', enabled: false },
    ];

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

    // Load settings
    const loadSettings = () => {
      chrome.storage.sync.get(
        [
          'isEnabled',
          'invertHorizontalScroll',
          'showTimelineOnHover',
          'timelineHeight',
          'domainRules',
        ],
        (result) => {
          isEnabled = result.isEnabled ?? true;
          invertHorizontalScroll = result.invertHorizontalScroll ?? false;
          showTimelineOnHover = result.showTimelineOnHover ?? false;
          timelineHeight = result.timelineHeight ?? timelineDefaultHeight;

          const existingRules = result.domainRules;
          domainRules = existingRules
            ? mergeDomainRules(existingRules)
            : getDefaultDomainRules();

          if (DEBUG) {
            console.log('📜 Loaded extension enabled setting:', isEnabled);
            console.log(
              '📜 Loaded scroll inversion setting:',
              invertHorizontalScroll
            );
            console.log(
              '📜 Loaded timeline hover setting:',
              showTimelineOnHover
            );
            console.log('📜 Loaded timeline height setting:', timelineHeight);
            console.log('📜 Loaded domain rules:', domainRules);
          }
        }
      );
    };

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateEnabled') {
        isEnabled = message.isEnabled;
        if (DEBUG)
          console.log('📤 Updated extension enabled from popup:', isEnabled);

        if (!isEnabled) {
          // Remove existing overlays when disabled
          if (DEBUG) console.log('🚫 Extension disabled, removing overlays');
          const existingOverlays = document.querySelectorAll('.scrub-wrapper');
          existingOverlays.forEach((overlay) => overlay.remove());

          // Remove scrub-enabled attributes
          const videos = document.querySelectorAll('video[data-scrub-enabled]');
          videos.forEach((video) =>
            video.removeAttribute('data-scrub-enabled')
          );
        } else {
          // Extension is enabled, check for videos again
          if (DEBUG) console.log('✅ Extension enabled, checking for videos');
          setTimeout(() => checkForVideos(), 100);
        }

        sendResponse({ success: true });
      } else if (message.action === 'updateScrollInversion') {
        invertHorizontalScroll = message.invertHorizontalScroll;
        if (DEBUG)
          console.log(
            '📤 Updated scroll inversion from popup:',
            invertHorizontalScroll
          );
        sendResponse({ success: true });
      } else if (message.action === 'updateTimelineHover') {
        showTimelineOnHover = message.showTimelineOnHover;
        if (DEBUG)
          console.log(
            '📤 Updated timeline hover from popup:',
            showTimelineOnHover
          );
        sendResponse({ success: true });
      } else if (message.action === 'updateTimelineHeight') {
        timelineHeight = message.timelineHeight;
        if (DEBUG)
          console.log('📤 Updated timeline height from popup:', timelineHeight);

        // Update existing timelines if any
        if (scrubTimeline) {
          scrubTimeline.style.height = `${timelineHeight}px`;
          // Update position to account for new height
          const video = currentVideo;
          if (video) {
            const videoRect = video.getBoundingClientRect();
            const videoContainer = video.parentElement || document.body;
            const containerRect = videoContainer.getBoundingClientRect();
            const relativeTop = videoRect.top - containerRect.top;
            scrubTimeline.style.top = `${relativeTop + video.offsetHeight - timelineHeight}px`;
          }
        }

        sendResponse({ success: true });
      } else if (message.action === 'updateDomainRules') {
        domainRules = message.domainRules;
        if (DEBUG)
          console.log('📤 Updated domain rules from popup:', domainRules);

        // Check if extension should run with new rules
        if (!shouldRun()) {
          if (DEBUG)
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
        } else {
          // Domain is now allowed, check for videos again
          if (DEBUG)
            console.log(
              '✅ Current domain is now allowed, checking for videos'
            );
          setTimeout(() => checkForVideos(), 100);
        }

        sendResponse({ success: true });
      }
    });

    // Initialize settings
    loadSettings();

    // Get domain-specific color for progress bar
    const getProgressColor = (): string => {
      const hostname = window.location.hostname.toLowerCase();

      if (hostname.includes('youtube.com')) return '#ff0000';
      if (hostname.includes('vimeo.com')) return '#1ab7ea';
      if (hostname.includes('dailymotion.com')) return '#0066cc';
      if (hostname.includes('twitch.tv')) return '#9146ff';
      if (hostname.includes('tiktok.com')) return '#ff0050';
      if (hostname.includes('instagram.com')) return '#e4405f';
      if (hostname.includes('facebook.com')) return '#1877f2';
      // if (hostname.includes('netflix.com')) return '#e50914'
      // if (hostname.includes('hulu.com')) return '#1ce783'
      if (hostname.includes('x.com') || hostname.includes('twitter.com'))
        return '#1da1f2';

      return 'rgb(255 255 255 / 0.8)'; // Default white with 80% opacity
    };

    const getDebugColorBackground = () => {
      return DEBUG
        ? `
        background-color: rgb(from ${getProgressColor()} r g b / 0.1);
      `
        : '';
    };

    const getDebugImageBackground = () => {
      return DEBUG
        ? `
        background-size: 16px 16px;
        background-image: repeating-linear-gradient(
          315deg,
          rgb(from ${getProgressColor()} r g b / 0.3) 0 1px,
          #0000 0 50%
        );
      `
        : '';
    };

    const createScrubOverlay = (video: HTMLVideoElement) => {
      if (DEBUG) console.log('🎯 Creating scrub overlay for video:', video);

      // Remove existing overlay if any
      if (scrubOverlay) {
        if (DEBUG) console.log('🗑️ Removing existing overlay');
        scrubOverlay.remove();
      }

      // Track hover state for timeline display
      let isHovering = false;

      // Track when user is actively scrubbing
      let scrubTimeout: number | null = null;
      let needsScrollSync = true;
      let isSettingInitialScroll = false;

      // Create overlay div
      scrubOverlay = document.createElement('div');
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

      // Create content div that represents video length
      scrubOverlayScrollContent = document.createElement('div');
      scrubOverlayScrollContent.style.cssText = `
        height: 100%;
        min-width: 100%;
        background-color: rgb(0 0 0 / 0);
        ${getDebugImageBackground()}
      `;

      scrubOverlay.appendChild(scrubOverlayScrollContent);
      scrubOverlayScrollContent.classList.add('scrub-overlay-scroll-content');

      // Create timeline bar that appears during scrubbing
      scrubTimeline = document.createElement('div');
      scrubTimeline.style.cssText = `
        width: 100%;
        height: ${timelineHeight}px;
        position: absolute;
        left: 0px;
        top: calc(100% - ${timelineHeight}px);
        background: rgb(255 255 255 / 0.3);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Create progress indicator within timeline
      const scrubTimelineProgressIndicator = document.createElement('div');
      scrubTimelineProgressIndicator.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: ${getProgressColor()};
      `;

      scrubTimeline.appendChild(scrubTimelineProgressIndicator);
      scrubTimeline.classList.add('scrub-timeline');
      scrubTimelineProgressIndicator.classList.add(
        'scrub-timeline-progress-indicator'
      );

      // Position overlay over video with exact video dimensions
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

      // Remove existing scrub wrapper if it exists
      const existingScrubWrapper =
        videoContainer.querySelector('.scrub-wrapper');
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

      // Add all scrub elements to wrapper
      scrubWrapper.appendChild(scrubOverlay);
      scrubWrapper.appendChild(scrubTimeline);

      // Add wrapper to video container
      videoContainer.appendChild(scrubWrapper);

      // Function to update wrapper size and position to match video
      const updateOverlaySize = () => {
        const wrapper = videoContainer.querySelector(
          '.scrub-wrapper'
        ) as HTMLElement;
        if (!wrapper || !video || !scrubOverlay || !scrubTimeline) return;

        const videoRect = video.getBoundingClientRect();
        const containerRect = videoContainer.getBoundingClientRect();
        const relativeTop = videoRect.top - containerRect.top;
        const relativeLeft = videoRect.left - containerRect.left;

        // Update only the wrapper to match video size and position
        wrapper.style.top = `${relativeTop}px`;
        wrapper.style.left = `${relativeLeft}px`;
        wrapper.style.width = `${video.offsetWidth}px`;
        wrapper.style.height = `${video.offsetHeight}px`;
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

          // Set initial scroll position right after width is applied
          setTimeout(() => {
            if (!scrubOverlay || !scrubOverlayScrollContent) return;

            if (finalWidth <= 0) return;

            // Prevent scroll listener from interfering with initial position
            isSettingInitialScroll = true;
            needsScrollSync = false;

            // Set scroll position based on invert setting
            if (invertHorizontalScroll) {
              scrubOverlay.scrollLeft = 1; // Start at position 1 when inverted
            } else {
              scrubOverlay.scrollLeft = finalWidth - 1; // Start at end - 1 when not inverted
            }

            // Reset flag after setting
            setTimeout(() => {
              isSettingInitialScroll = false;
            }, 50);

            if (DEBUG) {
              console.log(
                '✅ Initial scroll position set after width update:',
                {
                  scrollLeft: scrubOverlay.scrollLeft,
                  maxScroll: finalWidth,
                  invertHorizontalScroll,
                }
              );
            }
          }, 500);
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

        // Sync scroll position to current video time when user starts scrolling
        if (needsScrollSync && !isUserScrubbing && scrubOverlay) {
          const progress = video.currentTime / video.duration;
          const maxScroll =
            scrubOverlayScrollContent.offsetWidth - scrubOverlay.offsetWidth;
          // Apply inversion when setting scroll position
          const targetScroll = invertHorizontalScroll
            ? progress * maxScroll
            : (1 - progress) * maxScroll;
          scrubOverlay.scrollLeft = targetScroll;
          needsScrollSync = false;
        }

        isUserScrubbing = true;

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
          isUserScrubbing = false;
          needsScrollSync = true; // Reset sync flag when user stops scrubbing

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
        if (!isUserScrubbing) {
          const progress = video.currentTime / video.duration;
          const progressBar = scrubTimeline.firstElementChild as HTMLElement;
          if (progressBar) {
            progressBar.style.width = `${progress * 100}%`;
          }
        }
      });

      scrubOverlay.addEventListener('mouseleave', () => {
        isHovering = false;
        if (!showTimelineOnHover || !scrubTimeline || isUserScrubbing) return;

        // Hide timeline when not hovering (unless user is scrubbing)
        scrubTimeline.style.opacity = '0';
      });

      // Sync scroll position only on actual seek events (not during normal playback)
      video.addEventListener('seeked', () => {
        if (
          !video.duration ||
          !scrubOverlayScrollContent ||
          !scrubOverlay ||
          isUserScrubbing
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
        needsScrollSync = true; // Reset sync flag when video is seeked
      });

      // Update overlay size on window resize
      window.addEventListener('resize', updateOverlaySize);

      // Update overlay size when video dimensions change
      const resizeObserver = new ResizeObserver(updateOverlaySize);
      resizeObserver.observe(video);

      // Update timeline progress during hover when video is playing
      video.addEventListener('timeupdate', () => {
        if (
          !showTimelineOnHover ||
          !scrubTimeline ||
          isUserScrubbing ||
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

      currentVideo = video;

      if (DEBUG) console.log('✅ Scrub overlay created successfully');
    };

    const checkForVideos = () => {
      if (DEBUG) console.log('🔍 Checking for video tags...');
      if (DEBUG) console.log('📍 Current URL:', window.location.href);
      if (DEBUG) console.log('📍 Page title:', document.title);

      // Check if extension should run
      if (!shouldRun()) {
        if (DEBUG)
          console.log(
            '🚫 Extension is disabled or current domain is not allowed by domain rules, skipping video check.'
          );
        return;
      }

      // Check in main document
      let videos = Array.from(document.querySelectorAll('video'));

      // Debug: log all video elements found
      if (DEBUG && videos.length > 0) {
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
          if (DEBUG) console.log('⚠️ Cross-origin iframe detected, skipping');
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

      if (DEBUG)
        console.log(
          `📺 Found ${videos.length} video element(s) (including iframes and shadow DOM)`
        );

      if (videos.length > 0) {
        videos.forEach((video, index) => {
          try {
            // Check if video is visible and has dimensions
            const isVisible = video.offsetWidth > 0 && video.offsetHeight > 0;
            const hasAttribute = video.hasAttribute('data-scrub-enabled');

            if (DEBUG) {
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
                if (DEBUG)
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
                  if (DEBUG)
                    console.log(
                      `🔄 Recreating missing overlay for video ${index + 1}:`,
                      video
                    );
                  // Remove attribute and recreate
                  video.removeAttribute('data-scrub-enabled');
                  createScrubOverlay(video as HTMLVideoElement);
                  video.setAttribute('data-scrub-enabled', 'true');
                } else {
                  if (DEBUG)
                    console.log(
                      `⏭️ Video ${index + 1} already has scrub overlay`
                    );
                }
              }
            } else {
              if (DEBUG)
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
                  if (DEBUG)
                    console.log(
                      `🔄 Retrying overlay creation for previously invisible video ${index + 1}`
                    );
                  createScrubOverlay(video as HTMLVideoElement);
                  video.setAttribute('data-scrub-enabled', 'true');
                }
              }, 1000);
            }
          } catch (error) {
            if (DEBUG)
              console.error(`❌ Error processing video ${index + 1}:`, error);
          }
        });
      } else {
        if (DEBUG) console.log('❌ No video elements found');
      }
    };

    // Check immediately when script runs
    checkForVideos();

    // Check again after a short delay for async content
    setTimeout(() => {
      if (DEBUG) console.log('🕐 Delayed video check (500ms)');
      checkForVideos();
    }, 500);

    // Check again after 2 seconds for heavily async sites
    setTimeout(() => {
      if (DEBUG) console.log('🕐 Delayed video check (2s)');
      checkForVideos();
    }, 2000);

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
                if (DEBUG)
                  console.log('🆕 New video element detected:', element);
                hasNewVideos = true;
              } else if (element.querySelector('video')) {
                if (DEBUG)
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
        if (DEBUG) console.log('🔄 MutationObserver triggered video check');
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
        if (DEBUG) console.log('🖱️ Mouse movement triggered video check');
        checkForVideos();
        mouseCheckTimeout = null;
      }, 1000); // Check at most every 1 second
    });
  },
});

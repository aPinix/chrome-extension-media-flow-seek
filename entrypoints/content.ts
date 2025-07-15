export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // console.log('🔴 Content script loaded for video scrubbing!');

    // Debug flag to control logging
    const DEBUG = false;

    let currentVideo: HTMLVideoElement | null = null;
    let scrubOverlay: HTMLDivElement | null = null;
    let scrubContent: HTMLDivElement | null = null;
    let scrubTimeline: HTMLDivElement | null = null;
    let isUserScrubbing = false;

    // Horizontal scroll inversion state
    let invertHorizontalScroll = false;

    // Load horizontal scroll inversion setting
    const loadScrollInversionSetting = () => {
      chrome.storage.sync.get(['invertHorizontalScroll'], (result) => {
        invertHorizontalScroll = result.invertHorizontalScroll || false;
        if (DEBUG)
          console.log(
            '📜 Loaded scroll inversion setting:',
            invertHorizontalScroll
          );
      });
    };

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateScrollInversion') {
        invertHorizontalScroll = message.invertHorizontalScroll;
        if (DEBUG)
          console.log(
            '📤 Updated scroll inversion from popup:',
            invertHorizontalScroll
          );
        sendResponse({ success: true });
      }
    });

    // Add horizontal scroll inversion logic
    const addScrollInversionListener = () => {
      document.addEventListener(
        'wheel',
        (e) => {
          if (!invertHorizontalScroll) return;

          // Only intercept horizontal scroll events
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();

            // Invert the horizontal scroll direction
            const invertedDeltaX = -e.deltaX;

            // Find the scrollable element
            let target = e.target as Element;
            while (target && target !== document.body) {
              const style = window.getComputedStyle(target);
              const overflowX = style.overflowX;

              if (overflowX === 'auto' || overflowX === 'scroll') {
                // Apply inverted scroll
                target.scrollLeft += invertedDeltaX;
                return;
              }
              target = target.parentElement!;
            }

            // If no scrollable parent found, scroll the window
            window.scrollBy(invertedDeltaX, 0);
          }
        },
        { passive: false }
      );
    };

    // Initialize scroll inversion
    loadScrollInversionSetting();
    addScrollInversionListener();

    // Get domain-specific color for progress bar
    const getProgressColor = (): string => {
      const hostname = window.location.hostname.toLowerCase();

      if (hostname.includes('youtube.com')) return '#ff0000'; // YouTube red
      if (hostname.includes('vimeo.com')) return '#1ab7ea'; // Vimeo blue
      if (hostname.includes('twitch.tv')) return '#9146ff'; // Twitch purple
      if (hostname.includes('netflix.com')) return '#e50914'; // Netflix red
      if (hostname.includes('dailymotion.com')) return '#0066cc'; // Dailymotion blue
      if (hostname.includes('hulu.com')) return '#1ce783'; // Hulu green
      if (hostname.includes('tiktok.com')) return '#ff0050'; // TikTok pink
      if (hostname.includes('instagram.com')) return '#e4405f'; // Instagram pink
      if (hostname.includes('facebook.com')) return '#1877f2'; // Facebook blue
      if (hostname.includes('twitter.com') || hostname.includes('x.com'))
        return '#1da1f2'; // Twitter blue

      return 'rgba(255, 255, 255, 0.8)'; // Default white with 80% opacity
    };

    const createScrubOverlay = (video: HTMLVideoElement) => {
      if (DEBUG) console.log('🎯 Creating scrub overlay for video:', video);

      // Remove existing overlay if any
      if (scrubOverlay) {
        if (DEBUG) console.log('🗑️ Removing existing overlay');
        scrubOverlay.remove();
      }

      // Create overlay div
      scrubOverlay = document.createElement('div');
      scrubOverlay.style.cssText = `
        position: absolute;
        overflow-x: auto;
        overflow-y: hidden;
        background: rgba(0, 0, 0, 0);
        // box-shadow: inset 0 0 0 5px red;
        z-index: 1000;
        pointer-events: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      `;

      // Hide scrollbar for WebKit browsers
      scrubOverlay.style.setProperty('scrollbar-width', 'none');
      scrubOverlay.style.setProperty('-ms-overflow-style', 'none');

      // Add WebKit scrollbar hiding styles
      const style = document.createElement('style');
      style.textContent = `
        .scrub-overlay::-webkit-scrollbar {
          display: none;
        }
      `;
      document.head.appendChild(style);
      scrubOverlay.classList.add('scrub-overlay');

      // Create content div that represents video length
      scrubContent = document.createElement('div');
      scrubContent.style.cssText = `
        height: 100%;
        background: rgba(0, 0, 0, 0);
        min-width: 100%;
      `;

      scrubOverlay.appendChild(scrubContent);

      // Create timeline bar that appears during scrubbing
      scrubTimeline = document.createElement('div');
      scrubTimeline.style.cssText = `
        position: absolute;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Create progress indicator within timeline
      const progressIndicator = document.createElement('div');
      progressIndicator.style.cssText = `
        height: 100%;
        background: ${getProgressColor()};
        width: 0%;
        transition: width 0.1s ease;
      `;

      scrubTimeline.appendChild(progressIndicator);

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

      // Set overlay to exact video size and position
      scrubOverlay.style.width = `${video.offsetWidth}px`;
      scrubOverlay.style.height = `${video.offsetHeight}px`;
      scrubOverlay.style.top = `${relativeTop}px`;
      scrubOverlay.style.left = `${relativeLeft}px`;

      // Set initial timeline position (full width bar at bottom)
      scrubTimeline.style.left = `${relativeLeft}px`;
      scrubTimeline.style.top = `${relativeTop + video.offsetHeight - 4}px`;
      scrubTimeline.style.width = `${video.offsetWidth}px`;

      videoContainer.appendChild(scrubOverlay);
      videoContainer.appendChild(scrubTimeline);

      // Function to update overlay size and position
      const updateOverlaySize = () => {
        if (!scrubOverlay || !video || !scrubTimeline) return;

        const videoRect = video.getBoundingClientRect();
        const containerRect = videoContainer.getBoundingClientRect();
        const relativeTop = videoRect.top - containerRect.top;
        const relativeLeft = videoRect.left - containerRect.left;

        scrubOverlay.style.width = `${video.offsetWidth}px`;
        scrubOverlay.style.height = `${video.offsetHeight}px`;
        scrubOverlay.style.top = `${relativeTop}px`;
        scrubOverlay.style.left = `${relativeLeft}px`;

        // Update timeline bar position (full width at bottom)
        scrubTimeline.style.left = `${relativeLeft}px`;
        scrubTimeline.style.top = `${relativeTop + video.offsetHeight - 4}px`;
        scrubTimeline.style.width = `${video.offsetWidth}px`;
      };

      // Update content width based on video duration
      const updateContentWidth = () => {
        if (video.duration && scrubContent && scrubOverlay) {
          // Make content width proportional to video duration
          // Base width multiplied by duration in minutes
          const baseWidth = video.offsetWidth;
          const durationMinutes = video.duration / 60;
          const contentWidth = Math.max(baseWidth, baseWidth * durationMinutes);
          scrubContent.style.width = `${contentWidth}px`;
        }
      };

      // Set initial width
      updateContentWidth();

      // Update width when video metadata loads
      video.addEventListener('loadedmetadata', updateContentWidth);

      // Track when user is actively scrubbing
      let scrubTimeout: number | null = null;

      // Handle scrolling to scrub video
      scrubOverlay.addEventListener('scroll', () => {
        if (!video.duration || !scrubContent || !scrubTimeline) return;

        isUserScrubbing = true;

        const scrollLeft = scrubOverlay!.scrollLeft;
        const maxScroll = scrubContent.offsetWidth - scrubOverlay!.offsetWidth;
        const scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
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

          // Hide timeline
          if (scrubTimeline) {
            scrubTimeline.style.opacity = '0';
          }
        }, 150);

        video.currentTime = newTime;
      });

      // Sync scroll position only on actual seek events (not during normal playback)
      video.addEventListener('seeked', () => {
        if (
          !video.duration ||
          !scrubContent ||
          !scrubOverlay ||
          isUserScrubbing
        )
          return;

        const progress = video.currentTime / video.duration;
        const maxScroll = scrubContent.offsetWidth - scrubOverlay.offsetWidth;
        const targetScroll = progress * maxScroll;

        scrubOverlay.scrollLeft = targetScroll;
      });

      // Update overlay size on window resize
      window.addEventListener('resize', updateOverlaySize);

      // Update overlay size when video dimensions change
      const resizeObserver = new ResizeObserver(updateOverlaySize);
      resizeObserver.observe(video);

      currentVideo = video;

      if (DEBUG) console.log('✅ Scrub overlay created successfully');
    };

    const checkForVideos = () => {
      if (DEBUG) console.log('🔍 Checking for video tags...');
      if (DEBUG) console.log('📍 Current URL:', window.location.href);
      if (DEBUG) console.log('📍 Page title:', document.title);

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
          if (!video.hasAttribute('data-scrub-enabled')) {
            if (DEBUG)
              console.log(
                `✅ Setting up scrub overlay for video ${index + 1}:`,
                video
              );
            createScrubOverlay(video as HTMLVideoElement);
            video.setAttribute('data-scrub-enabled', 'true');
          } else {
            if (DEBUG)
              console.log(`⏭️ Video ${index + 1} already has scrub overlay`);
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

import { DOMCheckOptionsT } from '@/types/content';

export class DOMUtils {
  static findAllVideos(): HTMLVideoElement[] {
    // Check in main document
    let videos = Array.from(
      document.querySelectorAll('video')
    ) as HTMLVideoElement[];

    // Also check in iframes (common on video sites)
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeVideos = Array.from(
            iframeDoc.querySelectorAll('video')
          ) as HTMLVideoElement[];
          videos = [...videos, ...iframeVideos];
        }
      } catch (e) {
        // Cross-origin iframe, can't access
      }
    });

    // Check in shadow DOM
    const elementsWithShadow = document.querySelectorAll('*');
    elementsWithShadow.forEach((element) => {
      if (element.shadowRoot) {
        const shadowVideos = Array.from(
          element.shadowRoot.querySelectorAll('video')
        ) as HTMLVideoElement[];
        videos = [...videos, ...shadowVideos];
      }
    });

    return videos;
  }

  static isVideoVisible(video: HTMLVideoElement): boolean {
    return video.offsetWidth > 0 && video.offsetHeight > 0;
  }

  static hasOverlayAttribute(video: HTMLVideoElement): boolean {
    return video.hasAttribute('data-scrub-enabled');
  }

  static setOverlayAttribute(
    video: HTMLVideoElement,
    value: boolean = true
  ): void {
    if (value) {
      video.setAttribute('data-scrub-enabled', 'true');
    } else {
      video.removeAttribute('data-scrub-enabled');
    }
  }

  static removeExistingScrubWrappers(): void {
    const existingOverlays = document.querySelectorAll('.scrub-wrapper');
    existingOverlays.forEach((overlay) => overlay.remove());
  }

  static removeOverlayAttributes(): void {
    const videos = document.querySelectorAll('video[data-scrub-enabled]');
    videos.forEach((video) => video.removeAttribute('data-scrub-enabled'));
  }

  static generateVideoId(video: HTMLVideoElement, index: number): string {
    return `video-${index}-${video.src || video.currentSrc || 'unknown'}`;
  }

  static findExistingOverlay(videoId: string): Element | null {
    return document.querySelector(`[data-video-id="${videoId}"]`);
  }

  static checkForVideos(options: DOMCheckOptionsT): void {
    const { debugMode, shouldRun, createOverlay } = options;

    if (debugMode) {
      console.log('🔍 Checking for video tags...');
      console.log('📍 Current URL:', window.location.href);
      console.log('📍 Page title:', document.title);
    }

    // Check if extension should run
    if (!shouldRun()) {
      if (debugMode) {
        console.log(
          '🚫 Extension is disabled or current domain is not allowed by domain rules, skipping video check.'
        );
      }
      return;
    }

    const videos = DOMUtils.findAllVideos();

    // Debug: log all video elements found
    if (debugMode && videos.length > 0) {
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
          hasAttribute: DOMUtils.hasOverlayAttribute(video),
        });
      });
    }

    if (debugMode) {
      console.log(
        `📺 Found ${videos.length} video element(s) (including iframes and shadow DOM)`
      );
    }

    if (videos.length > 0) {
      videos.forEach((video, index) => {
        try {
          const isVisible = DOMUtils.isVideoVisible(video);
          const hasAttribute = DOMUtils.hasOverlayAttribute(video);

          if (debugMode) {
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
              if (debugMode) {
                console.log(
                  `✅ Setting up scrub overlay for video ${index + 1}:`,
                  video
                );
              }
              createOverlay(video);
              DOMUtils.setOverlayAttribute(video, true);
            } else {
              // Force recreation if overlay doesn't exist but attribute is set
              const videoId = DOMUtils.generateVideoId(video, index);
              const existingOverlay = DOMUtils.findExistingOverlay(videoId);

              if (!existingOverlay) {
                if (debugMode) {
                  console.log(
                    `🔄 Recreating missing overlay for video ${index + 1}:`,
                    video
                  );
                }
                // Remove attribute and recreate
                DOMUtils.setOverlayAttribute(video, false);
                createOverlay(video);
                DOMUtils.setOverlayAttribute(video, true);
              } else {
                if (debugMode) {
                  console.log(
                    `⏭️ Video ${index + 1} already has scrub overlay`
                  );
                }
              }
            }
          } else {
            if (debugMode) {
              console.log(
                `⚠️ Video ${index + 1} not visible, skipping overlay creation`
              );
            }

            // Try again later for invisible videos
            setTimeout(() => {
              if (
                DOMUtils.isVideoVisible(video) &&
                !DOMUtils.hasOverlayAttribute(video)
              ) {
                if (debugMode) {
                  console.log(
                    `🔄 Retrying overlay creation for previously invisible video ${index + 1}`
                  );
                }
                createOverlay(video);
                DOMUtils.setOverlayAttribute(video, true);
              }
            }, 1000);
          }
        } catch (error) {
          if (debugMode) {
            console.error(`❌ Error processing video ${index + 1}:`, error);
          }
        }
      });
    } else {
      if (debugMode) {
        console.log('❌ No video elements found');
      }
    }
  }

  static observeNewVideos(
    callback: () => void,
    debugMode: boolean = false
  ): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any added nodes are video elements or contain video elements
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO') {
                if (debugMode) {
                  console.log('🆕 New video element detected:', element);
                }
                hasNewVideos = true;
              } else if (element.querySelector('video')) {
                if (debugMode) {
                  console.log(
                    '🆕 New element containing video detected:',
                    element
                  );
                }
                hasNewVideos = true;
              }
            }
          });
        }
      });

      if (hasNewVideos) {
        if (debugMode) {
          console.log('🔄 MutationObserver triggered video check');
        }
        // Add small delay to let DOM settle
        setTimeout(callback, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  static createMouseCheckThrottler(
    callback: () => void,
    debugMode: boolean = false
  ): () => void {
    let mouseCheckTimeout: number | null = null;

    return () => {
      // Throttle checks to avoid spam
      if (mouseCheckTimeout) return;

      mouseCheckTimeout = window.setTimeout(() => {
        if (debugMode) {
          console.log('🖱️ Mouse movement triggered video check');
        }
        callback();
        mouseCheckTimeout = null;
      }, 1000); // Check at most every 1 second
    };
  }
}

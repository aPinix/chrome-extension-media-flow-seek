import type { DOMCheckOptionsT } from '@/types/content';

const YOUTUBE_HOVER_PREVIEW_SELECTOR = [
  'ytd-moving-thumbnail-renderer',
  'ytd-thumbnail',
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-reel-item-renderer',
  'yt-lockup-view-model',
  '.yt-lockup-view-model',
  'yt-thumbnail-view-model',
  '.yt-thumbnail-view-model',
  'a#thumbnail',
].join(',');

// biome-ignore lint/complexity/noStaticOnlyClass: This class owns shared DOM discovery state as well as its related operations.
export class DOMUtils {
  private static shadowRoots = new Set<ShadowRoot>();
  private static hasScannedDocumentForShadowRoots = false;
  private static observedRoots = new WeakSet<Document | ShadowRoot>();
  private static visibilityObserver: ResizeObserver | null = null;
  private static visibilityCallbacks = new WeakMap<
    HTMLVideoElement,
    () => void
  >();

  private static getSearchRoots(): Array<Document | ShadowRoot> {
    const roots: Array<Document | ShadowRoot> = [document];

    for (const shadowRoot of DOMUtils.shadowRoots) {
      if (!shadowRoot.host.isConnected) {
        DOMUtils.shadowRoots.delete(shadowRoot);
        continue;
      }

      roots.push(shadowRoot);
    }

    return roots;
  }

  private static discoverShadowRoots(
    root: Document | ShadowRoot | Element
  ): void {
    const elements: Element[] = [];

    if (root instanceof Element) {
      elements.push(root);
    }
    elements.push(...Array.from(root.querySelectorAll('*')));

    elements.forEach((element) => {
      if (!element.shadowRoot || DOMUtils.shadowRoots.has(element.shadowRoot)) {
        return;
      }

      DOMUtils.shadowRoots.add(element.shadowRoot);
      DOMUtils.discoverShadowRoots(element.shadowRoot);
    });
  }

  static findAllVideos(): HTMLVideoElement[] {
    if (!DOMUtils.hasScannedDocumentForShadowRoots) {
      DOMUtils.discoverShadowRoots(document);
      DOMUtils.hasScannedDocumentForShadowRoots = true;
    }

    const videos = DOMUtils.getSearchRoots().flatMap((root) =>
      Array.from(root.querySelectorAll('video'))
    );

    return Array.from(new Set(videos));
  }

  static isVideoVisible(video: HTMLVideoElement): boolean {
    const rect = video.getBoundingClientRect();
    return video.isConnected && rect.width > 0 && rect.height > 0;
  }

  /**
   * YouTube creates short-lived videos inside grid/search/sidebar thumbnail
   * links to implement its native hover previews. Inserting an interaction
   * layer into those renderers can become the pointer target before YouTube's
   * hover controller, causing the preview to stop or never start.
   */
  static isYouTubeHoverPreview(video: HTMLVideoElement): boolean {
    if (video.closest(YOUTUBE_HOVER_PREVIEW_SELECTOR)) return true;

    const hostname = video.ownerDocument.location.hostname.toLowerCase();
    const isYouTube =
      hostname === 'youtube.com' || hostname.endsWith('.youtube.com');

    // YouTube has multiple concurrently deployed card implementations. Their
    // tag/class names change, but thumbnail preview videos remain descendants
    // of the card's navigation link. The watch-page and Shorts players are not
    // nested in anchors.
    return isYouTube && video.closest('a[href]') !== null;
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
    DOMUtils.getSearchRoots().forEach((root) => {
      root.querySelectorAll('.scrub-wrapper').forEach((overlay) => {
        overlay.remove();
      });
    });
  }

  static removeOverlayAttributes(): void {
    DOMUtils.getSearchRoots().forEach((root) => {
      root
        .querySelectorAll(
          'video[data-scrub-enabled], video[data-mfs-hide-controls]'
        )
        .forEach((video) => {
          video.removeAttribute('data-scrub-enabled');
          video.removeAttribute('data-mfs-hide-controls');
        });
      root
        .querySelectorAll(
          '[data-mfs-hide-controls-container], [data-mfs-instagram-player], [data-mfs-instagram-chrome], [data-mfs-tiktok-player]'
        )
        .forEach((container) => {
          container.removeAttribute('data-mfs-hide-controls-container');
          container.removeAttribute('data-mfs-instagram-player');
          container.removeAttribute('data-mfs-instagram-chrome');
          container.removeAttribute('data-mfs-tiktok-player');
        });
    });
  }

  static checkForVideos(options: DOMCheckOptionsT): void {
    const { debugMode, shouldRun, hasOverlay, createOverlay } = options;

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
          const hasConnectedOverlay = hasOverlay(video);
          const isYouTubeHoverPreview = DOMUtils.isYouTubeHoverPreview(video);

          if (debugMode) {
            console.log(`📺 Video ${index + 1} analysis:`, {
              isVisible,
              hasAttribute,
              hasConnectedOverlay,
              isYouTubeHoverPreview,
              offsetWidth: video.offsetWidth,
              offsetHeight: video.offsetHeight,
              readyState: video.readyState,
            });
          }

          // The state manager is the source of truth. Sites frequently clone video
          // nodes or remove extension DOM while leaving element attributes intact.
          if (isVisible) {
            if (!hasConnectedOverlay) {
              if (debugMode) {
                console.log(
                  `✅ Setting up scrub overlay for video ${index + 1}:`,
                  video
                );
              }
              createOverlay(video);
              DOMUtils.setOverlayAttribute(video, true);
            } else {
              if (debugMode) {
                console.log(`⏭️ Video ${index + 1} already has scrub overlay`);
              }
            }
          } else {
            if (debugMode) {
              console.log(
                `⚠️ Video ${index + 1} not visible, skipping overlay creation`
              );
            }

            DOMUtils.observeUntilVisible(video, () => {
              if (!shouldRun() || hasOverlay(video)) return;

              if (debugMode) {
                console.log(
                  `🔄 Retrying overlay creation for previously invisible video ${index + 1}`
                );
              }
              options.createOverlay(video);
              DOMUtils.setOverlayAttribute(video, true);
            });
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
    const observeRoot = (
      root: Document | ShadowRoot
    ): MutationObserver | null => {
      if (DOMUtils.observedRoots.has(root)) return null;
      DOMUtils.observedRoots.add(root);

      const observer = new MutationObserver((mutations) => {
        let hasNewVideos = false;
        let hasRemovedVideos = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Check if any added nodes are video elements or contain video elements
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                DOMUtils.discoverShadowRoots(element);
                DOMUtils.getSearchRoots().forEach((searchRoot) => {
                  if (searchRoot !== document) observeRoot(searchRoot);
                });

                if (element.tagName === 'VIDEO') {
                  if (debugMode) {
                    console.log('🆕 New video element detected:', element);
                  }
                  hasNewVideos = true;
                } else if (
                  element.querySelector('video') ||
                  element.shadowRoot?.querySelector('video')
                ) {
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

            // YouTube repeatedly removes its temporary preview video while
            // leaving the thumbnail host connected. Trigger pruning in the
            // same microtask so our sibling wrapper cannot linger over the
            // thumbnail until the next mouse scan.
            mutation.removedNodes.forEach((node) => {
              if (node.nodeType !== Node.ELEMENT_NODE) return;

              const element = node as Element;
              if (
                element.tagName === 'VIDEO' ||
                element.querySelector('video') ||
                element.shadowRoot?.querySelector('video')
              ) {
                hasRemovedVideos = true;
                if (debugMode) {
                  console.log('🗑️ Removed video element detected:', element);
                }
              }
            });
          }
        });

        if (hasRemovedVideos) {
          if (debugMode) {
            console.log('🧹 MutationObserver triggered overlay pruning');
          }
          callback();
        }

        if (hasNewVideos) {
          if (debugMode) {
            console.log('🔄 MutationObserver triggered video check');
          }
          // Add small delay to let SPA/carousel layout settle.
          setTimeout(callback, 100);
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
      });

      return observer;
    };

    DOMUtils.discoverShadowRoots(document);
    DOMUtils.hasScannedDocumentForShadowRoots = true;
    const observer = observeRoot(document) ?? new MutationObserver(() => {});
    DOMUtils.getSearchRoots().forEach((root) => {
      if (root !== document) observeRoot(root);
    });

    return observer;
  }

  private static observeUntilVisible(
    video: HTMLVideoElement,
    callback: () => void
  ): void {
    DOMUtils.visibilityCallbacks.set(video, callback);

    if (!DOMUtils.visibilityObserver) {
      DOMUtils.visibilityObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const observedVideo = entry.target as HTMLVideoElement;
          if (!DOMUtils.isVideoVisible(observedVideo)) return;

          DOMUtils.visibilityObserver?.unobserve(observedVideo);
          const onVisible = DOMUtils.visibilityCallbacks.get(observedVideo);
          DOMUtils.visibilityCallbacks.delete(observedVideo);
          onVisible?.();
        });
      });
    }

    DOMUtils.visibilityObserver.observe(video);
  }

  static createMouseCheckThrottler(
    callback: () => void,
    debugMode: boolean = false
  ): (event?: MouseEvent) => void {
    let mouseCheckTimeout: number | null = null;

    return (event?: MouseEvent) => {
      // Rebuilding or reconciling overlays after pointerdown can make the
      // scrubber miss the beginning of a video-area drag. Pointer entry gets
      // an immediate scan, but an already pressed pointer keeps its current
      // interaction owner until the next unpressed movement.
      if (event && event.buttons !== 0) return;

      // Throttle checks to avoid spam
      if (mouseCheckTimeout) return;

      if (debugMode) {
        console.log('🖱️ Mouse movement triggered video check');
      }
      callback();

      mouseCheckTimeout = window.setTimeout(() => {
        mouseCheckTimeout = null;
      }, 1000); // Check immediately, then at most once per second
    };
  }
}

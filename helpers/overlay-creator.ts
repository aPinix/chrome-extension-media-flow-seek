import { EXT_URL } from '@/config/variables.config';
import { DOMUtils } from '@/helpers/dom-utils';
import {
  getProgressColor,
  getProgressColorSync,
} from '@/helpers/favicon-color';
import { getAppLogoBase64 } from '@/helpers/logo';
import {
  DeferredMediaSeek,
  getMediaProgress,
  getMediaSeekRange,
  getMediaSeekTarget,
  MEDIA_SCROLL_SEEK_SETTLE_DELAY_MS,
  MEDIA_SEEK_SETTLE_DELAY_MS,
} from '@/helpers/media';
import {
  DEFAULT_SCROLL_SPEED_FACTOR,
  getPlayerLayerWheelDeltaPixels,
  getScrollSpeedMultiplier,
  getWheelDeltaPixels,
  hasScrollSpeedHotkey,
  isScrollSpeedHotkeyCode,
} from '@/helpers/scroll-speed';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import {
  getWheelPlaybackAction,
  isHorizontalWheelAction,
  isPrimaryWheelModifierCode,
  matchesPrimaryWheelModifier,
} from '@/helpers/wheel-actions';
import {
  extractYouTubeChapterModel,
  isYouTubeChapterPage,
  type YouTubeChapterModelT,
  type YouTubeChapterT,
  youtubeChapterMutationMayAffectModel,
} from '@/helpers/youtube-chapters';
import {
  ActionAreaE,
  type ActionAreaT,
  type VideoStateT,
} from '@/types/content';

const MIN_INTERACTIVE_TIMELINE_HEIGHT_PX = 10;
const VIDEO_DRAG_START_THRESHOLD_PX = 5;
const VOLUME_DRAG_START_THRESHOLD_PX = 3;
const VOLUME_CONTROL_WIDTH_PX = 20;
const VOLUME_EDGE_GAP_PX = 0;
const VOLUME_CONTROL_HEIGHT_PX = 72;
const VOLUME_KEY_STEP = 0.05;
const VOLUME_WHEEL_SENSITIVITY = 0.001;
const PAGE_DIALOG_SELECTOR = [
  'dialog[open]',
  '[role="dialog" i]',
  '[role="alertdialog" i]',
  '[aria-modal="true" i]',
  '[popover]',
].join(',');
const EXTENSION_UI_SELECTOR = [
  '.scrub-wrapper',
  '.scrub-timeline',
  '.mfs-media-controls',
  '.mfs-seek-speed-label',
  '.mfs-youtube-chapter-tooltip',
  '.scrub-debug-indicator',
].join(',');
const SITE_INTERACTIVE_SELECTOR = [
  'button',
  // Cross-origin controls are opaque to elementsFromPoint(). The iframe is
  // the deepest site-owned element we can see, so it must receive the pointer
  // before controls such as Google IMA's Skip Ad button can be clicked.
  'iframe',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[role="button" i]',
  '[role="checkbox" i]',
  '[role="combobox" i]',
  '[role="link" i]',
  '[role="menuitem" i]',
  '[role="option" i]',
  '[role="radio" i]',
  '[role="slider" i]',
  '[role="switch" i]',
  '[role="tab" i]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const PLAYER_SINGLE_CLICK_DELAY_MS = 220;
const WHEEL_HOVER_LEASE_MS = 1500;
const SEEK_SPEED_LABEL_DISMISS_DELAY_MS = 700;
const PLAY_PAUSE_WHEEL_GESTURE_END_MS = 500;
const DEFAULT_TIMELINE_PROGRESS_BACKGROUND = 'rgb(255 255 255 / 0.3)';
const DEFAULT_TIMELINE_BACKGROUND = 'rgb(255 255 255 / 0.2)';
const YOUTUBE_CHAPTER_GAP_PX = 4;
const SETTINGS_LAYOUT_TRANSITION_MS = 320;
const ACTION_AREA_PREVIEW_MS = 1200;
const ACTION_AREA_PREVIEW_BACKGROUND = 'rgb(126 34 206 / 0.4)';
const ACTION_AREA_PREVIEW_BORDER = 'inset 0 0 0 2px rgb(196 181 253 / 0.9)';
const PASSIVE_PREVIEW_Z_INDEX = '2147483644';
const isPlaybackToggleHotkey = (event: KeyboardEvent): boolean =>
  event.code === 'Space' ||
  event.key === ' ' ||
  event.code === 'KeyK' ||
  event.key.toLowerCase() === 'k' ||
  event.code === 'MediaPlayPause' ||
  event.key === 'MediaPlayPause';
const PLAYBACK_PLAY_ICON_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.4 4.6C7.35 3.93 6 4.68 6 5.93v12.14c0 1.25 1.35 2 2.4 1.33l9.54-6.07a1.58 1.58 0 0 0 0-2.66L8.4 4.6Z" fill="white"/></svg>'
)}")`;
const PLAYBACK_PAUSE_ICON_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.75" fill="white"/><rect x="14" y="4" width="5" height="16" rx="1.75" fill="white"/></svg>'
)}")`;

const getColorizedTimelineBackground = (color: string): string => {
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgb(${rgbMatch[1]} ${rgbMatch[2]} ${rgbMatch[3]} / 0.8)`;
  }

  const hexMatch = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hexMatch) {
    return `rgb(${Number.parseInt(hexMatch[1] ?? '', 16)} ${Number.parseInt(hexMatch[2] ?? '', 16)} ${Number.parseInt(hexMatch[3] ?? '', 16)} / 0.8)`;
  }

  return color;
};

export class OverlayCreator {
  private settingsManager: SettingsManager;
  private videoStateManager: VideoStateManager;
  private keyboardEventListenerAdded = false;
  private pressedKeys = new Set<string>();
  private isKeyboardSuspended = false;
  private checkForVideos: () => void;
  private isFastHideStyleInjected = false;
  private styledDocuments = new WeakSet<Document>();
  private hoverTrackedDocuments = new WeakSet<Document>();
  private lastPointerPoints = new WeakMap<
    Document,
    { clientX: number; clientY: number }
  >();
  private dialogGuardedDocuments = new WeakSet<Document>();
  private timelinePreviewTimeouts = new WeakMap<HTMLDivElement, number>();
  private timelineLayoutTimeouts = new WeakMap<HTMLDivElement, number>();
  private actionAreaPreviewTimeouts = new WeakMap<HTMLDivElement, number>();
  private actionAreaOriginalBackgrounds = new WeakMap<HTMLDivElement, string>();
  private actionAreaOriginalBoxShadows = new WeakMap<HTMLDivElement, string>();
  private actionAreaOriginalTransitions = new WeakMap<HTMLDivElement, string>();
  private youtubeChapterModels = new WeakMap<
    HTMLDivElement,
    YouTubeChapterT[]
  >();
  private nextVideoId = 1;

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

  // YouTube creates its preview video after the pointer has already rested on
  // a thumbnail. Content startup calls this before any video is found so a
  // late-mounted preview can immediately restore that hover point.
  startDocumentHoverTracking(ownerDocument: Document = document): void {
    this.setupDocumentHoverTracking(ownerDocument);
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
    // Playback hotkeys belong to the page player. Tearing down and rebuilding
    // the overlay during the same key gesture can expose native controls
    // halfway through the event and make one press toggle playback repeatedly.
    if (isPlaybackToggleHotkey(event)) return;

    // Keep configured wheel modifiers available so their gesture reaches the
    // existing overlay instead of suspending it first. Track them so a real
    // multi-key shortcut still remains suspended until every key is released.
    if (this.isWheelActionModifierCode(event.code)) {
      this.pressedKeys.add(event.code);
      return;
    }

    // Ignore auto-repeat keydown events to prevent repeated work
    if (event.repeat) return;

    // Track pressed keys. Reserved modifiers may already be present without
    // having suspended the overlay.
    this.pressedKeys.add(event.code);

    if (this.isKeyboardSuspended) return;

    // Temporarily suspend interaction without destroying the overlay. Reusing
    // the same wheel/scroll listeners avoids a fragile teardown/rebuild cycle
    // for short-lived preview videos and custom player frames.
    this.isKeyboardSuspended = true;

    if (this.settingsManager.isDebugEnabled()) {
      console.log('🚫 Extension disabled by key press, fast-hiding overlays');
    }

    // Hide the extension UI immediately while the page handles the shortcut.
    this.fastHideOverlays();

    if (this.settingsManager.isDebugEnabled()) {
      console.log(
        '🎯 PRESSED KEYS:',
        this.pressedKeys.size,
        '- Extension disabled'
      );
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (isPlaybackToggleHotkey(event)) return;

    // A modifier that was previously tracked must still be released if the
    // setting changed while it was held. Untracked wheel modifiers stay out of
    // the keyboard-suspension lifecycle entirely.
    if (
      !this.pressedKeys.has(event.code) &&
      this.isWheelActionModifierCode(event.code)
    )
      return;

    // Remove the released key from pressed keys
    this.pressedKeys.delete(event.code);

    if (this.settingsManager.isDebugEnabled()) {
      console.log('🎯 PRESSED KEYS:', this.pressedKeys.size);
    }

    if (this.pressedKeys.size === 0) this.resumeKeyboardSuspension();
  }

  private isWheelActionModifierCode(code: string): boolean {
    return (
      isScrollSpeedHotkeyCode(
        code,
        this.settingsManager.getFastScrollHotkey(),
        this.settingsManager.getSlowScrollHotkey()
      ) || this.isPlayPauseWheelModifierCode(code)
    );
  }

  private isPlayPauseWheelModifierCode(code: string): boolean {
    return (
      this.settingsManager.isPlayPauseWheelEnabled() &&
      isPrimaryWheelModifierCode(code)
    );
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
    this.resumeKeyboardSuspension();
  }

  private resumeKeyboardSuspension(): void {
    if (!this.isKeyboardSuspended) return;

    this.isKeyboardSuspended = false;
    document.documentElement.classList.remove('mfs-disabled');
    document.getElementById('mfs-fast-hide')?.remove();
    this.isFastHideStyleInjected = false;

    if (this.settingsManager.isDebugEnabled()) {
      console.log('✅ Extension resumed by key release, checking for videos');
    }

    // Preserve connected controllers, while still repairing any player DOM
    // that the site replaced during the shortcut.
    setTimeout(() => {
      if (!this.isKeyboardSuspended) this.checkForVideos();
    }, 100);
  }

  private fastHideOverlays(): void {
    // Add a lightweight class that CSS can key off if needed
    document.documentElement.classList.add('mfs-disabled');

    // Fallback: ensure scrub wrappers are immediately hidden without heavy DOM ops
    if (!this.isFastHideStyleInjected) {
      const style = document.createElement('style');
      style.id = 'mfs-fast-hide';
      style.textContent = `
        .scrub-wrapper,
        .scrub-timeline[data-mfs-portaled="true"],
        .mfs-media-controls[data-mfs-portaled="true"],
        .mfs-seek-speed-label[data-mfs-portaled="true"] {
          display: none !important;
          visibility: hidden !important;
        }
      `;
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
    }

    let scrubTimeout: number | null = null;
    let isSettingInitialScroll = false;

    const deferredSeek = new DeferredMediaSeek(
      video,
      MEDIA_SEEK_SETTLE_DELAY_MS,
      (error) => {
        if (debugMode) {
          console.warn('Unable to seek this video source:', error);
        }
      }
    );

    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;

    // Create overlay div
    const scrubOverlay = this.createOverlayElement(ownerDocument);
    const videoId = this.generateVideoId(video);
    scrubOverlay.setAttribute('data-video-id', videoId);

    // Create content div
    const scrubOverlayScrollContent =
      this.createScrollContentElement(ownerDocument);
    scrubOverlay.appendChild(scrubOverlayScrollContent);

    // Create timeline bar
    const scrubTimeline = this.createTimelineElement(ownerDocument);
    const scrubTimelineProgressIndicator =
      this.createProgressIndicatorElement(ownerDocument);
    scrubTimeline.appendChild(scrubTimelineProgressIndicator);

    // Create and position wrapper
    const { scrubWrapper, debugIndicator } =
      this.createWrapperAndDebugIndicator(video, videoId);
    const mediaControls = this.createMediaControlsElement(ownerDocument);
    const seekSpeedLabel = this.createSeekSpeedLabel(ownerDocument);
    const youtubeChapterTooltip =
      !DOMUtils.isYouTubeHoverPreview(video) &&
      isYouTubeChapterPage(ownerDocument.location.href)
        ? this.createYouTubeChapterTooltipElement(ownerDocument)
        : undefined;

    // Add elements to wrapper
    scrubWrapper.appendChild(scrubOverlay);
    scrubWrapper.appendChild(scrubTimeline);
    scrubWrapper.appendChild(mediaControls);
    scrubWrapper.appendChild(seekSpeedLabel);
    if (youtubeChapterTooltip) scrubWrapper.appendChild(youtubeChapterTooltip);

    // Only add debug indicator to DOM if debug is enabled
    if (this.settingsManager.isDebugEnabled()) {
      scrubWrapper.appendChild(debugIndicator);
    }

    // Insert wrapper into DOM
    this.insertWrapperIntoDOM(video, scrubWrapper);

    // Store state before setting scroll positions, which can asynchronously
    // dispatch scroll events in some browser engines.
    const videoState: VideoStateT = {
      overlay: scrubOverlay,
      scrollContent: scrubOverlayScrollContent,
      timeline: scrubTimeline,
      wrapper: scrubWrapper,
      debugIndicator: debugIndicator,
      mediaControls,
      youtubeChapterTooltip,
      isHovering: false,
      isPointerHovering: false,
      isWheelHovering: false,
      isUserScrubbing: false,
    };
    this.videoStateManager.set(video, videoState);
    this.updateOverlayPointerEvents(video, videoState);
    this.setupDocumentDialogGuard(ownerDocument);
    this.updateDocumentDialogGuard(ownerDocument);

    // Register whole-video drag handling before click handling so a completed
    // drag can suppress the synthetic click that browsers dispatch afterward.
    const videoDraggingController = this.setupVideoDraggingSeeking(
      video,
      scrubOverlay,
      scrubTimeline,
      videoState,
      deferredSeek,
      debugMode
    );
    videoState.cancelVideoDragging = videoDraggingController.cancel;

    // Preserve essential playback interaction when native/custom controls are
    // hidden and this transparent overlay becomes the click target.
    const playbackController = this.setupPlayerClickHandling(
      scrubOverlay,
      video,
      debugMode,
      () => videoState.isHovering
    );
    videoState.syncPlaybackFeedback = playbackController.sync;
    playbackController.sync();

    const mediaControlsController = this.setupMediaControls(
      mediaControls,
      video,
      debugMode
    );
    videoState.syncMediaControls = mediaControlsController.sync;
    videoState.preserveSourceVolume =
      mediaControlsController.preserveSourceVolume;
    mediaControlsController.sync();

    this.updateVideoControlsForVideo(video, videoState);
    this.setupDocumentHoverTracking(ownerDocument);
    this.restoreDocumentHoverAtLastPointer(ownerDocument);

    const timelineSeekingController = this.setupTimelineSeeking(
      video,
      scrubTimeline,
      videoState,
      deferredSeek,
      debugMode
    );
    videoState.cancelTimelineSeeking = timelineSeekingController.cancel;

    const youtubeChapterController = this.setupYouTubeChapterTimeline(
      video,
      videoState
    );
    videoState.updateYouTubeChapterMode =
      youtubeChapterController.updateEnabled;

    // Setup overlay functionality
    const updateOverlaySize = this.createOverlaySizeUpdater(
      video,
      scrubWrapper
    );
    const updateOverlayAndTimeline = () => {
      updateOverlaySize();
      this.updateTimelineInteractivityForVideo(video, scrubTimeline);
      this.updateMediaControlsPlacement(video, videoState);
    };
    const updateContentWidth = this.createContentWidthUpdater(
      video,
      scrubOverlayScrollContent,
      scrubOverlay,
      (value) => {
        isSettingInitialScroll = value;
      }
    );

    // Set initial dimensions and keep them current when a player changes source.
    updateOverlayAndTimeline();
    updateContentWidth();
    const updateTimelineInteractivity = () => {
      this.updateTimelineInteractivityForVideo(video, scrubTimeline);
      this.updateVideoDraggingForVideo(video, videoState);
      this.updateVideoControlsForVideo(video, videoState);
    };
    updateTimelineInteractivity();
    video.addEventListener('loadedmetadata', updateContentWidth);
    video.addEventListener('durationchange', updateContentWidth);
    video.addEventListener('loadedmetadata', updateTimelineInteractivity);
    video.addEventListener('durationchange', updateTimelineInteractivity);
    video.addEventListener('progress', updateTimelineInteractivity);

    // Setup scroll handling
    const scrollCleanup = this.setupScrollHandling(
      video,
      scrubOverlay,
      scrubOverlayScrollContent,
      scrubTimeline,
      seekSpeedLabel,
      () => isSettingInitialScroll,
      (value) => {
        isSettingInitialScroll = value;
      },
      (timeout) => {
        scrubTimeout = timeout;
      },
      () => scrubTimeout,
      () => videoState.isHovering,
      deferredSeek,
      debugMode,
      playbackController.setPlayback
    );

    // Setup video sync events
    const videoSyncCleanup = this.setupVideoSyncEvents(
      video,
      scrubOverlay,
      scrubOverlayScrollContent,
      (value) => {
        isSettingInitialScroll = value;
      }
    );

    // Setup resize handling
    ownerWindow.addEventListener('resize', updateOverlayAndTimeline);
    const resizeObserver = new ResizeObserver(updateOverlayAndTimeline);
    resizeObserver.observe(video);

    let timelineLayoutFrame: number | null = null;
    const scheduleTimelineLayoutUpdate = () => {
      if (timelineLayoutFrame !== null) return;

      timelineLayoutFrame = ownerWindow.requestAnimationFrame(() => {
        timelineLayoutFrame = null;
        updateOverlayAndTimeline();
      });
    };
    ownerDocument.addEventListener('scroll', scheduleTimelineLayoutUpdate, {
      capture: true,
      passive: true,
    });
    ownerDocument.addEventListener(
      'fullscreenchange',
      updateOverlayAndTimeline
    );

    // Setup timeline progress updates during playback
    const timelineCleanup = this.setupTimelineProgressUpdates(
      video,
      scrubTimeline
    );

    videoState.syncCleanup = () => {
      video.removeEventListener('loadedmetadata', updateContentWidth);
      video.removeEventListener('durationchange', updateContentWidth);
      video.removeEventListener('loadedmetadata', updateTimelineInteractivity);
      video.removeEventListener('durationchange', updateTimelineInteractivity);
      video.removeEventListener('progress', updateTimelineInteractivity);
      ownerWindow.removeEventListener('resize', updateOverlayAndTimeline);
      ownerDocument.removeEventListener(
        'scroll',
        scheduleTimelineLayoutUpdate,
        true
      );
      ownerDocument.removeEventListener(
        'fullscreenchange',
        updateOverlayAndTimeline
      );
      if (timelineLayoutFrame !== null) {
        ownerWindow.cancelAnimationFrame(timelineLayoutFrame);
      }
      resizeObserver.disconnect();
      videoSyncCleanup();
      timelineCleanup();
      timelineSeekingController.cleanup();
      youtubeChapterController.cleanup();
      videoDraggingController.cleanup();
      playbackController.cleanup();
      mediaControlsController.cleanup();
      scrollCleanup();
      deferredSeek.cancel();
      if (scrubTimeout) ownerWindow.clearTimeout(scrubTimeout);
      if (videoState.wheelHoverTimeout !== undefined) {
        ownerWindow.clearTimeout(videoState.wheelHoverTimeout);
        videoState.wheelHoverTimeout = undefined;
      }
    };

    if (debugMode) console.log('✅ Scrub overlay created successfully');
  }

  private generateVideoId(video: HTMLVideoElement): string {
    const existingId = video.getAttribute('data-media-flow-seek-id');
    if (existingId) return existingId;

    const id = `media-flow-seek-${this.nextVideoId++}`;
    if (!DOMUtils.isYouTubeHoverPreview(video)) {
      video.setAttribute('data-media-flow-seek-id', id);
    }
    return id;
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

  private createOverlayElement(ownerDocument: Document): HTMLDivElement {
    const scrubOverlay = ownerDocument.createElement('div');
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

    // Add WebKit scrollbar hiding styles once per frame document.
    if (!this.styledDocuments.has(ownerDocument)) {
      const style = ownerDocument.createElement('style');
      style.textContent = `
        .scrub-overlay::-webkit-scrollbar {
          display: none;
        }

        .mfs-video-dragging,
        .mfs-video-dragging * {
          cursor: pointer !important;
          user-select: none !important;
        }

        .mfs-seek-speed-label {
          all: initial;
          position: absolute;
          left: 50%;
          bottom: 12px;
          z-index: 2147483646 !important;
          display: block;
          color: white;
          text-shadow: 0 1px 3px rgb(0 0 0 / 0.8), 0 2px 8px rgb(0 0 0 / 0.45);
          opacity: 0;
          transform: translate(-50%, 4px);
          transition: opacity 120ms ease, transform 120ms ease;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          line-height: 14px;
          letter-spacing: 0.01em;
        }

        .mfs-seek-speed-label[data-mfs-visible="true"] {
          opacity: 1;
          transform: translate(-50%, 0);
        }

        .mfs-seek-speed-label[data-mfs-portaled="true"] {
          bottom: auto;
          transform: translate(-50%, calc(-100% + 4px));
        }

        .mfs-seek-speed-label[data-mfs-portaled="true"][data-mfs-visible="true"] {
          transform: translate(-50%, -100%);
        }

        .mfs-youtube-chapter-tooltip {
          all: initial;
          position: absolute;
          left: 0;
          z-index: 2147483646 !important;
          display: block;
          box-sizing: border-box;
          max-width: calc(100% - 16px);
          overflow: hidden;
          padding: 5px 8px;
          border-radius: 6px;
          background: rgb(15 23 42 / 0.88);
          color: white;
          box-shadow: 0 3px 12px rgb(0 0 0 / 0.28);
          opacity: 0;
          transition: opacity 100ms ease;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          line-height: 14px;
        }

        .mfs-youtube-chapter-tooltip[data-mfs-visible="true"] {
          opacity: 1;
        }

        .mfs-media-controls {
          all: initial;
          width: ${VOLUME_CONTROL_WIDTH_PX}px;
          height: min(${VOLUME_CONTROL_HEIGHT_PX}px, calc(100% - 16px));
          position: absolute;
          right: ${VOLUME_EDGE_GAP_PX}px;
          top: 50%;
          z-index: 2147483647 !important;
          display: block;
          box-sizing: border-box;
          overflow: hidden;
          border: 0;
          border-radius: 8px 0 0 8px;
          background: rgb(255 255 255 / 0.28);
          color: white;
          box-shadow: none;
          visibility: hidden;
          opacity: 0;
          transform: translateY(-50%);
          transition: opacity 140ms ease, transform 140ms ease;
          -webkit-backdrop-filter: blur(6px) saturate(130%);
          backdrop-filter: blur(6px) saturate(130%);
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .mfs-media-controls[hidden] {
          display: none !important;
        }

        .mfs-media-controls[data-mfs-active="true"][data-mfs-video-hovered="true"] {
          visibility: visible;
          opacity: 0.3;
          pointer-events: auto;
        }

        .mfs-media-controls[data-mfs-active="true"][data-mfs-visible="true"],
        .mfs-media-controls[data-mfs-active="true"][data-mfs-interacting="true"],
        .mfs-media-controls[data-mfs-active="true"]:hover,
        .mfs-media-controls[data-mfs-active="true"]:focus-within {
          visibility: visible;
          opacity: 1;
          transform: translateY(-50%);
          pointer-events: auto !important;
        }

        .mfs-volume-pill {
          all: unset;
          width: 100%;
          height: 100%;
          position: relative;
          display: block;
          box-sizing: border-box;
          overflow: hidden;
          border-radius: inherit;
          color: inherit;
          cursor: pointer;
          touch-action: none;
          user-select: none;
        }

        .mfs-volume-pill::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 2;
          border-radius: inherit;
        }

        .mfs-volume-pill:focus-visible {
          outline: 2px solid white;
          outline-offset: -4px;
        }

        .mfs-volume-pill[data-mfs-dragging="true"] {
          cursor: ns-resize;
        }

        .mfs-volume-fill {
          width: 100%;
          height: var(--mfs-volume, 100%);
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 0;
          background: rgb(255 255 255 / 0.42);
          border-radius: 0;
          box-shadow: none;
          transition: height 120ms ease-out;
          -webkit-backdrop-filter: blur(6px) saturate(130%);
          backdrop-filter: blur(6px) saturate(130%);
          pointer-events: none;
        }

        .mfs-volume-pill[data-mfs-dragging="true"] .mfs-volume-fill {
          transition: none;
        }

        .mfs-volume-icon {
          width: 14px;
          height: 14px;
          position: absolute;
          left: 50%;
          bottom: 6px;
          z-index: 3;
          display: block;
          color: white;
          filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.25));
          transform: translateX(-50%);
          pointer-events: none;
        }

        .mfs-volume-icon path {
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .mfs-volume-icon-speaker {
          fill: currentColor !important;
          stroke: none !important;
        }

        .mfs-volume-icon-wave,
        .mfs-volume-icon-muted {
          opacity: 0;
          transform: scaleX(0.35);
          transform-box: fill-box;
          transform-origin: left center;
          transition:
            opacity 140ms ease,
            transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mfs-volume-pill[data-mfs-volume-level="low"] .mfs-volume-icon-wave-one,
        .mfs-volume-pill[data-mfs-volume-level="medium"] .mfs-volume-icon-wave-one,
        .mfs-volume-pill[data-mfs-volume-level="medium"] .mfs-volume-icon-wave-two,
        .mfs-volume-pill[data-mfs-volume-level="high"] .mfs-volume-icon-wave {
          opacity: 1;
          transform: scaleX(1);
        }

        .mfs-volume-icon-muted {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          transform: none;
          transition:
            opacity 100ms ease,
            stroke-dashoffset 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mfs-volume-pill[data-mfs-volume-level="muted"] .mfs-volume-icon-muted {
          opacity: 1;
          stroke-dashoffset: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .mfs-volume-icon-wave,
          .mfs-volume-icon-muted {
            transition: none;
          }
        }

        @media (hover: none), (pointer: coarse) {
          .mfs-media-controls[data-mfs-active="true"] {
            visibility: visible;
            opacity: 1;
            transform: translateY(-50%);
            pointer-events: auto !important;
          }
        }

        .mfs-playback-feedback {
          width: 112px;
          height: 112px;
          position: absolute;
          top: 50%;
          left: 50%;
          z-index: 2147483646;
          display: grid;
          place-items: center;
          border: 0;
          background: transparent;
          color: white;
          pointer-events: none;
          animation: mfs-playback-feedback 650ms ease-out forwards;
        }

        .mfs-playback-feedback svg {
          width: 96px;
          height: 96px;
          fill: currentColor;
          opacity: 0.9;
        }

        .mfs-playback-feedback svg,
        .mfs-playback-feedback::before {
          filter:
            drop-shadow(0 2px 4px rgb(0 0 0 / 0.72))
            drop-shadow(0 10px 22px rgb(0 0 0 / 0.42));
        }

        @supports (
          ((backdrop-filter: blur(1px)) and (mask-image: linear-gradient(black, black))) or
          ((-webkit-backdrop-filter: blur(1px)) and (-webkit-mask-image: linear-gradient(black, black)))
        ) {
          .mfs-playback-feedback[data-mfs-playback-feedback="play"] {
            --mfs-playback-icon-mask: ${PLAYBACK_PLAY_ICON_MASK};
          }

          .mfs-playback-feedback[data-mfs-playback-feedback="pause"] {
            --mfs-playback-icon-mask: ${PLAYBACK_PAUSE_ICON_MASK};
          }

          .mfs-playback-feedback::before {
            content: '';
            width: 96px;
            height: 96px;
            position: absolute;
            inset: 8px;
            background: rgb(255 255 255 / 0.8);
            -webkit-backdrop-filter: saturate(180%) blur(20px);
            backdrop-filter: saturate(180%) blur(20px);
            -webkit-mask: var(--mfs-playback-icon-mask) center / contain no-repeat;
            mask: var(--mfs-playback-icon-mask) center / contain no-repeat;
          }

          .mfs-playback-feedback svg {
            visibility: hidden;
          }
        }

        .mfs-playback-feedback[data-mfs-persistent="true"] {
          animation: mfs-playback-feedback-persistent 220ms ease-out both;
        }

        @keyframes mfs-playback-feedback {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.78);
          }
          18% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          72% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.08);
          }
        }

        @keyframes mfs-playback-feedback-persistent {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.86);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .scrub-debug-indicator {
          width: auto;
          height: auto;
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 10px 8px 8px;
          box-sizing: border-box;
          border: 1px solid rgb(255 255 255 / 0.4);
          border-radius: 9999px;
          background: rgb(255 255 255 / 0.8);
          color: rgb(15 23 42);
          box-shadow:
            0 2px 4px rgb(15 23 42 / 0.06),
            0 12px 30px -10px rgb(15 23 42 / 0.22),
            0 24px 60px -24px rgb(15 23 42 / 0.28),
            inset 0 1px 0 rgb(255 255 255 / 0.72),
            inset 0 0 0 1px rgb(15 23 42 / 0.035);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          backdrop-filter: saturate(180%) blur(20px);
          pointer-events: auto;
          white-space: nowrap;
          text-decoration: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .scrub-debug-indicator-logo-container {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .scrub-debug-indicator-logo {
          width: 16px;
          height: 16px;
          object-fit: contain;
        }

        .scrub-debug-indicator-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .scrub-debug-indicator-title {
          font-size: 10px;
          font-weight: 600;
          line-height: 1.2;
        }

        .scrub-debug-indicator-subtitle {
          font-size: 9px;
          line-height: 1.2;
          opacity: 0.62;
        }

        @media (prefers-color-scheme: dark) {
          .scrub-debug-indicator {
            border-color: rgb(255 255 255 / 0.14);
            background: rgb(51 51 51 / 0.8);
            color: rgb(248 250 252);
            box-shadow:
              0 2px 6px rgb(0 0 0 / 0.22),
              0 16px 36px -12px rgb(0 0 0 / 0.55),
              0 28px 70px -28px rgb(0 0 0 / 0.65),
              inset 0 1px 0 rgb(255 255 255 / 0.12),
              inset 0 0 0 1px rgb(0 0 0 / 0.12);
          }
        }

        @media (max-width: 480px) {
          .scrub-debug-indicator {
            padding: 7px 11px 7px 7px;
          }

          .scrub-debug-indicator-logo-container {
            width: 22px;
            height: 22px;
          }

          .scrub-debug-indicator-logo {
            width: 15px;
            height: 15px;
          }

          .scrub-debug-indicator-title {
            font-size: 10px;
          }

          .scrub-debug-indicator-subtitle {
            font-size: 9px;
          }
        }

        video[data-mfs-hide-controls="true"]::-webkit-media-controls,
        video[data-mfs-hide-controls="true"]::-webkit-media-controls-enclosure,
        video[data-mfs-hide-controls="true"]::-webkit-media-controls-panel {
          display: none !important;
        }

        [data-mfs-hide-controls-container="true"] .ytp-chrome-bottom,
        [data-mfs-hide-controls-container="true"] .ytp-chrome-top,
        [data-mfs-hide-controls-container="true"] .ytp-gradient-bottom,
        [data-mfs-hide-controls-container="true"] .ytp-gradient-top,
        [data-mfs-hide-controls-container="true"] .ytp-bezel,
        [data-mfs-hide-controls-container="true"] .ytp-large-play-button,
        [data-mfs-hide-controls-container="true"] .vp-controls,
        [data-mfs-hide-controls-container="true"] .vp-sidedock,
        [data-mfs-hide-controls-container="true"] [data-a-target="player-controls"],
        [data-mfs-hide-controls-container="true"] .PlayerControlsNeo__layout,
        [data-mfs-hide-controls-container="true"] button[data-a-target="player-overlay-play-button"],
        [data-mfs-hide-controls-container="true"] [class*="DivVolumeControlContainer"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [class*="DivMediaCardOverlayBottom"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [class*="DivCreatorInfoContainer"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [class*="DivMediaCardDescriptionContainer"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [data-e2e="video-desc"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [data-e2e="video-author-uniqueid"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [data-e2e="video-author-nickname"],
        [data-mfs-hide-controls-container="true"][data-mfs-tiktok-player="true"] [data-e2e="video-music"],
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[aria-label="volume" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[aria-label="mute" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[aria-label="unmute" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[aria-label*="play" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[aria-label*="pause" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[title*="play" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"] :is(button, [role="button"])[title*="pause" i]:not([data-mfs-action]),
        [data-mfs-hide-controls-container="true"].responsive_menu_ignore_touch > .scrub-wrapper + div {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        [data-mfs-instagram-chrome="true"] {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        html[data-mfs-page-dialog-open="true"] .scrub-wrapper,
        html[data-mfs-page-dialog-open="true"] .scrub-timeline[data-mfs-portaled="true"],
        html[data-mfs-page-dialog-open="true"] .mfs-media-controls[data-mfs-portaled="true"],
        html[data-mfs-page-dialog-open="true"] .mfs-seek-speed-label[data-mfs-portaled="true"],
        html[data-mfs-page-dialog-open="true"] .mfs-youtube-chapter-tooltip {
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
      (ownerDocument.head ?? ownerDocument.documentElement).appendChild(style);
      this.styledDocuments.add(ownerDocument);
    }
    scrubOverlay.classList.add('scrub-overlay');

    return scrubOverlay;
  }

  private createScrollContentElement(ownerDocument: Document): HTMLDivElement {
    const scrollContent = ownerDocument.createElement('div');
    scrollContent.style.cssText = `
      height: 100%;
      min-width: 100%;
      background-color: rgb(0 0 0 / 0);
      ${this.getDebugImageBackground()}
    `;
    scrollContent.classList.add('scrub-overlay-scroll-content');
    return scrollContent;
  }

  private createTimelineElement(ownerDocument: Document): HTMLDivElement {
    const timeline = ownerDocument.createElement('div');
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
      background: rgb(255 255 255 / 0.2);
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      backdrop-filter: blur(8px) saturate(140%);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    timeline.classList.add('scrub-timeline');
    return timeline;
  }

  private createSeekSpeedLabel(ownerDocument: Document): HTMLDivElement {
    const label = ownerDocument.createElement('div');
    label.className = 'mfs-seek-speed-label';
    label.dataset.mfsVisible = 'false';
    label.setAttribute('role', 'status');
    label.setAttribute('aria-live', 'polite');
    label.setAttribute('aria-atomic', 'true');
    return label;
  }

  private createYouTubeChapterTooltipElement(
    ownerDocument: Document
  ): HTMLDivElement {
    const tooltip = ownerDocument.createElement('div');
    tooltip.className = 'mfs-youtube-chapter-tooltip';
    tooltip.dataset.mfsVisible = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    return tooltip;
  }

  private updateTimelineInteractivityForVideo(
    video: HTMLVideoElement,
    timeline: HTMLDivElement
  ): boolean {
    const isInteractive =
      !DOMUtils.isYouTubeHoverPreview(video) &&
      this.settingsManager.isTimelineSeekingEnabled() &&
      getMediaSeekRange(video) !== null;

    const state = this.videoStateManager.get(video);
    if (state?.timeline === timeline) {
      this.updateTimelinePlacement(video, state, isInteractive);
    }

    const isPageDialogOpen =
      video.ownerDocument.documentElement.dataset.mfsPageDialogOpen === 'true';
    timeline.style.pointerEvents =
      isInteractive && !isPageDialogOpen ? 'auto' : 'none';
    timeline.style.cursor = isInteractive ? 'pointer' : '';
    timeline.style.touchAction = isInteractive ? 'none' : '';
    timeline.style.userSelect = isInteractive ? 'none' : '';
    timeline.style.zIndex = isInteractive ? '2147483645' : '';
    timeline.dataset.mfsInteractive = String(isInteractive);
    timeline
      .querySelectorAll<HTMLElement>(
        '.scrub-timeline-handle, .scrub-timeline-handle-indicator'
      )
      .forEach((handle) => {
        handle.style.display = isInteractive ? 'none' : '';
      });

    return isInteractive;
  }

  private updateTimelinePlacement(
    video: HTMLVideoElement,
    state: VideoStateT,
    isInteractive: boolean
  ): void {
    const { timeline, wrapper } = state;
    const height = this.settingsManager.getTimelineHeight();
    const unit = this.settingsManager.getTimelineHeightUnit();
    const position = this.settingsManager.getTimelinePosition();
    const wrapperRect = wrapper.getBoundingClientRect();
    const configuredHeightInPixels =
      unit === '%' ? (wrapperRect.height * height) / 100 : height;
    const heightInPixels =
      isInteractive &&
      configuredHeightInPixels < MIN_INTERACTIVE_TIMELINE_HEIGHT_PX
        ? Math.min(MIN_INTERACTIVE_TIMELINE_HEIGHT_PX, wrapperRect.height)
        : configuredHeightInPixels;

    this.updateTimelineCornerClipping(
      video,
      timeline,
      position,
      heightInPixels >= wrapperRect.height
    );

    if (!isInteractive) {
      if (timeline.parentElement !== wrapper) wrapper.appendChild(timeline);

      const heightValue = unit === '%' ? `${height}%` : `${height}px`;
      timeline.style.position = 'absolute';
      timeline.style.left = '0px';
      timeline.style.width = '100%';
      timeline.style.height = heightValue;
      timeline.style.top =
        position === 'top' ? '0px' : `calc(100% - ${heightValue})`;
      delete timeline.dataset.mfsPortaled;
      return;
    }

    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const fullscreenElement = ownerDocument.fullscreenElement;
    const portalHost =
      fullscreenElement?.contains(video) || fullscreenElement?.contains(wrapper)
        ? fullscreenElement
        : ownerDocument.documentElement;

    if (timeline.parentElement !== portalHost) portalHost.appendChild(timeline);

    const targetTop =
      position === 'top'
        ? wrapperRect.top
        : wrapperRect.bottom - heightInPixels;
    let portalLeft = wrapperRect.left + ownerWindow.scrollX;
    let portalTop = targetTop + ownerWindow.scrollY;

    if (portalHost !== ownerDocument.documentElement) {
      const portalRect = portalHost.getBoundingClientRect();
      portalLeft =
        wrapperRect.left -
        portalRect.left +
        portalHost.scrollLeft -
        portalHost.clientLeft;
      portalTop =
        targetTop -
        portalRect.top +
        portalHost.scrollTop -
        portalHost.clientTop;
    }

    // Keep the portaled timeline in the same scrollable coordinate space as
    // the video. Fixed elements stay pinned to the viewport during elastic
    // overscroll while the page content (and video) is displaced.
    timeline.style.position = 'absolute';
    timeline.style.left = `${portalLeft}px`;
    timeline.style.width = `${wrapperRect.width}px`;
    timeline.style.height = `${heightInPixels}px`;
    timeline.style.top = `${portalTop}px`;
    timeline.dataset.mfsPortaled = 'true';
  }

  private updateTimelineCornerClipping(
    video: HTMLVideoElement,
    timeline: HTMLDivElement,
    position: 'top' | 'bottom',
    fillsVideoHeight: boolean
  ): void {
    const geometrySource = DOMUtils.isYouTubeHoverPreview(video)
      ? this.getPassivePreviewGeometrySource(video)
      : (this.findVisibleVideoContainer(video) ?? video);
    const targetElement = this.findEffectiveBorderRadiusSource(
      video,
      geometrySource
    );
    const ownerWindow = video.ownerDocument.defaultView ?? window;
    const targetStyle = ownerWindow.getComputedStyle(targetElement);
    const [topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius] =
      this.getBorderRadiusValues(targetStyle);
    const showTopCorners = fillsVideoHeight || position === 'top';
    const showBottomCorners = fillsVideoHeight || position === 'bottom';

    timeline.style.overflow = 'hidden';
    timeline.style.borderTopLeftRadius = showTopCorners ? topLeftRadius : '0px';
    timeline.style.borderTopRightRadius = showTopCorners
      ? topRightRadius
      : '0px';
    timeline.style.borderBottomRightRadius = showBottomCorners
      ? bottomRightRadius
      : '0px';
    timeline.style.borderBottomLeftRadius = showBottomCorners
      ? bottomLeftRadius
      : '0px';
  }

  private findEffectiveBorderRadiusSource(
    video: HTMLVideoElement,
    geometrySource: HTMLElement
  ): HTMLElement {
    const ownerWindow = video.ownerDocument.defaultView ?? window;
    const referenceRect = geometrySource.getBoundingClientRect();
    const horizontalTolerance = Math.max(4, referenceRect.width * 0.05);
    const verticalTolerance = Math.max(4, referenceRect.height * 0.05);
    let bestElement = geometrySource;
    let bestEdgeDelta = Number.POSITIVE_INFINITY;
    let bestRadiusMagnitude = 0;
    let currentElement: HTMLElement | null = video;

    for (let depth = 0; currentElement && depth < 16; depth += 1) {
      const rect = currentElement.getBoundingClientRect();
      const leftDelta = Math.abs(rect.left - referenceRect.left);
      const rightDelta = Math.abs(rect.right - referenceRect.right);
      const topDelta = Math.abs(rect.top - referenceRect.top);
      const bottomDelta = Math.abs(rect.bottom - referenceRect.bottom);
      const matchesVisibleGeometry =
        rect.width > 0 &&
        rect.height > 0 &&
        leftDelta <= horizontalTolerance &&
        rightDelta <= horizontalTolerance &&
        topDelta <= verticalTolerance &&
        bottomDelta <= verticalTolerance;

      if (matchesVisibleGeometry) {
        const style = ownerWindow.getComputedStyle(currentElement);
        const radiusMagnitude = this.getBorderRadiusMagnitude(style);
        const edgeDelta = leftDelta + rightDelta + topDelta + bottomDelta;
        const isCloserMatch = edgeDelta < bestEdgeDelta - 0.5;
        const isSameMatchWithLargerRadius =
          Math.abs(edgeDelta - bestEdgeDelta) <= 0.5 &&
          radiusMagnitude > bestRadiusMagnitude;

        if (
          radiusMagnitude > 0 &&
          (currentElement === video || this.hasVisualClipping(style)) &&
          (isCloserMatch || isSameMatchWithLargerRadius)
        ) {
          bestElement = currentElement;
          bestEdgeDelta = edgeDelta;
          bestRadiusMagnitude = radiusMagnitude;
        }
      }

      currentElement = this.getComposedParentElement(
        currentElement,
        ownerWindow
      );
    }

    return bestElement;
  }

  private getBorderRadiusMagnitude(style: CSSStyleDeclaration): number {
    return this.getBorderRadiusValues(style).reduce((total, value) => {
      const components = value.match(/-?\d*\.?\d+/g);
      if (!components) return total;

      return (
        total +
        components.reduce((sum, component) => {
          const numericValue = Number.parseFloat(component);
          return sum + (Number.isFinite(numericValue) ? numericValue : 0);
        }, 0)
      );
    }, 0);
  }

  private getBorderRadiusValues(
    style: CSSStyleDeclaration
  ): [string, string, string, string] {
    const cornerValues: [string, string, string, string] = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ];
    const cornerMagnitude = cornerValues.reduce((total, value) => {
      const components = value.match(/-?\d*\.?\d+/g);
      if (!components) return total;
      return total + components.reduce((sum, value) => sum + Number(value), 0);
    }, 0);

    // JSDOM reports zeroed longhands for an inline border-radius shorthand.
    // Real browsers expand the shorthand, but this fallback also protects
    // unusual player styles that expose only the shorthand value.
    if (cornerMagnitude === 0 && style.borderRadius) {
      return [
        style.borderRadius,
        style.borderRadius,
        style.borderRadius,
        style.borderRadius,
      ];
    }

    return cornerValues;
  }

  private hasVisualClipping(style: CSSStyleDeclaration): boolean {
    const hasNonEmptyValue = (value: string): boolean =>
      value !== '' && value !== 'none';
    const clipsOverflow = [
      style.overflow,
      style.overflowX,
      style.overflowY,
    ].some((value) => value === 'hidden' || value === 'clip');
    const webkitMaskImage = style.getPropertyValue('-webkit-mask-image');
    const hasMask =
      hasNonEmptyValue(style.maskImage) || hasNonEmptyValue(webkitMaskImage);

    return (
      clipsOverflow ||
      hasNonEmptyValue(style.clipPath) ||
      hasMask ||
      style.contain.split(/\s+/).includes('paint')
    );
  }

  private getComposedParentElement(
    element: HTMLElement,
    ownerWindow: Window & typeof globalThis
  ): HTMLElement | null {
    if (element.parentElement) return element.parentElement;

    const root = element.getRootNode() as ShadowRoot;
    return root.host instanceof ownerWindow.HTMLElement ? root.host : null;
  }

  private applySeekTargetAtClientX(
    video: HTMLVideoElement,
    timeline: HTMLDivElement,
    clientX: number,
    trackRect: Pick<DOMRect, 'left' | 'width'>,
    deferredSeek: DeferredMediaSeek,
    debugMode: boolean,
    source: 'timeline' | 'video'
  ): boolean {
    const range = getMediaSeekRange(video);
    if (!range) return false;

    const target = getMediaSeekTarget(
      range,
      clientX,
      trackRect.left,
      trackRect.width
    );
    if (!target) return false;

    timeline.style.opacity = '1';
    this.setTimelineProgress(timeline, target.progress);
    deferredSeek.stage(target.time);

    if (debugMode) {
      console.log(`🖱️ ${source} seek target:`, target.time);
    }

    return true;
  }

  private setupTimelineSeeking(
    video: HTMLVideoElement,
    timeline: HTMLDivElement,
    videoState: VideoStateT,
    deferredSeek: DeferredMediaSeek,
    debugMode: boolean
  ): { cancel: () => void; cleanup: () => void } {
    let activePointerId: number | null = null;

    const applyPointerTarget = (event: PointerEvent): boolean => {
      const rect = timeline.getBoundingClientRect();
      return this.applySeekTargetAtClientX(
        video,
        timeline,
        event.clientX,
        rect,
        deferredSeek,
        debugMode,
        'timeline'
      );
    };

    const releasePointer = (pointerId: number): void => {
      try {
        if (
          typeof timeline.hasPointerCapture === 'function' &&
          timeline.hasPointerCapture(pointerId)
        ) {
          timeline.releasePointerCapture(pointerId);
        }
      } catch (error) {
        if (debugMode) {
          console.warn('Unable to release timeline pointer capture:', error);
        }
      }
    };

    const finishScrubbing = (commitPendingSeek: boolean): void => {
      if (activePointerId === null) return;

      const pointerId = activePointerId;
      activePointerId = null;
      if (commitPendingSeek) deferredSeek.commit();
      releasePointer(pointerId);
      videoState.isUserScrubbing = false;
      this.updateTimelineInteractivityForVideo(video, timeline);
      this.updateTimelineHoverState(video, videoState, videoState.isHovering);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (
        !this.settingsManager.isTimelineSeekingEnabled() ||
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        activePointerId !== null
      )
        return;

      if (!applyPointerTarget(event)) {
        this.updateTimelineInteractivityForVideo(video, timeline);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activePointerId = event.pointerId;
      videoState.isUserScrubbing = true;
      timeline.style.cursor = 'grabbing';

      try {
        timeline.setPointerCapture?.(event.pointerId);
      } catch (error) {
        if (debugMode) {
          console.warn('Unable to capture timeline pointer:', error);
        }
      }
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      event.stopPropagation();
      applyPointerTarget(event);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      event.stopPropagation();
      applyPointerTarget(event);
      finishScrubbing(true);
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      event.stopPropagation();
      finishScrubbing(true);
    };

    const handleLostPointerCapture = (event: PointerEvent): void => {
      if (event.pointerId === activePointerId) finishScrubbing(true);
    };

    const handleClick = (event: MouseEvent): void => {
      if (
        this.settingsManager.isTimelineSeekingEnabled() &&
        getMediaSeekRange(video)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    timeline.addEventListener('pointerdown', handlePointerDown);
    timeline.addEventListener('pointermove', handlePointerMove);
    timeline.addEventListener('pointerup', handlePointerUp);
    timeline.addEventListener('pointercancel', handlePointerCancel);
    timeline.addEventListener('lostpointercapture', handleLostPointerCapture);
    timeline.addEventListener('click', handleClick);

    return {
      cancel: () => finishScrubbing(true),
      cleanup: () => {
        if (activePointerId !== null) {
          const pointerId = activePointerId;
          activePointerId = null;
          releasePointer(pointerId);
          videoState.isUserScrubbing = false;
        }
        timeline.removeEventListener('pointerdown', handlePointerDown);
        timeline.removeEventListener('pointermove', handlePointerMove);
        timeline.removeEventListener('pointerup', handlePointerUp);
        timeline.removeEventListener('pointercancel', handlePointerCancel);
        timeline.removeEventListener(
          'lostpointercapture',
          handleLostPointerCapture
        );
        timeline.removeEventListener('click', handleClick);
      },
    };
  }

  private setupVideoDraggingSeeking(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    timeline: HTMLDivElement,
    videoState: VideoStateT,
    deferredSeek: DeferredMediaSeek,
    debugMode: boolean
  ): { cancel: () => void; cleanup: () => void } {
    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let candidatePointer:
      | { id: number; startX: number; startY: number }
      | undefined;
    let activePointerId: number | null = null;
    let suppressNextClick = false;
    let suppressClickTimeout: number | null = null;

    const canDragVideo = (): boolean =>
      (this.settingsManager.shouldDragVideoToSeek?.() ?? false) &&
      getMediaSeekRange(video) !== null;

    const isExcludedTarget = (event: Event): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof ownerWindow.Element &&
            target.matches(
              '.scrub-timeline, .scrub-timeline *, .mfs-media-controls, .mfs-media-controls *, .scrub-debug-indicator, .scrub-debug-indicator *, a, button, input, select, textarea, [role="button"], [role="slider"], [contenteditable="true"]'
            )
        );

    const isInsideVideo = (clientX: number, clientY: number): boolean => {
      const rect = videoState.wrapper.getBoundingClientRect();
      const { top, height } = this.calculateActionAreaDimensions(
        rect.height,
        this.settingsManager.getActionArea()
      );
      const actionAreaTop = rect.top + top;
      const actionAreaBottom = actionAreaTop + height;
      return (
        videoState.wrapper.isConnected &&
        rect.width > 0 &&
        rect.height > 0 &&
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= actionAreaTop &&
        clientY <= actionAreaBottom
      );
    };

    const applyPointerTarget = (event: PointerEvent): boolean => {
      const rect = videoState.wrapper.getBoundingClientRect();
      return this.applySeekTargetAtClientX(
        video,
        timeline,
        event.clientX,
        rect,
        deferredSeek,
        debugMode,
        'video'
      );
    };

    const releasePointer = (pointerId: number): void => {
      try {
        if (
          typeof overlay.hasPointerCapture === 'function' &&
          overlay.hasPointerCapture(pointerId)
        ) {
          overlay.releasePointerCapture(pointerId);
        }
      } catch (error) {
        if (debugMode) {
          console.warn('Unable to release video drag pointer capture:', error);
        }
      }
    };

    const queueClickSuppressionReset = (): void => {
      if (suppressClickTimeout !== null) {
        ownerWindow.clearTimeout(suppressClickTimeout);
      }
      suppressClickTimeout = ownerWindow.setTimeout(() => {
        suppressNextClick = false;
        suppressClickTimeout = null;
      }, 0);
    };

    const finishDragging = (commitPendingSeek: boolean): void => {
      candidatePointer = undefined;
      if (activePointerId === null) return;

      const pointerId = activePointerId;
      activePointerId = null;
      if (commitPendingSeek) deferredSeek.commit();
      releasePointer(pointerId);
      videoState.isVideoDragging = false;
      videoState.isUserScrubbing = false;
      ownerDocument.documentElement.classList.remove('mfs-video-dragging');
      this.updateVideoDraggingForVideo(video, videoState);
      this.updateTimelineHoverState(video, videoState, videoState.isHovering);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (candidatePointer && candidatePointer.id !== event.pointerId) {
        candidatePointer = undefined;
      }
      if (
        !canDragVideo() ||
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        activePointerId !== null ||
        candidatePointer ||
        isExcludedTarget(event) ||
        !isInsideVideo(event.clientX, event.clientY)
      )
        return;

      candidatePointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId === activePointerId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyPointerTarget(event);
        return;
      }

      if (event.pointerId !== candidatePointer?.id) return;
      if (!canDragVideo()) {
        candidatePointer = undefined;
        return;
      }

      const horizontalDistance = Math.abs(
        event.clientX - candidatePointer.startX
      );
      const verticalDistance = Math.abs(
        event.clientY - candidatePointer.startY
      );

      // Preserve vertical page/player gestures. A drag becomes seek input only
      // after intentional, predominantly horizontal movement.
      if (
        verticalDistance >= VIDEO_DRAG_START_THRESHOLD_PX &&
        verticalDistance > horizontalDistance
      ) {
        candidatePointer = undefined;
        return;
      }
      if (
        horizontalDistance < VIDEO_DRAG_START_THRESHOLD_PX ||
        horizontalDistance < verticalDistance
      )
        return;

      activePointerId = event.pointerId;
      candidatePointer = undefined;
      videoState.isVideoDragging = true;
      videoState.isUserScrubbing = true;
      suppressNextClick = true;
      ownerDocument.documentElement.classList.add('mfs-video-dragging');
      this.updateVideoDraggingForVideo(video, videoState);

      try {
        overlay.setPointerCapture?.(event.pointerId);
      } catch (error) {
        if (debugMode) {
          console.warn('Unable to capture video drag pointer:', error);
        }
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      applyPointerTarget(event);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.pointerId === candidatePointer?.id) {
        candidatePointer = undefined;
        return;
      }
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      applyPointerTarget(event);
      finishDragging(true);
      queueClickSuppressionReset();
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (event.pointerId === candidatePointer?.id) {
        candidatePointer = undefined;
        return;
      }
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      finishDragging(true);
      queueClickSuppressionReset();
    };

    const handleLostPointerCapture = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;

      // Pointer capture is an optimization, not the owner of the drag
      // lifecycle. Players can move or restyle the overlay while the pointer
      // is outside the video, which makes Chromium release capture even though
      // the mouse button is still down. The document-level listeners above
      // continue tracking that pointer until pointerup or pointercancel.
      suppressNextClick = true;
    };

    const handleClick = (event: MouseEvent): void => {
      if (!suppressNextClick) return;

      suppressNextClick = false;
      if (suppressClickTimeout !== null) {
        ownerWindow.clearTimeout(suppressClickTimeout);
        suppressClickTimeout = null;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const handleWindowBlur = (): void => {
      candidatePointer = undefined;
      finishDragging(true);
    };

    ownerDocument.addEventListener('pointerdown', handlePointerDown, true);
    ownerDocument.addEventListener('pointermove', handlePointerMove, true);
    ownerDocument.addEventListener('pointerup', handlePointerUp, true);
    ownerDocument.addEventListener('pointercancel', handlePointerCancel, true);
    ownerDocument.addEventListener('click', handleClick, true);
    overlay.addEventListener('lostpointercapture', handleLostPointerCapture);
    ownerWindow.addEventListener('blur', handleWindowBlur);

    return {
      cancel: () => finishDragging(true),
      cleanup: () => {
        finishDragging(false);
        candidatePointer = undefined;
        suppressNextClick = false;
        if (suppressClickTimeout !== null) {
          ownerWindow.clearTimeout(suppressClickTimeout);
          suppressClickTimeout = null;
        }
        ownerDocument.removeEventListener(
          'pointerdown',
          handlePointerDown,
          true
        );
        ownerDocument.removeEventListener(
          'pointermove',
          handlePointerMove,
          true
        );
        ownerDocument.removeEventListener('pointerup', handlePointerUp, true);
        ownerDocument.removeEventListener(
          'pointercancel',
          handlePointerCancel,
          true
        );
        ownerDocument.removeEventListener('click', handleClick, true);
        overlay.removeEventListener(
          'lostpointercapture',
          handleLostPointerCapture
        );
        ownerWindow.removeEventListener('blur', handleWindowBlur);
      },
    };
  }

  private createProgressIndicatorElement(
    ownerDocument: Document
  ): HTMLDivElement {
    const progressIndicator = ownerDocument.createElement('div');
    const handle = ownerDocument.createElement('div');
    const handleIndicator = ownerDocument.createElement('div');
    progressIndicator.style.cssText = `
      width: 0%;
      height: 100%;
      position: relative;
      overflow: visible;
      background-color: ${DEFAULT_TIMELINE_PROGRESS_BACKGROUND};
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      backdrop-filter: blur(8px) saturate(140%);
    `;
    progressIndicator.classList.add('scrub-timeline-progress-indicator');
    this.updateProgressIndicatorColor(progressIndicator);

    handle.style.cssText = `
      width: 12px;
      height: 12px;
      position: absolute;
      top: 50%;
      right: 0px;
      transform: translate(50%, -50%);
      pointer-events: none;
    `;
    handle.classList.add('scrub-timeline-handle');
    handle.setAttribute('aria-hidden', 'true');

    handleIndicator.style.cssText = `
      width: 3px;
      height: 100%;
      position: absolute;
      top: 0px;
      right: 0px;
      transform: translateX(50%);
      background-color: white;
      pointer-events: none;
    `;
    handleIndicator.classList.add('scrub-timeline-handle-indicator');
    progressIndicator.appendChild(handle);
    progressIndicator.appendChild(handleIndicator);

    return progressIndicator;
  }

  private updateProgressIndicatorColor(progressIndicator: HTMLElement): void {
    if (!this.settingsManager.shouldColorizeTimeline()) {
      this.applyTimelineProgressColor(
        progressIndicator,
        DEFAULT_TIMELINE_PROGRESS_BACKGROUND
      );
      return;
    }

    void getProgressColor(progressIndicator.ownerDocument).then((color) => {
      if (this.settingsManager.shouldColorizeTimeline()) {
        this.applyTimelineProgressColor(
          progressIndicator,
          getColorizedTimelineBackground(color)
        );
      }
    });
  }

  private applyTimelineProgressColor(
    progressIndicator: HTMLElement,
    color: string
  ): void {
    const timeline = progressIndicator.closest<HTMLElement>('.scrub-timeline');
    timeline?.style.setProperty('--mfs-timeline-progress-color', color);
    progressIndicator.style.backgroundColor =
      timeline?.dataset.mfsYoutubeChaptered === 'true' ? 'transparent' : color;
  }

  private setTimelineProgress(
    timeline: HTMLDivElement,
    progress: number
  ): void {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    const progressIndicator =
      timeline.querySelector<HTMLElement>(
        ':scope > .scrub-timeline-progress-indicator'
      ) ?? (timeline.firstElementChild as HTMLElement | null);
    if (progressIndicator) {
      progressIndicator.style.width = `${clampedProgress * 100}%`;
    }

    const chapters = this.youtubeChapterModels.get(timeline);
    if (!chapters) return;

    const duration = chapters.at(-1)?.end ?? 0;
    if (!(duration > 0)) return;

    const fills = timeline.querySelectorAll<HTMLElement>(
      '.mfs-youtube-chapter-progress'
    );
    chapters.forEach((chapter, index) => {
      const chapterStart = chapter.start / duration;
      const chapterEnd = chapter.end / duration;
      const chapterProgress =
        clampedProgress <= chapterStart
          ? 0
          : clampedProgress >= chapterEnd
            ? 1
            : (clampedProgress - chapterStart) / (chapterEnd - chapterStart);
      const fill = fills[index];
      if (fill) {
        const percentage = Number((chapterProgress * 100).toFixed(6));
        fill.style.width = `${percentage}%`;
      }
    });
  }

  private updateYouTubeChapterGap(timeline: HTMLDivElement): void {
    const layer = timeline.querySelector<HTMLElement>(
      ':scope > .mfs-youtube-chapters'
    );
    if (!layer) return;

    const chapterCount = layer.childElementCount;
    const width =
      timeline.getBoundingClientRect().width || timeline.clientWidth;
    const gap =
      width > 0 && chapterCount > 1
        ? Math.min(YOUTUBE_CHAPTER_GAP_PX, width / (chapterCount - 1) / 2)
        : YOUTUBE_CHAPTER_GAP_PX;
    layer.style.gap = `${gap}px`;
  }

  private renderYouTubeChapterModel(
    timeline: HTMLDivElement,
    model: YouTubeChapterModelT | null
  ): void {
    const progressIndicator = timeline.querySelector<HTMLElement>(
      ':scope > .scrub-timeline-progress-indicator'
    );

    if (!model) {
      this.youtubeChapterModels.delete(timeline);
      timeline.querySelector(':scope > .mfs-youtube-chapters')?.remove();
      timeline.style.background = DEFAULT_TIMELINE_BACKGROUND;
      timeline.style.setProperty(
        '-webkit-backdrop-filter',
        'blur(8px) saturate(140%)'
      );
      timeline.style.backdropFilter = 'blur(8px) saturate(140%)';
      delete timeline.dataset.mfsYoutubeChapterSignature;
      delete timeline.dataset.mfsYoutubeChaptered;
      if (progressIndicator) {
        progressIndicator.style.backgroundColor =
          timeline.style.getPropertyValue('--mfs-timeline-progress-color') ||
          DEFAULT_TIMELINE_PROGRESS_BACKGROUND;
        progressIndicator.style.setProperty(
          '-webkit-backdrop-filter',
          'blur(8px) saturate(140%)'
        );
        progressIndicator.style.backdropFilter = 'blur(8px) saturate(140%)';
      }
      return;
    }

    const signature = JSON.stringify(model.chapters);
    if (timeline.dataset.mfsYoutubeChapterSignature === signature) {
      this.youtubeChapterModels.set(timeline, model.chapters);
      this.updateYouTubeChapterGap(timeline);
      return;
    }

    timeline.querySelector(':scope > .mfs-youtube-chapters')?.remove();
    const layer = timeline.ownerDocument.createElement('div');
    layer.className = 'mfs-youtube-chapters';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 0;
      display: flex;
      overflow: hidden;
      border-radius: inherit;
      pointer-events: none;
    `;

    model.chapters.forEach((chapter) => {
      const segment = timeline.ownerDocument.createElement('div');
      const fill = timeline.ownerDocument.createElement('div');
      segment.className = 'mfs-youtube-chapter-segment';
      segment.style.cssText = `
        position: relative;
        min-width: 0;
        overflow: hidden;
        background: ${DEFAULT_TIMELINE_BACKGROUND};
        -webkit-backdrop-filter: blur(8px) saturate(140%);
        backdrop-filter: blur(8px) saturate(140%);
      `;
      segment.style.flexGrow = String(chapter.end - chapter.start);
      segment.style.flexShrink = '1';
      segment.style.flexBasis = '0px';
      fill.className = 'mfs-youtube-chapter-progress';
      fill.style.cssText = `
        width: 0%;
        height: 100%;
        background: var(--mfs-timeline-progress-color, ${DEFAULT_TIMELINE_PROGRESS_BACKGROUND});
      `;
      segment.appendChild(fill);
      layer.appendChild(segment);
    });

    const currentColor =
      timeline.style.getPropertyValue('--mfs-timeline-progress-color') ||
      progressIndicator?.style.backgroundColor ||
      DEFAULT_TIMELINE_PROGRESS_BACKGROUND;
    timeline.style.setProperty('--mfs-timeline-progress-color', currentColor);
    timeline.style.background = 'transparent';
    timeline.style.setProperty('-webkit-backdrop-filter', 'none');
    timeline.style.backdropFilter = 'none';
    timeline.dataset.mfsYoutubeChaptered = 'true';
    timeline.dataset.mfsYoutubeChapterSignature = signature;
    this.youtubeChapterModels.set(timeline, model.chapters);
    if (progressIndicator) {
      progressIndicator.style.zIndex = '1';
      progressIndicator.style.backgroundColor = 'transparent';
      progressIndicator.style.setProperty('-webkit-backdrop-filter', 'none');
      progressIndicator.style.backdropFilter = 'none';
    }
    timeline.appendChild(layer);
    this.updateYouTubeChapterGap(timeline);

    const progress = Number.parseFloat(progressIndicator?.style.width ?? '0');
    this.setTimelineProgress(
      timeline,
      Number.isFinite(progress) ? progress / 100 : 0
    );
  }

  updateTimelineColorization(): void {
    this.videoStateManager.forEach((state) => {
      const progressIndicator = state.timeline.querySelector<HTMLElement>(
        '.scrub-timeline-progress-indicator'
      );
      if (progressIndicator) {
        this.updateProgressIndicatorColor(progressIndicator);
      }
    });
  }

  updateYouTubeChapteredTimelineState(): void {
    this.videoStateManager.forEach((state) => {
      state.updateYouTubeChapterMode?.();
    });

    if (this.settingsManager.isYouTubeChapteredTimelineEnabled?.() ?? false) {
      this.previewTimelines();
    }
  }

  private setupYouTubeChapterTimeline(
    video: HTMLVideoElement,
    state: VideoStateT
  ): { cleanup: () => void; updateEnabled: () => void } {
    const { ownerDocument } = video;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let mutationObserver: MutationObserver | null = null;
    let refreshFrame: number | null = null;
    let watching = false;

    const refresh = () => {
      refreshFrame = null;
      if (
        !(this.settingsManager.isYouTubeChapteredTimelineEnabled?.() ?? false)
      ) {
        this.renderYouTubeChapterModel(state.timeline, null);
        this.hideYouTubeChapterTooltip(state);
        return;
      }

      const model = extractYouTubeChapterModel({ ownerDocument, video });
      this.renderYouTubeChapterModel(state.timeline, model);
      if (!model) this.hideYouTubeChapterTooltip(state);
      const range = getMediaSeekRange(video);
      if (range) {
        this.setTimelineProgress(
          state.timeline,
          getMediaProgress(video, range)
        );
      }
    };

    const scheduleRefresh = () => {
      if (refreshFrame !== null) return;
      refreshFrame = ownerWindow.requestAnimationFrame(refresh);
    };

    const handleMutations = (mutations: MutationRecord[]) => {
      if (mutations.some(youtubeChapterMutationMayAffectModel)) {
        scheduleRefresh();
      }
    };

    const start = () => {
      if (watching || !state.youtubeChapterTooltip) return;
      watching = true;
      mutationObserver = new ownerWindow.MutationObserver(handleMutations);
      mutationObserver.observe(ownerDocument.documentElement, {
        attributeFilter: [
          'aria-orientation',
          'class',
          'href',
          'role',
          'style',
          'title',
        ],
        attributes: true,
        childList: true,
        subtree: true,
      });
      video.addEventListener('loadedmetadata', scheduleRefresh);
      video.addEventListener('durationchange', scheduleRefresh);
      ownerDocument.addEventListener('yt-navigate-finish', scheduleRefresh);
      ownerDocument.addEventListener('yt-page-data-updated', scheduleRefresh);
      ownerWindow.addEventListener('resize', scheduleRefresh, {
        passive: true,
      });
      scheduleRefresh();
    };

    const stop = () => {
      if (!watching) return;
      watching = false;
      mutationObserver?.disconnect();
      mutationObserver = null;
      video.removeEventListener('loadedmetadata', scheduleRefresh);
      video.removeEventListener('durationchange', scheduleRefresh);
      ownerDocument.removeEventListener('yt-navigate-finish', scheduleRefresh);
      ownerDocument.removeEventListener(
        'yt-page-data-updated',
        scheduleRefresh
      );
      ownerWindow.removeEventListener('resize', scheduleRefresh);
      if (refreshFrame !== null) {
        ownerWindow.cancelAnimationFrame(refreshFrame);
        refreshFrame = null;
      }
    };

    const updateEnabled = () => {
      if (this.settingsManager.isYouTubeChapteredTimelineEnabled?.() ?? false) {
        start();
        scheduleRefresh();
        return;
      }

      stop();
      this.renderYouTubeChapterModel(state.timeline, null);
      this.hideYouTubeChapterTooltip(state);
    };

    updateEnabled();
    return {
      cleanup: () => {
        stop();
        this.renderYouTubeChapterModel(state.timeline, null);
        this.hideYouTubeChapterTooltip(state);
      },
      updateEnabled,
    };
  }

  private hideYouTubeChapterTooltip(state: VideoStateT): void {
    if (!state.youtubeChapterTooltip) return;
    state.youtubeChapterTooltip.dataset.mfsVisible = 'false';
    state.youtubeChapterTooltip.setAttribute('aria-hidden', 'true');
  }

  private updateYouTubeChapterTooltipAtPoint(
    state: VideoStateT,
    clientX: number,
    clientY: number
  ): void {
    const tooltip = state.youtubeChapterTooltip;
    const chapters = this.youtubeChapterModels.get(state.timeline);
    if (
      !tooltip ||
      !chapters ||
      state.timeline.style.opacity !== '1' ||
      !(this.settingsManager.isYouTubeChapteredTimelineEnabled?.() ?? false)
    ) {
      this.hideYouTubeChapterTooltip(state);
      return;
    }

    const timelineRect = state.timeline.getBoundingClientRect();
    if (
      timelineRect.width <= 0 ||
      clientX < timelineRect.left ||
      clientX > timelineRect.right ||
      clientY < timelineRect.top ||
      clientY > timelineRect.bottom
    ) {
      this.hideYouTubeChapterTooltip(state);
      return;
    }

    const segments = state.timeline.querySelectorAll<HTMLElement>(
      '.mfs-youtube-chapter-segment'
    );
    const segmentIndex = Array.from(segments).findIndex((segment) => {
      const rect = segment.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right;
    });
    const title = chapters[segmentIndex]?.title;
    if (!title) {
      this.hideYouTubeChapterTooltip(state);
      return;
    }

    tooltip.textContent = title;
    tooltip.dataset.mfsVisible = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    const wrapperRect = state.wrapper.getBoundingClientRect();
    const tooltipWidth =
      tooltip.offsetWidth ||
      Math.min(title.length * 6 + 16, wrapperRect.width - 16);
    const halfWidth = tooltipWidth / 2;
    const relativeX = clientX - wrapperRect.left;
    const left = Math.min(
      Math.max(relativeX, halfWidth + 8),
      wrapperRect.width - halfWidth - 8
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.transform = 'translateX(-50%)';

    if (this.settingsManager.getTimelinePosition() === 'top') {
      tooltip.style.top = `${timelineRect.bottom - wrapperRect.top + 8}px`;
    } else {
      tooltip.style.top = `${
        timelineRect.top - wrapperRect.top - tooltip.offsetHeight - 8
      }px`;
    }
  }

  private createWrapperAndDebugIndicator(
    video: HTMLVideoElement,
    _videoId: string
  ): {
    scrubWrapper: HTMLDivElement;
    debugIndicator: HTMLAnchorElement;
  } {
    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const isPassiveYouTubePreview = DOMUtils.isYouTubeHoverPreview(video);
    const videoRect = (
      isPassiveYouTubePreview
        ? this.getPassivePreviewGeometrySource(video)
        : video
    ).getBoundingClientRect();
    const videoContainer = isPassiveYouTubePreview
      ? null
      : this.findOverlayHost(video);

    // Make sure the container has relative positioning
    if (
      videoContainer &&
      ownerWindow.getComputedStyle(videoContainer).position === 'static'
    ) {
      videoContainer.style.position = 'relative';
    }

    // Get video's position relative to its container
    const containerRect = videoContainer?.getBoundingClientRect();
    const relativeTop = isPassiveYouTubePreview
      ? videoRect.top
      : videoRect.top - (containerRect?.top ?? 0);
    const relativeLeft = isPassiveYouTubePreview
      ? videoRect.left
      : videoRect.left - (containerRect?.left ?? 0);

    // Create scrub wrapper div
    const scrubWrapper = ownerDocument.createElement('div');
    scrubWrapper.style.cssText = `
      position: ${isPassiveYouTubePreview ? 'fixed' : 'absolute'};
      top: ${relativeTop}px;
      left: ${relativeLeft}px;
      width: ${isPassiveYouTubePreview ? videoRect.width : video.offsetWidth}px;
      height: ${isPassiveYouTubePreview ? videoRect.height : video.offsetHeight}px;
      ${isPassiveYouTubePreview ? `z-index: ${PASSIVE_PREVIEW_Z_INDEX};` : ''}
      pointer-events: none;
    `;
    scrubWrapper.classList.add('scrub-wrapper');
    if (isPassiveYouTubePreview) {
      scrubWrapper.dataset.mfsPassivePreviewHost = 'true';
    }

    // Create debug indicator
    const debugIndicator = this.createDebugIndicator(ownerDocument);
    if (isPassiveYouTubePreview) {
      debugIndicator.style.setProperty('pointer-events', 'none', 'important');
    }

    return { scrubWrapper, debugIndicator };
  }

  private createDebugIndicator(ownerDocument: Document): HTMLAnchorElement {
    const debugIndicator = ownerDocument.createElement('a');
    debugIndicator.href = EXT_URL;
    debugIndicator.target = '_blank';
    debugIndicator.rel = 'noopener noreferrer';
    debugIndicator.title = 'View Better Video Controls on Chrome Web Store';
    debugIndicator.classList.add('scrub-debug-indicator');

    // Add extension icon and debug text
    debugIndicator.innerHTML = `
      <span class="scrub-debug-indicator-logo-container">
        <img
          class="scrub-debug-indicator-logo"
          src="${getAppLogoBase64()}"
          alt="BetterVideo"
        />
      </span>
      <div class="scrub-debug-indicator-text">
        <span class="scrub-debug-indicator-title">BetterVideo (Extension)</span>
        <span class="scrub-debug-indicator-subtitle">Debug mode enabled</span>
      </div>
    `;

    return debugIndicator;
  }

  private createMediaControlsElement(ownerDocument: Document): HTMLDivElement {
    const controls = ownerDocument.createElement('div');
    controls.className = 'mfs-media-controls';
    controls.hidden = true;
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Volume control');
    controls.innerHTML = `
      <button
        class="mfs-volume-pill"
        type="button"
        data-mfs-action="volume"
        aria-label="Volume"
        title="Drag or scroll to adjust volume; click to mute"
      >
        <span class="mfs-volume-fill" aria-hidden="true"></span>
        <svg
          class="mfs-volume-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path class="mfs-volume-icon-speaker" d="M3 10v4a1 1 0 0 0 1 1h2.6l3.7 3.7A1 1 0 0 0 12 18V6a1 1 0 0 0-1.7-.7L6.6 9H4a1 1 0 0 0-1 1Z"></path>
          <path class="mfs-volume-icon-wave mfs-volume-icon-wave-one" d="M14 9.5c2 1.5 2 3.5 0 5"></path>
          <path class="mfs-volume-icon-wave mfs-volume-icon-wave-two" d="M16.5 7.5c3.5 2.5 3.5 6.5 0 9"></path>
          <path class="mfs-volume-icon-wave mfs-volume-icon-wave-three" d="M18.5 5.5c5 3.5 5 9.5 0 13"></path>
          <path class="mfs-volume-icon-muted" d="M4.5 4.5 19.5 19.5"></path>
        </svg>
      </button>
    `;
    return controls;
  }

  private setupMediaControls(
    controls: HTMLDivElement,
    video: HTMLVideoElement,
    _debugMode: boolean
  ): {
    cleanup: () => void;
    preserveSourceVolume: () => void;
    sync: () => void;
  } {
    const ownerWindow = video.ownerDocument.defaultView ?? window;
    const volumePill = controls.querySelector<HTMLButtonElement>(
      '[data-mfs-action="volume"]'
    );

    if (!volumePill) {
      return {
        cleanup: () => {},
        preserveSourceVolume: () => {},
        sync: () => {},
      };
    }
    let lastAudibleVolume = video.volume > 0 ? video.volume : 1;
    let pointerStartY: number | null = null;
    let activePointerId: number | null = null;
    let suppressNextClick = false;
    let suppressClickTimeout: number | null = null;
    let sourceVolumeState = {
      muted: video.muted,
      volume: video.volume,
    };
    const preservesSiteVolume = (): boolean =>
      DOMUtils.isYouTubeHoverPreview(video);

    const syncVolume = (): void => {
      const volumePercent = Math.round(video.volume * 100);
      const isMuted = video.muted || video.volume === 0;
      const volumeLevel = isMuted
        ? 'muted'
        : volumePercent <= 33
          ? 'low'
          : volumePercent <= 66
            ? 'medium'
            : 'high';

      if (video.volume > 0 && !video.muted) lastAudibleVolume = video.volume;
      volumePill.style.setProperty('--mfs-volume', `${volumePercent}%`);
      volumePill.dataset.mfsMuted = String(isMuted);
      volumePill.dataset.mfsVolumeLevel = volumeLevel;
      volumePill.setAttribute(
        'aria-label',
        isMuted ? 'Unmute' : `Volume ${volumePercent}%, click to mute`
      );
      volumePill.setAttribute('aria-pressed', String(isMuted));
      volumePill.setAttribute('aria-valuenow', String(volumePercent));
      volumePill.setAttribute('aria-valuemin', '0');
      volumePill.setAttribute('aria-valuemax', '100');
      volumePill.title = isMuted
        ? 'Click to unmute; drag or scroll to adjust volume'
        : `Volume ${volumePercent}% · drag or scroll to adjust · click to mute`;
    };

    const syncPreferredVolume = (): void => {
      if (preservesSiteVolume()) {
        // Once YouTube owns this element as a thumbnail preview, subsequent
        // source-side changes become the state we preserve. The extension
        // must not freeze an earlier mute/volume snapshot over YouTube.
        sourceVolumeState = {
          muted: video.muted,
          volume: video.volume,
        };
        syncVolume();
        return;
      }
      syncVolume();
    };

    const handlePlaybackStart = (): void => {
      if (preservesSiteVolume()) {
        preserveSourceVolume();
        return;
      }
      syncVolume();
    };

    const handleVolumeChange = (): void => {
      if (preservesSiteVolume()) {
        syncPreferredVolume();
        return;
      }
      syncVolume();
    };

    const toggleMute = (): void => {
      if (video.muted || video.volume === 0) {
        if (video.volume === 0) video.volume = lastAudibleVolume;
        video.muted = false;
      } else {
        lastAudibleVolume = video.volume;
        video.muted = true;
      }
      syncVolume();
    };

    const setVolume = (nextVolume: number): void => {
      video.volume = Math.min(1, Math.max(0, nextVolume));
      video.muted = video.volume === 0;
      if (video.volume > 0) lastAudibleVolume = video.volume;
      syncVolume();
    };

    const setVolumeFromClientY = (clientY: number): void => {
      const rect = volumePill.getBoundingClientRect();
      if (rect.height <= 0) return;
      setVolume(1 - (clientY - rect.top) / rect.height);
    };

    const stopPlayerInteraction = (event: Event): void => {
      event.stopImmediatePropagation();
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        activePointerId !== null
      )
        return;

      pointerStartY = event.clientY;
      activePointerId = event.pointerId;
      suppressNextClick = false;
      controls.dataset.mfsInteracting = 'true';
      controls.dataset.mfsVisible = 'true';
      try {
        volumePill.setPointerCapture?.(event.pointerId);
      } catch {
        // Document-level movement is not needed because the pill normally
        // captures the pointer; browsers without capture still work in-bounds.
      }
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId || pointerStartY === null) return;
      if (
        !suppressNextClick &&
        Math.abs(event.clientY - pointerStartY) < VOLUME_DRAG_START_THRESHOLD_PX
      )
        return;

      suppressNextClick = true;
      volumePill.dataset.mfsDragging = 'true';
      event.preventDefault();
      setVolumeFromClientY(event.clientY);
    };

    const finishPointer = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;
      if (suppressNextClick) {
        event.preventDefault();
        setVolumeFromClientY(event.clientY);
      }
      try {
        if (volumePill.hasPointerCapture?.(event.pointerId)) {
          volumePill.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Pointer capture can already be gone after cancellation.
      }
      activePointerId = null;
      pointerStartY = null;
      volumePill.dataset.mfsDragging = 'false';
      delete controls.dataset.mfsInteracting;
      const controlsRect = volumePill.getBoundingClientRect();
      controls.dataset.mfsVisible = String(
        event.type !== 'pointercancel' &&
          event.clientX >= controlsRect.left &&
          event.clientX <= controlsRect.right &&
          event.clientY >= controlsRect.top &&
          event.clientY <= controlsRect.bottom
      );
      if (suppressNextClick) {
        if (suppressClickTimeout !== null) {
          ownerWindow.clearTimeout(suppressClickTimeout);
        }
        suppressClickTimeout = ownerWindow.setTimeout(() => {
          suppressNextClick = false;
          suppressClickTimeout = null;
        }, 0);
      }
    };

    const handleClick = (event: MouseEvent): void => {
      if (suppressNextClick) {
        suppressNextClick = false;
        if (suppressClickTimeout !== null) {
          ownerWindow.clearTimeout(suppressClickTimeout);
          suppressClickTimeout = null;
        }
        event.preventDefault();
        return;
      }
      toggleMute();
    };

    const handleWheel = (event: WheelEvent): void => {
      const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (rawDelta === 0) return;

      const deltaPixels = getWheelDeltaPixels(
        {
          deltaMode: event.deltaMode,
          deltaX: 0,
          deltaY: rawDelta,
        },
        Math.max(ownerWindow.innerHeight, 1)
      );

      event.preventDefault();
      const scrollDirection =
        this.settingsManager.shouldInvertHorizontalScroll() ? -1 : 1;
      setVolume(
        video.volume + deltaPixels * VOLUME_WHEEL_SENSITIVITY * scrollDirection
      );
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      setVolume(
        video.volume +
          (event.key === 'ArrowUp' ? VOLUME_KEY_STEP : -VOLUME_KEY_STEP)
      );
    };

    syncVolume();

    const stoppedEvents = [
      'pointerdown',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'keydown',
      'keyup',
      'wheel',
    ];

    stoppedEvents.forEach((eventName) => {
      controls.addEventListener(eventName, stopPlayerInteraction);
    });
    volumePill.addEventListener('pointerdown', handlePointerDown);
    volumePill.addEventListener('pointermove', handlePointerMove);
    volumePill.addEventListener('pointerup', finishPointer);
    volumePill.addEventListener('pointercancel', finishPointer);
    volumePill.addEventListener('click', handleClick);
    volumePill.addEventListener('wheel', handleWheel, { passive: false });
    volumePill.addEventListener('keydown', handleKeyDown);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('play', handlePlaybackStart);

    function preserveSourceVolume(): void {
      if (!preservesSiteVolume()) return;
      if (video.volume !== sourceVolumeState.volume) {
        video.volume = sourceVolumeState.volume;
      }
      if (video.muted !== sourceVolumeState.muted) {
        video.muted = sourceVolumeState.muted;
      }
      syncVolume();
    }

    return {
      cleanup: () => {
        if (suppressClickTimeout !== null) {
          ownerWindow.clearTimeout(suppressClickTimeout);
          suppressClickTimeout = null;
        }
        stoppedEvents.forEach((eventName) => {
          controls.removeEventListener(eventName, stopPlayerInteraction);
        });
        volumePill.removeEventListener('pointerdown', handlePointerDown);
        volumePill.removeEventListener('pointermove', handlePointerMove);
        volumePill.removeEventListener('pointerup', finishPointer);
        volumePill.removeEventListener('pointercancel', finishPointer);
        volumePill.removeEventListener('click', handleClick);
        volumePill.removeEventListener('wheel', handleWheel);
        volumePill.removeEventListener('keydown', handleKeyDown);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('play', handlePlaybackStart);
        delete controls.dataset.mfsInteracting;
      },
      preserveSourceVolume,
      sync: syncPreferredVolume,
    };
  }

  private insertWrapperIntoDOM(
    video: HTMLVideoElement,
    scrubWrapper: HTMLDivElement
  ): void {
    if (scrubWrapper.dataset.mfsPassivePreviewHost === 'true') {
      // Keep extension DOM outside YouTube's thumbnail renderer. Mutating the
      // renderer while the pointer is stationary can cancel its native hover
      // animation even when every extension layer is pointer-transparent.
      video.ownerDocument.documentElement.appendChild(scrubWrapper);
      return;
    }

    const videoContainer = this.findOverlayHost(video);

    // Keep the overlay near the video when its immediate parent is also the
    // positioning host. Some players (notably TikTok) put the video inside
    // zero-size intermediary elements, in which case the wrapper belongs in a
    // higher ancestor instead.
    if (video.parentElement === videoContainer && video.nextSibling) {
      videoContainer.insertBefore(scrubWrapper, video.nextSibling);
    } else {
      videoContainer.appendChild(scrubWrapper);
    }
  }

  /**
   * Find a positioning host with real layout dimensions.
   *
   * Setting a zero-height intermediary to `position: relative` changes the
   * containing block of an absolutely positioned `height: 100%` video. TikTok
   * uses exactly that structure, which collapses the moving video layer while
   * audio continues playing. Skip such layout-only wrappers and anchor the
   * overlay to the first ancestor that actually contains the visible video.
   */
  private findOverlayHost(video: HTMLVideoElement): HTMLElement {
    let candidate = video.parentElement;

    while (candidate) {
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return candidate;
      candidate = candidate.parentElement;
    }

    return video.parentElement || video.ownerDocument.body;
  }

  private setupPlayerClickHandling(
    scrubOverlay: HTMLDivElement,
    video: HTMLVideoElement,
    debugMode: boolean,
    getIsHovering: () => boolean = () => false
  ): {
    cleanup: () => void;
    setPlayback: (shouldPlay: boolean) => void;
    sync: () => void;
    togglePlayback: () => void;
  } {
    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let feedbackElement: HTMLDivElement | null = null;
    let feedbackTimeout: number | null = null;
    let playbackClickTimeout: number | null = null;

    const clearFeedback = (): void => {
      if (feedbackTimeout !== null) {
        ownerWindow.clearTimeout(feedbackTimeout);
        feedbackTimeout = null;
      }
      feedbackElement?.remove();
      feedbackElement = null;
    };

    const showFeedback = (
      action: 'play' | 'pause',
      persistent = false
    ): void => {
      clearFeedback();

      feedbackElement = ownerDocument.createElement('div');
      feedbackElement.className = 'mfs-playback-feedback';
      feedbackElement.dataset.mfsPlaybackFeedback = action;
      if (persistent) feedbackElement.dataset.mfsPersistent = 'true';
      feedbackElement.setAttribute('aria-hidden', 'true');
      feedbackElement.innerHTML =
        action === 'play'
          ? '<svg viewBox="0 0 24 24"><path d="M8.4 4.6C7.35 3.93 6 4.68 6 5.93v12.14c0 1.25 1.35 2 2.4 1.33l9.54-6.07a1.58 1.58 0 0 0 0-2.66L8.4 4.6Z" /></svg>'
          : '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.75" /><rect x="14" y="4" width="5" height="16" rx="1.75" /></svg>';
      (scrubOverlay.parentElement ?? scrubOverlay).appendChild(feedbackElement);

      if (!persistent) {
        feedbackTimeout = ownerWindow.setTimeout(clearFeedback, 650);
      }
    };

    const syncPausedFeedback = (): void => {
      const shouldShowPause =
        getIsHovering() && this.shouldShowPausedPlaybackUi(video);

      if (shouldShowPause) {
        if (
          feedbackElement?.dataset.mfsPlaybackFeedback !== 'pause' ||
          feedbackElement.dataset.mfsPersistent !== 'true'
        ) {
          showFeedback('pause', true);
        }
      } else if (feedbackElement?.dataset.mfsPlaybackFeedback === 'pause') {
        clearFeedback();
      }
    };

    const canTogglePlayback = (event: MouseEvent): boolean =>
      event.button === 0 &&
      !DOMUtils.isYouTubeHoverPreview(video) &&
      this.settingsManager.shouldHideVideoControls() &&
      getMediaSeekRange(video) !== null;

    const setPlayback = (shouldPlay: boolean): void => {
      if (shouldPlay) {
        if (!video.paused) return;
        showFeedback('play');
        void video.play().catch((error) => {
          if (debugMode) {
            console.warn('Unable to play video from overlay click:', error);
          }
        });
        return;
      }

      if (video.paused) return;
      showFeedback('pause', getIsHovering());
      video.pause();
    };

    const togglePlayback = (): void => setPlayback(video.paused);

    const clearScheduledPlaybackToggle = (): void => {
      if (playbackClickTimeout === null) return;
      ownerWindow.clearTimeout(playbackClickTimeout);
      playbackClickTimeout = null;
    };

    const schedulePlaybackToggle = (): void => {
      clearScheduledPlaybackToggle();
      playbackClickTimeout = ownerWindow.setTimeout(() => {
        playbackClickTimeout = null;
        togglePlayback();
      }, PLAYER_SINGLE_CLICK_DELAY_MS);
    };

    const isVideoFullscreen = (): boolean => {
      const fullscreenElement = ownerDocument.fullscreenElement;
      return Boolean(
        fullscreenElement &&
          (fullscreenElement === video || fullscreenElement.contains(video))
      );
    };

    const toggleFullscreen = async (): Promise<void> => {
      try {
        if (isVideoFullscreen()) {
          await ownerDocument.exitFullscreen?.();
        } else {
          const fullscreenTarget =
            this.findPlayerControlsContainer(video) ??
            video.parentElement ??
            video;
          await fullscreenTarget.requestFullscreen?.();
        }
      } catch (error) {
        if (debugMode) {
          console.warn('Unable to toggle fullscreen for video:', error);
        }
      }
    };

    const isExtensionControlEvent = (event: MouseEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof ownerWindow.Element &&
            target.matches(
              '.mfs-media-controls, .mfs-media-controls *, .scrub-timeline, .scrub-timeline *, .scrub-debug-indicator, .scrub-debug-indicator *'
            )
        );

    const isInsidePlayer = (event: MouseEvent): boolean => {
      const playerRect = (
        scrubOverlay.parentElement ?? scrubOverlay
      ).getBoundingClientRect();
      return (
        playerRect.width > 0 &&
        playerRect.height > 0 &&
        event.clientX >= playerRect.left &&
        event.clientX <= playerRect.right &&
        event.clientY >= playerRect.top &&
        event.clientY <= playerRect.bottom
      );
    };

    const isOwnedByPlayer = (event: MouseEvent): boolean => {
      const player = this.findPlayerControlsContainer(video);
      if (
        !player ||
        player === ownerDocument.body ||
        player === ownerDocument.documentElement
      )
        return false;

      return event.composedPath().includes(player);
    };

    const isModalEvent = (event: MouseEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof ownerWindow.Element &&
            target.matches('dialog, [role="dialog"], [aria-modal="true"]')
        );

    const isSiteInteractiveControlEvent = (event: MouseEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof ownerWindow.Element &&
            target.matches(SITE_INTERACTIVE_SELECTOR) &&
            !target.closest(EXTENSION_UI_SELECTOR)
        );

    const handleClick = (event: MouseEvent): void => {
      if (!canTogglePlayback(event)) return;

      event.preventDefault();
      event.stopPropagation();
      schedulePlaybackToggle();
    };

    const handlePlayerLayerClick = (event: MouseEvent): void => {
      if (!canTogglePlayback(event)) return;

      const path = event.composedPath();
      if (path.includes(scrubOverlay) || isExtensionControlEvent(event)) return;
      if (
        isSiteInteractiveControlEvent(event) ||
        isModalEvent(event) ||
        !isOwnedByPlayer(event) ||
        !isInsidePlayer(event)
      )
        return;

      // Custom players such as YouTube and Instagram can put their click layer
      // above the video. Capture the click before their handler can display a
      // native play/pause bezel, then use only our own playback feedback.
      event.preventDefault();
      event.stopImmediatePropagation();
      schedulePlaybackToggle();
    };

    const handleDoubleClick = (event: MouseEvent): void => {
      if (!canTogglePlayback(event)) return;

      clearScheduledPlaybackToggle();
      event.preventDefault();
      event.stopPropagation();
      void toggleFullscreen();
    };

    const handlePlayerLayerDoubleClick = (event: MouseEvent): void => {
      if (!canTogglePlayback(event)) return;

      const path = event.composedPath();
      if (
        path.includes(scrubOverlay) ||
        isExtensionControlEvent(event) ||
        isSiteInteractiveControlEvent(event) ||
        isModalEvent(event) ||
        !isOwnedByPlayer(event) ||
        !isInsidePlayer(event)
      )
        return;

      clearScheduledPlaybackToggle();
      event.preventDefault();
      event.stopImmediatePropagation();
      void toggleFullscreen();
    };

    scrubOverlay.addEventListener('click', handleClick);
    scrubOverlay.addEventListener('dblclick', handleDoubleClick);
    ownerDocument.addEventListener('click', handlePlayerLayerClick, true);
    ownerDocument.addEventListener(
      'dblclick',
      handlePlayerLayerDoubleClick,
      true
    );
    video.addEventListener('pause', syncPausedFeedback);
    video.addEventListener('play', syncPausedFeedback);
    video.addEventListener('loadedmetadata', syncPausedFeedback);

    return {
      cleanup: () => {
        clearScheduledPlaybackToggle();
        scrubOverlay.removeEventListener('click', handleClick);
        scrubOverlay.removeEventListener('dblclick', handleDoubleClick);
        ownerDocument.removeEventListener(
          'click',
          handlePlayerLayerClick,
          true
        );
        ownerDocument.removeEventListener(
          'dblclick',
          handlePlayerLayerDoubleClick,
          true
        );
        video.removeEventListener('pause', syncPausedFeedback);
        video.removeEventListener('play', syncPausedFeedback);
        video.removeEventListener('loadedmetadata', syncPausedFeedback);
        clearFeedback();
      },
      setPlayback,
      sync: syncPausedFeedback,
      togglePlayback,
    };
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

    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let currentElement = this.getComposedParentElement(video, ownerWindow);

    while (currentElement && currentElement !== ownerDocument.body) {
      const elementRect = currentElement.getBoundingClientRect();
      const elementWidth = elementRect.width;
      const elementHeight = elementRect.height;

      // Check if dimensions are similar (within margin)
      const widthDiff = Math.abs(elementWidth - videoWidth);
      const heightDiff = Math.abs(elementHeight - videoHeight);

      if (widthDiff <= margin && heightDiff <= margin) {
        const computedStyle = ownerWindow.getComputedStyle(currentElement);
        if (this.hasVisualClipping(computedStyle)) {
          return currentElement;
        }
      }

      currentElement = this.getComposedParentElement(
        currentElement,
        ownerWindow
      );
    }

    return null;
  }

  /**
   * Calculate overlay dimensions based on action area setting and size
   * Single source of truth for action area positioning logic
   */
  private calculateActionAreaDimensions(
    targetHeight: number,
    actionArea: ActionAreaT,
    actionAreaSize = this.settingsManager.getActionAreaSize(),
    actionAreaSizeUnit = this.settingsManager.getActionAreaSizeUnit()
  ): { top: number; height: number } {
    const partialHeight = Math.min(
      targetHeight,
      actionAreaSizeUnit === '%'
        ? targetHeight * (actionAreaSize / 100)
        : actionAreaSize
    );

    switch (actionArea) {
      case ActionAreaE.Top:
        return { top: 0, height: partialHeight };
      case ActionAreaE.Middle: {
        return {
          top: (targetHeight - partialHeight) / 2,
          height: partialHeight,
        };
      }
      case ActionAreaE.Bottom: {
        return {
          top: targetHeight - partialHeight,
          height: partialHeight,
        };
      }
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

      const isPassivePreview =
        scrubWrapper.dataset.mfsPassivePreviewHost === 'true';
      // YouTube can render a vertical video taller than the thumbnail and clip
      // it to cover the available media area. Use that clipping rectangle for
      // passive previews; the raw <video> can extend into card metadata.
      const visibleContainer = isPassivePreview
        ? this.getPassivePreviewGeometrySource(video)
        : this.findVisibleVideoContainer(video);
      const targetElement = visibleContainer ?? video;
      const targetRect = targetElement.getBoundingClientRect();
      let relativeTop = targetRect.top;
      let relativeLeft = targetRect.left;

      if (!isPassivePreview) {
        const videoContainer = this.findOverlayHost(video);
        const containerRect = videoContainer.getBoundingClientRect();
        relativeTop -= containerRect.top;
        relativeLeft -= containerRect.left;
      }

      // Always position wrapper to match the full video area
      scrubWrapper.style.position = isPassivePreview ? 'fixed' : 'absolute';
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

  // Update existing action areas in place so their new region can be previewed
  // without interrupting the video's overlay state.
  updateAllOverlaysForActionArea(
    previewDurationMs = ACTION_AREA_PREVIEW_MS,
    actionArea = this.settingsManager.getActionArea(),
    actionAreaSize = this.settingsManager.getActionAreaSize(),
    actionAreaSizeUnit = this.settingsManager.getActionAreaSizeUnit(),
    restoreAfterPreview = false
  ): void {
    const debugMode = this.settingsManager.isDebugEnabled();

    if (debugMode) {
      console.log('🎯 Updating and previewing changed action areas');
    }

    this.videoStateManager.forEach((state, video) => {
      const { overlay, wrapper } = state;
      const ownerWindow = video.ownerDocument.defaultView ?? window;
      const wrapperRect = wrapper.getBoundingClientRect();
      const { top, height } = this.calculateActionAreaDimensions(
        wrapperRect.height,
        actionArea,
        actionAreaSize,
        actionAreaSizeUnit
      );
      const existingTimeout = this.actionAreaPreviewTimeouts.get(overlay);

      if (existingTimeout !== undefined) {
        ownerWindow.clearTimeout(existingTimeout);
      }

      if (!this.actionAreaOriginalBackgrounds.has(overlay)) {
        this.actionAreaOriginalBackgrounds.set(
          overlay,
          overlay.style.backgroundColor
        );
        this.actionAreaOriginalBoxShadows.set(overlay, overlay.style.boxShadow);
        this.actionAreaOriginalTransitions.set(
          overlay,
          overlay.style.transition
        );
      }

      const reduceMotion =
        ownerWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false;
      overlay.style.transition = reduceMotion
        ? 'none'
        : `top ${SETTINGS_LAYOUT_TRANSITION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), height ${SETTINGS_LAYOUT_TRANSITION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 300ms ease, box-shadow 300ms ease`;
      overlay.style.top = `${top}px`;
      overlay.style.height = `${height}px`;
      overlay.style.backgroundColor = ACTION_AREA_PREVIEW_BACKGROUND;
      overlay.style.boxShadow = ACTION_AREA_PREVIEW_BORDER;

      const fadeDelay = Math.max(0, previewDurationMs - 300);
      const fadeTimeout = ownerWindow.setTimeout(() => {
        overlay.style.backgroundColor =
          this.actionAreaOriginalBackgrounds.get(overlay) ?? '';
        overlay.style.boxShadow =
          this.actionAreaOriginalBoxShadows.get(overlay) ?? '';

        if (restoreAfterPreview) {
          const restoredDimensions = this.calculateActionAreaDimensions(
            wrapper.getBoundingClientRect().height,
            this.settingsManager.getActionArea()
          );
          overlay.style.top = `${restoredDimensions.top}px`;
          overlay.style.height = `${restoredDimensions.height}px`;
        }

        const cleanupTimeout = ownerWindow.setTimeout(
          () => {
            overlay.style.transition =
              this.actionAreaOriginalTransitions.get(overlay) ?? '';
            this.actionAreaPreviewTimeouts.delete(overlay);
            this.actionAreaOriginalBackgrounds.delete(overlay);
            this.actionAreaOriginalBoxShadows.delete(overlay);
            this.actionAreaOriginalTransitions.delete(overlay);
          },
          reduceMotion ? 0 : 300
        );

        this.actionAreaPreviewTimeouts.set(overlay, cleanupTimeout);
      }, fadeDelay);

      this.actionAreaPreviewTimeouts.set(overlay, fadeTimeout);
    });
  }

  previewActionArea(
    actionArea: ActionAreaT,
    actionAreaSize: number,
    actionAreaSizeUnit = this.settingsManager.getActionAreaSizeUnit()
  ): void {
    this.updateAllOverlaysForActionArea(
      60_000,
      actionArea,
      actionAreaSize,
      actionAreaSizeUnit,
      true
    );
  }

  clearActionAreaPreview(): void {
    this.updateAllOverlaysForActionArea(0);
  }

  updateTimelineSeekingState(): void {
    this.videoStateManager.forEach((state, video) => {
      const isInteractive = this.updateTimelineInteractivityForVideo(
        video,
        state.timeline
      );

      if (!isInteractive) state.cancelTimelineSeeking?.();
      const canDragVideo = this.updateVideoDraggingForVideo(video, state);
      if (!canDragVideo) state.cancelVideoDragging?.();
      this.updateTimelineHoverState(video, state, state.isHovering);
    });
  }

  updateScrollSeekingState(): void {
    this.videoStateManager.forEach((state, video) => {
      this.updateOverlayPointerEvents(video, state);
    });
  }

  /**
   * Apply timeline layout settings with motion that is limited to the popup
   * interaction. Keeping the transition temporary prevents a portaled timeline
   * from lagging behind its video during normal page scrolling or resizing.
   */
  updateTimelineLayoutWithAnimation(): void {
    this.videoStateManager.forEach((state, video) => {
      const { timeline } = state;
      const ownerWindow = video.ownerDocument.defaultView ?? window;
      const existingTimeout = this.timelineLayoutTimeouts.get(timeline);

      if (existingTimeout !== undefined) {
        ownerWindow.clearTimeout(existingTimeout);
      }

      const reduceMotion =
        ownerWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false;
      timeline.style.transition = reduceMotion
        ? 'opacity 0.3s ease'
        : `opacity 0.3s ease, top ${SETTINGS_LAYOUT_TRANSITION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), height ${SETTINGS_LAYOUT_TRANSITION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

      if (!reduceMotion) {
        const timeout = ownerWindow.setTimeout(() => {
          this.timelineLayoutTimeouts.delete(timeline);
          timeline.style.transition = 'opacity 0.3s ease';
        }, SETTINGS_LAYOUT_TRANSITION_MS + 50);
        this.timelineLayoutTimeouts.set(timeline, timeout);
      }
    });

    this.updateTimelineSeekingState();
  }

  updateVideoDraggingState(): void {
    this.videoStateManager.forEach((state, video) => {
      const canDragVideo = this.updateVideoDraggingForVideo(video, state);
      if (!canDragVideo) state.cancelVideoDragging?.();
    });
  }

  private updateVideoDraggingForVideo(
    video: HTMLVideoElement,
    state: VideoStateT
  ): boolean {
    const canDragVideo =
      !DOMUtils.isYouTubeHoverPreview(video) &&
      (this.settingsManager.shouldDragVideoToSeek?.() ?? false) &&
      getMediaSeekRange(video) !== null;

    state.overlay.dataset.mfsVideoDragging = String(canDragVideo);
    state.overlay.style.touchAction = canDragVideo ? 'pan-y' : '';

    if (state.isVideoDragging) {
      state.overlay.style.cursor = 'pointer';
    } else if (canDragVideo) {
      state.overlay.style.cursor = 'pointer';
    } else if (
      (this.settingsManager.shouldHideVideoControls?.() ?? false) &&
      getMediaSeekRange(video) !== null
    ) {
      state.overlay.style.cursor = 'pointer';
    } else {
      state.overlay.style.cursor = '';
    }

    return canDragVideo;
  }

  updateVideoControlsVisibility(): void {
    this.videoStateManager.forEach((state, video) => {
      this.updateVideoControlsForVideo(video, state);
    });
  }

  private updateVideoControlsForVideo(
    video: HTMLVideoElement,
    state: VideoStateT
  ): void {
    const shouldHide =
      !DOMUtils.isYouTubeHoverPreview(video) &&
      this.settingsManager.shouldHideVideoControls() &&
      getMediaSeekRange(video) !== null;

    if (!shouldHide) {
      if (state.wrapper.dataset.mfsPassivePreviewHost === 'true') {
        // Controls/settings reconciliation runs immediately after the wrapper
        // is created and whenever popup settings change. Keep the passive
        // YouTube timeline above the thumbnail through those refreshes.
        state.wrapper.style.zIndex = PASSIVE_PREVIEW_Z_INDEX;
      } else {
        state.wrapper.style.removeProperty('z-index');
      }
      if (state.mediaControls) {
        state.mediaControls.hidden = true;
        state.mediaControls.dataset.mfsActive = 'false';
        state.mediaControls.dataset.mfsVisible = 'false';
        state.mediaControls.dataset.mfsVideoHovered = 'false';
      }
      this.updateMediaControlsPlacement(video, state);
      if (state.videoControlsBeforeHide !== undefined) {
        video.controls = state.videoControlsBeforeHide;
        state.videoControlsBeforeHide = undefined;
      }

      video.removeAttribute('data-mfs-hide-controls');
      state.hiddenControlsContainer?.removeAttribute(
        'data-mfs-hide-controls-container'
      );
      this.clearInstagramPlayerChrome(state.hiddenControlsContainer);
      state.hiddenControlsContainer?.removeAttribute(
        'data-mfs-instagram-player'
      );
      state.hiddenControlsContainer?.removeAttribute('data-mfs-tiktok-player');
      state.hiddenControlsContainer = undefined;
      state.syncMediaControls?.();
      state.syncPlaybackFeedback?.();
      this.updateVideoDraggingForVideo(video, state);
      this.updateTimelineHoverState(video, state, state.isHovering);
      return;
    }

    if (state.videoControlsBeforeHide === undefined) {
      state.videoControlsBeforeHide = video.controls;
    }

    video.controls = false;
    video.setAttribute('data-mfs-hide-controls', 'true');
    // Keep the scrub layer local to the player stacking context. A global
    // maximum z-index makes a transparent layer win hit-testing over site
    // dialogs even when the dialog is painted above the video.
    state.wrapper.style.removeProperty('z-index');
    if (state.mediaControls) {
      state.mediaControls.hidden = false;
      state.mediaControls.dataset.mfsActive = 'true';
      state.mediaControls.dataset.mfsVisible = 'false';
      state.mediaControls.dataset.mfsVideoHovered = String(
        state.isPointerHovering === true
      );
    }
    this.updateMediaControlsPlacement(video, state);

    const controlsContainer = this.findPlayerControlsContainer(video);
    if (state.hiddenControlsContainer !== controlsContainer) {
      state.hiddenControlsContainer?.removeAttribute(
        'data-mfs-hide-controls-container'
      );
      this.clearInstagramPlayerChrome(state.hiddenControlsContainer);
      state.hiddenControlsContainer?.removeAttribute(
        'data-mfs-instagram-player'
      );
      state.hiddenControlsContainer?.removeAttribute('data-mfs-tiktok-player');
      state.hiddenControlsContainer = controlsContainer ?? undefined;
    }
    controlsContainer?.setAttribute('data-mfs-hide-controls-container', 'true');
    if (controlsContainer && this.isInstagramVideo(video)) {
      controlsContainer.setAttribute('data-mfs-instagram-player', 'true');
      this.markInstagramPlayerChrome(video, controlsContainer);
    } else {
      controlsContainer?.removeAttribute('data-mfs-instagram-player');
    }
    if (controlsContainer && this.isTikTokVideo(video)) {
      controlsContainer.setAttribute('data-mfs-tiktok-player', 'true');
    } else {
      controlsContainer?.removeAttribute('data-mfs-tiktok-player');
    }
    state.syncMediaControls?.();
    state.syncPlaybackFeedback?.();
    this.updateVideoDraggingForVideo(video, state);
    this.updateTimelineHoverState(video, state, state.isHovering);
  }

  private updateMediaControlsPlacement(
    video: HTMLVideoElement,
    state: VideoStateT
  ): void {
    const controls = state.mediaControls;
    if (!controls) return;

    if (controls.hidden || controls.dataset.mfsActive !== 'true') {
      if (controls.parentElement !== state.wrapper) {
        state.wrapper.appendChild(controls);
      }
      controls.style.position = '';
      controls.style.left = '';
      controls.style.right = '';
      controls.style.top = '';
      delete controls.dataset.mfsPortaled;
      return;
    }

    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const fullscreenElement = ownerDocument.fullscreenElement;
    const portalHost =
      fullscreenElement?.contains(video) ||
      fullscreenElement?.contains(state.wrapper)
        ? fullscreenElement
        : ownerDocument.documentElement;
    const videoRect = state.wrapper.getBoundingClientRect();
    const controlsWidth =
      controls.getBoundingClientRect().width || VOLUME_CONTROL_WIDTH_PX;
    let portalLeft =
      videoRect.right -
      controlsWidth -
      VOLUME_EDGE_GAP_PX +
      ownerWindow.scrollX;
    let portalTop = videoRect.top + videoRect.height / 2 + ownerWindow.scrollY;

    if (portalHost !== ownerDocument.documentElement) {
      const portalRect = portalHost.getBoundingClientRect();
      portalLeft =
        videoRect.right -
        portalRect.left +
        portalHost.scrollLeft -
        portalHost.clientLeft -
        controlsWidth -
        VOLUME_EDGE_GAP_PX;
      portalTop =
        videoRect.top -
        portalRect.top +
        portalHost.scrollTop -
        portalHost.clientTop +
        videoRect.height / 2;
    }

    if (controls.parentElement !== portalHost) portalHost.appendChild(controls);
    controls.style.position = 'absolute';
    controls.style.left = `${portalLeft}px`;
    controls.style.right = 'auto';
    controls.style.top = `${portalTop}px`;
    controls.dataset.mfsPortaled = 'true';
  }

  private findPlayerControlsContainer(
    video: HTMLVideoElement
  ): HTMLElement | null {
    const instagramPlayer = this.findInstagramPlayerContainer(video);
    const tiktokPlayer = this.findTikTokPlayerContainer(video);
    const knownPlayer = video.closest<HTMLElement>(
      [
        '.html5-video-player',
        '#player.player',
        '.vp-player-layout',
        '.responsive_menu_ignore_touch',
        '[data-a-target="video-player"]',
        '[data-uia="video-canvas"]',
      ].join(',')
    );

    return (
      instagramPlayer ??
      tiktokPlayer ??
      knownPlayer ??
      this.findVisibleVideoContainer(video) ??
      video.parentElement
    );
  }

  private isInstagramVideo(video: HTMLVideoElement): boolean {
    const hostname = video.ownerDocument.location.hostname.toLowerCase();
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
  }

  private isTikTokVideo(video: HTMLVideoElement): boolean {
    const hostname = video.ownerDocument.location.hostname.toLowerCase();
    return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
  }

  private findTikTokPlayerContainer(
    video: HTMLVideoElement
  ): HTMLElement | null {
    if (!this.isTikTokVideo(video)) return null;

    // TikTok's generated class names change frequently. Prefer its stable
    // player-level data marker so all of that video's chrome can be scoped
    // without accidentally affecting page-level onboarding/login dialogs.
    const markedPlayer =
      video.closest<HTMLElement>(
        '[data-e2e="recommend-list-item-container"]'
      ) ??
      video.closest<HTMLElement>(
        '[data-e2e="feed-video"], [data-e2e="browse-video"]'
      );
    if (markedPlayer) return markedPlayer;

    const ownerDocument = video.ownerDocument;
    let current = video.parentElement;

    while (current && current !== ownerDocument.body) {
      if (
        current.querySelector(
          '[class*="DivVolumeControlContainer"], button[aria-label="Volume" i]'
        )
      ) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  private findInstagramPlayerContainer(
    video: HTMLVideoElement
  ): HTMLElement | null {
    if (!this.isInstagramVideo(video)) return null;

    const ownerDocument = video.ownerDocument;
    let current = video.parentElement;

    while (current && current !== ownerDocument.body) {
      const children = Array.from(current.children);
      const hasVideoBranch = children.some(
        (child) => child === video || child.contains(video)
      );
      const hasReelMetadataBranch = children.some(
        (child) =>
          child !== video &&
          !child.contains(video) &&
          child.querySelector('a[href*="/reels/"]')
      );

      if (hasVideoBranch && hasReelMetadataBranch) return current;
      current = current.parentElement;
    }

    return null;
  }

  private markInstagramPlayerChrome(
    video: HTMLVideoElement,
    player: HTMLElement
  ): void {
    this.clearInstagramPlayerChrome(player);

    let videoBranch: Element = video;
    while (videoBranch !== player && videoBranch.parentElement) {
      const parent = videoBranch.parentElement;
      Array.from(parent.children).forEach((sibling) => {
        if (
          sibling !== videoBranch &&
          !sibling.classList.contains('scrub-wrapper')
        ) {
          sibling.setAttribute('data-mfs-instagram-chrome', 'true');
        }
      });
      videoBranch = parent;
    }
  }

  private clearInstagramPlayerChrome(player?: HTMLElement): void {
    player
      ?.querySelectorAll('[data-mfs-instagram-chrome]')
      .forEach((element) => {
        element.removeAttribute('data-mfs-instagram-chrome');
      });
  }

  /**
   * Briefly reveal every existing timeline so popup setting changes are
   * visible on the videos themselves, even when hover display is disabled.
   */
  previewTimelines(durationMs = 1200): void {
    this.videoStateManager.forEach((state, video) => {
      const { timeline } = state;
      const ownerWindow = video.ownerDocument.defaultView ?? window;
      const existingTimeout = this.timelinePreviewTimeouts.get(timeline);

      if (existingTimeout !== undefined) {
        ownerWindow.clearTimeout(existingTimeout);
      }

      const range = getMediaSeekRange(video);
      if (!range) {
        timeline.style.opacity = '0';
        return;
      }

      this.setTimelineProgress(timeline, getMediaProgress(video, range));

      timeline.dataset.mfsSettingsPreview = 'true';
      timeline.style.opacity = '1';

      const timeout = ownerWindow.setTimeout(() => {
        this.timelinePreviewTimeouts.delete(timeline);
        delete timeline.dataset.mfsSettingsPreview;

        const shouldRemainVisible =
          state.isUserScrubbing ||
          ((this.settingsManager.shouldShowTimelineOnHover() ||
            this.settingsManager.isTimelineSeekingEnabled()) &&
            state.isHovering);

        if (!shouldRemainVisible) {
          timeline.style.opacity = '0';
        }
      }, durationMs);

      this.timelinePreviewTimeouts.set(timeline, timeout);
    });
  }

  private createContentWidthUpdater(
    video: HTMLVideoElement,
    scrollContent: HTMLDivElement,
    overlay: HTMLDivElement,
    setIsSettingInitialScroll: (value: boolean) => void
  ): () => void {
    return () => {
      if (!scrollContent || !overlay) return;

      const baseWidth = video.offsetWidth || 800; // Fallback width if video not loaded
      const range = getMediaSeekRange(video);
      let finalWidth = baseWidth * 5;

      if (range) {
        // Make content width proportional to the finite video or DVR window.
        const durationMinutes = range.duration / 60;
        const contentWidth = Math.max(baseWidth, baseWidth * durationMinutes);
        const minScrollableWidth = baseWidth * 3;
        finalWidth = Math.max(contentWidth, minScrollableWidth);
      }

      scrollContent.style.width = `${finalWidth}px`;
      this.syncOverlayToVideo(
        video,
        overlay,
        scrollContent,
        setIsSettingInitialScroll
      );
    };
  }

  private syncOverlayToVideo(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    scrollContent: HTMLDivElement,
    setIsProgrammaticScroll: (value: boolean) => void
  ): void {
    const range = getMediaSeekRange(video);
    if (!range) return;

    const videoState = this.videoStateManager.get(video);
    if (videoState?.isUserScrubbing) return;

    const progress = getMediaProgress(video, range);
    const maxScroll = Math.max(
      0,
      scrollContent.offsetWidth - overlay.offsetWidth
    );
    const targetScroll = this.settingsManager.shouldInvertHorizontalScroll()
      ? progress * maxScroll
      : (1 - progress) * maxScroll;

    setIsProgrammaticScroll(true);
    overlay.scrollLeft = targetScroll;
    (video.ownerDocument.defaultView ?? window).requestAnimationFrame(() => {
      setIsProgrammaticScroll(false);
    });
  }

  private setupScrollHandling(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    scrollContent: HTMLDivElement,
    timeline: HTMLDivElement,
    seekSpeedLabel: HTMLDivElement,
    getIsSettingInitialScroll: () => boolean,
    _setIsSettingInitialScroll: (value: boolean) => void,
    setScrubTimeout: (timeout: number | null) => void,
    getScrubTimeout: () => number | null,
    getIsHovering: () => boolean,
    deferredSeek: DeferredMediaSeek,
    debugMode: boolean,
    setPlayback?: (shouldPlay: boolean) => void
  ): () => void {
    const ownerDocument = video.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let seekSpeedLabelDismissTimeout: number | undefined;
    let seekCommitTimeout: number | undefined;
    let wheelGestureTimeout: number | undefined;
    let playPauseGestureTimeout: number | undefined;
    let isPlayPauseGestureLocked = false;
    let playPauseGestureAction: 'play' | 'pause' | null = null;
    let isWheelGestureActive = false;

    const canHandleScrollSeeking = (): boolean =>
      !this.isKeyboardSuspended &&
      this.settingsManager.isScrollSeekingEnabled();

    const clearSeekCommitTimeout = (): void => {
      if (seekCommitTimeout === undefined) return;
      ownerWindow.clearTimeout(seekCommitTimeout);
      seekCommitTimeout = undefined;
    };

    const commitPendingSeek = (): void => {
      clearSeekCommitTimeout();
      const videoState = this.videoStateManager.get(video);
      // A pointer drag owns the shared staged seek until pointerup. A stale
      // wheel/scroll settle timer must not commit it or release the visual lock
      // while the pointer is still held down.
      if (videoState?.isVideoDragging) return;
      if (videoState) videoState.isUserScrubbing = false;
      deferredSeek.commit();
    };

    const armSeekCommitFallback = (): void => {
      clearSeekCommitTimeout();
      seekCommitTimeout = ownerWindow.setTimeout(() => {
        seekCommitTimeout = undefined;
        commitPendingSeek();
      }, MEDIA_SCROLL_SEEK_SETTLE_DELAY_MS);
    };

    const markWheelGestureActive = (): void => {
      isWheelGestureActive = true;
      if (wheelGestureTimeout !== undefined) {
        ownerWindow.clearTimeout(wheelGestureTimeout);
      }
      wheelGestureTimeout = ownerWindow.setTimeout(() => {
        wheelGestureTimeout = undefined;
        isWheelGestureActive = false;
        commitPendingSeek();
      }, MEDIA_SCROLL_SEEK_SETTLE_DELAY_MS);
    };

    const showSeekSpeedLabel = (multiplier: number): void => {
      const fullscreenElement = ownerDocument.fullscreenElement;
      const portalHost = fullscreenElement?.contains(video)
        ? fullscreenElement
        : ownerDocument.documentElement;
      const overlayRect = DOMUtils.isYouTubeHoverPreview(video)
        ? this.getVideoActionAreaBounds(video)
        : overlay.getBoundingClientRect();
      let portalLeft =
        overlayRect.left + overlayRect.width / 2 + ownerWindow.scrollX;
      let portalTop = overlayRect.bottom - 12 + ownerWindow.scrollY;

      if (portalHost !== ownerDocument.documentElement) {
        const portalRect = portalHost.getBoundingClientRect();
        portalLeft =
          overlayRect.left -
          portalRect.left +
          portalHost.scrollLeft -
          portalHost.clientLeft +
          overlayRect.width / 2;
        portalTop =
          overlayRect.bottom -
          portalRect.top +
          portalHost.scrollTop -
          portalHost.clientTop -
          12;
      }

      if (seekSpeedLabel.parentElement !== portalHost) {
        portalHost.appendChild(seekSpeedLabel);
      }
      seekSpeedLabel.style.left = `${portalLeft}px`;
      seekSpeedLabel.style.top = `${portalTop}px`;
      seekSpeedLabel.dataset.mfsPortaled = 'true';
      seekSpeedLabel.textContent =
        multiplier > 1 ? 'Fast seeking' : 'Slow seeking';
      seekSpeedLabel.dataset.mfsSpeed = multiplier > 1 ? 'fast' : 'slow';
      seekSpeedLabel.dataset.mfsVisible = 'true';

      if (seekSpeedLabelDismissTimeout !== undefined) {
        ownerWindow.clearTimeout(seekSpeedLabelDismissTimeout);
      }
      seekSpeedLabelDismissTimeout = ownerWindow.setTimeout(() => {
        seekSpeedLabel.dataset.mfsVisible = 'false';
        seekSpeedLabelDismissTimeout = undefined;
      }, SEEK_SPEED_LABEL_DISMISS_DELAY_MS);
    };

    const armPlayPauseGestureEnd = (): void => {
      if (playPauseGestureTimeout !== undefined) {
        ownerWindow.clearTimeout(playPauseGestureTimeout);
      }
      playPauseGestureTimeout = ownerWindow.setTimeout(() => {
        playPauseGestureTimeout = undefined;
        isPlayPauseGestureLocked = false;
        playPauseGestureAction = null;
      }, PLAY_PAUSE_WHEEL_GESTURE_END_MS);
    };

    const handleWheelAction = (event: WheelEvent): boolean => {
      if (!canHandleScrollSeeking()) return false;

      const isPrimaryPlayPauseInput =
        this.settingsManager.isPlayPauseWheelEnabled() &&
        isHorizontalWheelAction(event) &&
        matchesPrimaryWheelModifier(event);
      const requestedPlaybackAction = isPrimaryPlayPauseInput
        ? getWheelPlaybackAction(event)
        : null;
      const startsOppositeDirectionalGesture =
        requestedPlaybackAction !== null &&
        requestedPlaybackAction !== playPauseGestureAction;

      // Trackpads and Magic Mice keep emitting momentum wheel events after the
      // user releases Command/Ctrl. Those tail events no longer carry the
      // modifier, but they still belong to the play/pause gesture. Consume
      // every remaining delta and extend the lock until the stream is idle so
      // none of its momentum can fall through to timeline seeking. Reapplying
      // the modifier to a saved momentum packet keeps producing the
      // same direction, so suppress it too. Only the opposite direction can
      // start the next intentional play/pause action without waiting.
      if (isPlayPauseGestureLocked && !startsOppositeDirectionalGesture) {
        event.preventDefault();
        armPlayPauseGestureEnd();
        return true;
      }

      if (isPrimaryPlayPauseInput) {
        // Consume the complete gesture before the seeking path below. A
        // Command/Ctrl play-pause gesture must never move the timeline too.
        event.preventDefault();
        isPlayPauseGestureLocked = true;
        playPauseGestureAction = requestedPlaybackAction;
        const shouldPlay = requestedPlaybackAction === 'play';
        if (setPlayback) {
          setPlayback(shouldPlay);
        } else if (shouldPlay) {
          if (video.paused) {
            void video.play().catch((error) => {
              if (debugMode) {
                console.warn('Unable to play video from wheel action:', error);
              }
            });
          }
        } else if (!video.paused) {
          video.pause();
        }

        armPlayPauseGestureEnd();
        return true;
      }

      return false;
    };

    const handleOverlayWheel = (event: WheelEvent): void => {
      if (!canHandleScrollSeeking()) return;
      if (handleWheelAction(event)) return;

      const fastScrollHotkey = this.settingsManager.getFastScrollHotkey();
      const slowScrollHotkey = this.settingsManager.getSlowScrollHotkey();
      const hasSpeedHotkey = hasScrollSpeedHotkey(
        event,
        fastScrollHotkey,
        slowScrollHotkey
      );

      // Leave an ordinary vertical wheel gesture available to the page. A
      // horizontal gesture belongs to the scrubber, including at either end of
      // its range, where native scroll chaining can otherwise become the
      // browser's Back or Forward navigation gesture.
      if (event.deltaX === 0 && !hasSpeedHotkey) return;

      const delta = getWheelDeltaPixels(event, overlay.clientWidth);
      if (delta === 0) return;

      // Captured pointer movement can make a scrollable overlay produce wheel
      // or synthetic scroll input near the viewport edge. Keep the pointer's
      // clamped target authoritative until release.
      if (this.videoStateManager.get(video)?.isVideoDragging) {
        event.preventDefault();
        return;
      }

      markWheelGestureActive();

      // Replace native horizontal scrolling so the event remains contained at
      // the scrubber's edges and an optional speed multiplier is applied once.
      event.preventDefault();
      const multiplier = getScrollSpeedMultiplier(
        event,
        fastScrollHotkey,
        slowScrollHotkey,
        this.settingsManager.getScrollSpeedFactor?.() ??
          DEFAULT_SCROLL_SPEED_FACTOR
      );
      if (hasSpeedHotkey) {
        showSeekSpeedLabel(
          getScrollSpeedMultiplier(event, fastScrollHotkey, slowScrollHotkey)
        );
      }
      overlay.scrollLeft += delta * multiplier;
    };

    const handlePlayerLayerWheel = (event: WheelEvent): void => {
      if (!canHandleScrollSeeking()) return;

      // Custom players such as Vimeo put their controls and interaction target
      // above the <video>. Listen at the document boundary so horizontal wheel
      // gestures still reach our scrubber without raising the overlay above (and
      // consequently blocking) the player's clickable controls.
      if (!overlay.isConnected || event.composedPath().includes(overlay))
        return;

      if (DOMUtils.isYouTubeHoverPreview(video)) {
        this.syncPassivePreviewWrapper(video, overlay.parentElement);
      }
      const overlayRect = DOMUtils.isYouTubeHoverPreview(video)
        ? this.getVideoActionAreaBounds(video)
        : overlay.getBoundingClientRect();
      const isInsideActionArea =
        event.clientX >= overlayRect.left &&
        event.clientX <= overlayRect.right &&
        event.clientY >= overlayRect.top &&
        event.clientY <= overlayRect.bottom;
      if (!isInsideActionArea) return;

      if (handleWheelAction(event)) return;

      const fastScrollHotkey = this.settingsManager.getFastScrollHotkey();
      const slowScrollHotkey = this.settingsManager.getSlowScrollHotkey();
      const hasSpeedHotkey = hasScrollSpeedHotkey(
        event,
        fastScrollHotkey,
        slowScrollHotkey
      );

      const delta = getPlayerLayerWheelDeltaPixels(
        event,
        overlay.clientWidth,
        hasSpeedHotkey
      );
      if (delta === 0) return;

      if (this.videoStateManager.get(video)?.isVideoDragging) {
        event.preventDefault();
        return;
      }

      markWheelGestureActive();

      event.preventDefault();
      const multiplier = getScrollSpeedMultiplier(
        event,
        fastScrollHotkey,
        slowScrollHotkey,
        this.settingsManager.getScrollSpeedFactor?.() ??
          DEFAULT_SCROLL_SPEED_FACTOR
      );
      if (hasSpeedHotkey) {
        showSeekSpeedLabel(
          getScrollSpeedMultiplier(event, fastScrollHotkey, slowScrollHotkey)
        );
      }
      overlay.scrollLeft += delta * multiplier;
    };

    const handleScroll = (): void => {
      if (!canHandleScrollSeeking()) return;

      const range = getMediaSeekRange(video);
      if (!range || !scrollContent || !timeline) return;

      // Don't process scroll events when setting initial position
      if (getIsSettingInitialScroll()) {
        if (debugMode) {
          console.log('🚫 Ignoring scroll event - setting initial position');
        }
        return;
      }

      const videoState = this.videoStateManager.get(video);
      if (!videoState) return;
      if (videoState.isVideoDragging) return;

      videoState.isUserScrubbing = true;

      const scrollLeft = overlay.scrollLeft;
      const maxScroll = scrollContent.offsetWidth - overlay.offsetWidth;
      let scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0;

      // Apply inversion to scroll progress based on setting
      if (!this.settingsManager.shouldInvertHorizontalScroll()) {
        scrollProgress = 1 - scrollProgress;
      }

      const newTime = range.start + scrollProgress * range.duration;
      deferredSeek.stage(newTime);
      armSeekCommitFallback();

      // Show timeline bar and update progress
      timeline.style.opacity = '1';
      this.setTimelineProgress(timeline, scrollProgress);

      // Clear existing timeout
      const currentTimeout = getScrubTimeout();
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }

      // Timeline visibility settles independently from the later network seek.
      // Keep isUserScrubbing true so media events cannot snap the staged bar
      // back to the old playback position before the gesture is committed.
      const timeout = (video.ownerDocument.defaultView ?? window).setTimeout(
        () => {
          // Handle timeline visibility after scrubbing ends
          if (timeline) {
            const shouldShowOnHover =
              (this.settingsManager.shouldShowTimelineOnHover() ||
                this.settingsManager.isTimelineSeekingEnabled()) &&
              getIsHovering();
            const isSettingsPreviewVisible =
              timeline.dataset.mfsSettingsPreview === 'true';
            if (!(shouldShowOnHover || isSettingsPreviewVisible)) {
              timeline.style.opacity = '0';
            }
          }
        },
        MEDIA_SEEK_SETTLE_DELAY_MS
      );

      setScrubTimeout(timeout);
    };

    const handleScrollEnd = (): void => {
      if (
        !canHandleScrollSeeking() ||
        getIsSettingInitialScroll() ||
        isWheelGestureActive ||
        this.videoStateManager.get(video)?.isVideoDragging
      )
        return;
      commitPendingSeek();
    };

    overlay.addEventListener('wheel', handleOverlayWheel, { passive: false });
    overlay.addEventListener('scroll', handleScroll);
    overlay.addEventListener('scrollend', handleScrollEnd);
    ownerDocument.addEventListener('wheel', handlePlayerLayerWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      overlay.removeEventListener('wheel', handleOverlayWheel);
      overlay.removeEventListener('scroll', handleScroll);
      overlay.removeEventListener('scrollend', handleScrollEnd);
      ownerDocument.removeEventListener('wheel', handlePlayerLayerWheel, true);
      if (seekSpeedLabelDismissTimeout !== undefined) {
        ownerWindow.clearTimeout(seekSpeedLabelDismissTimeout);
      }
      clearSeekCommitTimeout();
      if (wheelGestureTimeout !== undefined) {
        ownerWindow.clearTimeout(wheelGestureTimeout);
      }
      if (playPauseGestureTimeout !== undefined) {
        ownerWindow.clearTimeout(playPauseGestureTimeout);
      }
      const videoState = this.videoStateManager.get(video);
      if (videoState) videoState.isUserScrubbing = false;
      seekSpeedLabel.remove();
    };
  }

  /**
   * Let site-owned modal UI take exclusive pointer ownership while it is open.
   * BetterVideo normally sits above custom player chrome, so without this guard
   * a transparent scrub layer can intercept clicks intended for a login,
   * consent, share, settings, or other page dialog.
   */
  private setupDocumentDialogGuard(ownerDocument: Document): void {
    if (this.dialogGuardedDocuments.has(ownerDocument)) return;

    const ownerWindow = ownerDocument.defaultView ?? window;
    let updateFrame: number | null = null;
    const scheduleUpdate = (): void => {
      if (updateFrame !== null) return;
      updateFrame = ownerWindow.requestAnimationFrame(() => {
        updateFrame = null;
        this.updateDocumentDialogGuard(ownerDocument);
      });
    };
    const containsDialogCandidate = (node: Node): boolean => {
      if (!(node instanceof ownerWindow.Element)) return false;
      return (
        node.matches(PAGE_DIALOG_SELECTOR) ||
        node.querySelector(PAGE_DIALOG_SELECTOR) !== null
      );
    };
    const Observer = ownerWindow.MutationObserver ?? MutationObserver;
    const observer = new Observer((mutations) => {
      const mayAffectDialog = mutations.some((mutation) => {
        if (mutation.type === 'childList') {
          return [...mutation.addedNodes, ...mutation.removedNodes].some(
            containsDialogCandidate
          );
        }

        return containsDialogCandidate(mutation.target);
      });

      if (mayAffectDialog) scheduleUpdate();
    });

    observer.observe(ownerDocument.documentElement, {
      attributeFilter: [
        'aria-hidden',
        'aria-modal',
        'class',
        'hidden',
        'open',
        'popover',
        'role',
        'style',
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
    ownerDocument.addEventListener('toggle', scheduleUpdate, true);
    ownerWindow.addEventListener('resize', scheduleUpdate, { passive: true });
    this.dialogGuardedDocuments.add(ownerDocument);
  }

  private hasVisiblePageDialog(ownerDocument: Document): boolean {
    const ownerWindow = ownerDocument.defaultView ?? window;
    const candidates =
      ownerDocument.querySelectorAll<HTMLElement>(PAGE_DIALOG_SELECTOR);

    return Array.from(candidates).some((candidate) => {
      if (
        candidate.closest(
          '.scrub-wrapper, .scrub-timeline, .mfs-media-controls, .mfs-seek-speed-label'
        ) ||
        candidate.hidden ||
        candidate.getAttribute('aria-hidden') === 'true' ||
        candidate.closest('[inert]')
      ) {
        return false;
      }

      if (candidate.hasAttribute('popover')) {
        try {
          if (!candidate.matches(':popover-open')) return false;
        } catch {
          if (!candidate.hasAttribute('open')) return false;
        }
      }

      const rect = candidate.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= ownerWindow.innerWidth ||
        rect.top >= ownerWindow.innerHeight
      ) {
        return false;
      }

      const style = ownerWindow.getComputedStyle(candidate);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.pointerEvents !== 'none'
      );
    });
  }

  private updateDocumentDialogGuard(ownerDocument: Document): void {
    const isDialogOpen = this.hasVisiblePageDialog(ownerDocument);
    if (isDialogOpen) {
      ownerDocument.documentElement.setAttribute(
        'data-mfs-page-dialog-open',
        'true'
      );
    } else {
      ownerDocument.documentElement.removeAttribute(
        'data-mfs-page-dialog-open'
      );
    }

    this.videoStateManager.forEach((state, video) => {
      if (
        video.ownerDocument !== ownerDocument ||
        !video.isConnected ||
        !state.wrapper.isConnected
      ) {
        return;
      }

      if (isDialogOpen) {
        state.wrapper.style.setProperty('visibility', 'hidden', 'important');
        state.overlay.style.setProperty('pointer-events', 'none', 'important');
        state.timeline.style.setProperty('visibility', 'hidden', 'important');
        state.timeline.style.setProperty('pointer-events', 'none', 'important');
        state.mediaControls?.style.setProperty(
          'visibility',
          'hidden',
          'important'
        );
        state.mediaControls?.style.setProperty(
          'pointer-events',
          'none',
          'important'
        );
        return;
      }

      state.wrapper.style.removeProperty('visibility');
      this.updateOverlayPointerEvents(video, state);
      state.timeline.style.removeProperty('visibility');
      state.mediaControls?.style.removeProperty('visibility');
      state.mediaControls?.style.removeProperty('pointer-events');
      this.updateTimelineInteractivityForVideo(video, state.timeline);
    });

    ownerDocument
      .querySelectorAll<HTMLElement>('.mfs-seek-speed-label')
      .forEach((label) => {
        if (isDialogOpen) {
          label.style.setProperty('visibility', 'hidden', 'important');
          label.style.setProperty('pointer-events', 'none', 'important');
        } else {
          label.style.removeProperty('visibility');
          label.style.removeProperty('pointer-events');
        }
      });
  }

  /**
   * Track the pointer at the document boundary instead of relying on the
   * scrub overlay to be the event target. Custom players commonly place a
   * controls layer, link, canvas, or iframe above the video. Those elements
   * still produce document-level pointer activity, so geometry is the most
   * reliable way to decide whether the user is visually hovering a video.
   *
   * There is one listener set per frame document. Content scripts run in every
   * frame, which also covers videos that live inside cross-origin iframes.
   */
  private setupDocumentHoverTracking(ownerDocument: Document): void {
    if (this.hoverTrackedDocuments.has(ownerDocument)) return;

    const updateFromPointer = (event: MouseEvent): void => {
      this.lastPointerPoints.set(ownerDocument, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      this.updateSiteUiPointerPassthrough(
        ownerDocument,
        event.clientX,
        event.clientY
      );
      this.updatePointerHoveredVideosAtPoint(
        ownerDocument,
        event.clientX,
        event.clientY
      );
    };

    const updateFromWheel = (event: WheelEvent): void => {
      this.updateWheelHoveredVideosAtPoint(
        ownerDocument,
        event.clientX,
        event.clientY
      );
    };

    const clearHoveredVideos = (): void => {
      this.lastPointerPoints.delete(ownerDocument);
      this.videoStateManager.forEach((state, video) => {
        if (video.ownerDocument === ownerDocument) {
          this.clearWheelHoverLease(video, state);
          state.isPointerHovering = false;
          if (state.mediaControls) {
            state.mediaControls.dataset.mfsVisible = 'false';
            state.mediaControls.dataset.mfsVideoHovered = 'false';
          }
          this.updateTimelineHoverState(video, state, false);
          this.hideYouTubeChapterTooltip(state);
        }
      });
    };

    // pointerover runs before pointerdown, allowing a newly opened site dialog
    // to take ownership even before the pointer has moved across it.
    ownerDocument.addEventListener('pointerover', updateFromPointer, {
      capture: true,
      passive: true,
    });
    ownerDocument.addEventListener('pointermove', updateFromPointer, {
      capture: true,
      passive: true,
    });
    ownerDocument.addEventListener('mouseover', updateFromPointer, {
      capture: true,
      passive: true,
    });
    ownerDocument.addEventListener('wheel', updateFromWheel, {
      capture: true,
      passive: true,
    });
    ownerDocument.defaultView?.addEventListener('blur', clearHoveredVideos);

    this.hoverTrackedDocuments.add(ownerDocument);
  }

  private restoreDocumentHoverAtLastPointer(ownerDocument: Document): void {
    const point = this.lastPointerPoints.get(ownerDocument);
    if (!point) return;

    this.updateSiteUiPointerPassthrough(
      ownerDocument,
      point.clientX,
      point.clientY
    );
    this.updatePointerHoveredVideosAtPoint(
      ownerDocument,
      point.clientX,
      point.clientY
    );
  }

  /**
   * Give visible site-owned controls priority whenever they geometrically sit
   * beneath one of our transparent/portaled layers. This is intentionally
   * based on hit testing and interactive semantics rather than modal selectors,
   * so login, consent, onboarding, share, and future dialogs all work alike.
   */
  private updateSiteUiPointerPassthrough(
    ownerDocument: Document,
    clientX: number,
    clientY: number
  ): void {
    if (typeof ownerDocument.elementsFromPoint !== 'function') return;

    const ownerWindow = ownerDocument.defaultView ?? window;
    const siteControlAtPoint = ownerDocument
      .elementsFromPoint(clientX, clientY)
      .find((element) => {
        if (
          element.closest(EXTENSION_UI_SELECTOR) ||
          !element.matches(SITE_INTERACTIVE_SELECTOR)
        ) {
          return false;
        }

        const style = ownerWindow.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none'
        );
      });

    this.videoStateManager.forEach((state, video) => {
      if (video.ownerDocument !== ownerDocument) return;

      const containsPoint = (element?: HTMLElement): boolean => {
        if (!element?.isConnected) return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      };
      const isOverActiveMediaControls = Boolean(
        state.mediaControls &&
          !state.mediaControls.hidden &&
          state.mediaControls.dataset.mfsActive === 'true' &&
          containsPoint(state.mediaControls)
      );
      const isOverExtensionLayer = [
        state.wrapper,
        state.timeline,
        state.mediaControls,
      ].some(containsPoint);
      const shouldPassThrough = Boolean(
        siteControlAtPoint && isOverExtensionLayer && !isOverActiveMediaControls
      );

      if (shouldPassThrough) {
        state.overlay.style.setProperty('pointer-events', 'none', 'important');
        state.timeline.style.setProperty('pointer-events', 'none', 'important');
        state.mediaControls?.style.setProperty(
          'pointer-events',
          'none',
          'important'
        );
        return;
      }

      if (ownerDocument.documentElement.dataset.mfsPageDialogOpen === 'true') {
        return;
      }

      this.updateOverlayPointerEvents(video, state);
      state.mediaControls?.style.removeProperty('pointer-events');
      this.updateTimelineInteractivityForVideo(video, state.timeline);
    });
  }

  private updateOverlayPointerEvents(
    video: HTMLVideoElement,
    state: VideoStateT
  ): void {
    // A disabled Scroll method must not leave a native horizontal scroll box
    // under the pointer. When Drag or Minimal Player still owns the surface,
    // wheel defaults can then continue to the page untouched.
    state.overlay.style.overflowX =
      this.settingsManager.isScrollSeekingEnabled() ? 'scroll' : 'hidden';

    if (DOMUtils.isYouTubeHoverPreview(video)) {
      // YouTube's temporary thumbnail player must remain underneath the
      // pointer so its own hover lifecycle keeps running. Wheel gestures are
      // still captured by setupScrollHandling's document-level hit test.
      state.overlay.style.setProperty('pointer-events', 'none', 'important');
      state.overlay.dataset.mfsPassivePreview = 'true';
      state.preserveSourceVolume?.();
      return;
    }

    const shouldCaptureVideoSurface =
      this.settingsManager.isScrollSeekingEnabled() ||
      this.settingsManager.shouldDragVideoToSeek() ||
      this.settingsManager.shouldHideVideoControls();

    if (!shouldCaptureVideoSurface) {
      state.overlay.style.setProperty('pointer-events', 'none', 'important');
      state.overlay.dataset.mfsPassivePreview = 'true';
      return;
    }

    state.overlay.style.removeProperty('pointer-events');
    state.overlay.style.pointerEvents = 'auto';
    delete state.overlay.dataset.mfsPassivePreview;
  }

  private updatePointerHoveredVideosAtPoint(
    ownerDocument: Document,
    clientX: number,
    clientY: number
  ): void {
    this.videoStateManager.forEach((state, video) => {
      if (video.ownerDocument !== ownerDocument) return;

      this.clearWheelHoverLease(video, state);
      state.isPointerHovering = this.isPointInsideVideoWrapper(
        video,
        state,
        clientX,
        clientY
      );
      if (state.mediaControls) {
        state.mediaControls.dataset.mfsVideoHovered = String(
          state.isPointerHovering
        );
      }
      this.updateMediaControlsRevealAtPoint(state, clientX, clientY);
      this.updateTimelineHoverState(video, state, state.isPointerHovering);
      this.updateYouTubeChapterTooltipAtPoint(state, clientX, clientY);
    });
  }

  private updateWheelHoveredVideosAtPoint(
    ownerDocument: Document,
    clientX: number,
    clientY: number
  ): void {
    this.videoStateManager.forEach((state, video) => {
      if (video.ownerDocument !== ownerDocument) return;

      this.clearWheelHoverLease(video, state);
      state.isWheelHovering = this.isPointInsideVideoWrapper(
        video,
        state,
        clientX,
        clientY
      );

      if (state.isWheelHovering) {
        const ownerWindow = ownerDocument.defaultView ?? window;
        state.wheelHoverTimeout = ownerWindow.setTimeout(() => {
          state.wheelHoverTimeout = undefined;
          state.isWheelHovering = false;
          this.updateTimelineHoverState(
            video,
            state,
            state.isPointerHovering === true
          );
        }, WHEEL_HOVER_LEASE_MS);
      }

      this.updateTimelineHoverState(
        video,
        state,
        state.isPointerHovering === true || state.isWheelHovering === true
      );
    });
  }

  private clearWheelHoverLease(
    video: HTMLVideoElement,
    state: VideoStateT
  ): void {
    if (state.wheelHoverTimeout !== undefined) {
      (video.ownerDocument.defaultView ?? window).clearTimeout(
        state.wheelHoverTimeout
      );
      state.wheelHoverTimeout = undefined;
    }
    state.isWheelHovering = false;
  }

  private isPointInsideVideoWrapper(
    video: HTMLVideoElement,
    state: VideoStateT,
    clientX: number,
    clientY: number
  ): boolean {
    // Player layouts can move without resizing. Keep portaled UI attached to
    // the current visible media rectangle, including clipped preview videos.
    this.updateTimelineInteractivityForVideo(video, state.timeline);
    if (DOMUtils.isYouTubeHoverPreview(video)) {
      this.syncPassivePreviewWrapper(video, state.wrapper);
    }

    const rect = DOMUtils.isYouTubeHoverPreview(video)
      ? this.getVideoActionAreaBounds(video)
      : state.wrapper.getBoundingClientRect();
    return (
      video.isConnected &&
      state.wrapper.isConnected &&
      rect.width > 0 &&
      rect.height > 0 &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  private syncPassivePreviewWrapper(
    video: HTMLVideoElement,
    wrapper: HTMLElement | null
  ): void {
    if (wrapper?.dataset.mfsPassivePreviewHost !== 'true') return;

    const rect =
      this.getPassivePreviewGeometrySource(video).getBoundingClientRect();
    wrapper.style.position = 'fixed';
    wrapper.style.top = `${rect.top}px`;
    wrapper.style.left = `${rect.left}px`;
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
  }

  private getVideoActionAreaBounds(video: HTMLVideoElement): {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  } {
    const target = DOMUtils.isYouTubeHoverPreview(video)
      ? this.getPassivePreviewGeometrySource(video)
      : (this.findVisibleVideoContainer(video) ?? video);
    const rect = target.getBoundingClientRect();
    const { top, height } = this.calculateActionAreaDimensions(
      rect.height,
      this.settingsManager.getActionArea()
    );

    return {
      top: rect.top + top,
      right: rect.right,
      bottom: rect.top + top + height,
      left: rect.left,
      width: rect.width,
      height,
    };
  }

  private getPassivePreviewGeometrySource(
    video: HTMLVideoElement
  ): HTMLElement {
    const candidates = [
      video.closest<HTMLElement>('#player-container-wrapper'),
      video.closest<HTMLElement>('#media-container'),
      video.closest<HTMLElement>('#inline-preview-player'),
    ];

    return (
      candidates.find((candidate) => {
        if (!candidate) return false;
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? video
    );
  }

  private updateMediaControlsRevealAtPoint(
    state: VideoStateT,
    clientX: number,
    clientY: number
  ): void {
    const controls = state.mediaControls;
    if (!controls || controls.hidden || controls.dataset.mfsActive !== 'true') {
      return;
    }

    const controlsRect = controls.getBoundingClientRect();
    const isOverControls =
      controlsRect.width > 0 &&
      controlsRect.height > 0 &&
      clientX >= controlsRect.left &&
      clientX <= controlsRect.right &&
      clientY >= controlsRect.top &&
      clientY <= controlsRect.bottom;

    const isInteracting = controls.dataset.mfsInteracting === 'true';

    controls.dataset.mfsVisible = String(isOverControls || isInteracting);
  }

  private shouldShowPausedPlaybackUi(video: HTMLVideoElement): boolean {
    return (
      (this.settingsManager.shouldHideVideoControls?.() ?? false) &&
      video.paused &&
      getMediaSeekRange(video) !== null
    );
  }

  private updateTimelineHoverState(
    video: HTMLVideoElement,
    state: VideoStateT,
    isHovering: boolean
  ): void {
    state.isHovering = isHovering;
    state.syncPlaybackFeedback?.();

    const isSettingsPreviewVisible =
      state.timeline.dataset.mfsSettingsPreview === 'true';
    const shouldShow =
      ((this.settingsManager.shouldShowTimelineOnHover?.() ?? false) ||
        (this.settingsManager.isTimelineSeekingEnabled?.() ?? false)) &&
      isHovering &&
      getMediaSeekRange(video) !== null;

    if (!shouldShow) {
      if (!(state.isUserScrubbing || isSettingsPreviewVisible)) {
        state.timeline.style.opacity = '0';
      }
      this.hideYouTubeChapterTooltip(state);
      return;
    }

    state.timeline.style.opacity = '1';
    if (state.isUserScrubbing) return;

    const range = getMediaSeekRange(video);
    if (range) {
      this.setTimelineProgress(state.timeline, getMediaProgress(video, range));
    }
  }

  private setupVideoSyncEvents(
    video: HTMLVideoElement,
    overlay: HTMLDivElement,
    scrollContent: HTMLDivElement,
    setIsProgrammaticScroll: (value: boolean) => void
  ): () => void {
    const sync = () => {
      this.syncOverlayToVideo(
        video,
        overlay,
        scrollContent,
        setIsProgrammaticScroll
      );
    };
    const events: Array<keyof HTMLMediaElementEventMap> = [
      'timeupdate',
      'seeked',
      'loadedmetadata',
      'durationchange',
      'progress',
    ];
    events.forEach((eventName) => {
      video.addEventListener(eventName, sync);
    });

    return () => {
      events.forEach((eventName) => {
        video.removeEventListener(eventName, sync);
      });
    };
  }

  private setupTimelineProgressUpdates(
    video: HTMLVideoElement,
    timeline: HTMLDivElement
  ): () => void {
    const updateTimeline = () => {
      const videoState = this.videoStateManager.get(video);
      const range = getMediaSeekRange(video);
      if (
        (!this.settingsManager.shouldShowTimelineOnHover() &&
          !this.settingsManager.isTimelineSeekingEnabled()) ||
        !timeline ||
        videoState?.isUserScrubbing ||
        !range
      )
        return;

      // Only update if timeline is visible (user is hovering)
      if (timeline.style.opacity === '1') {
        const progress = getMediaProgress(video, range);
        this.setTimelineProgress(timeline, progress);
      }
    };

    const syncTimelineVisibility = () => {
      const videoState = this.videoStateManager.get(video);
      if (!videoState) return;
      this.updateTimelineHoverState(video, videoState, videoState.isHovering);
    };

    video.addEventListener('timeupdate', updateTimeline);
    video.addEventListener('pause', syncTimelineVisibility);
    video.addEventListener('play', syncTimelineVisibility);
    video.addEventListener('loadedmetadata', syncTimelineVisibility);
    syncTimelineVisibility();

    return () => {
      video.removeEventListener('timeupdate', updateTimeline);
      video.removeEventListener('pause', syncTimelineVisibility);
      video.removeEventListener('play', syncTimelineVisibility);
      video.removeEventListener('loadedmetadata', syncTimelineVisibility);
    };
  }
}

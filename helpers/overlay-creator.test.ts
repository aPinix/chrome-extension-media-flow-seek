// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeferredMediaSeek } from '@/helpers/media';
import { OverlayCreator } from '@/helpers/overlay-creator';
import type { SettingsManager } from '@/helpers/settings-manager';
import { VideoStateManager } from '@/helpers/video-state';
import type { VideoStateT } from '@/types/content';

const createSettingsManager = ({
  isScrollSeekingEnabled = true,
  isTimelineSeekingEnabled = false,
  dragVideoToSeek = false,
  hideVideoControls = false,
  colorizedTimeline = false,
  invertHorizontalScroll = false,
  showTimelineOnHover = false,
  timelineHeight = 6,
  timelineHeightUnit = 'px',
  timelinePosition = 'bottom',
  actionArea = 'full',
  actionAreaSize = 30,
  actionAreaSizeUnit = '%',
  isPlayPauseWheelEnabled = true,
}: {
  isScrollSeekingEnabled?: boolean;
  isTimelineSeekingEnabled?: boolean;
  dragVideoToSeek?: boolean;
  hideVideoControls?: boolean;
  colorizedTimeline?: boolean;
  invertHorizontalScroll?: boolean;
  showTimelineOnHover?: boolean;
  timelineHeight?: number;
  timelineHeightUnit?: 'px' | '%';
  timelinePosition?: 'top' | 'bottom';
  actionArea?: 'full' | 'top' | 'middle' | 'bottom';
  actionAreaSize?: number;
  actionAreaSizeUnit?: 'px' | '%';
  isPlayPauseWheelEnabled?: boolean;
} = {}): SettingsManager =>
  ({
    getActionArea: () => actionArea,
    getActionAreaSize: () => actionAreaSize,
    getActionAreaSizeUnit: () => actionAreaSizeUnit,
    getTimelineHeight: () => timelineHeight,
    getTimelineHeightUnit: () => timelineHeightUnit,
    getTimelinePosition: () => timelinePosition,
    isDebugEnabled: () => false,
    isScrollSeekingEnabled: () => isScrollSeekingEnabled,
    isTimelineSeekingEnabled: () => isTimelineSeekingEnabled,
    shouldDragVideoToSeek: () => dragVideoToSeek,
    shouldHideVideoControls: () => hideVideoControls,
    shouldColorizeTimeline: () => colorizedTimeline,
    shouldInvertHorizontalScroll: () => invertHorizontalScroll,
    shouldShowTimelineOnHover: () => showTimelineOnHover,
    getFastScrollHotkey: () => 'alt',
    getSlowScrollHotkey: () => 'alt+shift',
    isPlayPauseWheelEnabled: () => isPlayPauseWheelEnabled,
    updateSetting: () => {},
  }) as unknown as SettingsManager;

const createPointerEvent = (
  type: string,
  {
    clientX,
    clientY = 60,
    pointerId = 1,
  }: { clientX: number; clientY?: number; pointerId?: number }
): PointerEvent => {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
  });
  return event as unknown as PointerEvent;
};

const createVideoState = (
  ownerDocument: Document = document
): {
  video: HTMLVideoElement;
  state: VideoStateT;
} => {
  const video = ownerDocument.createElement('video');
  Object.defineProperties(video, {
    buffered: {
      configurable: true,
      value: { length: 0 },
    },
    currentTime: { configurable: true, value: 25, writable: true },
    duration: { configurable: true, value: 100 },
  });

  const wrapper = ownerDocument.createElement('div');
  wrapper.getBoundingClientRect = () =>
    ({
      bottom: 120,
      height: 100,
      left: 10,
      right: 210,
      top: 20,
      width: 200,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect;

  const overlay = ownerDocument.createElement('div');
  const timeline = ownerDocument.createElement('div');
  timeline.getBoundingClientRect = () =>
    ({
      bottom: 120,
      height: 6,
      left: 10,
      right: 210,
      top: 114,
      width: 200,
      x: 10,
      y: 114,
      toJSON: () => ({}),
    }) as DOMRect;
  timeline.appendChild(ownerDocument.createElement('div'));
  wrapper.append(overlay, timeline);
  ownerDocument.body.append(video, wrapper);

  return {
    video,
    state: {
      debugIndicator: ownerDocument.createElement('a'),
      isHovering: false,
      isUserScrubbing: false,
      overlay,
      scrollContent: ownerDocument.createElement('div'),
      timeline,
      wrapper,
    },
  };
};

afterEach(() => {
  document.querySelectorAll('.scrub-timeline').forEach((timeline) => {
    timeline.remove();
  });
  document.body.replaceChildren();
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });
  Object.defineProperties(window, {
    scrollX: { configurable: true, value: 0 },
    scrollY: { configurable: true, value: 0 },
  });
  document.documentElement.removeAttribute('data-mfs-page-dialog-open');
  document.documentElement.classList.remove('mfs-disabled');
  document.getElementById('mfs-fast-hide')?.remove();
  vi.useRealTimers();
});

describe('OverlayCreator keyboard handling', () => {
  it('suspends without clearing overlays or rewriting the enabled setting', () => {
    vi.useFakeTimers();
    const updateSetting = vi.fn();
    const settingsManager = {
      ...createSettingsManager(),
      updateSetting,
    } as unknown as SettingsManager;
    const videoStateManager = new VideoStateManager();
    const clear = vi.spyOn(videoStateManager, 'clear');
    const checkForVideos = vi.fn();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      checkForVideos
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);
    const keyboardMethods = overlayCreator as unknown as {
      handleKeyDown: (event: KeyboardEvent) => void;
      handleKeyUp: (event: KeyboardEvent) => void;
    };

    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' })
    );
    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', { code: 'KeyF', key: 'f' })
    );
    vi.advanceTimersByTime(100);

    expect(updateSetting).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(state.wrapper.isConnected).toBe(true);
    expect(checkForVideos).toHaveBeenCalledOnce();
  });

  it.each([
    ['Space', ' '],
    ['KeyK', 'k'],
    ['MediaPlayPause', 'MediaPlayPause'],
  ])(
    'leaves the %s playback hotkey entirely to the page player',
    (code, key) => {
      vi.useFakeTimers();
      const updateSetting = vi.fn();
      const settingsManager = {
        ...createSettingsManager(),
        getFastScrollHotkey: () => 'Alt',
        getSlowScrollHotkey: () => 'Shift',
        updateSetting,
      } as unknown as SettingsManager;
      const videoStateManager = new VideoStateManager();
      const clear = vi.spyOn(videoStateManager, 'clear');
      const checkForVideos = vi.fn();
      const overlayCreator = new OverlayCreator(
        settingsManager,
        videoStateManager,
        checkForVideos
      );
      const keyboardMethods = overlayCreator as unknown as {
        handleKeyDown: (event: KeyboardEvent) => void;
        handleKeyUp: (event: KeyboardEvent) => void;
      };
      const eventInit = { code, key };

      keyboardMethods.handleKeyDown(new KeyboardEvent('keydown', eventInit));
      keyboardMethods.handleKeyUp(new KeyboardEvent('keyup', eventInit));
      vi.advanceTimersByTime(200);

      expect(updateSetting).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(checkForVideos).not.toHaveBeenCalled();
      expect(document.documentElement.classList.contains('mfs-disabled')).toBe(
        false
      );
      expect(document.getElementById('mfs-fast-hide')).toBeNull();
    }
  );
});

describe('OverlayCreator page dialog guard', () => {
  it('releases all player interaction while a visible site dialog is open', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ isTimelineSeekingEnabled: true }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const mediaControls = document.createElement('div');
    const dialog = document.createElement('div');

    state.mediaControls = mediaControls;
    state.wrapper.appendChild(mediaControls);
    videoStateManager.set(video, state);
    dialog.setAttribute('role', 'dialog');
    dialog.getBoundingClientRect = () =>
      ({
        bottom: 500,
        height: 400,
        left: 100,
        right: 500,
        top: 100,
        width: 400,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(dialog);

    const methods = overlayCreator as unknown as {
      updateDocumentDialogGuard: (ownerDocument: Document) => void;
    };
    methods.updateDocumentDialogGuard(document);

    expect(document.documentElement.dataset.mfsPageDialogOpen).toBe('true');
    expect(state.wrapper.style.getPropertyValue('visibility')).toBe('hidden');
    expect(state.wrapper.style.getPropertyPriority('visibility')).toBe(
      'important'
    );
    expect(state.overlay.style.getPropertyValue('pointer-events')).toBe('none');
    expect(state.mediaControls.style.getPropertyValue('pointer-events')).toBe(
      'none'
    );

    dialog.hidden = true;
    methods.updateDocumentDialogGuard(document);

    expect(document.documentElement.dataset.mfsPageDialogOpen).toBeUndefined();
    expect(state.wrapper.style.visibility).toBe('');
    expect(state.overlay.style.pointerEvents).toBe('auto');
    expect(state.timeline.style.pointerEvents).toBe('auto');
    expect(state.mediaControls.style.pointerEvents).toBe('');
  });

  it('ignores hidden or zero-size dialog markup', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      new VideoStateManager(),
      () => {}
    );
    const hiddenDialog = document.createElement('div');
    hiddenDialog.setAttribute('role', 'dialog');
    document.body.appendChild(hiddenDialog);

    const methods = overlayCreator as unknown as {
      updateDocumentDialogGuard: (ownerDocument: Document) => void;
    };
    methods.updateDocumentDialogGuard(document);

    expect(document.documentElement.dataset.mfsPageDialogOpen).toBeUndefined();
  });

  it('automatically follows dialogs added and closed by a site', async () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);
    const methods = overlayCreator as unknown as {
      setupDocumentDialogGuard: (ownerDocument: Document) => void;
    };
    methods.setupDocumentDialogGuard(document);

    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    dialog.getBoundingClientRect = () =>
      ({
        bottom: 300,
        height: 200,
        left: 50,
        right: 350,
        top: 100,
        width: 300,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(dialog);

    await vi.waitFor(() => {
      expect(document.documentElement.dataset.mfsPageDialogOpen).toBe('true');
      expect(state.overlay.style.pointerEvents).toBe('none');
    });

    dialog.hidden = true;
    await vi.waitFor(() => {
      expect(
        document.documentElement.dataset.mfsPageDialogOpen
      ).toBeUndefined();
      expect(state.overlay.style.pointerEvents).toBe('auto');
    });
  });

  it('passes through unknown site controls without requiring dialog selectors', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ isTimelineSeekingEnabled: true }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const siteButton = document.createElement('button');
    const mediaControls = document.createElement('div');
    const originalElementsFromPoint = document.elementsFromPoint;

    state.overlay.className = 'scrub-overlay';
    state.timeline.className = 'scrub-timeline';
    state.mediaControls = mediaControls;
    mediaControls.className = 'mfs-media-controls';
    state.wrapper.appendChild(mediaControls);
    siteButton.textContent = 'Continue';
    siteButton.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 40,
        left: 40,
        right: 180,
        top: 60,
        width: 140,
        x: 40,
        y: 60,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(siteButton);
    videoStateManager.set(video, state);

    const elementsFromPoint = vi.fn(() => [state.overlay, siteButton]);
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: elementsFromPoint,
    });
    const methods = overlayCreator as unknown as {
      updateSiteUiPointerPassthrough: (
        ownerDocument: Document,
        clientX: number,
        clientY: number
      ) => void;
    };

    methods.updateSiteUiPointerPassthrough(document, 100, 80);

    expect(state.overlay.style.pointerEvents).toBe('none');
    expect(state.overlay.style.getPropertyPriority('pointer-events')).toBe(
      'important'
    );
    expect(state.timeline.style.pointerEvents).toBe('none');
    expect(mediaControls.style.pointerEvents).toBe('none');

    elementsFromPoint.mockReturnValue([state.overlay]);
    methods.updateSiteUiPointerPassthrough(document, 100, 80);

    expect(state.overlay.style.pointerEvents).toBe('auto');
    expect(state.timeline.style.pointerEvents).toBe('auto');
    expect(mediaControls.style.pointerEvents).toBe('');

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
    });
  });

  it('passes through nested ad iframes that hide their controls cross-origin', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ isTimelineSeekingEnabled: true }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const adFrame = document.createElement('iframe');
    const originalElementsFromPoint = document.elementsFromPoint;

    state.overlay.className = 'scrub-overlay';
    state.timeline.className = 'scrub-timeline';
    adFrame.title = 'Advertisement';
    adFrame.getBoundingClientRect = () =>
      ({
        bottom: 120,
        height: 100,
        left: 10,
        right: 210,
        top: 20,
        width: 200,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(adFrame);
    videoStateManager.set(video, state);

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => [state.overlay, adFrame]),
    });

    const methods = overlayCreator as unknown as {
      updateSiteUiPointerPassthrough: (
        ownerDocument: Document,
        clientX: number,
        clientY: number
      ) => void;
    };
    methods.updateSiteUiPointerPassthrough(document, 100, 80);

    expect(state.overlay.style.pointerEvents).toBe('none');
    expect(state.overlay.style.getPropertyPriority('pointer-events')).toBe(
      'important'
    );
    expect(state.timeline.style.pointerEvents).toBe('none');

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
    });
  });

  it('keeps active volume controls above an underlying player button', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ isTimelineSeekingEnabled: true }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const sitePlayButton = document.createElement('button');
    const mediaControls = document.createElement('div');
    const originalElementsFromPoint = document.elementsFromPoint;

    state.overlay.className = 'scrub-overlay';
    state.timeline.className = 'scrub-timeline';
    state.mediaControls = mediaControls;
    mediaControls.className = 'mfs-media-controls';
    mediaControls.dataset.mfsActive = 'true';
    mediaControls.dataset.mfsVisible = 'true';
    mediaControls.getBoundingClientRect = () =>
      ({
        bottom: 140,
        height: 80,
        left: 160,
        right: 188,
        top: 60,
        width: 28,
        x: 160,
        y: 60,
        toJSON: () => ({}),
      }) as DOMRect;
    state.wrapper.appendChild(mediaControls);
    document.body.appendChild(sitePlayButton);
    videoStateManager.set(video, state);

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => [state.overlay, sitePlayButton]),
    });
    mediaControls.style.setProperty('pointer-events', 'none', 'important');

    const methods = overlayCreator as unknown as {
      updateSiteUiPointerPassthrough: (
        ownerDocument: Document,
        clientX: number,
        clientY: number
      ) => void;
    };
    methods.updateSiteUiPointerPassthrough(document, 174, 80);

    expect(mediaControls.style.pointerEvents).toBe('');
    expect(state.overlay.style.pointerEvents).toBe('auto');

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
    });
  });
});

describe('OverlayCreator seek speed label', () => {
  it('shows the active fast or slow mode at the bottom of the video', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      videoStateManager,
      () => {}
    );
    const video = document.createElement('video');
    const overlay = document.createElement('div');
    const scrollContent = document.createElement('div');
    const timeline = document.createElement('div');
    const seekSpeedLabel = document.createElement('div');
    const wrapper = document.createElement('div');
    timeline.appendChild(document.createElement('div'));
    wrapper.append(overlay, timeline, seekSpeedLabel);
    document.body.append(video, wrapper);

    Object.defineProperties(video, {
      buffered: { configurable: true, value: { length: 0 } },
      currentTime: { configurable: true, value: 25, writable: true },
      duration: { configurable: true, value: 100 },
    });
    Object.defineProperties(overlay, {
      clientWidth: { configurable: true, value: 200 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });
    Object.defineProperty(scrollContent, 'offsetWidth', {
      configurable: true,
      value: 1000,
    });

    const videoState = {
      debugIndicator: document.createElement('a'),
      isHovering: false,
      isUserScrubbing: false,
      overlay,
      scrollContent,
      timeline,
      wrapper,
    };
    videoStateManager.set(video, videoState);
    const deferredSeek = new DeferredMediaSeek(video, 150);

    const methods = overlayCreator as unknown as {
      setupScrollHandling: (
        video: HTMLVideoElement,
        overlay: HTMLDivElement,
        scrollContent: HTMLDivElement,
        timeline: HTMLDivElement,
        seekSpeedLabel: HTMLDivElement,
        getIsSettingInitialScroll: () => boolean,
        setIsSettingInitialScroll: (value: boolean) => void,
        setScrubTimeout: (timeout: number | null) => void,
        getScrubTimeout: () => number | null,
        getIsHovering: () => boolean,
        deferredSeek: DeferredMediaSeek,
        debugMode: boolean
      ) => () => void;
    };
    const cleanup = methods.setupScrollHandling(
      video,
      overlay,
      scrollContent,
      timeline,
      seekSpeedLabel,
      () => false,
      () => {},
      () => {},
      () => null,
      () => false,
      deferredSeek,
      false
    );

    overlay.dispatchEvent(
      new WheelEvent('wheel', {
        altKey: true,
        bubbles: true,
        cancelable: true,
        deltaX: 10,
      })
    );
    expect(seekSpeedLabel.textContent).toBe('Fast seeking');
    expect(seekSpeedLabel.dataset.mfsSpeed).toBe('fast');
    expect(seekSpeedLabel.dataset.mfsVisible).toBe('true');
    expect(overlay.scrollLeft).toBe(30);

    overlay.dispatchEvent(
      new WheelEvent('wheel', {
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        deltaX: 20,
      })
    );
    expect(seekSpeedLabel.textContent).toBe('Slow seeking');
    expect(seekSpeedLabel.dataset.mfsSpeed).toBe('slow');
    expect(overlay.scrollLeft).toBe(35);

    vi.advanceTimersByTime(700);
    expect(seekSpeedLabel.dataset.mfsVisible).toBe('false');
    cleanup();
    deferredSeek.cancel();
  });
});

describe('OverlayCreator scroll gesture seeking', () => {
  const setupScrollSeeking = (
    getIsSettingInitialScroll = () => false,
    isScrollSeekingEnabled = true
  ) => {
    const settingsManager = createSettingsManager({
      isScrollSeekingEnabled,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const video = document.createElement('video');
    const overlay = document.createElement('div');
    const scrollContent = document.createElement('div');
    const timeline = document.createElement('div');
    const seekSpeedLabel = document.createElement('div');
    const wrapper = document.createElement('div');
    const soughtTimes: number[] = [];
    let currentTime = 25;
    let scrubTimeout: number | null = null;

    timeline.appendChild(document.createElement('div'));
    wrapper.append(overlay, timeline, seekSpeedLabel);
    document.body.append(video, wrapper);

    Object.defineProperties(video, {
      buffered: { configurable: true, value: { length: 0 } },
      currentTime: {
        configurable: true,
        get: () => currentTime,
        set: (time: number) => {
          currentTime = time;
          soughtTimes.push(time);
        },
      },
      duration: { configurable: true, value: 100 },
    });
    Object.defineProperties(overlay, {
      clientWidth: { configurable: true, value: 200 },
      offsetWidth: { configurable: true, value: 200 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });
    Object.defineProperty(scrollContent, 'offsetWidth', {
      configurable: true,
      value: 1000,
    });

    const videoState = {
      debugIndicator: document.createElement('a'),
      isHovering: false,
      isUserScrubbing: false,
      overlay,
      scrollContent,
      timeline,
      wrapper,
    };
    videoStateManager.set(video, videoState);

    const deferredSeek = new DeferredMediaSeek(video, 150);
    const methods = overlayCreator as unknown as {
      setupScrollHandling: (
        targetVideo: HTMLVideoElement,
        targetOverlay: HTMLDivElement,
        targetScrollContent: HTMLDivElement,
        targetTimeline: HTMLDivElement,
        targetSeekSpeedLabel: HTMLDivElement,
        isSettingInitialScroll: () => boolean,
        setIsSettingInitialScroll: (value: boolean) => void,
        setScrubTimeout: (timeout: number | null) => void,
        getScrubTimeout: () => number | null,
        getIsHovering: () => boolean,
        seek: DeferredMediaSeek,
        debugMode: boolean
      ) => () => void;
    };
    const cleanupScroll = methods.setupScrollHandling(
      video,
      overlay,
      scrollContent,
      timeline,
      seekSpeedLabel,
      getIsSettingInitialScroll,
      () => {},
      (timeout) => {
        scrubTimeout = timeout;
      },
      () => scrubTimeout,
      () => false,
      deferredSeek,
      false
    );

    return {
      cleanup: () => {
        cleanupScroll();
        deferredSeek.cancel();
        if (scrubTimeout !== null) window.clearTimeout(scrubTimeout);
      },
      overlay,
      overlayCreator,
      soughtTimes,
      video,
      videoState,
    };
  };

  it('commits only the final target after a wheel gesture becomes idle', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, soughtTimes, videoState } = setupScrollSeeking();

    overlay.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaX: 10 })
    );
    overlay.scrollLeft = 100;
    overlay.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(200);

    overlay.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaX: 10 })
    );
    overlay.scrollLeft = 600;
    overlay.dispatchEvent(new Event('scroll'));

    vi.advanceTimersByTime(299);
    expect(soughtTimes).toEqual([]);
    expect(videoState.isUserScrubbing).toBe(true);
    expect(
      (videoState.timeline.firstElementChild as HTMLElement).style.width
    ).toBe('25%');

    vi.advanceTimersByTime(1);
    expect(soughtTimes).toEqual([25]);
    expect(videoState.isUserScrubbing).toBe(false);
    cleanup();
  });

  it('contains horizontal wheel gestures at the scrubber edges', () => {
    vi.useFakeTimers();
    const { cleanup, overlay } = setupScrollSeeking();
    overlay.scrollLeft = 0;

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: -20,
    });
    overlay.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    cleanup();
  });

  it('leaves ordinary vertical wheel gestures available to the page', () => {
    vi.useFakeTimers();
    const { cleanup, overlay } = setupScrollSeeking();

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 20,
    });
    overlay.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
    expect(overlay.scrollLeft).toBe(0);
    cleanup();
  });

  it('preserves scroll seeking through temporary keyboard suspension', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, overlayCreator, videoState } =
      setupScrollSeeking();
    const keyboardMethods = overlayCreator as unknown as {
      handleKeyDown: (event: KeyboardEvent) => void;
      handleKeyUp: (event: KeyboardEvent) => void;
    };
    const wheel = () =>
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 20,
      });

    const beforeShortcut = wheel();
    overlay.dispatchEvent(beforeShortcut);
    expect(beforeShortcut.defaultPrevented).toBe(true);
    expect(overlay.scrollLeft).toBe(20);

    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', { code: 'MetaLeft', key: 'Meta' })
    );
    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', metaKey: true })
    );
    expect(document.documentElement.classList.contains('mfs-disabled')).toBe(
      true
    );
    expect(videoState.wrapper.isConnected).toBe(true);

    const duringShortcut = wheel();
    overlay.dispatchEvent(duringShortcut);
    expect(duringShortcut.defaultPrevented).toBe(false);
    expect(overlay.scrollLeft).toBe(20);

    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', { code: 'KeyF', key: 'f', metaKey: true })
    );
    expect(document.documentElement.classList.contains('mfs-disabled')).toBe(
      true
    );

    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', { code: 'MetaLeft', key: 'Meta' })
    );
    expect(document.documentElement.classList.contains('mfs-disabled')).toBe(
      false
    );
    expect(document.getElementById('mfs-fast-hide')).toBeNull();
    expect(videoState.wrapper.isConnected).toBe(true);

    const afterShortcut = wheel();
    overlay.dispatchEvent(afterShortcut);
    expect(afterShortcut.defaultPrevented).toBe(true);
    expect(overlay.scrollLeft).toBe(40);

    vi.advanceTimersByTime(100);
    expect(videoState.wrapper.isConnected).toBe(true);
    cleanup();
  });

  it('leaves all wheel and scroll behavior untouched when Scroll to Seek is disabled', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, soughtTimes, video, videoState } =
      setupScrollSeeking(() => false, false);
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperty(video, 'play', { configurable: true, value: play });
    const primaryKey = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
      ? { metaKey: true }
      : { ctrlKey: true };
    const wheel = new WheelEvent('wheel', {
      ...primaryKey,
      bubbles: true,
      cancelable: true,
      deltaX: 20,
    });

    overlay.dispatchEvent(wheel);
    overlay.scrollLeft = 400;
    overlay.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);

    expect(wheel.defaultPrevented).toBe(false);
    expect(play).not.toHaveBeenCalled();
    expect(soughtTimes).toEqual([]);
    expect(videoState.isUserScrubbing).toBe(false);
    cleanup();
  });

  it('removes native horizontal scrolling while another video-surface method remains enabled', () => {
    let isScrollSeekingEnabled = false;
    const settingsManager = {
      ...createSettingsManager({ dragVideoToSeek: true }),
      isScrollSeekingEnabled: () => isScrollSeekingEnabled,
    } as unknown as SettingsManager;
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { state, video } = createVideoState();
    videoStateManager.set(video, state);

    overlayCreator.updateScrollSeekingState();
    expect(state.overlay.style.overflowX).toBe('hidden');
    expect(state.overlay.style.pointerEvents).toBe('auto');

    isScrollSeekingEnabled = true;
    overlayCreator.updateScrollSeekingState();
    expect(state.overlay.style.overflowX).toBe('scroll');
  });

  it('plays right and pauses left without seeking or waiting', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, overlayCreator, video } = setupScrollSeeking();
    let paused = true;
    const play = vi.fn(() => {
      paused = false;
      return Promise.resolve();
    });
    const pause = vi.fn(() => {
      paused = true;
    });
    Object.defineProperties(video, {
      pause: { configurable: true, value: pause },
      paused: { configurable: true, get: () => paused },
      play: { configurable: true, value: play },
    });
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const primaryKey = isMac ? { metaKey: true } : { ctrlKey: true };
    const primaryKeyboardEvent = {
      ...primaryKey,
      code: isMac ? 'MetaLeft' : 'ControlLeft',
      key: isMac ? 'Meta' : 'Control',
    };
    const keyboardMethods = overlayCreator as unknown as {
      handleKeyDown: (event: KeyboardEvent) => void;
      handleKeyUp: (event: KeyboardEvent) => void;
    };
    const createWheel = (deltaX: number) =>
      new WheelEvent('wheel', {
        ...primaryKey,
        bubbles: true,
        cancelable: true,
        deltaX,
      });

    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', primaryKeyboardEvent)
    );
    expect(document.documentElement.classList.contains('mfs-disabled')).toBe(
      false
    );

    const firstWheel = createWheel(-20);
    overlay.dispatchEvent(firstWheel);
    overlay.dispatchEvent(createWheel(-10));

    expect(firstWheel.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
    expect(overlay.scrollLeft).toBe(0);

    const pauseWheel = createWheel(20);
    overlay.dispatchEvent(pauseWheel);

    expect(pauseWheel.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
    expect(overlay.scrollLeft).toBe(0);
    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', primaryKeyboardEvent)
    );
    cleanup();
  });

  it('discards momentum after Primary is released instead of seeking', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, overlayCreator, video } = setupScrollSeeking();
    let paused = true;
    const play = vi.fn(() => {
      paused = false;
      return Promise.resolve();
    });
    const pause = vi.fn(() => {
      paused = true;
    });
    Object.defineProperties(video, {
      pause: { configurable: true, value: pause },
      paused: { configurable: true, get: () => paused },
      play: { configurable: true, value: play },
    });
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const primaryKey = isMac ? { metaKey: true } : { ctrlKey: true };
    const primaryKeyboardEvent = {
      ...primaryKey,
      code: isMac ? 'MetaLeft' : 'ControlLeft',
      key: isMac ? 'Meta' : 'Control',
    };
    const keyboardMethods = overlayCreator as unknown as {
      handleKeyDown: (event: KeyboardEvent) => void;
      handleKeyUp: (event: KeyboardEvent) => void;
    };

    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', primaryKeyboardEvent)
    );
    overlay.dispatchEvent(
      new WheelEvent('wheel', {
        ...primaryKey,
        bubbles: true,
        cancelable: true,
        deltaX: -80,
      })
    );
    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', primaryKeyboardEvent)
    );

    vi.advanceTimersByTime(400);
    const firstMomentumTail = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: -30,
    });
    overlay.dispatchEvent(firstMomentumTail);

    vi.advanceTimersByTime(400);
    const finalMomentumTail = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: -0.5,
    });
    overlay.dispatchEvent(finalMomentumTail);

    expect(firstMomentumTail.defaultPrevented).toBe(true);
    expect(finalMomentumTail.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
    expect(overlay.scrollLeft).toBe(0);

    keyboardMethods.handleKeyDown(
      new KeyboardEvent('keydown', primaryKeyboardEvent)
    );
    const savedMomentumWithModifier = new WheelEvent('wheel', {
      ...primaryKey,
      bubbles: true,
      cancelable: true,
      deltaX: -10,
    });
    overlay.dispatchEvent(savedMomentumWithModifier);
    const immediateNextGesture = new WheelEvent('wheel', {
      ...primaryKey,
      bubbles: true,
      cancelable: true,
      deltaX: 20,
    });
    overlay.dispatchEvent(immediateNextGesture);
    keyboardMethods.handleKeyUp(
      new KeyboardEvent('keyup', primaryKeyboardEvent)
    );

    expect(savedMomentumWithModifier.defaultPrevented).toBe(true);
    expect(immediateNextGesture.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
    expect(overlay.scrollLeft).toBe(0);

    vi.advanceTimersByTime(500);
    const nextGesture = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: 20,
    });
    overlay.dispatchEvent(nextGesture);

    expect(nextGesture.defaultPrevented).toBe(true);
    expect(overlay.scrollLeft).toBe(20);
    cleanup();
  });

  it('controls a passive YouTube thumbnail through document wheel hit-testing', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, overlayCreator, video, videoState } =
      setupScrollSeeking();
    const thumbnail = document.createElement('ytd-thumbnail');
    thumbnail.appendChild(video);
    document.body.appendChild(thumbnail);
    const previewRect = {
      bottom: 120,
      height: 100,
      left: 10,
      right: 210,
      top: 20,
      width: 200,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect;
    overlay.getBoundingClientRect = () => previewRect;
    video.getBoundingClientRect = () => previewRect;

    const methods = overlayCreator as unknown as {
      updateOverlayPointerEvents: (
        targetVideo: HTMLVideoElement,
        state: VideoStateT
      ) => void;
    };
    methods.updateOverlayPointerEvents(video, videoState);

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
      deltaX: 20,
    });
    document.dispatchEvent(wheel);

    expect(overlay.style.getPropertyValue('pointer-events')).toBe('none');
    expect(overlay.style.getPropertyPriority('pointer-events')).toBe(
      'important'
    );
    expect(wheel.defaultPrevented).toBe(true);
    expect(overlay.scrollLeft).toBe(20);
    cleanup();
  });

  it('commits non-wheel scrolling as soon as scrollend fires', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, soughtTimes, videoState } = setupScrollSeeking();

    overlay.scrollLeft = 400;
    overlay.dispatchEvent(new Event('scroll'));
    expect(soughtTimes).toEqual([]);

    overlay.dispatchEvent(new Event('scrollend'));
    expect(soughtTimes).toEqual([50]);
    expect(videoState.isUserScrubbing).toBe(false);
    cleanup();
  });

  it('commits non-wheel scrolling after the inactivity fallback', () => {
    vi.useFakeTimers();
    const { cleanup, overlay, soughtTimes, videoState } = setupScrollSeeking();

    overlay.scrollLeft = 600;
    overlay.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(299);
    expect(soughtTimes).toEqual([]);
    expect(videoState.isUserScrubbing).toBe(true);

    vi.advanceTimersByTime(1);
    expect(soughtTimes).toEqual([25]);
    expect(videoState.isUserScrubbing).toBe(false);
    cleanup();
  });

  it('does not commit programmatic scroll synchronization', () => {
    vi.useFakeTimers();
    let isSettingInitialScroll = true;
    const { cleanup, overlay, soughtTimes } = setupScrollSeeking(
      () => isSettingInitialScroll
    );

    overlay.scrollLeft = 400;
    overlay.dispatchEvent(new Event('scroll'));
    isSettingInitialScroll = false;
    overlay.dispatchEvent(new Event('scrollend'));
    vi.advanceTimersByTime(300);

    expect(soughtTimes).toEqual([]);
    cleanup();
  });
});

describe('OverlayCreator overlay host', () => {
  it('portals a YouTube preview overlay outside the thumbnail renderer', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      videoStateManager,
      () => {}
    );
    const methods = overlayCreator as unknown as {
      createWrapperAndDebugIndicator: (
        video: HTMLVideoElement,
        videoId: string
      ) => {
        debugIndicator: HTMLAnchorElement;
        scrubWrapper: HTMLDivElement;
      };
      createOverlaySizeUpdater: (
        video: HTMLVideoElement,
        wrapper: HTMLDivElement
      ) => () => void;
      insertWrapperIntoDOM: (
        video: HTMLVideoElement,
        wrapper: HTMLDivElement
      ) => void;
      syncPassivePreviewWrapper: (
        video: HTMLVideoElement,
        wrapper: HTMLDivElement
      ) => void;
    };
    const thumbnail = document.createElement('ytd-thumbnail');
    const clippingContainer = document.createElement('div');
    clippingContainer.id = 'player-container-wrapper';
    const video = document.createElement('video');
    let mediaRect = {
      bottom: 180,
      height: 160,
      left: 10,
      right: 294,
      top: 20,
      width: 284,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect;
    let videoRect = {
      ...mediaRect,
      bottom: 212,
      height: 224,
      top: -12,
      y: -12,
    } as DOMRect;
    video.getBoundingClientRect = () => videoRect;
    clippingContainer.getBoundingClientRect = () => mediaRect;
    clippingContainer.style.overflow = 'hidden';
    thumbnail.getBoundingClientRect = () => ({
      ...mediaRect,
      bottom: mediaRect.bottom + 80,
      height: 240,
    });
    thumbnail.style.overflow = 'hidden';
    clippingContainer.appendChild(video);
    thumbnail.appendChild(clippingContainer);
    document.body.appendChild(thumbnail);

    const { debugIndicator, scrubWrapper } =
      methods.createWrapperAndDebugIndicator(video, 'youtube-preview');
    methods.insertWrapperIntoDOM(video, scrubWrapper);

    expect(thumbnail.style.position).toBe('');
    expect(video.nextSibling).toBeNull();
    expect(scrubWrapper.parentElement).toBe(document.documentElement);
    expect(scrubWrapper.dataset.mfsPassivePreviewHost).toBe('true');
    expect(scrubWrapper.style.position).toBe('fixed');
    expect(scrubWrapper.style.zIndex).toBe('2147483644');
    expect(scrubWrapper.style.left).toBe('10px');
    expect(scrubWrapper.style.top).toBe('20px');
    expect(debugIndicator.style.getPropertyValue('pointer-events')).toBe(
      'none'
    );
    expect(debugIndicator.style.getPropertyPriority('pointer-events')).toBe(
      'important'
    );

    const overlay = document.createElement('div');
    overlay.className = 'scrub-overlay';
    scrubWrapper.appendChild(overlay);
    methods.createOverlaySizeUpdater(video, scrubWrapper)();

    expect(scrubWrapper.style.height).toBe('160px');
    expect(overlay.style.height).toBe('160px');

    videoStateManager.set(video, {
      debugIndicator,
      isHovering: false,
      isPointerHovering: false,
      isUserScrubbing: false,
      overlay,
      scrollContent: document.createElement('div'),
      timeline: document.createElement('div'),
      wrapper: scrubWrapper,
    });
    overlayCreator.updateVideoControlsVisibility();

    expect(scrubWrapper.style.zIndex).toBe('2147483644');

    mediaRect = {
      ...mediaRect,
      bottom: 380,
      left: 310,
      right: 594,
      top: 220,
      x: 310,
      y: 220,
    };
    videoRect = {
      ...videoRect,
      bottom: 412,
      left: 310,
      right: 594,
      top: 188,
      x: 310,
      y: 188,
    };
    methods.syncPassivePreviewWrapper(video, scrubWrapper);

    expect(scrubWrapper.style.left).toBe('310px');
    expect(scrubWrapper.style.top).toBe('220px');
  });

  it('skips zero-size TikTok-style video wrappers', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      new VideoStateManager(),
      () => {}
    );
    const methods = overlayCreator as unknown as {
      createWrapperAndDebugIndicator: (
        video: HTMLVideoElement,
        videoId: string
      ) => { scrubWrapper: HTMLDivElement };
      insertWrapperIntoDOM: (
        video: HTMLVideoElement,
        wrapper: HTMLDivElement
      ) => void;
    };
    const player = document.createElement('div');
    const zeroSizeWrapper = document.createElement('div');
    const video = document.createElement('video');

    player.getBoundingClientRect = () =>
      ({
        bottom: 708,
        height: 688,
        left: 322,
        right: 709,
        top: 20,
        width: 387,
        x: 322,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    zeroSizeWrapper.getBoundingClientRect = () =>
      ({
        bottom: 20,
        height: 0,
        left: 322,
        right: 709,
        top: 20,
        width: 387,
        x: 322,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    video.getBoundingClientRect = player.getBoundingClientRect;
    Object.defineProperties(video, {
      offsetHeight: { configurable: true, value: 688 },
      offsetWidth: { configurable: true, value: 387 },
    });
    zeroSizeWrapper.appendChild(video);
    player.appendChild(zeroSizeWrapper);
    document.body.appendChild(player);

    const { scrubWrapper } = methods.createWrapperAndDebugIndicator(
      video,
      'tiktok-video'
    );
    methods.insertWrapperIntoDOM(video, scrubWrapper);

    expect(zeroSizeWrapper.style.position).toBe('');
    expect(player.style.position).toBe('relative');
    expect(scrubWrapper.parentElement).toBe(player);
    expect(scrubWrapper.style.width).toBe('387px');
    expect(scrubWrapper.style.height).toBe('688px');
  });

  it('keeps using a normally sized immediate parent', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      new VideoStateManager(),
      () => {}
    );
    const methods = overlayCreator as unknown as {
      createWrapperAndDebugIndicator: (
        video: HTMLVideoElement,
        videoId: string
      ) => { scrubWrapper: HTMLDivElement };
      insertWrapperIntoDOM: (
        video: HTMLVideoElement,
        wrapper: HTMLDivElement
      ) => void;
    };
    const player = document.createElement('div');
    const video = document.createElement('video');
    const rect = {
      bottom: 120,
      height: 100,
      left: 10,
      right: 210,
      top: 20,
      width: 200,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect;

    player.getBoundingClientRect = () => rect;
    video.getBoundingClientRect = () => rect;
    player.appendChild(video);
    document.body.appendChild(player);

    const { scrubWrapper } = methods.createWrapperAndDebugIndicator(
      video,
      'regular-video'
    );
    methods.insertWrapperIntoDOM(video, scrubWrapper);

    expect(player.style.position).toBe('relative');
    expect(scrubWrapper.parentElement).toBe(player);
    expect(video.nextSibling).toBe(scrubWrapper);
  });
});

describe('OverlayCreator debug indicator', () => {
  it('uses the toggle notification glass-pill treatment', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager(),
      new VideoStateManager(),
      () => {}
    );
    const debugIndicatorMethods = overlayCreator as unknown as {
      createDebugIndicator: (ownerDocument: Document) => HTMLAnchorElement;
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
    };
    const existingStyleCount = document.head.querySelectorAll('style').length;

    debugIndicatorMethods.createOverlayElement(document);
    const debugIndicator = debugIndicatorMethods.createDebugIndicator(document);
    const injectedStyles = document.head
      .querySelectorAll('style')
      .item(existingStyleCount).textContent;

    expect(debugIndicator.className).toBe('scrub-debug-indicator');
    expect(debugIndicator.textContent).toContain('BetterVideo (Extension)');
    expect(debugIndicator.textContent).toContain('Debug mode enabled');
    expect(
      debugIndicator.querySelector('.scrub-debug-indicator-logo')
    ).not.toBeNull();
    expect(injectedStyles).toContain('padding: 8px 10px 8px 8px');
    expect(injectedStyles).toContain('width: 24px');
    expect(injectedStyles).toContain('font-size: 10px');
    expect(injectedStyles).toContain('border-radius: 9999px');
    expect(injectedStyles).toContain('background: rgb(255 255 255 / 0.8)');
    expect(injectedStyles).toContain(
      'backdrop-filter: saturate(180%) blur(20px)'
    );
    expect(injectedStyles).toContain('@media (prefers-color-scheme: dark)');
    expect(injectedStyles).toContain('background: rgb(51 51 51 / 0.8)');
    expect(injectedStyles).toContain('@media (max-width: 480px)');
  });
});

describe('OverlayCreator hover tracking', () => {
  it('restores hover for a preview mounted under a stationary pointer', () => {
    const settingsManager = createSettingsManager({
      showTimelineOnHover: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();

    overlayCreator.startDocumentHoverTracking(document);
    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      restoreDocumentHoverAtLastPointer: (ownerDocument: Document) => void;
    };
    hoverTracking.restoreDocumentHoverAtLastPointer(document);

    expect(state.isPointerHovering).toBe(true);
    expect(state.isHovering).toBe(true);
    expect(state.timeline.style.opacity).toBe('1');
  });

  it('tracks visual hover through custom player layers and iframe boundaries', () => {
    const settingsManager = createSettingsManager({
      showTimelineOnHover: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    const customPlayerLayer = document.createElement('button');
    document.body.appendChild(customPlayerLayer);
    customPlayerLayer.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );

    expect(state.isHovering).toBe(true);
    expect(state.timeline.style.opacity).toBe('1');
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '25%'
    );

    customPlayerLayer.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 300,
        clientY: 180,
      })
    );
    expect(state.isHovering).toBe(false);
    expect(state.timeline.style.opacity).toBe('0');

    const playerFrame = document.createElement('iframe');
    document.body.appendChild(playerFrame);
    playerFrame.dispatchEvent(
      new MouseEvent('mouseover', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );

    expect(state.isHovering).toBe(true);
    expect(state.timeline.style.opacity).toBe('1');

    window.dispatchEvent(new Event('blur'));
    expect(state.isHovering).toBe(false);
    expect(state.timeline.style.opacity).toBe('0');
  });

  it('shows the timeline on hover when interactive seeking enables it', () => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );

    expect(state.isHovering).toBe(true);
    expect(state.timeline.style.opacity).toBe('1');
  });

  it('keeps volume dim during wheel-derived video hover', () => {
    vi.useFakeTimers();
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    state.mediaControls = document.createElement('div');
    document.body.appendChild(state.mediaControls);
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    window.dispatchEvent(new Event('blur'));
    document.body.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
        deltaX: 10,
      })
    );

    expect(state.isHovering).toBe(true);
    expect(state.isWheelHovering).toBe(true);
    expect(state.mediaControls.dataset.mfsVisible).not.toBe('true');

    vi.advanceTimersByTime(1499);
    expect(state.isHovering).toBe(true);
    vi.advanceTimersByTime(1);

    expect(state.isHovering).toBe(false);
    expect(state.isWheelHovering).toBe(false);
    expect(state.mediaControls.dataset.mfsVisible).toBe('false');
  });

  it('brightens volume only while the pointer is directly over it', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const mediaControls = document.createElement('div');
    state.mediaControls = mediaControls;
    mediaControls.dataset.mfsActive = 'true';
    mediaControls.dataset.mfsVisible = 'false';
    mediaControls.getBoundingClientRect = () =>
      ({
        bottom: 103,
        height: 86,
        left: 174,
        right: 202,
        top: 17,
        width: 28,
        x: 174,
        y: 17,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(mediaControls);
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 70,
      })
    );
    expect(state.isHovering).toBe(true);
    expect(mediaControls.dataset.mfsVideoHovered).toBe('true');
    expect(mediaControls.dataset.mfsVisible).toBe('false');

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 205,
        clientY: 70,
      })
    );
    expect(mediaControls.dataset.mfsVideoHovered).toBe('true');
    expect(mediaControls.dataset.mfsVisible).toBe('false');

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 180,
        clientY: 70,
      })
    );
    expect(mediaControls.dataset.mfsVideoHovered).toBe('true');
    expect(mediaControls.dataset.mfsVisible).toBe('true');

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 70,
      })
    );
    expect(mediaControls.dataset.mfsVisible).toBe('false');

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 150,
        clientY: 70,
      })
    );
    expect(mediaControls.dataset.mfsVisible).toBe('false');
  });

  it('renews wheel visibility and yields to the next pointer movement', () => {
    vi.useFakeTimers();
    const settingsManager = createSettingsManager({
      showTimelineOnHover: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    const wheelInside = () =>
      document.body.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          clientX: 100,
          clientY: 80,
          deltaY: 10,
        })
      );

    wheelInside();
    vi.advanceTimersByTime(1000);
    wheelInside();
    vi.advanceTimersByTime(1000);
    expect(state.isHovering).toBe(true);

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );
    expect(state.isWheelHovering).toBe(false);
    expect(state.isPointerHovering).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(state.isHovering).toBe(true);

    document.body.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 300,
        clientY: 180,
      })
    );
    expect(state.isHovering).toBe(false);
  });

  it('clears wheel-derived visibility when the wheel point is outside', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ showTimelineOnHover: true }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const hoverTracking = overlayCreator as unknown as {
      setupDocumentHoverTracking: (ownerDocument: Document) => void;
    };
    hoverTracking.setupDocumentHoverTracking(document);

    document.body.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      })
    );
    expect(state.isHovering).toBe(true);

    document.body.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        clientX: 300,
        clientY: 180,
      })
    );
    expect(state.isHovering).toBe(false);
    expect(state.isWheelHovering).toBe(false);
  });

  it('shows the paused timeline only while the video is hovered', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => true,
    });
    videoStateManager.set(video, state);

    const timelineVisibility = overlayCreator as unknown as {
      updateTimelineHoverState: (
        media: HTMLVideoElement,
        videoState: VideoStateT,
        isHovering: boolean
      ) => void;
    };

    timelineVisibility.updateTimelineHoverState(video, state, false);
    expect(state.timeline.style.opacity).toBe('0');

    timelineVisibility.updateTimelineHoverState(video, state, true);
    expect(state.timeline.style.opacity).toBe('1');
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '25%'
    );

    timelineVisibility.updateTimelineHoverState(video, state, false);
    expect(state.timeline.style.opacity).toBe('0');
  });
});

describe('OverlayCreator timeline seeking', () => {
  const setupTimelineSeeking = (enabled: boolean) => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: enabled,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(state.timeline, {
      hasPointerCapture: () => true,
      releasePointerCapture,
      setPointerCapture,
    });

    const deferredSeek = new DeferredMediaSeek(video, 150);
    const timelineMethods = overlayCreator as unknown as {
      setupTimelineSeeking: (
        targetVideo: HTMLVideoElement,
        timeline: HTMLDivElement,
        targetState: VideoStateT,
        seek: DeferredMediaSeek,
        debugMode: boolean
      ) => { cancel: () => void; cleanup: () => void };
      updateTimelineInteractivityForVideo: (
        targetVideo: HTMLVideoElement,
        timeline: HTMLDivElement
      ) => boolean;
    };
    const controller = timelineMethods.setupTimelineSeeking(
      video,
      state.timeline,
      state,
      deferredSeek,
      false
    );
    timelineMethods.updateTimelineInteractivityForVideo(video, state.timeline);

    return {
      controller,
      deferredSeek,
      releasePointerCapture,
      setPointerCapture,
      state,
      video,
    };
  };

  it('updates existing timeline hit testing when the setting changes', () => {
    let enabled = true;
    const settingsManager = {
      getTimelineHeight: () => 6,
      getTimelineHeightUnit: () => 'px' as const,
      getTimelinePosition: () => 'bottom' as const,
      isDebugEnabled: () => false,
      isTimelineSeekingEnabled: () => enabled,
      shouldShowTimelineOnHover: () => false,
      updateSetting: () => {},
    } as unknown as SettingsManager;
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    video.style.borderTopLeftRadius = '12px';
    video.style.borderTopRightRadius = '14px';
    video.style.borderBottomRightRadius = '16px';
    video.style.borderBottomLeftRadius = '18px';
    state.cancelTimelineSeeking = vi.fn();
    videoStateManager.set(video, state);

    overlayCreator.updateTimelineSeekingState();
    expect(state.timeline.style.pointerEvents).toBe('auto');
    expect(state.timeline.style.zIndex).toBe('2147483645');
    expect(state.timeline.parentElement).toBe(document.documentElement);
    expect(state.timeline.dataset.mfsPortaled).toBe('true');
    expect(state.timeline.style.position).toBe('absolute');
    expect(state.timeline.style.left).toBe('10px');
    expect(state.timeline.style.height).toBe('10px');
    expect(state.timeline.style.top).toBe('110px');
    expect(state.timeline.style.width).toBe('200px');
    expect(state.timeline.style.overflow).toBe('hidden');
    expect(state.timeline.style.borderTopLeftRadius).toBe('0px');
    expect(state.timeline.style.borderTopRightRadius).toBe('0px');
    expect(state.timeline.style.borderBottomRightRadius).toBe('16px');
    expect(state.timeline.style.borderBottomLeftRadius).toBe('18px');

    enabled = false;
    overlayCreator.updateTimelineSeekingState();
    expect(state.timeline.style.pointerEvents).toBe('none');
    expect(state.timeline.style.zIndex).toBe('');
    expect(state.timeline.parentElement).toBe(state.wrapper);
    expect(state.timeline.dataset.mfsPortaled).toBeUndefined();
    expect(state.timeline.style.position).toBe('absolute');
    expect(state.timeline.style.top).toBe('calc(100% - 6px)');
    expect(state.cancelTimelineSeeking).toHaveBeenCalledOnce();
  });

  it('temporarily animates timeline position and height setting updates', () => {
    vi.useFakeTimers();
    let timelineHeight = 6;
    let timelinePosition: 'top' | 'bottom' = 'bottom';
    const settingsManager = {
      ...createSettingsManager(),
      getTimelineHeight: () => timelineHeight,
      getTimelinePosition: () => timelinePosition,
    } as unknown as SettingsManager;
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    state.timeline.style.height = '6px';
    state.timeline.style.top = 'calc(100% - 6px)';
    videoStateManager.set(video, state);

    timelineHeight = 18;
    timelinePosition = 'top';
    overlayCreator.updateTimelineLayoutWithAnimation();

    expect(state.timeline.style.height).toBe('18px');
    expect(state.timeline.style.top).toBe('0px');
    expect(state.timeline.style.transition).toContain('top 320ms');
    expect(state.timeline.style.transition).toContain('height 320ms');

    vi.advanceTimersByTime(370);
    expect(state.timeline.style.transition).toBe('opacity 0.3s ease');
  });

  it('anchors a portaled timeline to document coordinates while the page scrolls', () => {
    Object.defineProperties(window, {
      scrollX: { configurable: true, value: 30 },
      scrollY: { configurable: true, value: 50 },
    });
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    overlayCreator.updateTimelineSeekingState();

    expect(state.timeline.parentElement).toBe(document.documentElement);
    expect(state.timeline.style.position).toBe('absolute');
    expect(state.timeline.style.left).toBe('40px');
    expect(state.timeline.style.top).toBe('160px');
  });

  it('uses a rounded outer clipping layer beyond a square player layer', () => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const playerRect = state.wrapper.getBoundingClientRect();
    const squarePlayerLayer = document.createElement('div');
    const roundedPlayerLayer = document.createElement('div');

    video.getBoundingClientRect = () => playerRect;
    squarePlayerLayer.getBoundingClientRect = () => playerRect;
    squarePlayerLayer.style.overflow = 'hidden';
    roundedPlayerLayer.getBoundingClientRect = () => playerRect;
    roundedPlayerLayer.style.overflow = 'hidden';
    roundedPlayerLayer.style.borderTopLeftRadius = '22px';
    roundedPlayerLayer.style.borderTopRightRadius = '22px';
    roundedPlayerLayer.style.borderBottomRightRadius = '22px';
    roundedPlayerLayer.style.borderBottomLeftRadius = '22px';
    squarePlayerLayer.append(video, state.wrapper);
    roundedPlayerLayer.appendChild(squarePlayerLayer);
    document.body.appendChild(roundedPlayerLayer);
    state.cancelTimelineSeeking = vi.fn();
    videoStateManager.set(video, state);

    overlayCreator.updateTimelineSeekingState();

    expect(state.timeline.style.borderTopLeftRadius).toBe('0px');
    expect(state.timeline.style.borderTopRightRadius).toBe('0px');
    expect(state.timeline.style.borderBottomRightRadius).toBe('22px');
    expect(state.timeline.style.borderBottomLeftRadius).toBe('22px');
  });

  it('positions percent-height top timelines and keeps them in a fullscreen layer', () => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
      timelineHeight: 10,
      timelineHeightUnit: '%',
      timelinePosition: 'top',
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    video.style.borderTopLeftRadius = '12px';
    video.style.borderTopRightRadius = '14px';
    video.style.borderBottomRightRadius = '16px';
    video.style.borderBottomLeftRadius = '18px';
    const fullscreenPlayer = document.createElement('div');
    fullscreenPlayer.append(video, state.wrapper);
    document.body.appendChild(fullscreenPlayer);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: fullscreenPlayer,
    });
    videoStateManager.set(video, state);

    overlayCreator.updateTimelineSeekingState();

    expect(state.timeline.parentElement).toBe(fullscreenPlayer);
    expect(state.timeline.style.height).toBe('10px');
    expect(state.timeline.style.top).toBe('20px');
    expect(state.timeline.style.borderTopLeftRadius).toBe('12px');
    expect(state.timeline.style.borderTopRightRadius).toBe('14px');
    expect(state.timeline.style.borderBottomRightRadius).toBe('0px');
    expect(state.timeline.style.borderBottomLeftRadius).toBe('0px');
  });

  it('does not grow a 100% timeline beyond the available video height', () => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
      timelineHeight: 100,
      timelineHeightUnit: '%',
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    video.style.borderTopLeftRadius = '12px';
    video.style.borderTopRightRadius = '14px';
    video.style.borderBottomRightRadius = '16px';
    video.style.borderBottomLeftRadius = '18px';
    state.wrapper.getBoundingClientRect = () =>
      ({
        bottom: 28,
        height: 8,
        left: 10,
        right: 210,
        top: 20,
        width: 200,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    videoStateManager.set(video, state);

    overlayCreator.updateTimelineSeekingState();

    expect(state.timeline.style.height).toBe('8px');
    expect(state.timeline.style.top).toBe('20px');
    expect(state.timeline.style.borderTopLeftRadius).toBe('12px');
    expect(state.timeline.style.borderTopRightRadius).toBe('14px');
    expect(state.timeline.style.borderBottomRightRadius).toBe('16px');
    expect(state.timeline.style.borderBottomLeftRadius).toBe('18px');
  });

  it('adds a visual handle to the current progress edge', () => {
    const settingsManager = createSettingsManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      new VideoStateManager(),
      () => {}
    );
    const timelineElements = overlayCreator as unknown as {
      createProgressIndicatorElement: (
        ownerDocument: Document
      ) => HTMLDivElement;
    };

    const progressIndicator =
      timelineElements.createProgressIndicatorElement(document);
    const handle = progressIndicator.querySelector(
      '.scrub-timeline-handle'
    ) as HTMLDivElement | null;
    const handleIndicator = progressIndicator.querySelector(
      '.scrub-timeline-handle-indicator'
    ) as HTMLDivElement | null;

    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
    expect(handle?.style.width).toBe('12px');
    expect(handle?.style.height).toBe('12px');
    expect(handle?.style.pointerEvents).toBe('none');
    expect(handleIndicator?.style.width).toBe('3px');
    expect(handleIndicator?.style.height).toBe('100%');
    expect(handleIndicator?.style.backgroundColor).toBe('white');
    expect(handleIndicator?.style.border).toBe('');
    expect(handleIndicator?.style.boxShadow).toBe('');
    expect(progressIndicator.style.overflow).toBe('visible');
    expect(progressIndicator.style.backgroundColor).toContain('0.3');
    expect(progressIndicator.style.backdropFilter).toBe(
      'blur(8px) saturate(140%)'
    );
  });

  it('hides the progress-edge thumb while the timeline is interactive', () => {
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({ isTimelineSeekingEnabled: true }),
      videoStateManager,
      () => {}
    );
    const timelineElements = overlayCreator as unknown as {
      createProgressIndicatorElement: (
        ownerDocument: Document
      ) => HTMLDivElement;
      updateTimelineInteractivityForVideo: (
        video: HTMLVideoElement,
        timeline: HTMLDivElement
      ) => boolean;
    };
    const { video, state } = createVideoState();
    const progressIndicator =
      timelineElements.createProgressIndicatorElement(document);
    state.timeline.replaceChildren(progressIndicator);
    videoStateManager.set(video, state);

    timelineElements.updateTimelineInteractivityForVideo(video, state.timeline);

    expect(
      progressIndicator.querySelector<HTMLElement>('.scrub-timeline-handle')
        ?.style.display
    ).toBe('none');
    expect(
      progressIndicator.querySelector<HTMLElement>(
        '.scrub-timeline-handle-indicator'
      )?.style.display
    ).toBe('none');
  });

  it('applies backdrop blur to the unfilled timeline track', () => {
    const settingsManager = createSettingsManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      new VideoStateManager(),
      () => {}
    );
    const timelineElements = overlayCreator as unknown as {
      createTimelineElement: (ownerDocument: Document) => HTMLDivElement;
    };

    const timeline = timelineElements.createTimelineElement(document);

    expect(timeline.style.background).toContain('0.2');
    expect(timeline.style.backdropFilter).toBe('blur(8px) saturate(140%)');
  });

  it('removes a portaled timeline when its video overlay is cleaned up', () => {
    const settingsManager = createSettingsManager({
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);
    overlayCreator.updateTimelineSeekingState();

    expect(state.timeline.parentElement).toBe(document.documentElement);
    videoStateManager.delete(video);

    expect(state.timeline.isConnected).toBe(false);
    expect(state.wrapper.isConnected).toBe(false);
  });

  it('keeps Minimal Player independent from interactive timeline seeking', () => {
    let isTimelineSeekingEnabled = true;
    let hideVideoControls = true;
    const settingsManager = {
      isTimelineSeekingEnabled: () => isTimelineSeekingEnabled,
      shouldHideVideoControls: () => hideVideoControls,
    } as unknown as SettingsManager;
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    player.className = 'html5-video-player';
    player.append(video, state.wrapper);
    document.body.appendChild(player);
    state.mediaControls = document.createElement('div');
    state.mediaControls.hidden = true;
    state.wrapper.appendChild(state.mediaControls);
    video.controls = true;
    videoStateManager.set(video, state);

    overlayCreator.updateVideoControlsVisibility();

    expect(video.controls).toBe(false);
    expect(video.dataset.mfsHideControls).toBe('true');
    expect(state.overlay.style.cursor).toBe('pointer');
    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(state.mediaControls.hidden).toBe(false);
    expect(state.mediaControls.dataset.mfsActive).toBe('true');
    expect(state.wrapper.style.getPropertyValue('z-index')).toBe('');
    expect(state.mediaControls.parentElement).toBe(document.documentElement);
    expect(state.mediaControls.dataset.mfsPortaled).toBe('true');
    expect(state.mediaControls.style.left).toBe('190px');
    expect(state.mediaControls.style.top).toBe('70px');

    const hoverMethods = overlayCreator as unknown as {
      updateTimelineHoverState: (
        video: HTMLVideoElement,
        state: VideoStateT,
        isHovering: boolean
      ) => void;
    };
    hoverMethods.updateTimelineHoverState(video, state, true);
    expect(state.mediaControls.dataset.mfsVisible).toBe('false');

    isTimelineSeekingEnabled = false;
    overlayCreator.updateVideoControlsVisibility();

    expect(video.controls).toBe(false);
    expect(video.dataset.mfsHideControls).toBe('true');
    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(state.mediaControls.dataset.mfsActive).toBe('true');

    hideVideoControls = false;
    overlayCreator.updateVideoControlsVisibility();
    expect(video.controls).toBe(true);
    expect(video.dataset.mfsHideControls).toBeUndefined();
    expect(state.overlay.style.cursor).toBe('');
    expect(player.dataset.mfsHideControlsContainer).toBeUndefined();
    expect(state.mediaControls.hidden).toBe(true);
    expect(state.mediaControls.dataset.mfsActive).toBe('false');
    expect(state.wrapper.style.zIndex).toBe('');
    expect(state.mediaControls.parentElement).toBe(state.wrapper);
    expect(state.mediaControls.dataset.mfsPortaled).toBeUndefined();
  });

  it('hides Vimeo controls from the player root when they are outside the video wrapper', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    player.id = 'player';
    player.className = 'player js-player-fullscreen';
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'vp-video-wrapper';
    const controls = document.createElement('div');
    controls.className = 'vp-controls';
    videoWrapper.append(video, state.wrapper);
    player.append(videoWrapper, controls);
    document.body.appendChild(player);
    videoStateManager.set(video, state);

    const styleInjector = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
    };
    styleInjector.createOverlayElement(document);
    overlayCreator.updateVideoControlsVisibility();

    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(videoWrapper.dataset.mfsHideControlsContainer).toBeUndefined();
    expect(getComputedStyle(controls).visibility).toBe('hidden');
    expect(getComputedStyle(controls).pointerEvents).toBe('none');
  });

  it('hides TikTok native volume and metadata while keeping the replacement control', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    const videoBranch = document.createElement('div');
    const nativeVolumeContainer = document.createElement('div');
    const nativeVolumeButton = document.createElement('button');
    const metadataOverlay = document.createElement('div');
    const creatorInfo = document.createElement('div');
    const description = document.createElement('div');
    const soundAttribution = document.createElement('a');
    const effectBadge = document.createElement('a');

    player.dataset.e2e = 'recommend-list-item-container';
    nativeVolumeContainer.className =
      'css-generated-7937d88b--DivVolumeControlContainer';
    nativeVolumeButton.setAttribute('aria-label', 'Volume');
    nativeVolumeContainer.appendChild(nativeVolumeButton);
    metadataOverlay.className =
      'css-generated-7937d88b--DivMediaCardOverlayBottom';
    creatorInfo.className = 'css-generated-7937d88b--DivCreatorInfoContainer';
    creatorInfo.textContent = 'Nilsa Furtado';
    description.dataset.e2e = 'video-desc';
    description.textContent = 'Mamã, juro que é brincadeira!';
    soundAttribution.dataset.e2e = 'video-music';
    soundAttribution.textContent = 'sonido original - Jhey JG';
    effectBadge.className = 'css-generated-7937d88b--TagChipContainer';
    effectBadge.textContent = 'Faded Shadow';
    metadataOverlay.append(creatorInfo, description, effectBadge);
    videoBranch.append(video, state.wrapper);
    player.append(
      videoBranch,
      nativeVolumeContainer,
      metadataOverlay,
      soundAttribution
    );
    document.body.appendChild(player);

    const methods = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      isTikTokVideo: (target: HTMLVideoElement) => boolean;
    };
    vi.spyOn(methods, 'isTikTokVideo').mockReturnValue(true);
    methods.createOverlayElement(document);
    state.mediaControls = methods.createMediaControlsElement(document);
    state.wrapper.appendChild(state.mediaControls);
    videoStateManager.set(video, state);

    overlayCreator.updateVideoControlsVisibility();

    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(player.dataset.mfsTiktokPlayer).toBe('true');
    expect(getComputedStyle(nativeVolumeContainer).visibility).toBe('hidden');
    expect(getComputedStyle(nativeVolumeButton).pointerEvents).toBe('none');
    expect(getComputedStyle(creatorInfo).visibility).toBe('hidden');
    expect(getComputedStyle(description).visibility).toBe('hidden');
    expect(getComputedStyle(effectBadge).visibility).toBe('hidden');
    expect(getComputedStyle(soundAttribution).visibility).toBe('hidden');
    expect(state.mediaControls.hidden).toBe(false);
    expect(getComputedStyle(state.mediaControls).visibility).toBe('hidden');

    videoStateManager.delete(video);
    expect(player.dataset.mfsTiktokPlayer).toBeUndefined();
    expect(getComputedStyle(creatorInfo).visibility).not.toBe('hidden');
    expect(getComputedStyle(description).visibility).not.toBe('hidden');
    expect(getComputedStyle(effectBadge).visibility).not.toBe('hidden');
    expect(getComputedStyle(soundAttribution).visibility).not.toBe('hidden');
  });

  it('hides Instagram player chrome while retaining replacement volume controls', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    const metadata = document.createElement('div');
    const profileLink = document.createElement('a');
    profileLink.href = '/loopypro/reels/';
    metadata.appendChild(profileLink);
    const videoStage = document.createElement('div');
    const videoBranch = document.createElement('div');
    const instagramControls = document.createElement('div');
    instagramControls.textContent = 'Audio is muted';
    state.wrapper.className = 'scrub-wrapper';
    videoBranch.append(video, state.wrapper);
    videoStage.append(videoBranch, instagramControls);
    player.append(metadata, videoStage);
    document.body.appendChild(player);
    state.mediaControls = document.createElement('div');
    state.wrapper.appendChild(state.mediaControls);
    videoStateManager.set(video, state);

    vi.spyOn(
      overlayCreator as unknown as {
        isInstagramVideo: (target: HTMLVideoElement) => boolean;
      },
      'isInstagramVideo'
    ).mockReturnValue(true);

    const styleInjector = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
    };
    styleInjector.createOverlayElement(document);
    overlayCreator.updateVideoControlsVisibility();

    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(player.dataset.mfsInstagramPlayer).toBe('true');
    expect(state.mediaControls.hidden).toBe(false);
    expect(state.mediaControls.dataset.mfsActive).toBe('true');
    expect(state.mediaControls.parentElement).toBe(document.documentElement);
    expect(getComputedStyle(metadata).visibility).toBe('hidden');
    expect(getComputedStyle(instagramControls).visibility).toBe('hidden');
    expect(getComputedStyle(state.wrapper).visibility).not.toBe('hidden');
  });

  it('hides the Steam custom-control sibling without hiding the scrub wrapper', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    player.className = 'responsive_menu_ignore_touch';
    const controls = document.createElement('div');
    controls.className = 'steam-player-controls';
    state.wrapper.className = 'scrub-wrapper';
    player.append(video, state.wrapper, controls);
    document.body.appendChild(player);
    videoStateManager.set(video, state);

    const styleInjector = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
    };
    styleInjector.createOverlayElement(document);
    overlayCreator.updateVideoControlsVisibility();

    expect(player.dataset.mfsHideControlsContainer).toBe('true');
    expect(getComputedStyle(controls).visibility).toBe('hidden');
    expect(getComputedStyle(controls).pointerEvents).toBe('none');
    expect(getComputedStyle(state.wrapper).visibility).not.toBe('hidden');
  });

  it('toggles playback when the hidden-controls overlay is clicked', () => {
    vi.useFakeTimers();
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const overlayCreator = new OverlayCreator(
      settingsManager,
      new VideoStateManager(),
      () => {}
    );
    const { video } = createVideoState();
    let isPaused = true;
    const play = vi.fn(() => {
      isPaused = false;
      return Promise.resolve();
    });
    const pause = vi.fn(() => {
      isPaused = true;
    });
    Object.defineProperties(video, {
      pause: { configurable: true, value: pause },
      paused: { configurable: true, get: () => isPaused },
      play: { configurable: true, value: play },
    });
    const parentClick = vi.fn();
    const parent = document.createElement('div');
    parent.addEventListener('click', parentClick);

    const clickHandling = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const overlay = clickHandling.createOverlayElement(document);
    parent.appendChild(overlay);
    document.body.appendChild(parent);
    let isHovering = true;
    const playbackController = clickHandling.setupPlayerClickHandling(
      overlay,
      video,
      false,
      () => isHovering
    );

    const playClick = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    overlay.dispatchEvent(playClick);
    vi.advanceTimersByTime(220);
    expect(playClick.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
    const playFeedback = parent.querySelector<HTMLElement>(
      '[data-mfs-playback-feedback="play"]'
    );
    expect(playFeedback).not.toBeNull();
    expect(playFeedback?.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(playFeedback as HTMLElement).width).toBe('112px');
    expect(getComputedStyle(playFeedback as HTMLElement).pointerEvents).toBe(
      'none'
    );
    expect(getComputedStyle(playFeedback as HTMLElement).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)'
    );
    expect(getComputedStyle(playFeedback as HTMLElement).borderWidth).toBe(
      '0px'
    );
    expect(
      getComputedStyle(playFeedback?.querySelector('svg') as SVGElement).width
    ).toBe('96px');
    expect(
      getComputedStyle(playFeedback?.querySelector('svg') as SVGElement).opacity
    ).toBe('0.9');
    expect(
      getComputedStyle(playFeedback?.querySelector('svg') as SVGElement)
        .visibility
    ).toBe('visible');
    const playbackStyles = document.head.querySelector('style')?.textContent;
    expect(playbackStyles).toContain('@supports (');
    expect(playbackStyles).toContain(
      '.mfs-playback-feedback[data-mfs-playback-feedback="play"]'
    );
    expect(playbackStyles).toContain(
      '.mfs-playback-feedback[data-mfs-playback-feedback="pause"]'
    );
    expect(playbackStyles).toContain('--mfs-playback-icon-mask: url(');
    expect(playbackStyles).toContain('%3Cpath%20d%3D');
    expect(playbackStyles).toContain('%3Crect%20x%3D');
    expect(playbackStyles).toContain('background: rgb(255 255 255 / 0.8)');
    expect(playbackStyles).toContain(
      'backdrop-filter: saturate(180%) blur(20px)'
    );
    expect(playbackStyles).toContain(
      'mask: var(--mfs-playback-icon-mask) center / contain no-repeat'
    );
    expect(playbackStyles).toContain('visibility: hidden');
    expect(playbackStyles).not.toContain('backdrop-filter: blur(4px)');

    overlay.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    );
    vi.advanceTimersByTime(220);
    expect(pause).toHaveBeenCalledOnce();
    const pauseFeedback = parent.querySelector<HTMLElement>(
      '[data-mfs-playback-feedback="pause"]'
    );
    expect(pauseFeedback).not.toBeNull();
    expect(pauseFeedback?.dataset.mfsPersistent).toBe('true');
    expect(pauseFeedback?.querySelectorAll('rect')).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(
      parent.querySelector('[data-mfs-playback-feedback="pause"]')
    ).not.toBeNull();

    isHovering = false;
    playbackController.sync();
    expect(
      parent.querySelector('[data-mfs-playback-feedback="pause"]')
    ).toBeNull();

    playbackController.cleanup();
    overlay.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    );
    expect(play).toHaveBeenCalledOnce();
    expect(parent.querySelector('[data-mfs-playback-feedback]')).toBeNull();
  });

  it('intercepts site player clicks so only custom playback feedback is shown', () => {
    vi.useFakeTimers();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    let isPaused = true;
    const play = vi.fn(() => {
      isPaused = false;
      return Promise.resolve();
    });
    Object.defineProperties(video, {
      paused: { configurable: true, get: () => isPaused },
      play: { configurable: true, value: play },
    });
    const player = document.createElement('div');
    player.append(video, state.wrapper);
    document.body.appendChild(player);
    const siteLayer = document.createElement('div');
    const siteClick = vi.fn();
    siteLayer.addEventListener('click', siteClick);
    state.wrapper.append(state.overlay, siteLayer);

    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false,
      () => true
    );
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });

    siteLayer.dispatchEvent(click);
    vi.advanceTimersByTime(220);

    expect(click.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(siteClick).not.toHaveBeenCalled();
    expect(
      state.wrapper.querySelector('[data-mfs-playback-feedback="play"]')
    ).not.toBeNull();
    playbackController.cleanup();
  });

  it('lets a YouTube search-result thumbnail navigate without toggling its preview', () => {
    vi.useFakeTimers();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperties(video, {
      paused: { configurable: true, value: true },
      play: { configurable: true, value: play },
    });

    const searchResult = document.createElement('ytd-video-renderer');
    const thumbnailClickLayer = document.createElement('div');
    const navigate = vi.fn();
    thumbnailClickLayer.addEventListener('click', navigate);
    searchResult.append(video, state.wrapper, thumbnailClickLayer);
    document.body.appendChild(searchResult);

    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        targetVideo: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false,
      () => true
    );
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });

    thumbnailClickLayer.dispatchEvent(click);
    vi.advanceTimersByTime(220);

    expect(click.defaultPrevented).toBe(false);
    expect(navigate).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
    expect(
      state.wrapper.querySelector('[data-mfs-playback-feedback]')
    ).toBeNull();
    playbackController.cleanup();
  });

  it('lets a YouTube iframe skip-ad button receive its click', () => {
    vi.useFakeTimers();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) throw new Error('Expected an iframe document');
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState(iframeDocument);
    const player = iframeDocument.createElement('div');
    player.className = 'html5-video-player';
    player.append(video, state.wrapper);
    iframeDocument.body.appendChild(player);
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperties(video, {
      paused: { configurable: true, value: true },
      play: { configurable: true, value: play },
    });

    const skipAdButton = iframeDocument.createElement('button');
    skipAdButton.className = 'ytp-ad-skip-button-modern';
    const label = iframeDocument.createElement('span');
    label.textContent = 'Skip Ad';
    skipAdButton.appendChild(label);
    const skipAd = vi.fn();
    skipAdButton.addEventListener('click', skipAd);
    player.appendChild(skipAdButton);

    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        targetVideo: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false,
      () => true
    );
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });

    label.dispatchEvent(click);
    vi.advanceTimersByTime(220);

    expect(click.defaultPrevented).toBe(false);
    expect(skipAd).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
    expect(
      state.wrapper.querySelector('[data-mfs-playback-feedback]')
    ).toBeNull();
    playbackController.cleanup();
  });

  it('does not intercept modal clicks layered over a video', () => {
    vi.useFakeTimers();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    player.append(video, state.wrapper);
    document.body.appendChild(player);
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperties(video, {
      paused: { configurable: true, value: true },
      play: { configurable: true, value: play },
    });

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const allowCookies = document.createElement('button');
    const allowCookiesClick = vi.fn();
    allowCookies.addEventListener('click', allowCookiesClick);
    dialog.appendChild(allowCookies);
    player.appendChild(dialog);

    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false,
      () => true
    );
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });

    allowCookies.dispatchEvent(click);
    vi.advanceTimersByTime(220);

    expect(click.defaultPrevented).toBe(false);
    expect(allowCookiesClick).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
    playbackController.cleanup();
  });

  it('toggles fullscreen on video double-click without toggling playback', async () => {
    vi.useFakeTimers();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    const player = document.createElement('div');
    player.className = 'html5-video-player';
    player.append(video, state.wrapper);
    document.body.appendChild(player);
    let isPaused = true;
    const play = vi.fn(() => {
      isPaused = false;
      return Promise.resolve();
    });
    Object.defineProperties(video, {
      paused: { configurable: true, get: () => isPaused },
      play: { configurable: true, value: play },
    });

    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = player;
      return Promise.resolve();
    });
    const exitFullscreen = vi.fn(() => {
      fullscreenElement = null;
      return Promise.resolve();
    });
    Object.defineProperty(player, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });

    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        targetVideo: HTMLVideoElement,
        debugMode: boolean,
        getIsHovering?: () => boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false,
      () => true
    );

    state.overlay.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    );
    state.overlay.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        button: 0,
        cancelable: true,
      })
    );
    await Promise.resolve();
    vi.runAllTimers();

    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();

    state.overlay.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        button: 0,
        cancelable: true,
      })
    );
    await Promise.resolve();
    expect(exitFullscreen).toHaveBeenCalledOnce();

    playbackController.cleanup();
  });

  it('renders a compact frosted volume pill and synchronizes it', () => {
    vi.useFakeTimers();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    Object.defineProperties(video, {
      muted: { configurable: true, value: false, writable: true },
      volume: { configurable: true, value: 0.8, writable: true },
    });

    const mediaControlMethods = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    mediaControlMethods.createOverlayElement(document);
    const controls = mediaControlMethods.createMediaControlsElement(document);
    state.wrapper.appendChild(controls);
    const controller = mediaControlMethods.setupMediaControls(
      controls,
      video,
      false
    );
    controller.sync();

    const volume = controls.querySelector<HTMLButtonElement>(
      '[data-mfs-action="volume"]'
    );
    const fill = controls.querySelector<HTMLElement>('.mfs-volume-fill');
    const icon = controls.querySelector<HTMLElement>('.mfs-volume-icon');
    expect(volume).not.toBeNull();
    expect(fill).not.toBeNull();
    expect(icon).not.toBeNull();
    expect(controls.querySelector('.mfs-volume-thumb')).toBeNull();
    expect(controls.querySelector('.mfs-volume-icon')).not.toBeNull();
    expect(controls.querySelectorAll('.mfs-volume-icon-wave')).toHaveLength(3);
    expect(controls.querySelectorAll('.mfs-volume-icon-muted')).toHaveLength(1);
    expect(controls.querySelector('svg')).not.toBeNull();
    expect(controls.querySelectorAll('button')).toHaveLength(1);
    expect(controls.querySelector('[data-mfs-action="fullscreen"]')).toBeNull();
    expect(volume?.style.getPropertyValue('--mfs-volume')).toBe('80%');
    expect(volume?.dataset.mfsVolumeLevel).toBe('high');
    expect(getComputedStyle(controls).borderRadius).toBe('8px 0 0 8px');
    expect(getComputedStyle(controls).width).toBe('20px');
    expect(getComputedStyle(controls).right).toBe('0px');
    expect(getComputedStyle(icon as HTMLElement).left).toBe('50%');
    expect(getComputedStyle(icon as HTMLElement).transform).toBe(
      'translateX(-50%)'
    );
    expect(getComputedStyle(controls).top).toBe('50%');
    expect(getComputedStyle(controls).bottom).toBe('auto');
    expect(getComputedStyle(controls).borderWidth).toBe('0px');
    expect(getComputedStyle(controls).height).toBe('min(72px, 100% - 16px)');
    expect(getComputedStyle(controls).backgroundColor).toContain('0.28');
    expect(getComputedStyle(controls).opacity).toBe('0');
    expect(getComputedStyle(controls).visibility).toBe('hidden');
    expect(getComputedStyle(controls).pointerEvents).toBe('none');
    controls.dataset.mfsActive = 'true';
    controls.dataset.mfsVideoHovered = 'true';
    expect(getComputedStyle(controls).opacity).toBe('0.3');
    expect(getComputedStyle(controls).pointerEvents).toBe('auto');
    controls.dataset.mfsVisible = 'true';
    expect(getComputedStyle(controls).opacity).toBe('1');
    controls.dataset.mfsVisible = 'false';
    expect(getComputedStyle(controls).boxShadow).toBe('none');
    expect(getComputedStyle(volume as HTMLElement).overflow).toBe('hidden');
    expect(getComputedStyle(controls).backdropFilter).toBe(
      'blur(6px) saturate(130%)'
    );
    expect(getComputedStyle(fill as HTMLElement).backgroundColor).toContain(
      '0.42'
    );
    expect(getComputedStyle(fill as HTMLElement).borderRadius).toBe('0px');
    expect(getComputedStyle(fill as HTMLElement).boxShadow).toBe('none');
    expect(getComputedStyle(fill as HTMLElement).backdropFilter).toBe(
      'blur(6px) saturate(130%)'
    );
    expect(document.head.querySelector('style')?.textContent).toContain(
      '.mfs-volume-fill'
    );
    expect(document.head.querySelector('style')?.textContent).toContain(
      'stroke-dashoffset 220ms'
    );
    expect(document.head.querySelector('style')?.textContent).toContain(
      'prefers-reduced-motion: reduce'
    );

    volume?.click();
    expect(video.muted).toBe(true);
    expect(volume?.getAttribute('aria-label')).toBe('Unmute');
    expect(volume?.style.getPropertyValue('--mfs-volume')).toBe('80%');
    expect(volume?.getAttribute('aria-valuenow')).toBe('80');
    expect(volume?.dataset.mfsMuted).toBe('true');
    expect(volume?.dataset.mfsVolumeLevel).toBe('muted');
    volume?.click();
    expect(video.muted).toBe(false);
    expect(volume?.dataset.mfsMuted).toBe('false');
    expect(volume?.dataset.mfsVolumeLevel).toBe('high');

    video.volume = 0.2;
    video.dispatchEvent(new Event('volumechange'));
    expect(volume?.dataset.mfsVolumeLevel).toBe('low');
    video.volume = 0.5;
    video.dispatchEvent(new Event('volumechange'));
    expect(volume?.dataset.mfsVolumeLevel).toBe('medium');
    video.volume = 0.8;
    video.dispatchEvent(new Event('volumechange'));
    expect(volume?.dataset.mfsVolumeLevel).toBe('high');

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 20,
    });
    volume?.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(video.volume).toBeCloseTo(0.82);

    volume?.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 2,
      })
    );
    expect(video.volume).toBeCloseTo(0.822);

    if (volume) {
      volume.getBoundingClientRect = () =>
        ({
          bottom: 150,
          height: 150,
          left: 0,
          right: 60,
          top: 0,
          width: 60,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      Object.assign(volume, {
        hasPointerCapture: () => true,
        releasePointerCapture: vi.fn(),
        setPointerCapture: vi.fn(),
      });
      volume.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 30, clientY: 120 })
      );
      expect(controls.dataset.mfsInteracting).toBe('true');
      expect(controls.dataset.mfsVisible).toBe('true');
      volume.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 30, clientY: 30 })
      );
      expect(volume.dataset.mfsDragging).toBe('true');
      expect(controls.dataset.mfsVisible).toBe('true');
      volume.dispatchEvent(
        createPointerEvent('pointerup', { clientX: 30, clientY: 30 })
      );
      expect(controls.dataset.mfsInteracting).toBeUndefined();
      expect(controls.dataset.mfsVisible).toBe('true');
    }
    expect(video.volume).toBeCloseTo(0.8);
    expect(volume?.style.getPropertyValue('--mfs-volume')).toBe('80%');

    const syntheticClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    volume?.dispatchEvent(syntheticClick);
    expect(syntheticClick.defaultPrevented).toBe(true);
    expect(video.muted).toBe(false);

    controller.cleanup();
  });

  it('inverts wheel volume changes when inverted scrolling is enabled', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        invertHorizontalScroll: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    Object.defineProperties(video, {
      muted: { configurable: true, value: false, writable: true },
      volume: { configurable: true, value: 0.8, writable: true },
    });

    const methods = overlayCreator as unknown as {
      createOverlayElement: (ownerDocument: Document) => HTMLDivElement;
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void };
    };
    methods.createOverlayElement(document);
    const controls = methods.createMediaControlsElement(document);
    state.wrapper.appendChild(controls);
    const controller = methods.setupMediaControls(controls, video, false);
    const volume = controls.querySelector<HTMLButtonElement>(
      '[data-mfs-action="volume"]'
    );

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 20,
    });
    volume?.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    expect(video.volume).toBeCloseTo(0.78);
    controller.cleanup();
  });

  it('preserves YouTube thumbnail mute and volume in minimal-player mode', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      videoStateManager,
      () => {}
    );
    const { video: previewVideo, state: previewState } = createVideoState();
    const thumbnail = document.createElement('ytd-thumbnail');
    document.body.appendChild(thumbnail);
    Object.defineProperties(previewVideo, {
      muted: { configurable: true, value: true, writable: true },
      volume: { configurable: true, value: 0.25, writable: true },
    });
    videoStateManager.set(previewVideo, previewState);

    const methods = overlayCreator as unknown as {
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        targetVideo: HTMLVideoElement,
        debugMode: boolean
      ) => {
        cleanup: () => void;
        preserveSourceVolume: () => void;
        sync: () => void;
      };
    };
    const controls = methods.createMediaControlsElement(document);
    previewState.wrapper.appendChild(controls);
    const controller = methods.setupMediaControls(
      controls,
      previewVideo,
      false
    );

    // YouTube can create the media before moving it into its thumbnail host.
    // Minimal Player must leave its audio state untouched throughout.
    controller.sync();
    expect(previewVideo.muted).toBe(true);
    expect(previewVideo.volume).toBe(0.25);

    thumbnail.appendChild(previewVideo);
    previewVideo.dispatchEvent(new Event('volumechange'));
    previewVideo.dispatchEvent(new Event('play'));
    vi.runAllTimers();

    expect(previewVideo.muted).toBe(true);
    expect(previewVideo.volume).toBe(0.25);

    // Later source-owned volume changes become the new preserved state.
    previewVideo.volume = 0.4;
    previewVideo.muted = false;
    previewVideo.dispatchEvent(new Event('volumechange'));
    previewVideo.volume = 0.9;
    previewVideo.muted = true;
    controller.preserveSourceVolume();
    expect(previewVideo.muted).toBe(false);
    expect(previewVideo.volume).toBe(0.4);
    controller.cleanup();
  });

  it('changes only the current video volume', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const { video: nextVideo, state: nextState } = createVideoState();
    Object.defineProperties(video, {
      muted: { configurable: true, value: false, writable: true },
      volume: { configurable: true, value: 0.8, writable: true },
    });
    Object.defineProperties(nextVideo, {
      muted: { configurable: true, value: true, writable: true },
      volume: { configurable: true, value: 1, writable: true },
    });
    videoStateManager.set(video, state);
    videoStateManager.set(nextVideo, nextState);

    const methods = overlayCreator as unknown as {
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        target: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void };
    };
    const controls = methods.createMediaControlsElement(document);
    state.wrapper.appendChild(controls);
    const controller = methods.setupMediaControls(controls, video, false);

    controls
      .querySelector<HTMLButtonElement>('[data-mfs-action="volume"]')
      ?.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 20,
        })
      );

    expect(video.volume).toBeCloseTo(0.82);
    expect(nextVideo.volume).toBe(1);
    expect(nextVideo.muted).toBe(true);
    controller.cleanup();
  });

  it('never overrides the video volume during setup or playback', async () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    Object.defineProperties(video, {
      muted: { configurable: true, value: true, writable: true },
      volume: { configurable: true, value: 1, writable: true },
    });

    const methods = overlayCreator as unknown as {
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        target: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void };
    };
    const controls = methods.createMediaControlsElement(document);
    state.wrapper.appendChild(controls);
    const controller = methods.setupMediaControls(controls, video, false);

    await Promise.resolve();

    expect(video.volume).toBe(1);
    expect(video.muted).toBe(true);
    expect(
      controls
        .querySelector<HTMLButtonElement>('[data-mfs-action="volume"]')
        ?.style.getPropertyValue('--mfs-volume')
    ).toBe('100%');

    video.volume = 0.1;
    video.muted = true;
    video.dispatchEvent(new Event('volumechange'));
    expect(video.volume).toBe(0.1);
    expect(video.muted).toBe(true);
    expect(
      controls
        .querySelector<HTMLButtonElement>('[data-mfs-action="volume"]')
        ?.style.getPropertyValue('--mfs-volume')
    ).toBe('10%');

    video.volume = 0.2;
    video.muted = true;
    video.dispatchEvent(new Event('play'));
    expect(video.volume).toBe(0.2);
    expect(video.muted).toBe(true);
    controller.cleanup();
  });

  it('mutes from the portaled volume pill without toggling playback', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: true,
        isTimelineSeekingEnabled: true,
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    const pause = vi.fn();
    Object.defineProperties(video, {
      muted: { configurable: true, value: false, writable: true },
      pause: { configurable: true, value: pause },
      paused: { configurable: true, value: false },
      volume: { configurable: true, value: 0.8, writable: true },
    });

    const methods = overlayCreator as unknown as {
      createMediaControlsElement: (ownerDocument: Document) => HTMLDivElement;
      setupMediaControls: (
        controls: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void; sync: () => void };
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void; sync: () => void };
      updateVideoControlsForVideo: (
        video: HTMLVideoElement,
        state: VideoStateT
      ) => void;
    };
    const controls = methods.createMediaControlsElement(document);
    state.mediaControls = controls;
    state.wrapper.appendChild(controls);
    videoStateManager.set(video, state);
    const playbackController = methods.setupPlayerClickHandling(
      state.overlay,
      video,
      false
    );
    const volumeController = methods.setupMediaControls(controls, video, false);

    methods.updateVideoControlsForVideo(video, state);
    controls
      .querySelector<HTMLButtonElement>('[data-mfs-action="volume"]')
      ?.click();
    vi.advanceTimersByTime(250);

    expect(video.muted).toBe(true);
    expect(pause).not.toHaveBeenCalled();

    playbackController.cleanup();
    volumeController.cleanup();
  });

  it('leaves overlay clicks untouched while video controls are visible', () => {
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        hideVideoControls: false,
        isTimelineSeekingEnabled: true,
      }),
      new VideoStateManager(),
      () => {}
    );
    const { video, state } = createVideoState();
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperty(video, 'play', {
      configurable: true,
      value: play,
    });
    const clickHandling = overlayCreator as unknown as {
      setupPlayerClickHandling: (
        overlay: HTMLDivElement,
        video: HTMLVideoElement,
        debugMode: boolean
      ) => { cleanup: () => void; sync: () => void };
    };
    const playbackController = clickHandling.setupPlayerClickHandling(
      state.overlay,
      video,
      false
    );
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });

    state.overlay.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(play).not.toHaveBeenCalled();
    playbackController.cleanup();
  });

  it('restores native controls when a hidden-controls overlay is removed', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    video.controls = true;
    videoStateManager.set(video, state);

    overlayCreator.updateVideoControlsVisibility();
    expect(video.controls).toBe(false);

    videoStateManager.delete(video);

    expect(video.controls).toBe(true);
    expect(video.dataset.mfsHideControls).toBeUndefined();
  });

  it('keeps controls available when the video has no interactive seek range', () => {
    const settingsManager = createSettingsManager({
      hideVideoControls: true,
      isTimelineSeekingEnabled: true,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    Object.defineProperties(video, {
      duration: { configurable: true, value: Number.NaN },
      seekable: { configurable: true, value: { length: 0 } },
    });
    video.controls = true;
    videoStateManager.set(video, state);

    overlayCreator.updateVideoControlsVisibility();

    expect(video.controls).toBe(true);
    expect(video.dataset.mfsHideControls).toBeUndefined();
  });

  it('does not intercept pointer input while the setting is disabled', () => {
    const { controller, deferredSeek, state, video } =
      setupTimelineSeeking(false);
    const pointerDown = createPointerEvent('pointerdown', { clientX: 110 });

    state.timeline.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(false);
    expect(state.timeline.style.pointerEvents).toBe('none');
    expect(state.isUserScrubbing).toBe(false);
    expect(video.currentTime).toBe(25);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('clicks and drags across the timeline, then commits the final target', () => {
    vi.useFakeTimers();
    const {
      controller,
      deferredSeek,
      releasePointerCapture,
      setPointerCapture,
      state,
      video,
    } = setupTimelineSeeking(true);

    const pointerDown = createPointerEvent('pointerdown', { clientX: 110 });
    state.timeline.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(state.isUserScrubbing).toBe(true);
    expect(state.timeline.style.cursor).toBe('grabbing');
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '50%'
    );
    expect(video.currentTime).toBe(25);

    state.timeline.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 260 })
    );
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '100%'
    );

    const pointerUp = createPointerEvent('pointerup', { clientX: 260 });
    state.timeline.dispatchEvent(pointerUp);

    expect(pointerUp.defaultPrevented).toBe(true);
    expect(video.currentTime).toBe(100);
    expect(state.isUserScrubbing).toBe(false);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(vi.getTimerCount()).toBe(0);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('commits a simple unloaded timeline click once on pointer release', () => {
    const { controller, deferredSeek, state, video } =
      setupTimelineSeeking(true);
    const soughtTimes: number[] = [];
    let currentTime = 25;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (time: number) => {
        currentTime = time;
        soughtTimes.push(time);
      },
    });

    state.timeline.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 110 })
    );
    expect(soughtTimes).toEqual([]);

    state.timeline.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 110 })
    );
    expect(soughtTimes).toEqual([50]);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('does not seek through intermediate unloaded targets during a slow timeline drag', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } =
      setupTimelineSeeking(true);
    const soughtTimes: number[] = [];
    let currentTime = 25;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (time: number) => {
        currentTime = time;
        soughtTimes.push(time);
      },
    });

    state.timeline.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 110 })
    );
    vi.advanceTimersByTime(500);
    state.timeline.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    vi.advanceTimersByTime(500);

    expect(soughtTimes).toEqual([]);

    state.timeline.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 210 })
    );
    expect(soughtTimes).toEqual([100]);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('commits the last drag target on cancellation and removes its listeners', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } =
      setupTimelineSeeking(true);

    state.timeline.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    state.timeline.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    state.timeline.dispatchEvent(
      createPointerEvent('pointercancel', { clientX: 160 })
    );

    expect(video.currentTime).toBe(75);
    expect(state.isUserScrubbing).toBe(false);

    controller.cleanup();
    deferredSeek.cancel();
    const pointerDownAfterCleanup = createPointerEvent('pointerdown', {
      clientX: 110,
    });
    state.timeline.dispatchEvent(pointerDownAfterCleanup);
    expect(pointerDownAfterCleanup.defaultPrevented).toBe(false);
  });

  it('does not intercept an interactive timeline without a seekable range', () => {
    const { controller, deferredSeek, state, video } =
      setupTimelineSeeking(true);
    Object.defineProperties(video, {
      duration: { configurable: true, value: Number.NaN },
      seekable: { configurable: true, value: { length: 0 } },
    });

    const pointerDown = createPointerEvent('pointerdown', { clientX: 110 });
    state.timeline.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(false);
    expect(state.timeline.style.pointerEvents).toBe('none');
    expect(state.timeline.parentElement).toBe(state.wrapper);
    expect(state.timeline.dataset.mfsPortaled).toBeUndefined();
    expect(video.currentTime).toBe(25);

    controller.cleanup();
    deferredSeek.cancel();
  });
});

describe('OverlayCreator action-area settings preview', () => {
  it('animates the existing action area and restores its preview tint', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        actionArea: 'middle',
        actionAreaSize: 30,
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    state.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    videoStateManager.set(video, state);

    overlayCreator.updateAllOverlaysForActionArea();

    expect(state.overlay.style.top).toBe('35px');
    expect(state.overlay.style.height).toBe('30px');
    expect(state.overlay.style.transition).toContain('top 320ms');
    expect(state.overlay.style.transition).toContain('height 320ms');
    expect(state.overlay.style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(state.overlay.style.boxShadow).toContain('inset 0 0 0 2px');

    vi.advanceTimersByTime(1200);
    expect(state.overlay.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(state.overlay.style.boxShadow).toBe('');
    expect(state.overlay.style.transition).toBe('');
    expect(videoStateManager.get(video)).toBe(state);
  });

  it('previews a temporary area and restores the saved player area', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        actionArea: 'middle',
        actionAreaSize: 30,
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    overlayCreator.previewActionArea('top', 40);

    expect(state.overlay.style.top).toBe('0px');
    expect(state.overlay.style.height).toBe('40px');
    expect(state.overlay.style.boxShadow).toContain('inset 0 0 0 2px');

    overlayCreator.clearActionAreaPreview();
    vi.advanceTimersByTime(0);

    expect(state.overlay.style.top).toBe('35px');
    expect(state.overlay.style.height).toBe('30px');
  });

  it('uses absolute pixels for action area height', () => {
    vi.useFakeTimers();
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      createSettingsManager({
        actionArea: 'bottom',
        actionAreaSize: 24,
        actionAreaSizeUnit: 'px',
      }),
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    overlayCreator.updateAllOverlaysForActionArea();

    expect(state.overlay.style.top).toBe('76px');
    expect(state.overlay.style.height).toBe('24px');
  });
});

describe('OverlayCreator video dragging seeking', () => {
  const setupVideoDragging = ({
    actionArea = 'full',
    actionAreaSize = 30,
    dragVideoToSeek = true,
    isTimelineSeekingEnabled = true,
  }: {
    actionArea?: 'full' | 'top' | 'middle' | 'bottom';
    actionAreaSize?: number;
    dragVideoToSeek?: boolean;
    isTimelineSeekingEnabled?: boolean;
  } = {}) => {
    const settingsManager = createSettingsManager({
      actionArea,
      actionAreaSize,
      dragVideoToSeek,
      isTimelineSeekingEnabled,
    });
    const videoStateManager = new VideoStateManager();
    const overlayCreator = new OverlayCreator(
      settingsManager,
      videoStateManager,
      () => {}
    );
    const { video, state } = createVideoState();
    videoStateManager.set(video, state);

    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(state.overlay, {
      hasPointerCapture: () => true,
      releasePointerCapture,
      setPointerCapture,
    });

    const deferredSeek = new DeferredMediaSeek(video, 150);
    const dragMethods = overlayCreator as unknown as {
      setupVideoDraggingSeeking: (
        targetVideo: HTMLVideoElement,
        overlay: HTMLDivElement,
        timeline: HTMLDivElement,
        targetState: VideoStateT,
        seek: DeferredMediaSeek,
        debugMode: boolean
      ) => { cancel: () => void; cleanup: () => void };
      updateVideoDraggingForVideo: (
        targetVideo: HTMLVideoElement,
        targetState: VideoStateT
      ) => boolean;
    };
    const controller = dragMethods.setupVideoDraggingSeeking(
      video,
      state.overlay,
      state.timeline,
      state,
      deferredSeek,
      false
    );
    dragMethods.updateVideoDraggingForVideo(video, state);

    return {
      controller,
      deferredSeek,
      overlayCreator,
      releasePointerCapture,
      setPointerCapture,
      state,
      video,
      videoStateManager,
    };
  };

  it('preserves an ordinary click until horizontal dragging starts', () => {
    const { controller, deferredSeek, state, video } = setupVideoDragging();
    const pointerDown = createPointerEvent('pointerdown', {
      clientX: 60,
    });
    const pointerUp = createPointerEvent('pointerup', { clientX: 60 });
    const click = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });

    state.overlay.dispatchEvent(pointerDown);
    state.overlay.dispatchEvent(pointerUp);
    state.overlay.dispatchEvent(click);

    expect(pointerDown.defaultPrevented).toBe(false);
    expect(pointerUp.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(false);
    expect(state.isUserScrubbing).toBe(false);
    expect(video.currentTime).toBe(25);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('drags across the video, updates the timeline, and commits the seek', () => {
    vi.useFakeTimers();
    const {
      controller,
      deferredSeek,
      releasePointerCapture,
      setPointerCapture,
      state,
      video,
    } = setupVideoDragging();

    expect(state.overlay.style.cursor).toBe('pointer');

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    const pointerMove = createPointerEvent('pointermove', { clientX: 160 });
    state.overlay.dispatchEvent(pointerMove);

    expect(pointerMove.defaultPrevented).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(state.isUserScrubbing).toBe(true);
    expect(state.isVideoDragging).toBe(true);
    expect(state.overlay.style.cursor).toBe('pointer');
    expect(document.documentElement.classList).toContain('mfs-video-dragging');
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '75%'
    );
    expect(video.currentTime).toBe(25);

    const pointerUp = createPointerEvent('pointerup', { clientX: 210 });
    state.overlay.dispatchEvent(pointerUp);

    expect(pointerUp.defaultPrevented).toBe(true);
    expect(video.currentTime).toBe(100);
    expect(state.isUserScrubbing).toBe(false);
    expect(state.isVideoDragging).toBe(false);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(document.documentElement.classList).not.toContain(
      'mfs-video-dragging'
    );

    const syntheticClick = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    state.overlay.dispatchEvent(syntheticClick);
    expect(syntheticClick.defaultPrevented).toBe(true);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('drags without Click and Drag Seekbar being enabled', () => {
    const { controller, deferredSeek, state, video } = setupVideoDragging({
      isTimelineSeekingEnabled: false,
    });

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 160 })
    );

    expect(video.currentTime).toBe(75);
    expect(state.isUserScrubbing).toBe(false);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('only starts a drag inside the shared active video area', () => {
    const { controller, deferredSeek, state, video } = setupVideoDragging({
      actionArea: 'bottom',
      actionAreaSize: 30,
      isTimelineSeekingEnabled: false,
    });

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60, clientY: 40 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160, clientY: 40 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 160, clientY: 40 })
    );
    expect(video.currentTime).toBe(25);

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60, clientY: 100 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160, clientY: 100 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 160, clientY: 100 })
    );
    expect(video.currentTime).toBe(75);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('holds at either video edge while dragging outside until pointerup', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } = setupVideoDragging();

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    document.dispatchEvent(
      createPointerEvent('pointermove', { clientX: -100 })
    );

    expect(state.isVideoDragging).toBe(true);
    expect(state.isUserScrubbing).toBe(true);
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '0%'
    );
    expect(video.currentTime).toBe(25);

    document.dispatchEvent(createPointerEvent('pointermove', { clientX: 500 }));

    expect(state.isVideoDragging).toBe(true);
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '100%'
    );
    expect(video.currentTime).toBe(25);

    const pointerUp = createPointerEvent('pointerup', { clientX: 500 });
    document.dispatchEvent(pointerUp);

    expect(pointerUp.defaultPrevented).toBe(true);
    expect(video.currentTime).toBe(100);
    expect(state.isVideoDragging).toBe(false);
    expect(state.isUserScrubbing).toBe(false);

    const syntheticClick = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    document.body.dispatchEvent(syntheticClick);
    expect(syntheticClick.defaultPrevented).toBe(true);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('continues document tracking if pointer capture is lost outside', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } = setupVideoDragging();

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('lostpointercapture', { clientX: 220 })
    );

    expect(state.isVideoDragging).toBe(true);
    expect(state.isUserScrubbing).toBe(true);

    document.dispatchEvent(createPointerEvent('pointermove', { clientX: 500 }));
    document.dispatchEvent(createPointerEvent('pointerup', { clientX: 500 }));

    expect(video.currentTime).toBe(100);
    expect(state.isVideoDragging).toBe(false);
    expect(state.isUserScrubbing).toBe(false);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('keeps the clamped pointer target authoritative over overlay scrolling', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, overlayCreator, state, video } =
      setupVideoDragging();
    Object.defineProperties(state.overlay, {
      clientWidth: { configurable: true, value: 200 },
      offsetWidth: { configurable: true, value: 200 },
      scrollLeft: { configurable: true, value: 400, writable: true },
    });
    Object.defineProperty(state.scrollContent, 'offsetWidth', {
      configurable: true,
      value: 1000,
    });

    let scrubTimeout: number | null = null;
    const seekSpeedLabel = document.createElement('div');
    state.wrapper.appendChild(seekSpeedLabel);
    const scrollMethods = overlayCreator as unknown as {
      setupScrollHandling: (
        targetVideo: HTMLVideoElement,
        overlay: HTMLDivElement,
        scrollContent: HTMLDivElement,
        timeline: HTMLDivElement,
        seekSpeedLabel: HTMLDivElement,
        getIsSettingInitialScroll: () => boolean,
        setIsSettingInitialScroll: (value: boolean) => void,
        setScrubTimeout: (timeout: number | null) => void,
        getScrubTimeout: () => number | null,
        getIsHovering: () => boolean,
        seek: DeferredMediaSeek,
        debugMode: boolean
      ) => () => void;
    };
    const cleanupScroll = scrollMethods.setupScrollHandling(
      video,
      state.overlay,
      state.scrollContent,
      state.timeline,
      seekSpeedLabel,
      () => false,
      () => {},
      (timeout) => {
        scrubTimeout = timeout;
      },
      () => scrubTimeout,
      () => true,
      deferredSeek,
      false
    );

    // Arm the scroll-settle timer before dragging, then simulate native
    // overlay scrolling after the pointer has clamped beyond the right edge.
    state.overlay.dispatchEvent(new Event('scroll'));
    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    document.dispatchEvent(createPointerEvent('pointermove', { clientX: 500 }));
    state.overlay.scrollLeft = 800;
    state.overlay.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(300);

    expect(state.isVideoDragging).toBe(true);
    expect(state.isUserScrubbing).toBe(true);
    expect((state.timeline.firstElementChild as HTMLElement).style.width).toBe(
      '100%'
    );
    expect(video.currentTime).toBe(25);

    document.dispatchEvent(createPointerEvent('pointerup', { clientX: 500 }));
    expect(video.currentTime).toBe(100);

    cleanupScroll();
    controller.cleanup();
    deferredSeek.cancel();
    if (scrubTimeout !== null) window.clearTimeout(scrubTimeout);
  });

  it('does not seek through intermediate unloaded targets during a slow video drag', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } = setupVideoDragging();
    const soughtTimes: number[] = [];
    let currentTime = 25;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (time: number) => {
        currentTime = time;
        soughtTimes.push(time);
      },
    });

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    vi.advanceTimersByTime(500);
    state.overlay.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 180 })
    );
    vi.advanceTimersByTime(500);

    expect(soughtTimes).toEqual([]);

    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 210 })
    );
    expect(soughtTimes).toEqual([100]);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('leaves vertical pointer gestures available to the page', () => {
    const { controller, deferredSeek, state, video } = setupVideoDragging();

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60, clientY: 60 })
    );
    const pointerMove = createPointerEvent('pointermove', {
      clientX: 62,
      clientY: 85,
    });
    state.overlay.dispatchEvent(pointerMove);
    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 62, clientY: 85 })
    );

    expect(pointerMove.defaultPrevented).toBe(false);
    expect(state.isUserScrubbing).toBe(false);
    expect(video.currentTime).toBe(25);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('scrubs from a site-owned layer positioned over the video', () => {
    vi.useFakeTimers();
    const { controller, deferredSeek, state, video } = setupVideoDragging();
    const playerLayer = document.createElement('div');
    state.wrapper.appendChild(playerLayer);

    playerLayer.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    playerLayer.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 160 })
    );
    playerLayer.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 160 })
    );

    expect(video.currentTime).toBe(75);
    expect(state.isUserScrubbing).toBe(false);

    controller.cleanup();
    deferredSeek.cancel();
  });

  it('does not intercept video drags while its child setting is disabled', () => {
    const { controller, deferredSeek, state, video } = setupVideoDragging({
      dragVideoToSeek: false,
    });
    const pointerMove = createPointerEvent('pointermove', { clientX: 160 });

    state.overlay.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 60 })
    );
    state.overlay.dispatchEvent(pointerMove);
    state.overlay.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 160 })
    );

    expect(pointerMove.defaultPrevented).toBe(false);
    expect(state.overlay.style.cursor).toBe('');
    expect(state.overlay.style.touchAction).toBe('');
    expect(state.isUserScrubbing).toBe(false);
    expect(video.currentTime).toBe(25);

    controller.cleanup();
    deferredSeek.cancel();
  });
});

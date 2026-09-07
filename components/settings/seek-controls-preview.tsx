import { MousePointer2Icon, PointerIcon } from 'lucide-react';
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  DEFAULT_FAST_SCROLL_HOTKEY,
  DEFAULT_SLOW_SCROLL_HOTKEY,
  getPlayerLayerWheelDeltaPixels,
  getScrollSpeedMultiplier,
  hasScrollSpeedHotkey,
  normalizeScrollSpeedFactor,
  type ScrollHotkeyT,
} from '@/helpers/scroll-speed';
import { cn } from '@/lib/utils';
import { ActionAreaE, type ActionAreaT } from '@/types/content';

export type SeekControlMethodT = 'scroll' | 'drag' | 'seekbar';

const methodLabels: Record<SeekControlMethodT, string> = {
  scroll: 'Scroll',
  drag: 'Drag',
  seekbar: 'Seekbar',
};

const methodPreviewLabels: Record<SeekControlMethodT, string> = {
  scroll: 'Scroll to Seek',
  drag: 'Drag to Seek',
  seekbar: 'Click & Drag Seekbar',
};

const scrollDeviceNames = ['trackpad', 'magic-mouse', 'mouse'] as const;

const actionAreaLabels: Record<ActionAreaT, string> = {
  [ActionAreaE.Full]: 'full',
  [ActionAreaE.Top]: 'top',
  [ActionAreaE.Middle]: 'middle',
  [ActionAreaE.Bottom]: 'bottom',
};

function ScrollGestureCue({
  deviceIndex,
  fingersRef,
  wheelRef,
}: {
  deviceIndex: number;
  fingersRef: RefObject<HTMLDivElement | null>;
  wheelRef: RefObject<HTMLSpanElement | null>;
}) {
  const device = scrollDeviceNames[deviceIndex] ?? scrollDeviceNames[0];
  const isTrackpad = device === 'trackpad';
  const isMagicMouse = device === 'magic-mouse';

  return (
    <div
      className="relative h-18 w-20 text-white"
      data-testid="scroll-gesture-cue"
    >
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm backdrop-saturate-[1.4]"
          data-testid="scroll-device-container"
        >
          <div
            className="seek-preview-scroll-device relative overflow-hidden border-2 border-white/80 transition-[width,height,border-radius,background-color,box-shadow] duration-700 ease-in-out [corner-shape:squircle] motion-reduce:transition-none"
            data-scroll-device={device}
            data-testid="scroll-device"
            style={{
              backgroundColor: isTrackpad
                ? 'transparent'
                : 'rgb(255 255 255 / 0.1)',
              borderRadius: isTrackpad
                ? '6px'
                : isMagicMouse
                  ? '50% / 40%'
                  : '50px',
              boxShadow: isTrackpad
                ? 'none'
                : 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
              height: isTrackpad ? '2.5rem' : '3rem',
              width: isTrackpad ? '3.5rem' : '1.75rem',
            }}
          >
            <div
              className="seek-preview-scroll-fingers absolute transition-[top,left,gap,opacity] duration-700 ease-in-out motion-reduce:transition-none"
              data-testid="scroll-fingers"
              ref={fingersRef}
              style={
                {
                  '--seek-finger-x': '0px',
                  gap: isTrackpad ? '4px' : '0px',
                  left: '50%',
                  opacity: device === 'mouse' ? 0 : 1,
                  top: isTrackpad ? '50%' : isMagicMouse ? '10px' : '12px',
                } as React.CSSProperties
              }
            >
              <span className="block size-2 rounded-full bg-white shadow-sm" />
              <span
                className="seek-preview-scroll-finger-secondary block h-2 rounded-full bg-white shadow-sm transition-[width,opacity] duration-700 ease-in-out motion-reduce:transition-none"
                style={{
                  opacity: isTrackpad ? 1 : 0,
                  width: isTrackpad ? '8px' : '0px',
                }}
              />
            </div>
            <span
              className="seek-preview-scroll-wheel absolute block h-4 w-2 rounded-full bg-white shadow-sm transition-opacity duration-700 ease-in-out motion-reduce:transition-none"
              data-testid="scroll-wheel"
              ref={wheelRef}
              style={
                {
                  '--seek-wheel-x': '0px',
                  opacity: device === 'mouse' ? 1 : 0,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DragGestureCue({
  cueRef,
}: {
  cueRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="absolute left-1/2 grid w-fit -translate-x-1/2 place-items-center rounded-2xl bg-white/20 p-3 text-white backdrop-blur-sm backdrop-saturate-[1.4]"
      data-testid="drag-gesture-cue"
      ref={cueRef}
    >
      <PointerIcon
        className="seek-preview-drag-press size-7 fill-white/25 stroke-[2.5] drop-shadow-sm"
        data-testid="drag-cursor-hand"
      />
    </div>
  );
}

interface SeekControlsPreviewPropsI {
  actionArea: ActionAreaT;
  actionAreaSize: number;
  actionAreaSizeUnit?: 'px' | '%';
  colorizedTimeline: boolean;
  fastScrollHotkey?: ScrollHotkeyT;
  focusedMethod: SeekControlMethodT;
  isDragSeekingEnabled: boolean;
  scrollInverted?: boolean;
  isScrollSeekingEnabled: boolean;
  isSeekbarSeekingEnabled: boolean;
  scrollSpeedFactor?: number;
  slowScrollHotkey?: ScrollHotkeyT;
  timelineHeight: number;
  timelinePosition: 'top' | 'bottom';
  timelineUnit: 'px' | '%';
}

const PREVIEW_PROGRESS_MIN = 0.34;
const PREVIEW_PROGRESS_MAX = 0.72;
const PREVIEW_STATIC_PROGRESS =
  (PREVIEW_PROGRESS_MIN + PREVIEW_PROGRESS_MAX) / 2;
const SCROLL_DEVICE_PHASE_SECONDS = 6.4;
const SCROLL_DEVICE_PHASE_COUNT = 3;
const VIDEO_SEEK_INTERVAL_MS = 80;
const TEST_TO_DEMO_BLEND_MS = 700;

export function getSeekPreviewProgress(
  elapsedMs: number,
  method: SeekControlMethodT,
  scrollInverted = false
) {
  const cycleDurationMs = method === 'scroll' ? 3200 : 4000;
  const cycleProgress = (elapsedMs % cycleDurationMs) / cycleDurationMs;
  const easedProgress = (1 - Math.cos(cycleProgress * Math.PI * 2)) / 2;

  const progress =
    PREVIEW_PROGRESS_MIN +
    easedProgress * (PREVIEW_PROGRESS_MAX - PREVIEW_PROGRESS_MIN);

  return method === 'scroll' && scrollInverted
    ? PREVIEW_PROGRESS_MIN + PREVIEW_PROGRESS_MAX - progress
    : progress;
}

export function getSeekPreviewElapsed(
  elapsedMs: number,
  method: SeekControlMethodT,
  scrollSpeedFactor: number
) {
  return method === 'scroll'
    ? elapsedMs * normalizeScrollSpeedFactor(scrollSpeedFactor)
    : elapsedMs;
}

export function getScrollWheelOffset(elapsedMs: number) {
  const cycleDurationMs = 3200;
  const directionDurationMs = cycleDurationMs / 2;
  const snapDurationMs = 140;
  const cycleElapsedMs = elapsedMs % cycleDurationMs;
  const direction = cycleElapsedMs < directionDurationMs ? 1 : -1;
  const directionElapsedMs = cycleElapsedMs % directionDurationMs;
  const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

  let snapProgress = 1;
  if (directionElapsedMs < snapDurationMs) {
    snapProgress = easeOut(directionElapsedMs / snapDurationMs);
  } else if (directionElapsedMs > directionDurationMs - snapDurationMs) {
    snapProgress =
      1 -
      easeOut(
        (directionElapsedMs - (directionDurationMs - snapDurationMs)) /
          snapDurationMs
      );
  }

  return direction * snapProgress * 2;
}

export function SeekControlsPreview({
  actionArea,
  actionAreaSize,
  actionAreaSizeUnit = '%',
  colorizedTimeline,
  fastScrollHotkey = DEFAULT_FAST_SCROLL_HOTKEY,
  focusedMethod,
  isDragSeekingEnabled,
  scrollInverted = false,
  isScrollSeekingEnabled,
  isSeekbarSeekingEnabled,
  scrollSpeedFactor = 1,
  slowScrollHotkey = DEFAULT_SLOW_SCROLL_HOTKEY,
  timelineHeight,
  timelinePosition,
  timelineUnit,
}: SeekControlsPreviewPropsI) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [manualProgress, setManualProgress] = useState<number | null>(null);
  const [scrollDeviceIndex, setScrollDeviceIndex] = useState(0);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTargetRef = useRef<HTMLElement | null>(null);
  const animationOriginRef = useRef<number | null>(null);
  const currentProgressRef = useRef(PREVIEW_STATIC_PROGRESS);
  const previousFocusedMethodRef = useRef(focusedMethod);
  const dragCueRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrollFingersRef = useRef<HTMLDivElement>(null);
  const scrollWheelRef = useRef<HTMLSpanElement>(null);
  const seekbarCueRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const testAreaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const enabledMethods = [
    isScrollSeekingEnabled ? methodLabels.scroll : null,
    isDragSeekingEnabled ? methodLabels.drag : null,
    isSeekbarSeekingEnabled ? methodLabels.seekbar : null,
  ].filter((method): method is string => method !== null);
  const isFullActionArea = actionArea === ActionAreaE.Full;
  const actionAreaStyle = isFullActionArea
    ? undefined
    : {
        height: `${actionAreaSize}${actionAreaSizeUnit}`,
        top:
          actionArea === ActionAreaE.Top
            ? '0%'
            : actionArea === ActionAreaE.Middle
              ? actionAreaSizeUnit === '%'
                ? `${(100 - actionAreaSize) / 2}%`
                : `calc((100% - ${actionAreaSize}px) / 2)`
              : actionAreaSizeUnit === '%'
                ? `${100 - actionAreaSize}%`
                : `calc(100% - ${actionAreaSize}px)`,
      };
  const focusedMethodLabel = methodLabels[focusedMethod];
  const normalizedScrollSpeedFactor =
    normalizeScrollSpeedFactor(scrollSpeedFactor);
  const enabledDescription =
    enabledMethods.length > 0 ? enabledMethods.join(', ') : 'none';
  const testInstruction =
    focusedMethod === 'scroll'
      ? 'Scroll horizontally to test seeking.'
      : focusedMethod === 'drag'
        ? 'Drag across the video to test seeking.'
        : 'Click or drag the timeline to test seeking.';
  const previewLabel = `Interactive seek test area. Focused method: ${focusedMethodLabel}. ${testInstruction} Enabled methods: ${enabledDescription}. ${actionAreaLabels[actionArea]} active video area${isFullActionArea ? '' : ` at ${actionAreaSize}${actionAreaSizeUnit}`}. ${timelinePosition} timeline at ${timelineHeight}${timelineUnit}.`;
  const seekbarCursorTop =
    timelinePosition === 'top'
      ? `${timelineHeight / 2}${timelineUnit}`
      : timelineUnit === '%'
        ? `${100 - timelineHeight / 2}%`
        : `calc(100% - ${timelineHeight / 2}px)`;

  useEffect(() => {
    if (previousFocusedMethodRef.current === focusedMethod) return;

    previousFocusedMethodRef.current = focusedMethod;
    animationOriginRef.current = currentProgressRef.current;
    setManualProgress(null);
    activePointerIdRef.current = null;
  }, [focusedMethod]);

  useEffect(() => {
    if (focusedMethod !== 'scroll') {
      setScrollDeviceIndex(0);
      return;
    }
    if (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false
    ) {
      return;
    }

    const cycleTimer = window.setTimeout(
      () =>
        setScrollDeviceIndex(
          (scrollDeviceIndex + 1) % SCROLL_DEVICE_PHASE_COUNT
        ),
      (SCROLL_DEVICE_PHASE_SECONDS * 1000) / normalizedScrollSpeedFactor
    );
    return () => window.clearTimeout(cycleTimer);
  }, [focusedMethod, normalizedScrollSpeedFactor, scrollDeviceIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let objectUrl = '';

    const markReady = () => {
      if (disposed) return;
      video.pause();
      setIsVideoReady(true);
    };

    const loadOriginalSource = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        markReady();
      } else {
        video.addEventListener('loadedmetadata', markReady, { once: true });
      }
    };

    const prepareSeekableSource = async () => {
      if (
        typeof fetch !== 'function' ||
        typeof URL.createObjectURL !== 'function'
      ) {
        loadOriginalSource();
        return;
      }

      try {
        const response = await fetch('/video/video-preview.mp4');
        if (!response.ok) throw new Error('Unable to load preview video');
        const videoBlob = await response.blob();
        if (disposed) return;

        objectUrl = URL.createObjectURL(videoBlob);
        video.addEventListener('loadedmetadata', markReady, { once: true });
        video.src = objectUrl;
        video.load();
      } catch {
        loadOriginalSource();
      }
    };

    prepareSeekableSource();

    return () => {
      disposed = true;
      video.removeEventListener('loadedmetadata', markReady);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!(video && progress)) return;

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let animationFrame = 0;
    let lastVideoSeekAt = Number.NEGATIVE_INFINITY;
    let startedAt = performance.now();

    const renderProgress = (
      value: number,
      elapsedMs: number,
      gestureValue = value
    ) => {
      const percentage = value * 100;
      currentProgressRef.current = value;
      const gestureProgress =
        (gestureValue - PREVIEW_PROGRESS_MIN) /
        (PREVIEW_PROGRESS_MAX - PREVIEW_PROGRESS_MIN);
      const signedGestureProgress = gestureProgress * 2 - 1;
      progress.style.width = `${percentage}%`;
      if (dragCueRef.current) {
        dragCueRef.current.style.left = `${percentage}%`;
      }
      if (seekbarCueRef.current) {
        seekbarCueRef.current.style.left = `${percentage}%`;
      }
      if (scrollFingersRef.current) {
        scrollFingersRef.current.style.setProperty(
          '--seek-finger-x',
          `${signedGestureProgress * 3}px`
        );
      }
      if (scrollWheelRef.current) {
        scrollWheelRef.current.style.setProperty(
          '--seek-wheel-x',
          `${getScrollWheelOffset(elapsedMs)}px`
        );
      }
    };

    const synchronizeVideo = (value: number, now: number) => {
      if (
        now - lastVideoSeekAt < VIDEO_SEEK_INTERVAL_MS ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        return;
      }

      lastVideoSeekAt = now;
      const nextTime = value * video.duration;
      if (Math.abs(video.currentTime - nextTime) > 0.02) {
        video.currentTime = nextTime;
      }
    };

    const renderFrame = (now: number) => {
      const elapsedMs = now - startedAt;
      const previewElapsedMs = getSeekPreviewElapsed(
        elapsedMs,
        focusedMethod,
        normalizedScrollSpeedFactor
      );
      // Inversion reverses the seek result, while the cue keeps showing the
      // original physical scroll direction.
      const gestureValue = reduceMotion
        ? PREVIEW_STATIC_PROGRESS
        : getSeekPreviewProgress(previewElapsedMs, focusedMethod);
      const animatedValue = reduceMotion
        ? PREVIEW_STATIC_PROGRESS
        : getSeekPreviewProgress(
            previewElapsedMs,
            focusedMethod,
            scrollInverted
          );
      const animationOrigin = animationOriginRef.current;
      const blendProgress =
        animationOrigin === null
          ? 1
          : Math.min(1, elapsedMs / TEST_TO_DEMO_BLEND_MS);
      const value =
        animationOrigin === null
          ? animatedValue
          : animationOrigin + (animatedValue - animationOrigin) * blendProgress;
      const blendedGestureValue =
        animationOrigin === null
          ? gestureValue
          : animationOrigin + (gestureValue - animationOrigin) * blendProgress;
      renderProgress(value, previewElapsedMs, blendedGestureValue);
      synchronizeVideo(value, now);

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };

    if (manualProgress !== null) {
      renderProgress(manualProgress, 0);
      if (isVideoReady) synchronizeVideo(manualProgress, performance.now());
      return;
    }

    if (!isVideoReady) {
      if (animationOriginRef.current !== null) {
        renderProgress(animationOriginRef.current, 0);
      }
      return;
    }

    const startSynchronization = () => {
      video.pause();
      startedAt = performance.now();
      cancelAnimationFrame(animationFrame);
      renderFrame(startedAt);
    };

    startSynchronization();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [
    focusedMethod,
    isVideoReady,
    manualProgress,
    normalizedScrollSpeedFactor,
    scrollInverted,
  ]);

  const setTestProgressFromClientX = (clientX: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    setManualProgress(
      Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    );
  };

  const startPointerTest = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (focusedMethod !== 'drag') return;
    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    activePointerTargetRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setTestProgressFromClientX(event.clientX);
  };

  const startSeekbarTest = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (focusedMethod !== 'seekbar') return;
    event.preventDefault();
    event.stopPropagation();
    activePointerIdRef.current = event.pointerId;
    activePointerTargetRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setTestProgressFromClientX(event.clientX);
  };

  const movePointerTest = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    setTestProgressFromClientX(event.clientX);
  };

  const finishPointerTest = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    const pointerTarget = activePointerTargetRef.current;
    activePointerTargetRef.current = null;
    if (pointerTarget?.hasPointerCapture?.(event.pointerId)) {
      pointerTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetTestArea = () => {
    const activePointerId = activePointerIdRef.current;
    const pointerTarget = activePointerTargetRef.current;
    if (
      activePointerId !== null &&
      pointerTarget?.hasPointerCapture?.(activePointerId)
    ) {
      pointerTarget.releasePointerCapture(activePointerId);
    }
    activePointerIdRef.current = null;
    activePointerTargetRef.current = null;
    animationOriginRef.current = currentProgressRef.current;
    setManualProgress(null);
  };

  useEffect(() => {
    const testArea = testAreaRef.current;
    if (!testArea) return;

    const testScrollSeeking = (event: WheelEvent) => {
      if (focusedMethod !== 'scroll') return;
      const hasSpeedHotkey = hasScrollSpeedHotkey(
        event,
        fastScrollHotkey,
        slowScrollHotkey
      );
      const previewWidth = previewRef.current?.clientWidth ?? 0;
      const delta = getPlayerLayerWheelDeltaPixels(
        event,
        previewWidth,
        hasSpeedHotkey
      );
      if (delta === 0 || previewWidth <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      const multiplier = getScrollSpeedMultiplier(
        event,
        fastScrollHotkey,
        slowScrollHotkey,
        normalizedScrollSpeedFactor
      );
      const direction = scrollInverted ? 1 : -1;
      setManualProgress(
        Math.min(
          1,
          Math.max(
            0,
            currentProgressRef.current +
              (delta / previewWidth) * multiplier * direction
          )
        )
      );
    };

    testArea.addEventListener('wheel', testScrollSeeking, { passive: false });
    return () => testArea.removeEventListener('wheel', testScrollSeeking);
  }, [
    fastScrollHotkey,
    focusedMethod,
    normalizedScrollSpeedFactor,
    scrollInverted,
    slowScrollHotkey,
  ]);

  return (
    <div className="relative" onPointerLeave={resetTestArea} ref={testAreaRef}>
      <section
        aria-label={previewLabel}
        aria-roledescription="interactive video preview"
        className={cn(
          'relative aspect-video overflow-hidden rounded-xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset',
          focusedMethod === 'drag' && 'cursor-ew-resize touch-none'
        )}
        data-focused-method={focusedMethod}
        data-is-testing={manualProgress !== null}
        data-scroll-inverted={scrollInverted}
        data-scroll-speed-factor={normalizedScrollSpeedFactor}
        data-testid="seek-controls-preview"
        onPointerCancel={finishPointerTest}
        onPointerDown={startPointerTest}
        onPointerMove={movePointerTest}
        onPointerUp={finishPointerTest}
        ref={previewRef}
      >
        <video
          aria-hidden="true"
          autoPlay
          className="absolute inset-0 size-full object-cover"
          data-testid="seek-preview-video"
          loop
          muted
          playsInline
          ref={videoRef}
          src="/video/video-preview.mp4"
          tabIndex={-1}
        />

        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 z-10 border-2 border-brand-300/90 bg-brand-400/25 transition-[top,height] duration-300 ease-in-out motion-reduce:transition-none dark:border-brand-400/80 dark:bg-brand-600/30',
            isFullActionArea && 'inset-0 h-full rounded-lg',
            actionArea === ActionAreaE.Top && 'top-0 rounded-t-lg',
            actionArea === ActionAreaE.Middle && 'rounded',
            actionArea === ActionAreaE.Bottom && 'rounded-b-lg'
          )}
          data-testid="action-area-overlay"
          style={actionAreaStyle}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40"
          data-testid="gesture-cue-layer"
        >
          <div
            className={cn(
              'absolute inset-0 grid place-items-center transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none',
              focusedMethod === 'scroll'
                ? 'scale-100 opacity-100 blur-0'
                : 'pointer-events-none scale-90 opacity-0 blur-sm'
            )}
            data-testid="scroll-gesture-transition"
          >
            <ScrollGestureCue
              deviceIndex={scrollDeviceIndex}
              fingersRef={scrollFingersRef}
              key={`${normalizedScrollSpeedFactor}-${scrollInverted}`}
              wheelRef={scrollWheelRef}
            />
          </div>
          <div
            className={cn(
              'absolute inset-0 grid place-items-center transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none',
              focusedMethod === 'drag'
                ? 'scale-100 opacity-100 blur-0'
                : 'pointer-events-none scale-90 opacity-0 blur-sm'
            )}
            data-testid="drag-gesture-transition"
          >
            <DragGestureCue cueRef={dragCueRef} />
          </div>
        </div>

        <span
          aria-hidden="true"
          className="absolute top-3 left-3 z-50 rounded-md bg-slate-950/50 px-2 py-1 font-semibold text-[10px] text-white shadow-sm backdrop-blur-md"
          data-testid="focused-method-label"
        >
          {methodPreviewLabels[focusedMethod]}
        </span>

        <span
          className="pointer-events-none absolute top-3 right-3 z-50 rounded-md bg-slate-950/50 px-2 py-1 font-semibold text-[10px] text-white shadow-sm backdrop-blur-md"
          data-testid="test-area-hint"
        >
          {focusedMethod === 'scroll'
            ? 'Try scrolling'
            : focusedMethod === 'drag'
              ? 'Try dragging'
              : 'Try the timeline'}
        </span>

        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 z-20 overflow-hidden bg-white/20 backdrop-blur-sm backdrop-saturate-[1.4] transition-[top,height] duration-300 ease-in-out motion-reduce:transition-none',
            timelinePosition === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'
          )}
          data-testid="timeline-overlay"
          style={{
            height: `${timelineHeight}${timelineUnit}`,
            top:
              timelinePosition === 'top'
                ? '0px'
                : `calc(100% - ${timelineHeight}${timelineUnit})`,
          }}
        >
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[34%] overflow-visible backdrop-blur-sm backdrop-saturate-[1.4]',
              colorizedTimeline
                ? 'bg-brand-400/80 dark:bg-brand-600/80'
                : 'bg-white/30'
            )}
            data-testid="timeline-progress"
            ref={progressRef}
          />
        </div>

        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 z-60 touch-none',
            timelinePosition === 'top' ? 'top-0' : 'bottom-0',
            focusedMethod === 'seekbar'
              ? 'pointer-events-auto cursor-ew-resize'
              : 'pointer-events-none'
          )}
          data-testid="seekbar-test-hit-area"
          onPointerDown={startSeekbarTest}
          style={{ height: `max(2rem, ${timelineHeight}${timelineUnit})` }}
        />
      </section>

      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-50 block size-5 origin-top-left overflow-visible transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none',
          focusedMethod === 'seekbar'
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-90 opacity-0 blur-sm'
        )}
        data-registration-point="top-left"
        data-testid="seekbar-gesture-cue"
        ref={seekbarCueRef}
        style={{
          left: '34%',
          top: seekbarCursorTop,
        }}
      >
        <MousePointer2Icon className="size-full translate-x-[-3.333px] translate-y-[-3.333px] overflow-visible fill-white text-white drop-shadow-lg" />
      </span>

      {focusedMethod === 'scroll' ? (
        <button
          aria-label="Show next scroll input device"
          className="absolute inset-0 z-60 cursor-pointer rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-inset"
          onClick={() =>
            setScrollDeviceIndex(
              (current) => (current + 1) % SCROLL_DEVICE_PHASE_COUNT
            )
          }
          type="button"
        />
      ) : null}
    </div>
  );
}

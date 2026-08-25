import { MousePointer2Icon, PointerIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { normalizeScrollSpeedFactor } from '@/helpers/scroll-speed';
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

const actionAreaLabels: Record<ActionAreaT, string> = {
  [ActionAreaE.Full]: 'full',
  [ActionAreaE.Top]: 'top',
  [ActionAreaE.Middle]: 'middle',
  [ActionAreaE.Bottom]: 'bottom',
};

function ScrollGestureCue({
  fingersRef,
  wheelRef,
}: {
  fingersRef: RefObject<HTMLDivElement | null>;
  wheelRef: RefObject<HTMLSpanElement | null>;
}) {
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
            className="seek-preview-scroll-device relative overflow-hidden border-2 border-white/80 [corner-shape:squircle]"
            data-testid="scroll-device"
          >
            <div
              className="seek-preview-scroll-fingers absolute"
              data-testid="scroll-fingers"
              ref={fingersRef}
              style={
                {
                  '--seek-finger-x': '0px',
                } as React.CSSProperties
              }
            >
              <span className="block size-2 rounded-full bg-white shadow-sm" />
              <span className="seek-preview-scroll-finger-secondary block size-2 rounded-full bg-white shadow-sm" />
            </div>
            <span
              className="seek-preview-scroll-wheel absolute block h-4 w-2 rounded-full bg-white shadow-sm"
              data-testid="scroll-wheel"
              ref={wheelRef}
              style={
                {
                  '--seek-wheel-x': '0px',
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
  focusedMethod: SeekControlMethodT;
  isDragSeekingEnabled: boolean;
  scrollInverted?: boolean;
  isScrollSeekingEnabled: boolean;
  isSeekbarSeekingEnabled: boolean;
  scrollSpeedFactor?: number;
  timelineHeight: number;
  timelinePosition: 'top' | 'bottom';
  timelineUnit: 'px' | '%';
}

const PREVIEW_PROGRESS_MIN = 0.34;
const PREVIEW_PROGRESS_MAX = 0.72;
const PREVIEW_STATIC_PROGRESS =
  (PREVIEW_PROGRESS_MIN + PREVIEW_PROGRESS_MAX) / 2;
const VIDEO_SEEK_INTERVAL_MS = 80;

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
  focusedMethod,
  isDragSeekingEnabled,
  scrollInverted = false,
  isScrollSeekingEnabled,
  isSeekbarSeekingEnabled,
  scrollSpeedFactor = 1,
  timelineHeight,
  timelinePosition,
  timelineUnit,
}: SeekControlsPreviewPropsI) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const dragCueRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrollFingersRef = useRef<HTMLDivElement>(null);
  const scrollWheelRef = useRef<HTMLSpanElement>(null);
  const seekbarCueRef = useRef<HTMLSpanElement>(null);
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
  const previewLabel = `Seek controls preview. Focused method: ${focusedMethodLabel}. Enabled methods: ${enabledDescription}. ${actionAreaLabels[actionArea]} active video area${isFullActionArea ? '' : ` at ${actionAreaSize}${actionAreaSizeUnit}`}. ${timelinePosition} timeline at ${timelineHeight}${timelineUnit}.`;
  const seekbarCursorTop =
    timelinePosition === 'top'
      ? `${timelineHeight / 2}${timelineUnit}`
      : timelineUnit === '%'
        ? `${100 - timelineHeight / 2}%`
        : `calc(100% - ${timelineHeight / 2}px)`;

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
    if (!(video && progress && isVideoReady)) return;

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
      const value = reduceMotion
        ? PREVIEW_STATIC_PROGRESS
        : getSeekPreviewProgress(
            previewElapsedMs,
            focusedMethod,
            scrollInverted
          );
      renderProgress(value, previewElapsedMs, gestureValue);
      synchronizeVideo(value, now);

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };

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
    normalizedScrollSpeedFactor,
    scrollInverted,
  ]);

  return (
    <div
      aria-label={previewLabel}
      className="relative aspect-video overflow-hidden rounded-xl bg-black"
      data-focused-method={focusedMethod}
      data-scroll-inverted={scrollInverted}
      data-scroll-speed-factor={normalizedScrollSpeedFactor}
      data-testid="seek-controls-preview"
      role="img"
      style={
        {
          '--seek-scroll-cycle-duration': `${19.2 / normalizedScrollSpeedFactor}s`,
        } as React.CSSProperties
      }
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
          'absolute inset-x-0 z-10 border-2 border-violet-300/90 bg-violet-400/25 transition-[top,height] duration-300 ease-in-out motion-reduce:transition-none dark:border-violet-400/80 dark:bg-violet-600/30',
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
        className="absolute inset-0 z-40 grid place-items-center"
        data-testid="gesture-cue-layer"
      >
        {focusedMethod === 'scroll' ? (
          <ScrollGestureCue
            fingersRef={scrollFingersRef}
            key={`${normalizedScrollSpeedFactor}-${scrollInverted}`}
            wheelRef={scrollWheelRef}
          />
        ) : null}
        {focusedMethod === 'drag' ? (
          <DragGestureCue cueRef={dragCueRef} />
        ) : null}
        {focusedMethod === 'seekbar' ? (
          <span
            className="absolute z-30 block size-5 -translate-y-1/2"
            data-testid="seekbar-gesture-cue"
            ref={seekbarCueRef}
            style={{
              left: '34%',
              top: seekbarCursorTop,
            }}
          >
            <MousePointer2Icon className="size-full translate-x-[-3.333px] fill-white text-white drop-shadow-lg" />
          </span>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className="absolute top-3 left-3 z-50 rounded-md bg-slate-950/50 px-2 py-1 font-semibold text-[10px] text-white shadow-sm backdrop-blur-md"
        data-testid="focused-method-label"
      >
        {methodPreviewLabels[focusedMethod]}
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
              ? 'bg-violet-400/80 dark:bg-violet-600/80'
              : 'bg-white/30'
          )}
          data-testid="timeline-progress"
          ref={progressRef}
        />
      </div>
    </div>
  );
}

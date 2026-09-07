import { MousePointer2Icon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  MEDIA_OVERLAY_STYLES,
  VOLUME_BOTTOM_GAP_PX,
  VOLUME_EDGE_GAP_PX,
} from '@/helpers/media-overlay-styles';
import {
  getColorizedTimelineBackground,
  TIMELINE_PROGRESS_STYLE,
  TIMELINE_TRACK_STYLE,
} from '@/helpers/timeline-appearance';
import { VOLUME_ICON_PATHS } from '@/helpers/volume-icon';
import { cn } from '@/lib/utils';
import type { ExtraFeaturePreviewNameT } from './extra-feature-preview-tooltip';
import { SITE_COLOR_EXAMPLES, SiteColorPreview } from './site-color-preview';
import { TimelineDetailPreview } from './timeline-detail-preview';

const PREVIEW_SCENE_SCALE = 240 / 344;
const PREVIEW_ZOOM = 2.4;
const PREVIEW_CONTROL_SCALE = PREVIEW_SCENE_SCALE * PREVIEW_ZOOM;

// Use the same media as the settings demo; only the controls are composed here.
function PreviewVideo({
  zoomed = false,
  playing = false,
  videoRef,
}: {
  zoomed?: boolean;
  playing?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <video
      aria-hidden="true"
      autoPlay={playing}
      className="absolute inset-0 size-full object-cover"
      loop={playing}
      muted
      onLoadedMetadata={(event) => {
        if (playing) {
          event.currentTarget.currentTime = 0;
          return;
        }
        event.currentTarget.currentTime = Math.min(
          3.45,
          event.currentTarget.duration / 2
        );
      }}
      playsInline
      preload="auto"
      ref={videoRef}
      src="/video/video-preview.mp4"
      style={
        zoomed
          ? {
              transform: `scale(${PREVIEW_ZOOM})`,
              transformOrigin: '100% 100%',
            }
          : undefined
      }
      tabIndex={-1}
    />
  );
}

export function ExtraFeaturePreview({
  featureName,
}: {
  featureName: ExtraFeaturePreviewNameT;
}) {
  const thumbnail = featureName === 'Hover Thumbnails';
  const minimal = featureName === 'Minimal Player';
  const hoverDemo = featureName === 'Timeline Show on Hover';
  const colorDemo = featureName === 'Match Site Color';
  const chaptered = featureName === 'Chaptered Timeline';
  const playing = hoverDemo || minimal || colorDemo || thumbnail || chaptered;
  const [siteIndex, setSiteIndex] = useState(0);

  useEffect(() => {
    if (!colorDemo) return;
    setSiteIndex(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setSiteIndex((current) => (current + 1) % SITE_COLOR_EXAMPLES.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [colorDemo]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const volumeFillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const updateProgress = () => {
      const video = videoRef.current;
      if (video && progressRef.current) {
        const progress =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(1, Math.max(0, video.currentTime / video.duration))
            : 0;
        progressRef.current.style.width = `${progress * 100}%`;
      }
      if (
        minimal &&
        !reducedMotion &&
        volumeRef.current &&
        volumeFillRef.current
      ) {
        const phase = (performance.now() - startedAt) % 6000;
        const ramp =
          phase < 1000
            ? 0
            : phase < 2500
              ? (phase - 1000) / 1500
              : phase < 3500
                ? 1
                : phase < 5000
                  ? 1 - (phase - 3500) / 1500
                  : 0;
        const eased = (1 - Math.cos(ramp * Math.PI)) / 2;
        const volume = 70 * (1 - eased);
        volumeFillRef.current.style.height = `${volume}%`;
        volumeRef.current.dataset.mfsVolumeLevel =
          volume < 0.5
            ? 'muted'
            : volume <= 33
              ? 'low'
              : volume <= 66
                ? 'medium'
                : 'high';
      }
      frame = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    return () => cancelAnimationFrame(frame);
  }, [playing, minimal]);
  return (
    <div
      aria-label={`${featureName} feature preview`}
      className="relative h-33.75 w-60 overflow-hidden rounded-xl bg-neutral-800 text-white"
      role="img"
    >
      <style>{MEDIA_OVERLAY_STYLES}</style>
      {/* Compose at the reference image's size and scale as a single scene. */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 h-[193.5px] w-86 origin-top-left"
        style={{ transform: `scale(${PREVIEW_SCENE_SCALE})` }}
      >
        <PreviewVideo playing={playing} videoRef={videoRef} zoomed />
        {thumbnail && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
        )}
        {featureName === 'Timeline Show on Hover' && (
          <MousePointer2Icon className="feature-preview-hover-cursor absolute top-22.5 left-62.25 size-10 fill-black stroke-[1.5] stroke-white drop-shadow-md" />
        )}
      </div>
      {(thumbnail || chaptered) && (
        <TimelineDetailPreview thumbnail={thumbnail} videoRef={videoRef} />
      )}
      {colorDemo && <SiteColorPreview index={siteIndex} />}
      {minimal && (
        <div
          className="mfs-media-controls"
          data-mfs-active="true"
          data-mfs-visible="true"
          data-mfs-volume-level="high"
          ref={volumeRef}
          style={{
            right: VOLUME_EDGE_GAP_PX * PREVIEW_CONTROL_SCALE,
            bottom: VOLUME_BOTTOM_GAP_PX * PREVIEW_CONTROL_SCALE,
            transform: `scale(${PREVIEW_CONTROL_SCALE})`,
            transformOrigin: 'bottom right',
          }}
        >
          <div className="mfs-volume-pill">
            <span
              className="mfs-volume-fill"
              ref={volumeFillRef}
              style={{ height: '70%', transition: 'none' }}
            />
          </div>
          <span aria-hidden="true" className="mfs-volume-mute">
            <svg
              aria-hidden="true"
              className="mfs-volume-icon"
              viewBox="0 0 24 24"
            >
              {VOLUME_ICON_PATHS.map(({ className, d }) => (
                <path className={className} d={d} key={className} />
              ))}
            </svg>
          </span>
        </div>
      )}
      {!chaptered && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0',
            hoverDemo && 'feature-preview-hover-timeline'
          )}
          style={{
            ...TIMELINE_TRACK_STYLE,
            height: 16,
          }}
        >
          <div
            className="h-full"
            data-testid="feature-preview-progress"
            ref={progressRef}
            style={{
              ...TIMELINE_PROGRESS_STYLE,
              transition: colorDemo ? 'background-color 600ms ease' : undefined,
              width: playing ? '0%' : minimal ? '89%' : '72.5%',
              background:
                hoverDemo || minimal
                  ? TIMELINE_PROGRESS_STYLE.background
                  : getColorizedTimelineBackground(
                      colorDemo
                        ? (
                            SITE_COLOR_EXAMPLES[siteIndex] ??
                            SITE_COLOR_EXAMPLES[0]
                          ).color
                        : '#f31220'
                    ),
            }}
          />
        </div>
      )}
    </div>
  );
}

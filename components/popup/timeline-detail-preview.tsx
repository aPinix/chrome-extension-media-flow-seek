import { MousePointer2Icon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { formatThumbnailPreviewTime } from '@/helpers/thumbnail-preview';
import { ThumbnailPreviewTime } from '@/helpers/thumbnail-preview-time';
import {
  DEFAULT_TIMELINE_PROGRESS_BACKGROUND,
  TIMELINE_TRACK_STYLE,
  YOUTUBE_CHAPTER_GAP_PX,
} from '@/helpers/timeline-appearance';

const CHAPTERS = [
  { start: 0, end: 0.25, title: 'Introduction' },
  { start: 0.25, end: 0.55, title: 'Open road' },
  { start: 0.55, end: 0.8, title: 'Mountain pass' },
  { start: 0.8, end: 1, title: 'Final stretch' },
] as const;

export function TimelineDetailPreview({
  thumbnail,
  videoRef,
}: {
  thumbnail: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const frameRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const [sample, setSample] = useState({ hover: 0.25, time: 0, progress: 0 });

  useEffect(() => {
    let frame = 0;
    let lastUpdate = -Infinity;
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const update = (now: number) => {
      // Pause briefly at both ends before moving across the chapter boundaries.
      const phase = ((now - startedAt) % 8000) / 8000;
      const ramp =
        phase < 0.1
          ? 0
          : phase < 0.45
            ? (phase - 0.1) / 0.35
            : phase < 0.6
              ? 1
              : phase < 0.95
                ? 1 - (phase - 0.6) / 0.35
                : 0;
      const hover = reducedMotion
        ? 0.5
        : 0.12 + (0.76 * (1 - Math.cos(ramp * Math.PI))) / 2;
      const x = hover * 240;
      if (cardRef.current)
        cardRef.current.style.left = `${Math.max(thumbnail ? 70 : 58, Math.min(thumbnail ? 170 : 182, x))}px`;
      if (cursorRef.current) cursorRef.current.style.left = `${x - 3}px`;
      if (now - lastUpdate >= 80) {
        const video = videoRef.current;
        const duration =
          video && Number.isFinite(video.duration) ? video.duration : 0;
        const time = hover * duration;
        setSample({
          hover,
          time,
          progress: duration > 0 ? (video?.currentTime ?? 0) / duration : 0,
        });
        const preview = frameRef.current;
        if (
          preview &&
          preview.readyState >= 2 &&
          !preview.seeking &&
          Number.isFinite(preview.duration)
        ) {
          preview.currentTime = Math.min(
            time,
            Math.max(0, preview.duration - 0.01)
          );
        }
        lastUpdate = now;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [thumbnail, videoRef]);

  const chapter =
    CHAPTERS.find(
      ({ start, end }) => sample.hover >= start && sample.hover < end
    ) ?? CHAPTERS[0];
  return (
    <>
      {!thumbnail && (
        <div
          className="absolute inset-x-0 bottom-0 flex h-4"
          data-testid="chapter-preview-timeline"
          style={{ gap: YOUTUBE_CHAPTER_GAP_PX }}
        >
          {CHAPTERS.map(({ start, end, title }, index) => (
            <div
              className="relative min-w-0 overflow-hidden"
              key={title}
              style={{ ...TIMELINE_TRACK_STYLE, flex: `${end - start} 1 0px` }}
            >
              <div
                className="h-full"
                data-testid={
                  index === 0 ? 'feature-preview-progress' : undefined
                }
                style={{
                  background: DEFAULT_TIMELINE_PROGRESS_BACKGROUND,
                  width: `${Math.min(1, Math.max(0, (sample.progress - start) / (end - start))) * 100}%`,
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div
        className="mfs-seekbar-thumbnail-preview"
        data-mfs-image-visible={thumbnail ? 'true' : 'false'}
        data-mfs-visible="true"
        ref={cardRef}
        style={{
          left: 120,
          bottom: 25,
          width: thumbnail ? 132 : 'max-content',
          maxWidth: 224,
        }}
      >
        {thumbnail && (
          <div className="mfs-thumbnail-frame">
            <video
              aria-hidden="true"
              className="mfs-thumbnail-video"
              muted
              playsInline
              preload="auto"
              ref={frameRef}
              src="/video/video-preview.mp4"
              tabIndex={-1}
            />
          </div>
        )}
        <div className="mfs-thumbnail-copy">
          <span className="mfs-thumbnail-time">
            <ThumbnailPreviewTime
              value={formatThumbnailPreviewTime(sample.time)}
            />
          </span>
          <span className="whitespace-nowrap" key={chapter.title}>
            {chapter.title}
          </span>
        </div>
      </div>
      <MousePointer2Icon
        aria-hidden="true"
        className="absolute bottom-0 z-10 size-5 fill-black stroke-white drop-shadow-md"
        ref={cursorRef}
        style={{ left: 117 }}
      />
    </>
  );
}

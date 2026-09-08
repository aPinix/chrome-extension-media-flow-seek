import { MoveHorizontalIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/helpers/player-actions';
import { TIMELINE_PROGRESS_STYLE, TIMELINE_TRACK_STYLE } from '@/helpers/timeline-appearance';

export function LoopSectionsPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailRef = useRef<HTMLVideoElement>(null);
  const [sample, setSample] = useState({ end: 0.38, progress: 0.08, time: 0 });

  useEffect(() => {
    let frame = 0;
    let lastUpdate = -Infinity;
    let activeSection = 0;
    const started = performance.now();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const update = (now: number) => {
      const end = reducedMotion ? 0.38 : 0.38 + 0.09 * Math.sin((now - started) / 1500);
      const video = videoRef.current;
      const duration = video?.duration ?? 0;
      if (video && Number.isFinite(duration) && duration > 0) {
        const sections = [{ start: 0.08, end }, { start: 0.57, end: 0.86 }];
        const section = sections[activeSection]!;
        const progress = video.currentTime / duration;
        if (progress < section.start) video.currentTime = section.start * duration;
        else if (progress >= section.end) {
          activeSection = (activeSection + 1) % sections.length;
          video.currentTime = sections[activeSection]!.start * duration;
        }
        if (now - lastUpdate >= 50) {
          const time = end * duration;
          setSample({ end, progress: video.currentTime / duration, time });
          const thumbnail = thumbnailRef.current;
          if (thumbnail && thumbnail.readyState >= 2 && !thumbnail.seeking)
            thumbnail.currentTime = time;
          lastUpdate = now;
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative h-33.75 w-60 overflow-hidden rounded-xl bg-neutral-800 text-white" role="img" aria-label="A cursor resizes a yellow loop section while the video plays through two sections">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" src="/video/video-preview.mp4" autoPlay muted playsInline aria-hidden="true" />
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div className="absolute top-2 w-32 -translate-x-1/2" style={{ left: `${Math.max(29, sample.end * 100)}%` }}>
        <video ref={thumbnailRef} className="aspect-video w-full rounded-md border border-white/40 object-cover shadow-lg" src="/video/video-preview.mp4" muted playsInline preload="auto" aria-hidden="true" />
        <span className="mx-auto mt-1 block w-fit rounded-full bg-black/80 px-2 py-0.5 text-[10px] tabular-nums">{formatTime(sample.time)}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-5" style={TIMELINE_TRACK_STYLE} aria-hidden="true">
        <div className="absolute inset-y-0 left-0" style={{ ...TIMELINE_PROGRESS_STYLE, width: `${sample.progress * 100}%` }} />
        {[{ start: 0.08, end: sample.end }, { start: 0.57, end: 0.86 }].map((range) => (
          <div key={range.start} className="absolute inset-y-0 border-2 border-[#F3CD45] bg-[#F3CD45]/20" style={{ left: `${range.start * 100}%`, width: `${(range.end - range.start) * 100}%` }}>
            {['left', 'right'].map((side) => (
              <span key={side} className="absolute flex w-2 items-center justify-center bg-[#F3CD45]" style={{ borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0', top: -2, bottom: -2, [side]: -2, transform: side === 'left' ? 'translateX(-100%)' : 'translateX(100%)' }}>
                <span className="h-2.5 w-0.5 rounded-full bg-neutral-900" />
              </span>
            ))}
          </div>
        ))}
        <MoveHorizontalIcon className="absolute top-0 size-5 -translate-x-1/2 text-white drop-shadow-[0_1px_2px_black]" style={{ left: `${sample.end * 100}%` }} />
      </div>
    </div>
  );
}

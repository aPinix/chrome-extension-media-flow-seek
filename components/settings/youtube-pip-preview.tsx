import {
  ArrowUpLeftIcon,
  Maximize2Icon,
  PauseIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { PlayerToolsSettings } from '@/helpers/player-tools-settings';
import { cn } from '@/lib/utils';

export function YouTubePipPreview({
  mode,
}: {
  mode: PlayerToolsSettings['youtubePipMode'];
}) {
  const custom = mode === 'mini-player';
  const [position, setPosition] = useState<'floating' | 'corner' | 'page'>(
    'floating'
  );
  const returned = position === 'page';
  return (
    <figure
      aria-label={`${custom ? 'Custom' : 'Chrome'} PiP preview`}
      className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="relative aspect-[16/11] overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-900">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-3 bg-white/50 dark:bg-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 mx-auto flex h-3 w-24 items-center justify-center gap-1 rounded-t bg-white/50 dark:bg-white/10"
        >
          {[0, 1, 2, 3, 4].map((item) => (
            <span
              className="size-1.5 rounded-sm bg-slate-400 dark:bg-slate-500"
              key={item}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute top-6 left-3.5 w-3/4 overflow-hidden rounded-md border border-white/30 bg-slate-50 pb-3 shadow-lg dark:bg-slate-800"
        >
          <div className="flex h-4 items-center gap-1 px-1.5">
            <span className="size-1 rounded-full bg-red-400" />
            <span className="size-1 rounded-full bg-amber-400" />
            <span className="size-1 rounded-full bg-green-400" />
            <span className="ml-1 text-[7px] text-slate-400">youtube.com</span>
          </div>
          <div className="mx-1 aspect-video rounded-sm bg-black" />
          <div className="mx-2 mt-2 h-1 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        {!returned && (
          <div
            className="absolute top-10 left-4.5 aspect-video text-white"
            style={{ width: 'calc(75% - 8px)' }}
          >
            <p className="absolute top-2 left-2 m-0 text-[8px] text-white/80">
              Playing in picture-in-picture
            </p>
            <button
              aria-label="Preview bringing video back"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-2 py-1 font-medium text-[8px] transition-colors hover:border-white/50 hover:bg-white/20 active:bg-white/30"
              onClick={() => setPosition('page')}
              type="button"
            >
              Bring video back
            </button>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute overflow-hidden rounded-md border border-white/25 bg-black shadow-xl transition-[left,top,width] duration-320 ease-[cubic-bezier(.33,1,.68,1)] motion-reduce:transition-none"
          data-preview-position={position}
          style={{
            left: returned ? '18px' : 'calc(56% - 10px)',
            top: returned
              ? '40px'
              : position === 'corner'
                ? '22px'
                : 'calc(100% - 105px)',
            width: returned ? 'calc(75% - 8px)' : '44%',
          }}
        >
          {custom && (
            <div
              className="flex items-center justify-between overflow-hidden bg-neutral-800 px-1.5 text-[7px] text-white transition-[height,opacity] duration-320 motion-reduce:transition-none"
              style={{ height: returned ? 0 : 14, opacity: returned ? 0 : 1 }}
            >
              <span>youtube.com</span>
              <XIcon className="size-2" />
            </div>
          )}
          <div className="relative aspect-video">
            <video
              aria-hidden="true"
              autoPlay
              className="absolute inset-0 size-full object-cover"
              loop
              muted
              playsInline
              preload="metadata"
              src="/video/video-preview.mp4"
              tabIndex={-1}
            />
            {!returned && (
              <>
                {custom ? (
                  <>
                    <ArrowUpLeftIcon className="absolute top-1 left-1 size-3 text-white drop-shadow" />
                    <XIcon className="absolute top-1 right-1 size-3 text-white drop-shadow" />
                    <div className="absolute inset-0 flex items-center justify-center gap-3 text-white drop-shadow">
                      <SkipBackIcon className="size-3" />
                      <PauseIcon className="size-4 fill-white" />
                      <SkipForwardIcon className="size-3" />
                    </div>
                    <Volume2Icon className="absolute right-1 bottom-3 size-3 text-white drop-shadow" />
                  </>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-1 text-white">
                    <PauseIcon className="size-3 fill-white" />
                    <Maximize2Icon className="size-3" />
                  </div>
                )}
                {custom && (
                  <div className="absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-white/30">
                    <div className="h-full w-2/3 rounded-full bg-white" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <figcaption className="flex h-9 items-center justify-between gap-2 px-2.5">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {custom ? 'Drag · resize · flick' : 'Chrome controls'}
        </span>
        <button
          aria-label={
            returned
              ? 'Replay PiP preview'
              : custom
                ? 'Preview flick to a corner'
                : 'Preview moving PiP'
          }
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-1 font-medium text-[10px] text-brand-600 hover:bg-brand-100 active:bg-brand-200 dark:text-brand-300 dark:hover:bg-brand-900',
            'focus-visible:outline-2 focus-visible:outline-brand'
          )}
          onClick={() =>
            setPosition(
              returned || position === 'corner' ? 'floating' : 'corner'
            )
          }
          type="button"
        >
          <RotateCcwIcon className="size-3" />
          {returned ? 'Replay' : custom ? 'Flick' : 'Move'}
        </button>
      </figcaption>
    </figure>
  );
}

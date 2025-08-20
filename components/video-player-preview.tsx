import { PlayIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface VideoPlayerPreviewPropsI {
  className?: string;
}

export const VideoPlayerPreview = ({ className }: VideoPlayerPreviewPropsI) => {
  return (
    <div
      className={cn(
        'absolute inset-0 rounded bg-slate-200 dark:bg-slate-600',
        className
      )}
    >
      <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-400/20 dark:bg-white/20">
        <PlayIcon className="m-auto h-6 w-6 fill-slate-400 text-slate-400 dark:fill-white dark:text-white" />
      </div>
    </div>
  );
};

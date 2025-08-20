import { TimelineHeightControl } from '@/components/timeline-height-control';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { VideoPlayerPreview } from '../video-player-preview';

interface TimelineSettingsProps {
  position: 'top' | 'bottom';
  onPositionChange: (position: 'top' | 'bottom') => void;
  height: number;
  unit: 'px' | '%';
  onHeightChange: (height: number) => void;
  onUnitChange: (unit: 'px' | '%') => void;
}

export function TimelineSettings({
  position,
  onPositionChange,
  height,
  unit,
  onHeightChange,
  onUnitChange,
}: TimelineSettingsProps) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl bg-slate-100 p-4 transition-all dark:bg-slate-800">
      <div className="relative z-10 aspect-[16/9] overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-600">
        <VideoPlayerPreview />

        {/* Active area highlight - using dynamic sizing */}
        <div
          style={{
            height: `${height}${unit}`,
            top: position === 'top' ? '0px' : `calc(100% - ${height}${unit})`,
          }}
          className={cn(
            'absolute inset-x-0 z-20 transition-all duration-300 ease-in-out',
            position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'
          )}
        >
          {/* progress bar bg */}

          <div className="absolute inset-x-0 h-full bg-slate-500/40" />

          {/* progress bar */}
          <div
            className={cn(
              'bg-brand-400/70 dark:border-brand-300 dark:bg-brand-600/70 timeline-progress-animate absolute inset-x-0 h-full border transition-all',
              height <= 10 && '!bg-brand-400/70 !border-0'
            )}
          />
        </div>
      </div>

      {/* Position */}
      <div className="flex items-center justify-between">
        <span className="w-[70px] flex-none text-sm font-medium text-slate-700 dark:text-slate-300">
          Position
        </span>
        <ToggleGroup
          type="single"
          value={position}
          onValueChange={(value) =>
            value && onPositionChange(value as 'top' | 'bottom')
          }
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="top" className="flex-none shrink">
            Top
          </ToggleGroupItem>
          <ToggleGroupItem value="bottom" className="flex-none shrink">
            Bottom
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="bg-border mx-auto h-px w-full" />

      {/* Height */}
      <div className="flex items-center justify-between">
        <span className="w-[70px] flex-none text-sm font-medium text-slate-700 dark:text-slate-300">
          Height
        </span>

        <TimelineHeightControl
          value={height}
          unit={unit}
          onChange={onHeightChange}
          onUnitChange={onUnitChange}
          className="flex-1"
        />
      </div>
    </div>
  );
}

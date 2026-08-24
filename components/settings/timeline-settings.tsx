import { AppSegmentedControl } from '@/components/app/app-segmented-control';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { TimelineHeightControl } from '@/components/timeline-height-control';
import { DEFAULT_SETTINGS } from '@/helpers/popup-storage';
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
      <div className="relative z-10 aspect-video overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-600">
        <VideoPlayerPreview />

        {/* Active area highlight - using dynamic sizing */}
        <div
          className={cn(
            'absolute inset-x-0 z-20 transition-all duration-300 ease-in-out',
            position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'
          )}
          style={{
            height: `${height}${unit}`,
            top: position === 'top' ? '0px' : `calc(100% - ${height}${unit})`,
          }}
        >
          {/* progress bar bg */}

          <div className="absolute inset-x-0 h-full bg-slate-500/40" />

          {/* progress bar */}
          <div
            className={cn(
              'timeline-progress-animate absolute inset-x-0 h-full bg-brand-400/70 transition-all dark:bg-brand-600/70',
              height <= 10 && 'bg-brand-400/70!'
            )}
          />
        </div>
      </div>

      {/* Position */}
      <div className="flex items-center justify-between">
        <span className="w-17.5 flex-none font-medium text-slate-700 text-sm dark:text-slate-300">
          Position
        </span>
        <AppSegmentedControl
          className="w-32"
          label="Timeline position"
          onValueChange={onPositionChange}
          options={[
            { label: 'Bottom', value: 'bottom' },
            { label: 'Top', value: 'top' },
          ]}
          value={position}
        />
      </div>

      <div className="mx-auto h-px w-full bg-border" />

      {/* Height */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
            Height
          </span>
          <SliderResetButton
            disabled={height === DEFAULT_SETTINGS.timelineHeight}
            label="Reset height to default"
            onClick={() => onHeightChange(DEFAULT_SETTINGS.timelineHeight)}
          />
        </div>

        <TimelineHeightControl
          className="w-full"
          onChange={onHeightChange}
          onUnitChange={onUnitChange}
          unit={unit}
          value={height}
        />
      </div>
    </div>
  );
}

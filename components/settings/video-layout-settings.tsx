import { LockKeyholeIcon } from 'lucide-react';

import { ActionAreaSizeControl } from '@/components/action-area-size-control';
import { AppSegment } from '@/components/app/app-segment';
import { AppSwitch } from '@/components/app/app-switch';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { TimelineHeightControl } from '@/components/timeline-height-control';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DEFAULT_SETTINGS } from '@/helpers/popup-storage';
import { cn } from '@/lib/utils';
import { ActionAreaE, type ActionAreaT } from '@/types/content';

type TimelinePositionT = 'top' | 'bottom';
type TimelineUnitT = 'px' | '%';

interface VideoLayoutSettingsPropsI {
  actionArea: ActionAreaT;
  actionAreaSize: number;
  actionAreaSizeUnit: TimelineUnitT;
  height: number;
  isSeekbarSeekingEnabled: boolean;
  onActionAreaChange: (actionArea: ActionAreaT) => void;
  onActionAreaReset: () => void;
  onActionAreaSizeChange: (size: number) => void;
  onActionAreaSizeReset: () => void;
  onActionAreaSizeUnitChange: (unit: TimelineUnitT) => void;
  onHeightChange: (height: number) => void;
  onHeightReset: () => void;
  onPositionChange: (position: TimelinePositionT) => void;
  onPositionReset: () => void;
  onShowTimelineOnHoverChange: (enabled: boolean) => void;
  onUnitChange: (unit: TimelineUnitT) => void;
  position: TimelinePositionT;
  showTimelineOnHover: boolean;
  unit: TimelineUnitT;
}

const actionAreaOptions = [
  { label: 'Full', value: ActionAreaE.Full },
  { label: 'Top', value: ActionAreaE.Top },
  { label: 'Middle', value: ActionAreaE.Middle },
  { label: 'Bottom', value: ActionAreaE.Bottom },
] as const;

export function VideoLayoutSettings({
  actionArea,
  actionAreaSize,
  actionAreaSizeUnit,
  height,
  isSeekbarSeekingEnabled,
  onActionAreaChange,
  onActionAreaReset,
  onActionAreaSizeChange,
  onActionAreaSizeReset,
  onActionAreaSizeUnitChange,
  onHeightChange,
  onHeightReset,
  onPositionChange,
  onPositionReset,
  onShowTimelineOnHoverChange,
  onUnitChange,
  position,
  showTimelineOnHover,
  unit,
}: VideoLayoutSettingsPropsI) {
  const isFullActionArea = actionArea === ActionAreaE.Full;
  const effectiveShowTimelineOnHover =
    showTimelineOnHover || isSeekbarSeekingEnabled;

  return (
    <div className="flex w-full flex-col gap-4">
      <section
        aria-labelledby="active-video-area-heading"
        className="space-y-3"
      >
        <div>
          <div className="flex items-center gap-1.5">
            <h4
              className="font-semibold text-slate-800 text-sm dark:text-slate-100"
              id="active-video-area-heading"
            >
              Active Video Area
            </h4>
            <SliderResetButton
              disabled={actionArea === DEFAULT_SETTINGS.actionArea}
              label="Reset active video area to default"
              onClick={onActionAreaReset}
            />
          </div>
          <p className="mt-0.5 text-slate-500 text-xs dark:text-slate-400">
            Where Scroll and Drag gestures respond
          </p>
        </div>
        <AppSegment
          className="w-full border-0! dark:border-0!"
          label="Active video area"
          onValueChange={onActionAreaChange}
          options={actionAreaOptions}
          value={actionArea}
        />

        <div
          aria-hidden={isFullActionArea}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
            isFullActionArea
              ? 'pointer-events-none grid-rows-[0fr] opacity-0'
              : 'grid-rows-[1fr] opacity-100'
          )}
          data-testid="action-area-size-control"
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
                  Area Size
                </span>
                <SliderResetButton
                  disabled={
                    actionAreaSize === DEFAULT_SETTINGS.actionAreaSize &&
                    actionAreaSizeUnit === DEFAULT_SETTINGS.actionAreaSizeUnit
                  }
                  label="Reset area size to default"
                  onClick={onActionAreaSizeReset}
                />
              </div>
              <ActionAreaSizeControl
                disabled={isFullActionArea}
                onChange={onActionAreaSizeChange}
                onUnitChange={onActionAreaSizeUnitChange}
                unit={actionAreaSizeUnit}
                value={actionAreaSize}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-slate-100/70 dark:bg-white/5" />

      <section
        aria-labelledby="timeline-appearance-heading"
        className="space-y-3"
      >
        <h4
          className="font-semibold text-slate-800 text-sm dark:text-slate-100"
          id="timeline-appearance-heading"
        >
          Timeline Appearance
        </h4>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 text-sm dark:text-slate-300">
              Show on Hover
              {isSeekbarSeekingEnabled ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          aria-label="Why Show on Hover is locked"
                          className="cursor-help rounded-sm text-amber-500 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-400"
                          type="button"
                        >
                          <LockKeyholeIcon className="size-3.5" />
                        </button>
                      }
                    />
                    <TooltipContent>
                      Click & Drag Seekbar needs the timeline visible so it can
                      be used.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <p className="mt-0.5 text-slate-500 text-xs leading-snug dark:text-slate-400">
              {isSeekbarSeekingEnabled
                ? 'Locked on while Click & Drag Seekbar is enabled'
                : 'Reveal progress when the pointer is over a video'}
            </p>
          </div>
          <AppSwitch
            aria-label="Show timeline on hover"
            checked={effectiveShowTimelineOnHover}
            disabled={isSeekbarSeekingEnabled}
            onCheckedChange={onShowTimelineOnHoverChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
              Position
            </span>
            <SliderResetButton
              disabled={position === DEFAULT_SETTINGS.timelinePosition}
              label="Reset timeline position to default"
              onClick={onPositionReset}
            />
          </div>
          <AppSegment
            className="w-32 border-0! dark:border-0!"
            label="Timeline position"
            onValueChange={onPositionChange}
            options={[
              { label: 'Bottom', value: 'bottom' },
              { label: 'Top', value: 'top' },
            ]}
            value={position}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
              Height
            </span>
            <SliderResetButton
              disabled={
                height === DEFAULT_SETTINGS.timelineHeight &&
                unit === DEFAULT_SETTINGS.timelineHeightUnit
              }
              label="Reset height to default"
              onClick={onHeightReset}
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
      </section>
    </div>
  );
}

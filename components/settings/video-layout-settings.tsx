import { ActionAreaSizeControl } from '@/components/action-area-size-control';
import { AppSegment } from '@/components/app/app-segment';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { TimelineHeightControl } from '@/components/timeline-height-control';
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
  onActionAreaChange: (actionArea: ActionAreaT) => void;
  onActionAreaReset: () => void;
  onActionAreaSizeChange: (size: number) => void;
  onActionAreaSizeReset: () => void;
  onActionAreaSizeUnitChange: (unit: TimelineUnitT) => void;
  onHeightChange: (height: number) => void;
  onHeightReset: () => void;
  onPositionChange: (position: TimelinePositionT) => void;
  onPositionReset: () => void;
  onUnitChange: (unit: TimelineUnitT) => void;
  position: TimelinePositionT;
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
  onActionAreaChange,
  onActionAreaReset,
  onActionAreaSizeChange,
  onActionAreaSizeReset,
  onActionAreaSizeUnitChange,
  onHeightChange,
  onHeightReset,
  onPositionChange,
  onPositionReset,
  onUnitChange,
  position,
  unit,
}: VideoLayoutSettingsPropsI) {
  const isFullActionArea = actionArea === ActionAreaE.Full;

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

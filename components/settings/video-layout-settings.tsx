import { ActionAreaSizeControl } from '@/components/action-area-size-control';
import { AppSegmentedControl } from '@/components/app/app-segmented-control';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { TimelineHeightControl } from '@/components/timeline-height-control';
import { VideoPlayerPreview } from '@/components/video-player-preview';
import { DEFAULT_SETTINGS } from '@/helpers/popup-storage';
import { cn } from '@/lib/utils';
import { ActionAreaE, type ActionAreaT } from '@/types/content';

type TimelinePositionT = 'top' | 'bottom';
type TimelineUnitT = 'px' | '%';

interface VideoLayoutSettingsPropsI {
  actionArea: ActionAreaT;
  actionAreaSize: number;
  colorizedTimeline: boolean;
  height: number;
  onActionAreaChange: (actionArea: ActionAreaT) => void;
  onActionAreaSizeChange: (size: number) => void;
  onActionAreaSizeReset: () => void;
  onHeightChange: (height: number) => void;
  onHeightReset: () => void;
  onPositionChange: (position: TimelinePositionT) => void;
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

const actionAreaLabelMap: Record<ActionAreaT, string> = {
  [ActionAreaE.Full]: 'Full',
  [ActionAreaE.Top]: 'Top',
  [ActionAreaE.Middle]: 'Middle',
  [ActionAreaE.Bottom]: 'Bottom',
};

export function VideoLayoutSettings({
  actionArea,
  actionAreaSize,
  colorizedTimeline,
  height,
  onActionAreaChange,
  onActionAreaSizeChange,
  onActionAreaSizeReset,
  onHeightChange,
  onHeightReset,
  onPositionChange,
  onUnitChange,
  position,
  unit,
}: VideoLayoutSettingsPropsI) {
  const isFullActionArea = actionArea === ActionAreaE.Full;
  const previewLabel = `Video layout preview: ${actionAreaLabelMap[actionArea]} action area${isFullActionArea ? '' : ` at ${actionAreaSize}%`}; ${position} timeline at ${height}${unit}`;

  const actionAreaStyle = isFullActionArea
    ? undefined
    : {
        height: `${actionAreaSize}%`,
        top:
          actionArea === ActionAreaE.Top
            ? '0%'
            : actionArea === ActionAreaE.Middle
              ? `${(100 - actionAreaSize) / 2}%`
              : `${100 - actionAreaSize}%`,
      };

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        aria-label={previewLabel}
        className="relative aspect-video overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-600"
        data-testid="video-layout-preview"
        role="img"
      >
        <VideoPlayerPreview />

        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 bottom-2 z-30 font-bold text-[8px] text-brand leading-none tracking-[0.12em] dark:text-brand-300"
        >
          PREVIEW
        </span>

        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 z-10 bg-brand-400/30 transition-[top,height] duration-300 ease-in-out motion-reduce:transition-none dark:bg-brand-600/35',
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
          className={cn(
            'absolute inset-x-0 z-20 transition-[top,height] duration-300 ease-in-out motion-reduce:transition-none',
            position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'
          )}
          data-testid="timeline-overlay"
          style={{
            height: `${height}${unit}`,
            top: position === 'top' ? '0px' : `calc(100% - ${height}${unit})`,
          }}
        >
          <div className="absolute inset-x-0 h-full bg-slate-500/40" />
          <div
            className={cn(
              'timeline-progress-animate absolute inset-x-0 h-full transition-all',
              colorizedTimeline
                ? 'bg-brand-400/80 dark:bg-brand-600/80'
                : 'bg-white/55 dark:bg-white/40'
            )}
            data-testid="timeline-progress"
          />
        </div>
      </div>

      <section aria-labelledby="action-area-heading" className="space-y-3">
        <h4
          className="font-semibold text-slate-800 text-sm dark:text-slate-100"
          id="action-area-heading"
        >
          Action Area
        </h4>
        <AppSegmentedControl
          className="w-full"
          label="Action area"
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
                    isFullActionArea ||
                    actionAreaSize === DEFAULT_SETTINGS.actionAreaSize
                  }
                  label="Reset area size to default"
                  onClick={onActionAreaSizeReset}
                />
              </div>
              <ActionAreaSizeControl
                disabled={isFullActionArea}
                onChange={onActionAreaSizeChange}
                value={actionAreaSize}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-slate-100/40 dark:bg-white/[0.03]" />

      <section aria-labelledby="timeline-heading" className="space-y-3">
        <h4
          className="font-semibold text-slate-800 text-sm dark:text-slate-100"
          id="timeline-heading"
        >
          Timeline
        </h4>

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

        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
              Height
            </span>
            <SliderResetButton
              disabled={height === DEFAULT_SETTINGS.timelineHeight}
              label="Reset height to default"
              onClick={onHeightReset}
            />
          </div>
          <TimelineHeightControl
            className="w-full px-2"
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

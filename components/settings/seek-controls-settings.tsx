import {
  EyeIcon,
  LayoutTemplateIcon,
  MouseIcon,
  MousePointer2Icon,
  MoveHorizontalIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { AppBetaBadge } from '@/components/app/app-beta-badge';
import { AppKbd } from '@/components/app/app-kbd';
import { AppSelect } from '@/components/app/app-select';
import { AppSwitch } from '@/components/app/app-switch';
import { ScrollSpeedFactorControl } from '@/components/scroll-speed-factor-control';
import {
  type SeekControlMethodT,
  SeekControlsPreview,
} from '@/components/settings/seek-controls-preview';
import { VideoLayoutSettings } from '@/components/settings/video-layout-settings';
import {
  isScrollHotkey,
  ScrollHotkeyE,
  type ScrollHotkeyT,
} from '@/helpers/scroll-speed';
import { getPrimaryModifierLabel } from '@/helpers/wheel-actions';
import { cn } from '@/lib/utils';
import type { ActionAreaT } from '@/types/content';

const scrollHotkeyItems = [
  { label: 'Alt', value: ScrollHotkeyE.Alt },
  { label: 'Shift', value: ScrollHotkeyE.Shift },
  { label: 'Alt + Shift', value: ScrollHotkeyE.AltShift },
];

function ScrollHotkeySelect({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: ScrollHotkeyT) => void;
  value: ScrollHotkeyT;
}) {
  return (
    <AppSelect
      className="min-w-28"
      items={scrollHotkeyItems}
      label={label}
      onValueChange={(nextValue) => {
        if (isScrollHotkey(nextValue)) onChange(nextValue);
      }}
      value={value}
    />
  );
}

function SeekMethodCard({
  accessibleTitle,
  children,
  description,
  enabled,
  focused,
  icon: Icon,
  id,
  onEnabledChange,
  onPreview,
  title,
}: {
  accessibleTitle: string;
  children?: ReactNode;
  description: string;
  enabled: boolean;
  focused: boolean;
  icon: React.ElementType;
  id: SeekControlMethodT;
  onEnabledChange: (enabled: boolean) => void;
  onPreview: () => void;
  title: ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white transition-[border-color,box-shadow,background-color] dark:border-slate-800 dark:bg-slate-900',
        focused && 'border-brand-500 dark:border-brand-400'
      )}
      data-method={id}
      onFocusCapture={onPreview}
      onPointerDownCapture={onPreview}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cn(
              'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition-colors dark:bg-slate-700 dark:text-slate-300',
              enabled &&
                'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400'
            )}
            data-testid={`${id}-method-icon`}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-semibold text-slate-900 text-sm dark:text-white">
              {title}
            </span>
            <span className="mt-0.5 block text-slate-500 text-xs leading-snug dark:text-slate-400">
              {description}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <AppSwitch
            aria-label={`Enable ${accessibleTitle}`}
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <button
            aria-label={`Preview ${accessibleTitle}`}
            aria-pressed={focused}
            className={cn(
              'inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 font-semibold text-[10px] text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-400',
              focused &&
                'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-400'
            )}
            onClick={onPreview}
            type="button"
          >
            <EyeIcon className="size-3" />
            Preview
          </button>
        </div>
      </div>

      {children ? (
        <div className="px-4 pb-4">
          <div className="border-slate-200 border-t pt-4 dark:border-slate-800">
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface SeekControlsSettingsPropsI {
  actionArea: ActionAreaT;
  actionAreaSize: number;
  actionAreaSizeUnit: 'px' | '%';
  colorizedTimeline: boolean;
  fastScrollHotkey: ScrollHotkeyT;
  isDragSeekingEnabled: boolean;
  isPlayPauseWheelEnabled: boolean;
  isScrollSeekingEnabled: boolean;
  isSeekbarSeekingEnabled: boolean;
  onActionAreaChange: (actionArea: ActionAreaT) => void;
  onActionAreaReset: () => void;
  onActionAreaSizeChange: (size: number) => void;
  onActionAreaSizeReset: () => void;
  onActionAreaSizeUnitChange: (unit: 'px' | '%') => void;
  onDragSeekingEnabledChange: (enabled: boolean) => void;
  onFastScrollHotkeyChange: (hotkey: ScrollHotkeyT) => void;
  onHeightChange: (height: number) => void;
  onHeightReset: () => void;
  onPlayPauseWheelEnabledChange: (enabled: boolean) => void;
  onPositionChange: (position: 'top' | 'bottom') => void;
  onPositionReset: () => void;
  onScrollInversionChange: (enabled: boolean) => void;
  onScrollSeekingEnabledChange: (enabled: boolean) => void;
  onScrollSpeedFactorChange: (factor: number) => void;
  onSeekbarSeekingEnabledChange: (enabled: boolean) => void;
  onSlowScrollHotkeyChange: (hotkey: ScrollHotkeyT) => void;
  onUnitChange: (unit: 'px' | '%') => void;
  scrollInverted: boolean;
  scrollSpeedFactor: number;
  slowScrollHotkey: ScrollHotkeyT;
  timelineHeight: number;
  timelinePosition: 'top' | 'bottom';
  timelineUnit: 'px' | '%';
}

export function SeekControlsSettings({
  actionArea,
  actionAreaSize,
  actionAreaSizeUnit,
  colorizedTimeline,
  fastScrollHotkey,
  isDragSeekingEnabled,
  isPlayPauseWheelEnabled,
  isScrollSeekingEnabled,
  isSeekbarSeekingEnabled,
  onActionAreaChange,
  onActionAreaReset,
  onActionAreaSizeChange,
  onActionAreaSizeReset,
  onActionAreaSizeUnitChange,
  onDragSeekingEnabledChange,
  onFastScrollHotkeyChange,
  onHeightChange,
  onHeightReset,
  onPlayPauseWheelEnabledChange,
  onPositionChange,
  onPositionReset,
  onScrollInversionChange,
  onScrollSeekingEnabledChange,
  onScrollSpeedFactorChange,
  onSeekbarSeekingEnabledChange,
  onSlowScrollHotkeyChange,
  onUnitChange,
  scrollInverted,
  scrollSpeedFactor,
  slowScrollHotkey,
  timelineHeight,
  timelinePosition,
  timelineUnit,
}: SeekControlsSettingsPropsI) {
  const [focusedMethod, setFocusedMethod] =
    useState<SeekControlMethodT>('scroll');
  const primaryModifierLabel = getPrimaryModifierLabel();
  const primaryModifierKey =
    primaryModifierLabel === 'Command' ? '⌘' : primaryModifierLabel;
  const hasEnabledMethod =
    isScrollSeekingEnabled || isDragSeekingEnabled || isSeekbarSeekingEnabled;

  return (
    <div>
      <div className="sticky top-16 z-20" data-testid="sticky-seek-preview">
        <SeekControlsPreview
          actionArea={actionArea}
          actionAreaSize={actionAreaSize}
          actionAreaSizeUnit={actionAreaSizeUnit}
          colorizedTimeline={colorizedTimeline}
          fastScrollHotkey={fastScrollHotkey}
          focusedMethod={focusedMethod}
          isDragSeekingEnabled={isDragSeekingEnabled}
          isScrollSeekingEnabled={isScrollSeekingEnabled}
          isSeekbarSeekingEnabled={isSeekbarSeekingEnabled}
          scrollInverted={scrollInverted}
          scrollSpeedFactor={scrollSpeedFactor}
          slowScrollHotkey={slowScrollHotkey}
          timelineHeight={timelineHeight}
          timelinePosition={timelinePosition}
          timelineUnit={timelineUnit}
        />
      </div>

      {!hasEnabledMethod ? (
        <div
          className="mb-3 rounded-lg border border-slate-300 border-dashed bg-white/55 px-3 py-2 text-center text-slate-500 text-xs dark:border-slate-500 dark:bg-slate-800/35 dark:text-slate-400"
          role="status"
        >
          No seek controls enabled. Player appearance options can still run.
        </div>
      ) : null}

      <div className="mt-3 space-y-3" data-testid="seek-methods">
        <SeekMethodCard
          accessibleTitle="Scroll to Seek"
          description="Seek horizontally, even when the browser is not focused"
          enabled={isScrollSeekingEnabled}
          focused={focusedMethod === 'scroll'}
          icon={MouseIcon}
          id="scroll"
          onEnabledChange={(enabled) => {
            if (enabled) setFocusedMethod('scroll');
            onScrollSeekingEnabledChange(enabled);
          }}
          onPreview={() => setFocusedMethod('scroll')}
          title="Scroll to Seek"
        >
          <fieldset
            className={cn(
              'space-y-4 transition-opacity',
              !isScrollSeekingEnabled && 'opacity-45'
            )}
            disabled={!isScrollSeekingEnabled}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-700 text-sm dark:text-slate-300">
                  Inverse Scroll
                </div>
                <p className="text-slate-500 text-xs dark:text-slate-400">
                  Reverse the horizontal seek direction
                </p>
              </div>
              <AppSwitch
                aria-label="Inverse scroll direction"
                checked={scrollInverted}
                onCheckedChange={onScrollInversionChange}
              />
            </div>

            <ScrollSpeedFactorControl
              onChange={onScrollSpeedFactorChange}
              value={scrollSpeedFactor}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-700 text-sm dark:text-slate-300">
                    Fast Scroll
                  </div>
                  <p className="text-slate-500 text-xs dark:text-slate-400">
                    Hold while scrolling for 3× seeking
                  </p>
                </div>
                <ScrollHotkeySelect
                  label="Fast scroll hotkey"
                  onChange={onFastScrollHotkeyChange}
                  value={fastScrollHotkey}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-700 text-sm dark:text-slate-300">
                    Slow Scroll
                  </div>
                  <p className="text-slate-500 text-xs dark:text-slate-400">
                    Hold while scrolling for 1/4x precision
                  </p>
                </div>
                <ScrollHotkeySelect
                  label="Slow scroll hotkey"
                  onChange={onSlowScrollHotkeyChange}
                  value={slowScrollHotkey}
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-700 text-sm dark:text-slate-300">
                  Play / Pause
                </div>
                <p className="text-slate-500 text-xs dark:text-slate-400">
                  Hold{' '}
                  <AppKbd aria-label={`${primaryModifierKey} + Scroll Left`}>
                    {primaryModifierKey} + Scroll Left
                  </AppKbd>{' '}
                  to pause,{' '}
                  <AppKbd aria-label={`${primaryModifierKey} + Scroll Right`}>
                    {primaryModifierKey} + Scroll Right
                  </AppKbd>{' '}
                  to play
                </p>
              </div>
              <AppSwitch
                aria-label="Enable directional play pause wheel actions"
                checked={isPlayPauseWheelEnabled}
                onCheckedChange={onPlayPauseWheelEnabledChange}
              />
            </div>
          </fieldset>
        </SeekMethodCard>

        <SeekMethodCard
          accessibleTitle="Drag to Seek"
          description="Drag horizontally anywhere in the active video area"
          enabled={isDragSeekingEnabled}
          focused={focusedMethod === 'drag'}
          icon={MoveHorizontalIcon}
          id="drag"
          onEnabledChange={(enabled) => {
            if (enabled) setFocusedMethod('drag');
            onDragSeekingEnabledChange(enabled);
          }}
          onPreview={() => setFocusedMethod('drag')}
          title={
            <>
              Drag to Seek
              <AppBetaBadge
                featureName="Drag to Seek"
                tooltip={
                  <>
                    <strong>Drag to Seek</strong> is still being refined and may
                    behave differently on some video players.
                  </>
                }
              />
            </>
          }
        />

        <SeekMethodCard
          accessibleTitle="Click and Drag Seekbar"
          description="Click or drag the visible timeline to seek"
          enabled={isSeekbarSeekingEnabled}
          focused={focusedMethod === 'seekbar'}
          icon={MousePointer2Icon}
          id="seekbar"
          onEnabledChange={(enabled) => {
            if (enabled) setFocusedMethod('seekbar');
            onSeekbarSeekingEnabledChange(enabled);
          }}
          onPreview={() => setFocusedMethod('seekbar')}
          title="Click & Drag Seekbar"
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <LayoutTemplateIcon className="size-4" />
          </span>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm dark:text-white">
              Video Layout
            </h4>
            <p className="text-slate-500 text-xs dark:text-slate-400">
              Shared active area and timeline appearance
            </p>
          </div>
        </div>
        <VideoLayoutSettings
          actionArea={actionArea}
          actionAreaSize={actionAreaSize}
          actionAreaSizeUnit={actionAreaSizeUnit}
          height={timelineHeight}
          onActionAreaChange={onActionAreaChange}
          onActionAreaReset={onActionAreaReset}
          onActionAreaSizeChange={onActionAreaSizeChange}
          onActionAreaSizeReset={onActionAreaSizeReset}
          onActionAreaSizeUnitChange={onActionAreaSizeUnitChange}
          onHeightChange={onHeightChange}
          onHeightReset={onHeightReset}
          onPositionChange={onPositionChange}
          onPositionReset={onPositionReset}
          onUnitChange={onUnitChange}
          position={timelinePosition}
          unit={timelineUnit}
        />
      </div>
    </div>
  );
}

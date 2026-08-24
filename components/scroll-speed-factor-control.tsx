import { AppSlider } from '@/components/app/app-slider';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import {
  DEFAULT_SCROLL_SPEED_FACTOR,
  MAX_SCROLL_SPEED_FACTOR,
  MIN_SCROLL_SPEED_FACTOR,
  SCROLL_SPEED_FACTOR_STEP,
} from '@/helpers/scroll-speed';

export function ScrollSpeedFactorControl({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
            Base speed
          </span>
          <SliderResetButton
            disabled={value === DEFAULT_SCROLL_SPEED_FACTOR}
            label="Reset scroll speed to default"
            onClick={() => onChange(DEFAULT_SCROLL_SPEED_FACTOR)}
          />
        </div>
        <span className="min-w-10 text-right font-semibold text-brand text-sm tabular-nums dark:text-brand-300">
          {value}×
        </span>
      </div>
      <AppSlider
        aria-label="Base scroll seek speed"
        className="rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35"
        max={MAX_SCROLL_SPEED_FACTOR}
        min={MIN_SCROLL_SPEED_FACTOR}
        onValueChange={(nextValue) => {
          const factor = Array.isArray(nextValue) ? nextValue[0] : nextValue;
          if (typeof factor === 'number') onChange(factor);
        }}
        step={SCROLL_SPEED_FACTOR_STEP}
        thumbClassName="after:opacity-0"
        trackClassName="h-3"
        value={value}
      />
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>Slower</span>
        <span>Faster</span>
      </div>
    </div>
  );
}

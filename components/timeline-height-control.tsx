import { useEffect, useState } from 'react';

import { AppInputText } from '@/components/app/app-input-text';
import { AppSegment } from '@/components/app/app-segment';
import { AppSlider } from '@/components/app/app-slider';
import { DEFAULT_SETTINGS } from '@/helpers/popup-storage';
import { cn } from '@/lib/utils';

type TimelineUnit = 'px' | '%';

interface TimelineHeightControlPropsI {
  value: number;
  unit: TimelineUnit;
  onChange: (value: number) => void;
  onUnitChange: (unit: TimelineUnit) => void;
  className?: string;
}

const TimelineHeightControl = ({
  value,
  unit,
  onChange,
  onUnitChange,
  className,
}: TimelineHeightControlPropsI) => {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => setInputValue(String(value)), [value]);

  const commitInputValue = () => {
    const parsedValue = Number(inputValue);
    const nextValue =
      inputValue.trim() &&
      Number.isInteger(parsedValue) &&
      parsedValue >= 0 &&
      parsedValue <= 100
        ? parsedValue
        : DEFAULT_SETTINGS.timelineHeight;
    setInputValue(String(nextValue));
    onChange(nextValue);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <AppSlider
        aria-label="Timeline height"
        className="flex-1 rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35"
        max={100}
        min={0}
        onValueChange={(nextValue) => {
          onChange(
            typeof nextValue === 'number' ? nextValue : (nextValue[0] ?? value)
          );
        }}
        thumbClassName="after:opacity-0"
        trackClassName="h-3"
        value={value}
      />
      <div className="relative h-8 w-32 shrink-0 rounded-full bg-slate-200 transition-colors duration-300 ease-in-out motion-reduce:transition-none dark:bg-slate-800">
        <AppInputText
          aria-label="Timeline height value"
          className="h-8 w-full appearance-none rounded-full bg-slate-200 pr-20 pl-2 text-center font-mono text-xs dark:bg-slate-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          inputMode="numeric"
          max={100}
          min={0}
          onBlur={commitInputValue}
          onChange={(event) => {
            const nextInputValue = event.target.value;
            setInputValue(nextInputValue);

            const nextValue = Number(nextInputValue);
            if (
              nextInputValue.trim() &&
              Number.isInteger(nextValue) &&
              nextValue >= 0 &&
              nextValue <= 100
            ) {
              onChange(nextValue);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          step={1}
          type="number"
          value={inputValue}
        />

        <AppSegment
          className="absolute inset-y-1 right-1 z-10 h-6 w-18 rounded-full border-0! dark:border-0!"
          embedded
          label="Timeline height unit"
          onValueChange={onUnitChange}
          options={[
            { label: 'px', value: 'px' },
            { label: '%', value: '%' },
          ]}
          value={unit}
        />
      </div>
    </div>
  );
};

export { TimelineHeightControl };

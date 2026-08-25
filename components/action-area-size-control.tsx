import { useEffect, useState } from 'react';

import { AppInputText } from '@/components/app/app-input-text';
import { AppSegment } from '@/components/app/app-segment';
import { cn } from '@/lib/utils';

import { AppSlider } from './app/app-slider';

interface ActionAreaSizeControlPropsI {
  value: number;
  unit: 'px' | '%';
  onChange: (value: number) => void;
  onUnitChange: (unit: 'px' | '%') => void;
  className?: string;
  disabled?: boolean;
}

const ActionAreaSizeControl = ({
  value,
  unit,
  onChange,
  onUnitChange,
  className,
  disabled,
}: ActionAreaSizeControlPropsI) => {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => setInputValue(String(value)), [value]);

  const commitInputValue = () => {
    const parsedValue = Number(inputValue);
    if (!inputValue.trim() || !Number.isFinite(parsedValue)) {
      setInputValue(String(value));
      return;
    }

    const nextValue = Math.min(100, Math.max(10, parsedValue));
    setInputValue(String(nextValue));
    onChange(nextValue);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <AppSlider
        aria-label="Action area size"
        className="flex-1 rounded-full has-focus-visible:ring-2 has-focus-visible:ring-violet-500/35 dark:has-focus-visible:ring-violet-400/35"
        disabled={disabled}
        max={100}
        min={10}
        onValueChange={(nextValue) => {
          onChange(
            typeof nextValue === 'number' ? nextValue : (nextValue[0] ?? value)
          );
        }}
        step={5}
        thumbClassName="after:opacity-0"
        trackClassName="h-3"
        value={value}
      />
      <div className="relative h-8 w-32 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800">
        <AppInputText
          aria-label="Action area size value"
          className="h-8 w-full appearance-none rounded-full bg-slate-200 pr-20 pl-2 text-center font-mono text-xs focus-visible:bg-slate-200 dark:bg-slate-800 dark:focus-visible:bg-slate-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={disabled}
          inputMode="numeric"
          max={100}
          min={10}
          onBlur={commitInputValue}
          onChange={(event) => {
            const nextInputValue = event.target.value;
            setInputValue(nextInputValue);

            const nextValue = Number(nextInputValue);
            if (
              nextInputValue.trim() &&
              Number.isFinite(nextValue) &&
              nextValue >= 10 &&
              nextValue <= 100
            ) {
              onChange(nextValue);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          step={5}
          type="number"
          value={inputValue}
        />
        <AppSegment
          className="absolute inset-y-1 right-1 z-10 h-6 w-18 rounded-full border-0! dark:border-0!"
          embedded
          label="Action area size unit"
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

export { ActionAreaSizeControl };

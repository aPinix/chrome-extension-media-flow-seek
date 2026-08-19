import { useId } from 'react';

import { cn } from '@/lib/utils';

interface SegmentedControlOptionI<T extends string> {
  label: string;
  value: T;
}

interface AppSegmentedControlPropsI<T extends string> {
  className?: string;
  label: string;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOptionI<T>[];
  value: T;
}

export function AppSegmentedControl<T extends string>({
  className,
  label,
  onValueChange,
  options,
  value,
}: AppSegmentedControlPropsI<T>) {
  const groupName = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <fieldset
      aria-label={label}
      className={cn(
        'relative isolate grid h-8 min-w-0 rounded-full border-0 bg-slate-200/80 p-0.5 dark:bg-slate-700',
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0.5 z-0 rounded-full bg-brand shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          transform: `translateX(${selectedIndex * 100}%)`,
          width: `calc((100% - 0.25rem) / ${options.length})`,
        }}
      />

      {options.map((option) => {
        const optionId = `${groupName}-${option.value}`;
        const isSelected = option.value === value;

        return (
          <label
            className={cn(
              'relative z-10 flex min-w-0 cursor-pointer items-center justify-center rounded-full px-2 font-medium text-xs transition-colors duration-300 has-focus-visible:outline-2 has-focus-visible:outline-brand has-focus-visible:outline-offset-2',
              isSelected
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            )}
            htmlFor={optionId}
            key={option.value}
          >
            <input
              checked={isSelected}
              className="sr-only"
              id={optionId}
              name={groupName}
              onChange={() => onValueChange(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

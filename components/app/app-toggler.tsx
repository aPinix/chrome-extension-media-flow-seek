import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AppTogglerOptionI<T extends string> {
  icon: LucideIcon;
  indicatorClassName?: string;
  label: string;
  selectedClassName?: string;
  tooltip?: ReactNode;
  value: T;
}

export interface AppTogglerPropsI<T extends string> {
  className?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: T) => void;
  options: readonly AppTogglerOptionI<T>[];
  value: T;
}

export function AppToggler<T extends string>({
  className,
  disabled,
  label,
  onValueChange,
  options,
  value,
}: AppTogglerPropsI<T>) {
  const groupName = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const selectedOption = options[selectedIndex];
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previousIndexRef = useRef(selectedIndex);

  useEffect(() => {
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = selectedIndex;

    if (
      previousIndex === selectedIndex ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const animation = indicatorRef.current?.animate?.(
      [
        { marginInlineStart: '-0.125rem', width: '1.75rem' },
        { marginInlineStart: '0', width: '1.5rem' },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );

    return () => animation?.cancel();
  }, [selectedIndex]);

  return (
    <TooltipProvider>
      <fieldset
        aria-label={label}
        className={cn(
          'relative isolate inline-grid h-7 shrink-0 auto-cols-[1.5rem] grid-flow-col gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-700/70',
          disabled && 'opacity-50',
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0.5 left-0.5 z-0 size-6 rounded-full shadow-sm transition-[transform,background-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none',
            selectedOption?.indicatorClassName
          )}
          data-slot="app-toggler-indicator"
          ref={indicatorRef}
          style={{
            transform: `translateX(${selectedIndex * 1.625}rem)`,
          }}
        />

        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = option.value === value;
          const optionId = `${groupName}-${option.value}`;

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                render={
                  <label
                    className={cn(
                      'relative z-10 flex size-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-300 has-focus-visible:ring-2 has-focus-visible:ring-brand/35 dark:text-slate-300',
                      isSelected
                        ? option.selectedClassName
                        : 'hover:bg-white/60 hover:text-slate-800 dark:hover:bg-slate-600/70 dark:hover:text-white',
                      disabled && 'cursor-not-allowed'
                    )}
                    htmlFor={optionId}
                  >
                    <input
                      aria-label={option.label}
                      checked={isSelected}
                      className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      disabled={disabled}
                      id={optionId}
                      name={groupName}
                      onChange={() => onValueChange(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <Icon aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{option.label}</span>
                  </label>
                }
              />
              <TooltipContent>{option.tooltip ?? option.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </fieldset>
    </TooltipProvider>
  );
}

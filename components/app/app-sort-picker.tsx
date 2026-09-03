import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AppSortPickerOptionI<T extends string> {
  icon: LucideIcon;
  label: string;
  tooltip?: ReactNode;
  value: T;
}

interface AppSortPickerPropsI<T extends string> {
  className?: string;
  label: string;
  onValueChange: (value: T) => void;
  options: readonly AppSortPickerOptionI<T>[];
  value: T;
}

const OPTION_SPACING_REM = 2;
const BUTTON_SIZE_REM = 1.75;

export function AppSortPicker<T extends string>({
  className,
  label,
  onValueChange,
  options,
  value,
}: AppSortPickerPropsI<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0
  );
  const selectedOption = options[selectedIndex];

  if (!selectedOption) return null;

  const SelectedIcon = selectedOption.icon;
  const expandedHeight =
    (options.length - 1) * OPTION_SPACING_REM + BUTTON_SIZE_REM;
  const expandedTop = -selectedIndex * OPTION_SPACING_REM;

  return (
    <TooltipProvider>
      <fieldset
        aria-label={label}
        className={cn(
          'relative ml-auto h-7 w-7 shrink-0 overflow-visible',
          isExpanded && 'z-40',
          className
        )}
        data-expanded={isExpanded || undefined}
        data-slot="app-sort-picker"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsExpanded(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          setIsExpanded(false);
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0 right-0 w-7 rounded-full transition-[top,height,background-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none',
            isExpanded
              ? 'bg-white/80 shadow-lg ring-1 ring-slate-200/80 dark:bg-slate-800/80 dark:ring-white/10'
              : 'bg-transparent shadow-none'
          )}
          data-slot="app-sort-picker-pill"
          style={{
            backdropFilter: isExpanded ? 'saturate(180%) blur(20px)' : 'none',
            height: `${isExpanded ? expandedHeight : BUTTON_SIZE_REM}rem`,
            top: `${isExpanded ? expandedTop : 0}rem`,
          }}
        />

        {options.map((option, index) => {
          if (index === selectedIndex) return null;

          const Icon = option.icon;
          const offset = (index - selectedIndex) * OPTION_SPACING_REM;

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                render={
                  <button
                    aria-hidden={!isExpanded || undefined}
                    aria-label={option.label}
                    className={cn(
                      'absolute top-0 right-0 flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-500 outline-none transition-[transform,opacity,background-color,color] duration-300 ease-out hover:bg-slate-200/70 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand/35 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                      isExpanded
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0'
                    )}
                    onClick={() => {
                      onValueChange(option.value);
                      setIsExpanded(false);
                    }}
                    style={{
                      transform: isExpanded
                        ? `translateY(${offset}rem) scale(1)`
                        : 'translateY(0) scale(0.75)',
                    }}
                    tabIndex={isExpanded ? 0 : -1}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="left">
                {option.tooltip ?? option.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-expanded={isExpanded}
                aria-label={`${label}: ${selectedOption.label}`}
                className={cn(
                  'absolute top-0 right-0 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-500 outline-none transition-[background-color,color] duration-200 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand/35 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                  isExpanded &&
                    'bg-slate-200/70 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                )}
                onClick={() => setIsExpanded((current) => !current)}
                type="button"
              >
                <SelectedIcon aria-hidden="true" className="size-3.5" />
              </button>
            }
          />
          <TooltipContent side="left">
            {selectedOption.tooltip ?? selectedOption.label}
          </TooltipContent>
        </Tooltip>
      </fieldset>
    </TooltipProvider>
  );
}

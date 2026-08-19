import { CircleIcon, GlobeIcon, type LucideIcon } from 'lucide-react';
import { useId } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DomainModeT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

const MODE_OPTIONS: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: DomainModeT;
}[] = [
  { icon: GlobeIcon, label: 'Default', value: DomainModeE.Default },
  {
    icon: CircleIcon,
    iconClassName: 'fill-current',
    label: 'On',
    value: DomainModeE.On,
  },
  { icon: CircleIcon, label: 'Off', value: DomainModeE.Off },
];

interface DomainModeControlPropsI {
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: (mode: DomainModeT) => void;
  value: DomainModeT;
}

export function DomainModeControl({
  className,
  disabled,
  label,
  onChange,
  value,
}: DomainModeControlPropsI) {
  const groupName = useId();

  return (
    <TooltipProvider>
      <fieldset
        aria-label={label}
        className={cn(
          'grid h-7 w-20 shrink-0 grid-cols-3 gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-700/70',
          disabled && 'opacity-50',
          className
        )}
      >
        {MODE_OPTIONS.map((option) => {
          const isSelected = option.value === value;
          const Icon = option.icon;
          const optionId = `${groupName}-${option.value}`;
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                render={
                  <label
                    className={cn(
                      'relative flex size-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-[color,background-color,box-shadow] duration-200 hover:bg-white/60 hover:text-slate-800 has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-brand/35 dark:text-slate-300 dark:hover:bg-slate-600/70 dark:hover:text-white',
                      isSelected &&
                        option.value === DomainModeE.Default &&
                        'bg-sky-500/15 text-sky-500 shadow-sm hover:bg-sky-500/25 hover:text-sky-500 dark:bg-sky-400/15 dark:text-sky-400 dark:hover:bg-sky-400/25 dark:hover:text-sky-400',
                      isSelected &&
                        option.value === DomainModeE.On &&
                        'bg-lime-500/15 text-lime-500 shadow-sm hover:bg-lime-500/25 hover:text-lime-500 dark:bg-lime-400/15 dark:text-lime-400 dark:hover:bg-lime-400/25 dark:hover:text-lime-400',
                      isSelected &&
                        option.value === DomainModeE.Off &&
                        'bg-rose-500/15 text-rose-500 shadow-sm hover:bg-rose-500/25 hover:text-rose-500 dark:bg-rose-400/15 dark:text-rose-400 dark:hover:bg-rose-400/25 dark:hover:text-rose-400'
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
                      onChange={() => onChange(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <Icon
                      aria-hidden="true"
                      className={cn('size-3', option.iconClassName)}
                    />
                    <span className="sr-only">{option.label}</span>
                  </label>
                }
              />
              <TooltipContent>{option.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </fieldset>
    </TooltipProvider>
  );
}

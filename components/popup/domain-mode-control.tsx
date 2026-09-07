import {
  BanIcon,
  CheckCheckIcon,
  GlobeIcon,
  type LucideIcon,
} from 'lucide-react';

import {
  AppToggler,
  type AppTogglerOptionI,
} from '@/components/app/app-toggler';
import { cn } from '@/lib/utils';
import type { DomainModeT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

const MODE_OPTIONS: {
  icon: LucideIcon;
  label: string;
  value: DomainModeT;
}[] = [
  { icon: GlobeIcon, label: 'Default', value: DomainModeE.Default },
  { icon: CheckCheckIcon, label: 'On', value: DomainModeE.On },
  { icon: BanIcon, label: 'Off', value: DomainModeE.Off },
];

interface DomainModeControlPropsI {
  className?: string;
  globalDefaultOn: boolean;
  disabled?: boolean;
  label: string;
  onChange: (mode: DomainModeT) => void;
  value: DomainModeT;
}

export function DomainModeControl({
  className,
  globalDefaultOn,
  disabled,
  label,
  onChange,
  value,
}: DomainModeControlPropsI) {
  const options: AppTogglerOptionI<DomainModeT>[] = MODE_OPTIONS.map(
    (option) => {
      if (option.value === DomainModeE.Default) {
        return {
          ...option,
          indicatorClassName: globalDefaultOn
            ? 'bg-lime-500/15 dark:bg-lime-400/15'
            : 'bg-rose-500/15 dark:bg-rose-400/15',
          selectedClassName: globalDefaultOn
            ? 'text-lime-500 dark:text-lime-400'
            : 'text-rose-500 dark:text-rose-400',
          tooltip: (
            <>
              Default: <strong>{globalDefaultOn ? 'On' : 'Off'}</strong>
            </>
          ),
        };
      }

      if (option.value === DomainModeE.On) {
        return {
          ...option,
          indicatorClassName: 'bg-lime-500/15 dark:bg-lime-400/15',
          selectedClassName: 'text-lime-500 dark:text-lime-400',
        };
      }

      return {
        ...option,
        indicatorClassName: 'bg-rose-500/15 dark:bg-rose-400/15',
        selectedClassName: 'text-rose-500 dark:text-rose-400',
      };
    }
  );

  return (
    <AppToggler
      className={cn('w-20', className)}
      disabled={disabled}
      label={label}
      onValueChange={onChange}
      options={options}
      value={value}
    />
  );
}

import type { ComponentProps } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function AppSwitch({
  className,
  ...props
}: ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        'data-unchecked:border-slate-300 data-unchecked:bg-slate-300',
        'dark:data-unchecked:border-slate-400 dark:data-unchecked:bg-slate-400',
        className
      )}
      {...props}
    />
  );
}

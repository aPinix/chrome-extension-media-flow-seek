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
        'focus-visible:border-brand focus-visible:ring-brand/30 data-checked:border-brand data-checked:bg-brand',
        'group-has-[:focus-visible]/field-label:data-checked:border-brand',
        'data-unchecked:border-slate-300 data-unchecked:bg-slate-300',
        'dark:data-unchecked:border-slate-700 dark:data-unchecked:bg-slate-700',
        className
      )}
      {...props}
    />
  );
}

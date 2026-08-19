import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AppInputText({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        'rounded-lg border-transparent bg-slate-200 text-slate-900 shadow-none',
        'placeholder:text-slate-500',
        'transition-[color,background-color,box-shadow] duration-200',
        'focus-visible:border-transparent focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand/25',
        'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400',
        'dark:focus-visible:bg-brand-950 dark:focus-visible:ring-brand-400/30',
        className
      )}
      {...props}
    />
  );
}

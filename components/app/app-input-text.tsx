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
        'rounded-lg border-slate-300 bg-slate-200 text-slate-900 shadow-none dark:border-slate-700',
        'placeholder:text-slate-500',
        'transition-[color,background-color,border-color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none',
        'hover:border-slate-400 hover:bg-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700',
        'focus-visible:border-primary focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand/25 focus-visible:ring-inset',
        'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400',
        'dark:focus-visible:bg-brand-950 dark:focus-visible:ring-brand-400/30',
        className
      )}
      {...props}
    />
  );
}

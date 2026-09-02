import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function AppKbd({
  children,
  className,
  textClassName,
  ...props
}: ComponentProps<'kbd'> & {
  textClassName?: string;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4.5 w-auto min-w-4.5 shrink-0 place-items-center rounded-[5px] border-0 bg-slate-200 p-0 px-1.5 font-sans text-[10px] text-slate-600 leading-none shadow-none transition-colors group-hover/button:bg-brand-100 group-hover/button:text-brand-600 dark:bg-slate-600 dark:text-slate-200 dark:group-hover/button:bg-brand-800 dark:group-hover/button:text-brand-100',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'flex items-center justify-center whitespace-nowrap font-mono text-xs leading-none',
          textClassName
        )}
      >
        {children}
      </span>
    </kbd>
  );
}

import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AppButtonSizeT = 'lg' | 'md' | 'sm';

const appButtonSizeClassNameMap: Record<AppButtonSizeT, string> = {
  lg: 'h-9 px-3 text-sm',
  md: 'h-8 px-3 text-sm',
  sm: 'h-7 px-2.5 text-xs',
};

export function AppButton({
  className,
  size = 'md',
  ...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'variant'> & {
  size?: AppButtonSizeT;
}) {
  return (
    <Button
      className={cn(
        'bg-brand-50 text-brand-500 hover:bg-brand-100',
        'dark:bg-brand-600 dark:text-brand-50 dark:hover:bg-brand-700',
        appButtonSizeClassNameMap[size],
        className
      )}
      size="sm"
      variant="ghost"
      {...props}
    />
  );
}

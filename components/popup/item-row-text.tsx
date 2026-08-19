import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ItemRowTextPropsI {
  className?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  title: ReactNode;
  titleClassName?: string;
  titleTooltip?: string;
}

export function ItemRowText({
  className,
  description,
  descriptionClassName,
  title,
  titleClassName,
  titleTooltip,
}: ItemRowTextPropsI) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span
        className={cn(
          'truncate font-medium text-slate-900 text-sm dark:text-white',
          titleClassName
        )}
        title={titleTooltip}
      >
        {title}
      </span>
      {description ? (
        <span
          className={cn(
            'whitespace-normal break-words text-muted-foreground text-xs leading-snug',
            descriptionClassName
          )}
        >
          {description}
        </span>
      ) : null}
    </div>
  );
}

import React from 'react';

import { cn } from '@/lib/utils';

interface CardListItemWrapperPropsI {
  children: React.ReactNode;
  className?: string;
}

export const CardListItemWrapper = ({
  children,
  className,
}: CardListItemWrapperPropsI) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)]:gap-0',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:first-child]:rounded-b-none',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:first-child]:border-b-0',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:last-child]:rounded-t-none',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:last-child]:border-t-0',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:not(:first-child):not(:last-child),.card-list-item-separator:not(:first-child):not(:last-child)]:rounded-none',
        '[&:has(.card-list-item+.card-list-item,.card-list-item-separator)>.card-list-item:not(:first-child):not(:last-child),.card-list-item-separator:not(:first-child):not(:last-child)]:border-y-0',
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < React.Children.count(children) - 1 && (
            <div className="card-list-item-separator border-x border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/70">
              <div className="bg-border mx-auto h-px w-[calc(100%-2rem)]" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

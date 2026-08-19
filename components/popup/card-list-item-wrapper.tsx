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
  const childCount = React.Children.count(children);
  const hasMultipleRows = childCount > 1;

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        hasMultipleRows &&
          'gap-0 [&>.card-list-item:first-child]:rounded-t-xl [&>.card-list-item:last-child]:rounded-b-xl [&>.card-list-item]:rounded-none [&>.card-list-item]:border-0',
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < childCount - 1 && (
            <div className="card-list-item-separator bg-white dark:bg-slate-800/70">
              <div className="mx-auto h-px w-[calc(100%-2rem)] bg-slate-100/70 dark:bg-white/5" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

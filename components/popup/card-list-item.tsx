import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CardListItemPropsI {
  title: string;
  description: string;
  disabled?: boolean;
  onClick?: () => void;
  components?: {
    RightSlot?: React.ReactNode;
    BottomSlot?: React.ReactNode;
  };
}

export const CardListItem = ({
  title,
  description,
  disabled,
  onClick,
  components,
}: CardListItemPropsI) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30',
        onClick && 'cursor-pointer hover:shadow-lg dark:hover:bg-slate-800/80',
        disabled &&
          'pointer-events-none cursor-not-allowed opacity-50 dark:opacity-60'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span
            className={cn(
              'text-sm font-medium text-slate-900 dark:text-white',
              disabled && 'text-slate-400 line-through dark:text-slate-500'
            )}
          >
            {title}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {description}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {components?.RightSlot}
          {onClick && !disabled ? (
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          ) : null}
        </div>
      </div>
      {components?.BottomSlot ? (
        <div className="mt-4">{components.BottomSlot}</div>
      ) : null}
    </div>
  );
};

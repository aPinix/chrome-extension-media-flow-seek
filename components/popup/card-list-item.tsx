import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { ItemRowText } from './item-row-text';

interface CardListItemPropsI {
  title: React.ReactNode;
  icon?: React.ElementType;
  iconToggle?: React.ElementType;
  iconIsToggled?: boolean;
  description: React.ReactNode;
  disabled?: boolean;
  disabledSoft?: boolean;
  onClick?: () => void;
  components?: {
    RightSlot?: React.ReactNode;
    BottomSlot?: React.ReactNode;
  };
  className?: string;
  classNameIcon?: string;
  classNameContentBottom?: string;
}

export const CardListItem = ({
  title,
  icon: Icon,
  iconToggle: IconToggle,
  iconIsToggled,
  description,
  disabled,
  disabledSoft,
  onClick,
  components,
  className,
  classNameIcon,
  classNameContentBottom,
}: CardListItemPropsI) => {
  const rootClassName = cn(
    'card-list-item',
    'rounded-xl border border-slate-200 bg-white p-4 transition-all dark:border-slate-600 dark:bg-slate-800/70',
    onClick &&
      'w-full cursor-pointer text-left hover:shadow-lg dark:hover:bg-slate-800/80',
    disabled &&
      'pointer-events-none cursor-not-allowed opacity-50 dark:opacity-60',
    className
  );

  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        {/* icon + info */}
        <div
          className={cn(
            'flex min-w-0 flex-1 items-start gap-3',
            disabledSoft && 'opacity-50 dark:opacity-60'
          )}
        >
          {/* icon */}
          {(Icon || IconToggle) && (
            <div className="relative h-5 w-5 shrink-0">
              {/* Primary Icon */}
              {Icon ? (
                <Icon
                  className={cn(
                    'absolute inset-0 h-5 w-5 text-slate-400 transition-all duration-300 ease-in-out dark:text-slate-500',
                    IconToggle && iconIsToggled
                      ? 'scale-75 opacity-0'
                      : 'scale-100 opacity-100',
                    classNameIcon
                  )}
                />
              ) : null}

              {/* Toggle Icon */}
              {IconToggle ? (
                <IconToggle
                  className={cn(
                    'absolute inset-0 h-5 w-5 text-slate-400 transition-all duration-300 ease-in-out dark:text-slate-500',
                    iconIsToggled
                      ? 'scale-100 opacity-100'
                      : 'scale-75 opacity-0',
                    classNameIcon
                  )}
                />
              ) : null}
            </div>
          )}

          <ItemRowText
            description={description}
            title={title}
            titleClassName={cn(
              disabled && 'text-slate-400 line-through dark:text-slate-500'
            )}
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {components?.RightSlot}
          {onClick && !disabled ? (
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          ) : null}
        </div>
      </div>
      {components?.BottomSlot ? (
        <div className={cn('mt-4', classNameContentBottom)}>
          {components.BottomSlot}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        className={rootClassName}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <div className={rootClassName}>{content}</div>;
};

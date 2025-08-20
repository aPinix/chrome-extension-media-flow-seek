import { cn } from '@/lib/utils';

interface SectionTitlePropsI {
  title: string;
  icon?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
}

export const SectionTitle = ({
  title,
  icon: Icon,
  children,
  className,
}: SectionTitlePropsI) => {
  return (
    <div className={cn('flex h-8 items-center justify-between', className)}>
      <div className="flex items-center gap-2 pl-1">
        {Icon ? (
          <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        ) : null}
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>

      {children}
    </div>
  );
};

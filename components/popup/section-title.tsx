import { cn } from '@/lib/utils';

interface SectionTitlePropsI {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export const SectionTitle = ({
  title,
  children,
  className,
}: SectionTitlePropsI) => {
  return (
    <div className={cn('flex h-8 items-center justify-between', className)}>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>

      {children}
    </div>
  );
};

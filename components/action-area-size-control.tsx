import { cn } from '@/lib/utils';

import { Slider } from './ui/slider';

interface ActionAreaSizeControlPropsI {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const ActionAreaSizeControl = ({
  value,
  onChange,
  className,
}: ActionAreaSizeControlPropsI) => {
  return (
    <div className={cn('flex items-center gap-3 px-2', className)}>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={10}
        max={100}
        step={5}
        className="flex-1"
      />
      <span className="w-auto font-mono text-xs text-slate-700 dark:text-slate-300">
        {value}%
      </span>
    </div>
  );
};

export { ActionAreaSizeControl };

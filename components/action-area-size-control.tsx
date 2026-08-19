import { cn } from '@/lib/utils';

import { AppSlider } from './app/app-slider';

interface ActionAreaSizeControlPropsI {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

const ActionAreaSizeControl = ({
  value,
  onChange,
  className,
  disabled,
}: ActionAreaSizeControlPropsI) => {
  return (
    <div className={cn('flex items-center gap-3 px-2', className)}>
      <AppSlider
        aria-label="Action area size"
        className="flex-1"
        disabled={disabled}
        max={100}
        min={10}
        onValueChange={(nextValue) => {
          onChange(
            typeof nextValue === 'number' ? nextValue : (nextValue[0] ?? value)
          );
        }}
        step={5}
        value={value}
      />
      <span className="w-auto font-mono text-slate-700 text-xs dark:text-slate-300">
        {value}%
      </span>
    </div>
  );
};

export { ActionAreaSizeControl };

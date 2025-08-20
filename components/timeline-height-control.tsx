import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { Slider } from './ui/slider';

type TimelineUnit = 'px' | '%';

interface TimelineHeightControlPropsI {
  value: number;
  unit: TimelineUnit;
  onChange: (value: number) => void;
  onUnitChange: (unit: TimelineUnit) => void;
  className?: string;
}

const TimelineHeightControl = ({
  value,
  unit,
  onChange,
  onUnitChange,
  className,
}: TimelineHeightControlPropsI) => {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={0}
        max={100}
        className="flex-1"
      />
      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
        {value}
        {unit}
      </span>

      <ToggleGroup
        type="single"
        value={unit}
        onValueChange={(value) => value && onUnitChange(value as TimelineUnit)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="px" className="flex-none shrink">
          px
        </ToggleGroupItem>
        <ToggleGroupItem value="%" className="flex-none shrink">
          %
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

export { TimelineHeightControl };

import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
      <span className="w-12 font-mono text-xs text-slate-700 dark:text-slate-300">
        {value}
        {unit}
      </span>
      <Select
        value={unit}
        onValueChange={(newUnit) => onUnitChange(newUnit as TimelineUnit)}
      >
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="px">px</SelectItem>
          <SelectItem value="%">%</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export { TimelineHeightControl };

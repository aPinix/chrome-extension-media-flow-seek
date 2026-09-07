import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { APP_SEGMENT_INACTIVE_SURFACE } from '@/components/app/app-segment';
import { cn } from '@/lib/utils';

export function AppSlider({
  'aria-label': ariaLabel,
  className,
  defaultValue,
  max = 100,
  min = 0,
  thumbClassName,
  trackClassName,
  value,
  ...props
}: SliderPrimitive.Root.Props & {
  thumbClassName?: string;
  trackClassName?: string;
}) {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? Array.isArray(defaultValue)
        ? defaultValue
        : [defaultValue ?? min]
      : [value];

  return (
    <SliderPrimitive.Root
      aria-label={ariaLabel}
      className={cn('group/app-slider w-full cursor-pointer', className)}
      data-slot="app-slider"
      data-thumb-alignment="center"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="center"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-8 w-full touch-none select-none items-center data-disabled:opacity-50">
        <SliderPrimitive.Track
          className={cn(
            'relative h-2 w-full grow select-none overflow-hidden rounded-full transition-[scale,background-color] duration-150 ease-out group-hover/app-slider:scale-y-[1.15] group-hover/app-slider:bg-slate-300 group-active/app-slider:scale-y-125 dark:group-hover/app-slider:bg-slate-700',
            APP_SEGMENT_INACTIVE_SURFACE,
            trackClassName
          )}
          data-slot="app-slider-track"
        >
          <SliderPrimitive.Indicator
            className="h-full select-none bg-brand-500 transition-[width,inset-inline-start,height,bottom,background-color] duration-200 ease-out group-hover/app-slider:bg-brand-400 group-active/app-slider:bg-brand-300 data-dragging:transition-none"
            data-slot="app-slider-range"
          />
        </SliderPrimitive.Track>

        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            aria-label={
              values.length > 1 && ariaLabel
                ? `${ariaLabel} ${index + 1}`
                : ariaLabel
            }
            className={cn(
              "relative block h-8 w-7 shrink-0 bg-transparent outline-hidden transition-[inset-inline-start,bottom] duration-200 ease-out after:pointer-events-none after:absolute after:top-1/2 after:left-1/2 after:h-2 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-white after:shadow-sm after:ring-1 after:ring-black/10 after:transition-[box-shadow,background-color] after:content-[''] hover:after:ring-4 hover:after:ring-ring/30 focus-visible:after:ring-4 focus-visible:after:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-dragging:transition-none",
              thumbClassName
            )}
            data-slot="app-slider-thumb"
            key={index}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

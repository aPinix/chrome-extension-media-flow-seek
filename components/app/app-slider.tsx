import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

export function AppSlider({
  'aria-label': ariaLabel,
  className,
  defaultValue,
  max = 100,
  min = 0,
  value,
  ...props
}: SliderPrimitive.Root.Props) {
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
      className={cn('w-full cursor-pointer', className)}
      data-slot="app-slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-8 w-full touch-none select-none items-center data-disabled:opacity-50">
        <SliderPrimitive.Track
          className="relative h-2 w-full grow select-none overflow-hidden rounded-full bg-input/90"
          data-slot="app-slider-track"
        >
          <SliderPrimitive.Indicator
            className="h-full select-none bg-primary"
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
            className="relative block h-8 w-7 shrink-0 bg-transparent outline-hidden after:pointer-events-none after:absolute after:top-1/2 after:left-1/2 after:h-2 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-white after:shadow-sm after:ring-1 after:ring-black/10 after:transition-[box-shadow,background-color] after:content-[''] hover:after:ring-4 hover:after:ring-ring/30 focus-visible:after:ring-4 focus-visible:after:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
            data-slot="app-slider-thumb"
            key={index}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

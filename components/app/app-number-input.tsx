import { MinusIcon, PlusIcon } from 'lucide-react';
import { AppInputText } from './app-input-text';

export function AppNumberInput({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
  onCommit,
}: {
  id?: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const numeric = Number(value);
  const current = value.trim() && Number.isFinite(numeric) ? numeric : min;
  const adjust = (amount: number) => {
    const next = String(
      Math.min(max, Math.max(min, Number((current + amount).toFixed(6))))
    );
    onValueChange(next);
    onCommit(next);
  };
  return (
    <div className="relative">
      <AppInputText
        aria-label={label}
        className="pr-14 pl-1 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onBlur={() => onCommit(value)}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        step={step}
        type="number"
        value={value}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center">
        {([-1, 1] as const).map((direction) => {
          const Icon = direction === -1 ? MinusIcon : PlusIcon;
          return (
            <button
              aria-label={`${direction === -1 ? 'Decrease' : 'Increase'} ${label}`}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-300 ease-in-out hover:bg-slate-300/50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-700"
              disabled={
                disabled || (direction === -1 ? current <= min : current >= max)
              }
              key={direction}
              onClick={(event) =>
                adjust(direction * step * (event.shiftKey ? 10 : 1))
              }
              title={`${direction === -1 ? 'Decrease' : 'Increase'} by ${step} (Shift: ${step * 10})`}
              type="button"
            >
              <Icon aria-hidden="true" className="size-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

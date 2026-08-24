import { RotateCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SliderResetButtonPropsI {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

export function SliderResetButton({
  disabled,
  label,
  onClick,
}: SliderResetButtonPropsI) {
  return (
    <Button
      aria-label={label}
      className="size-5 shrink-0 rounded-full bg-amber-500/15 p-0 text-amber-600 transition-colors hover:bg-amber-500/25 hover:text-amber-700 disabled:bg-slate-300 disabled:text-slate-500 dark:bg-amber-400/15 dark:text-amber-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:hover:bg-amber-400/25 dark:hover:text-amber-200"
      disabled={disabled}
      onClick={onClick}
      size="icon-xs"
      title={label}
      type="button"
      variant="ghost"
    >
      <RotateCcwIcon className="size-3" />
    </Button>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type AppSelectItemT<TValue extends string> = {
  label: string;
  value: TValue;
};

export function AppSelect<TValue extends string>({
  className,
  items,
  label,
  onValueChange,
  value,
}: {
  className?: string;
  items: AppSelectItemT<TValue>[];
  label: string;
  onValueChange: (value: TValue) => void;
  value: TValue;
}) {
  return (
    <Select
      items={items}
      onValueChange={(nextValue) => {
        const selectedItem = items.find((item) => item.value === nextValue);
        if (selectedItem) onValueChange(selectedItem.value);
      }}
      value={value}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          'border-violet-300 bg-violet-100 text-violet-700 hover:border-violet-400 hover:bg-violet-200 [&_svg]:text-violet-600',
          'dark:border-violet-700 dark:bg-violet-900 dark:text-violet-300 dark:hover:border-violet-600 dark:hover:bg-violet-800 dark:[&_svg]:text-violet-300',
          className
        )}
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
          'border-brand-300 bg-brand-100 text-brand-700 hover:border-brand-400 hover:bg-brand-200 [&_svg]:text-brand-600',
          'dark:border-brand-700 dark:bg-brand-900 dark:text-brand-300 dark:hover:border-brand-600 dark:hover:bg-brand-800 dark:[&_svg]:text-brand-300',
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

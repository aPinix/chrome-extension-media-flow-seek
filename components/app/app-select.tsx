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
          'bg-brand-50 text-brand-500 hover:bg-brand-100',
          'dark:bg-brand-600 dark:text-brand-50 dark:hover:bg-brand-700',
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

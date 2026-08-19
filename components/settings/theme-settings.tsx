import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { useTheme } from '@/components/theme-provider.tsx';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const themes = ['light', 'dark'];
  const { t } = useTranslation();
  return (
    <Card>
      <div className="space-y-1.5 p-6 pb-3">
        <h3 className="text-left font-semibold text-base">
          {t('themeSettings')}
        </h3>
      </div>
      <RadioGroup
        className="p-6 pt-2"
        defaultValue={theme}
        onValueChange={async (selectedTheme: 'light' | 'dark') => {
          setTheme(selectedTheme);
          await browser.storage.local.set({ theme: selectedTheme });
        }}
        value={theme}
      >
        {themes.map((theme, index) => {
          return (
            <div
              className="flex items-center justify-between space-y-1.5"
              key={theme}
            >
              <Label htmlFor={`r${index}`}>{theme}</Label>
              <RadioGroupItem id={`r${index}`} value={theme} />
            </div>
          );
        })}
      </RadioGroup>
    </Card>
  );
}

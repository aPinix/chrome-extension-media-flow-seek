import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';

import languages from '@/components/i18nConfig.ts';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function I18nSettings() {
  const { i18n } = useTranslation();
  const { t } = useTranslation();
  return (
    <Card>
      <div className="space-y-1.5 p-6 pb-3">
        <h3 className="text-left font-semibold text-base">
          {t('i18nSettings')}
        </h3>
      </div>
      <RadioGroup
        className="p-6 pt-2"
        defaultValue={i18n.language}
        onValueChange={async (locale: string) => {
          await i18n.changeLanguage(locale);
          await browser.storage.local.set({ i18n: locale });
        }}
        value={i18n.language}
      >
        {languages.map((language, index) => {
          return (
            <div
              className="flex items-center justify-between space-y-1.5"
              key={language.locale}
            >
              <Label htmlFor={`r${index}`}>{language.name}</Label>
              <RadioGroupItem id={`r${index}`} value={`${language.locale}`} />
            </div>
          );
        })}
      </RadioGroup>
    </Card>
  );
}

import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';

import languages from '@/components/i18nConfig.ts';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { RadioGroup } from '@/components/ui/radio-group';

export function I18nSettings() {
  const { i18n } = useTranslation();
  const { t } = useTranslation();
  return (
    <Card>
      <div className="space-y-1.5 p-6 pb-3">
        <h3 className="text-left text-base font-semibold">
          {t('i18nSettings')}
        </h3>
      </div>
      <RadioGroup
        defaultValue={i18n.language}
        value={i18n.language}
        className="p-6 pt-2"
      >
        {languages.map((language, index, array) => {
          return (
            <div
              key={index}
              className="flex items-center justify-between space-y-1.5"
              onClick={async () => {
                await i18n.changeLanguage(language.locale);
                await browser.runtime.sendMessage({
                  messageType: MessageType.changeLocale,
                  content: language.locale,
                });
                await browser.storage.local.set({ i18n: language.locale });
              }}
            >
              <Label htmlFor={`r${index}`}>{language.name}</Label>
              <RadioGroupItem value={`${language.locale}`} id={`r${index}`} />
            </div>
          );
        })}
      </RadioGroup>
    </Card>
  );
}

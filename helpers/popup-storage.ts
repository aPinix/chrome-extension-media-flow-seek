import { getDefaultDomainRules } from '@/helpers/domains';
import { DomainConfigT } from '@/types/domains';

export type PopupSettings = {
  isEnabled: boolean;
  isDebugEnabled: boolean;
  isBetaFeaturesEnabled: boolean;
  invertHorizontalScroll: boolean;
  showTimelineOnHover: boolean;
  timelinePosition: 'top' | 'bottom';
  timelineHeight: number;
  timelineHeightUnit: 'px' | '%';
  actionArea: 'full' | 'top' | 'middle' | 'bottom';
  actionAreaSize: number;
  domainRules: DomainConfigT[];
};

export const DEFAULT_SETTINGS: Omit<PopupSettings, 'domainRules'> = {
  isEnabled: true,
  isDebugEnabled: false,
  isBetaFeaturesEnabled: false,
  invertHorizontalScroll: false,
  showTimelineOnHover: false,
  timelinePosition: 'bottom',
  timelineHeight: 6,
  timelineHeightUnit: 'px',
  actionArea: 'full',
  actionAreaSize: 30,
};

export const mergeDomainRules = (
  existingRules: DomainConfigT[]
): DomainConfigT[] => {
  const defaults = getDefaultDomainRules();
  const merged = [...existingRules];

  // Add any missing default domains
  defaults.forEach((defaultRule) => {
    const exists = merged.find((rule) => rule.domain === defaultRule.domain);
    if (!exists) {
      merged.push(defaultRule);
    }
  });

  return merged;
};

export const loadPopupSettings = (): Promise<PopupSettings> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        'isEnabled',
        'isDebugEnabled',
        'isBetaFeaturesEnabled',
        'invertHorizontalScroll',
        'showTimelineOnHover',
        'timelinePosition',
        'timelineHeight',
        'timelineHeightUnit',
        'actionArea',
        'actionAreaSize',
        'domainRules',
      ],
      (result) => {
        const existingRules = result.domainRules as DomainConfigT[] | undefined;
        const finalRules = existingRules
          ? mergeDomainRules(existingRules)
          : getDefaultDomainRules();

        // Save merged rules back to storage if we added new ones
        if (existingRules && finalRules.length !== existingRules.length) {
          chrome.storage.sync.set({ domainRules: finalRules });
        }

        resolve({
          isEnabled: result.isEnabled ?? DEFAULT_SETTINGS.isEnabled,
          isDebugEnabled:
            result.isDebugEnabled ?? DEFAULT_SETTINGS.isDebugEnabled,
          isBetaFeaturesEnabled:
            result.isBetaFeaturesEnabled ??
            DEFAULT_SETTINGS.isBetaFeaturesEnabled,
          invertHorizontalScroll:
            result.invertHorizontalScroll ??
            DEFAULT_SETTINGS.invertHorizontalScroll,
          showTimelineOnHover:
            result.showTimelineOnHover ?? DEFAULT_SETTINGS.showTimelineOnHover,
          timelinePosition:
            result.timelinePosition ?? DEFAULT_SETTINGS.timelinePosition,
          timelineHeight:
            result.timelineHeight ?? DEFAULT_SETTINGS.timelineHeight,
          timelineHeightUnit:
            result.timelineHeightUnit ?? DEFAULT_SETTINGS.timelineHeightUnit,
          actionArea: result.actionArea ?? DEFAULT_SETTINGS.actionArea,
          actionAreaSize:
            result.actionAreaSize ?? DEFAULT_SETTINGS.actionAreaSize,
          domainRules: finalRules,
        });
      }
    );
  });
};

export const saveSettings = (settings: Partial<PopupSettings>) => {
  chrome.storage.sync.set(settings);
};

export const sendMessageToCurrentTab = (message: any) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
};

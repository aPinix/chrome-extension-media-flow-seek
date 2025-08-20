import { parse } from 'tldts';

import { DomainConfigT } from '@/types/domains';

export const getCurrentDomain = (): Promise<string> => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const url = new URL(tabs[0].url);
        // Extract just the main domain using tldts
        const parsed = parse(url.hostname);
        const domain = parsed.domain || url.hostname;
        resolve(domain);
      } else {
        resolve('');
      }
    });
  });
};

export const checkIsAtDefaults = (
  isEnabled: boolean,
  isDebugEnabled: boolean,
  invertHorizontalScroll: boolean,
  showTimelineOnHover: boolean,
  timelinePosition: 'top' | 'bottom',
  timelineHeight: number,
  timelineHeightUnit: 'px' | '%',
  domainRules: DomainConfigT[],
  actionArea: 'full' | 'top' | 'middle' | 'bottom',
  actionAreaSize: number
): boolean => {
  return (
    isEnabled === true &&
    isDebugEnabled === false &&
    invertHorizontalScroll === false &&
    showTimelineOnHover === false &&
    timelinePosition === 'bottom' &&
    timelineHeight === 6 &&
    timelineHeightUnit === 'px' &&
    actionArea === 'full' &&
    actionAreaSize === 30
  );
};

export const findCurrentDomainRule = (
  domainRules: DomainConfigT[],
  currentDomain: string
): DomainConfigT | undefined => {
  return domainRules.find((rule) => rule.domain === currentDomain);
};

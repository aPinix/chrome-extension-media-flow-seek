import { DomainRuleTypeT } from './domains';

export type VideoStateT = {
  overlay: HTMLDivElement;
  scrollContent: HTMLDivElement;
  timeline: HTMLDivElement;
  wrapper: HTMLDivElement;
  debugIndicator: HTMLAnchorElement;
  isUserScrubbing: boolean;
  syncCleanup?: () => void;
};

export type ContentSettingsT = {
  isEnabled: boolean;
  isDebugEnabled: boolean;
  invertHorizontalScroll: boolean;
  showTimelineOnHover: boolean;
  timelinePosition: 'top' | 'bottom';
  timelineHeight: number;
  timelineHeightUnit: 'px' | '%';
  domainRules: Array<{
    domain: string;
    type: DomainRuleTypeT;
    enabled: boolean;
  }>;
};

export type ChromeMessageT = {
  action: string;
  [key: string]: any;
};

export type DOMCheckOptionsT = {
  debugMode: boolean;
  shouldRun: () => boolean;
  createOverlay: (video: HTMLVideoElement) => void;
};

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
  isBetaFeaturesEnabled: boolean;
  invertHorizontalScroll: boolean;
  showTimelineOnHover: boolean;
  timelinePosition: 'top' | 'bottom';
  timelineHeight: number;
  timelineHeightUnit: 'px' | '%';
  actionArea: 'full' | 'top' | 'middle' | 'bottom';
  actionAreaSize: number; // percentage for partial areas (top/middle/bottom)
  domainRules: Array<{
    domain: string;
    type: DomainRuleTypeT;
    enabled: boolean;
  }>;
};

export const ActionAreaE = {
  Full: 'full',
  Top: 'top',
  Middle: 'middle',
  Bottom: 'bottom',
} as const;
export type ActionAreaT = (typeof ActionAreaE)[keyof typeof ActionAreaE];

export type ChromeMessageT = {
  action: string;
  [key: string]: any;
};

export type DOMCheckOptionsT = {
  debugMode: boolean;
  shouldRun: () => boolean;
  createOverlay: (video: HTMLVideoElement) => void;
};

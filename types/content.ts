import type { ScrollHotkeyT } from '@/helpers/scroll-speed';

import type { DomainRuleTypeT } from './domains';

export type VideoStateT = {
  overlay: HTMLDivElement;
  scrollContent: HTMLDivElement;
  timeline: HTMLDivElement;
  wrapper: HTMLDivElement;
  debugIndicator: HTMLAnchorElement;
  mediaControls?: HTMLDivElement;
  isHovering: boolean;
  isPointerHovering?: boolean;
  isWheelHovering?: boolean;
  wheelHoverTimeout?: number;
  isUserScrubbing: boolean;
  isVideoDragging?: boolean;
  videoControlsBeforeHide?: boolean;
  hiddenControlsContainer?: HTMLElement;
  cancelTimelineSeeking?: () => void;
  cancelVideoDragging?: () => void;
  syncMediaControls?: () => void;
  preserveSourceVolume?: () => void;
  syncPlaybackFeedback?: () => void;
  syncCleanup?: () => void;
};

export type ContentSettingsT = {
  isEnabled: boolean;
  isDebugEnabled: boolean;
  isBetaFeaturesEnabled: boolean;
  invertHorizontalScroll: boolean;
  scrollSpeedFactor: number;
  fastScrollHotkey: ScrollHotkeyT;
  slowScrollHotkey: ScrollHotkeyT;
  isPlayPauseWheelEnabled: boolean;
  showTimelineOnHover: boolean;
  isTimelineSeekingEnabled: boolean;
  dragVideoToSeek: boolean;
  hideVideoControls: boolean;
  colorizedTimeline: boolean;
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
  type: string;
  isEnabled: boolean;
  isDebugEnabled: boolean;
  isBetaFeaturesEnabled: boolean;
  invertHorizontalScroll: boolean;
  scrollSpeedFactor?: number;
  fastScrollHotkey?: ContentSettingsT['fastScrollHotkey'];
  slowScrollHotkey?: ContentSettingsT['slowScrollHotkey'];
  isPlayPauseWheelEnabled?: boolean;
  showTimelineOnHover: boolean;
  isTimelineSeekingEnabled?: boolean;
  dragVideoToSeek?: boolean;
  hideVideoControls?: boolean;
  colorizedTimeline?: boolean;
  timelinePosition: ContentSettingsT['timelinePosition'];
  timelineHeight: number;
  timelineHeightUnit: ContentSettingsT['timelineHeightUnit'];
  domainRules: ContentSettingsT['domainRules'];
  triggeredBy?: 'hotkey' | 'popup';
  showNotification?: boolean;
  settings?: Partial<ContentSettingsT>;
  [key: string]: unknown;
};

export type DOMCheckOptionsT = {
  debugMode: boolean;
  shouldRun: () => boolean;
  hasOverlay: (video: HTMLVideoElement) => boolean;
  createOverlay: (video: HTMLVideoElement) => void;
  removeOverlay?: (video: HTMLVideoElement) => void;
};

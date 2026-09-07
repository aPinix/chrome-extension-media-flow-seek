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
  updateYouTubeChapterMode?: () => void;
  youtubeChapterTooltip?: HTMLDivElement;
  thumbnailPreview?: HTMLDivElement;
  updateThumbnailPreviewAtPoint?: (clientX: number, clientY: number) => void;
  repositionThumbnailPreview?: () => void;
  hideThumbnailPreview?: () => void;
  updateThumbnailPreviewMode?: () => void;
  syncCleanup?: () => void;
};

export type ContentSettingsT = {
  settingsSchemaVersion: number;
  isEnabled: boolean;
  isDebugEnabled: boolean;
  isBetaFeaturesEnabled: boolean;
  isScrollSeekingEnabled: boolean;
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
  instagramPlaybackSpeed: number;
  instagramAutoSkip: boolean;
  instagramShowPlaybackSpeed: boolean;
  instagramShowAutoSkip: boolean;
  tiktokPlaybackSpeed: number;
  tiktokAutoSkip: boolean;
  tiktokShowPlaybackSpeed: boolean;
  tiktokShowAutoSkip: boolean;
  isYouTubeChapteredTimelineEnabled: boolean;
  isSeekbarThumbnailPreviewEnabled: boolean;
  timelinePosition: 'top' | 'bottom';
  timelineHeight: number;
  timelineHeightUnit: 'px' | '%';
  actionArea: 'full' | 'top' | 'middle' | 'bottom';
  actionAreaSize: number;
  actionAreaSizeUnit: 'px' | '%';
  domainRules: Array<{
    domain: string;
    type: DomainRuleTypeT;
    enabled: boolean;
    createdAt?: number;
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
  isScrollSeekingEnabled?: boolean;
  showTimelineOnHover: boolean;
  isTimelineSeekingEnabled?: boolean;
  dragVideoToSeek?: boolean;
  hideVideoControls?: boolean;
  colorizedTimeline?: boolean;
  isYouTubeChapteredTimelineEnabled?: boolean;
  isSeekbarThumbnailPreviewEnabled?: boolean;
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

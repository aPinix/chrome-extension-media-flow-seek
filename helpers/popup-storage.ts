import {
  getDefaultDomainRules,
  mergeAndMigrateDomainRules,
} from '@/helpers/domains';
import { normalizeInstagramSpeed } from '@/helpers/instagram-settings';
import {
  DEFAULT_FAST_SCROLL_HOTKEY,
  DEFAULT_SCROLL_SPEED_FACTOR,
  DEFAULT_SLOW_SCROLL_HOTKEY,
  normalizeScrollHotkeys,
  normalizeScrollSpeedFactor,
  type ScrollHotkeyT,
} from '@/helpers/scroll-speed';
import {
  migrateSeekSettings,
  SETTINGS_SCHEMA_VERSION,
} from '@/helpers/settings-migration';
import { normalizeTikTokSpeed } from '@/helpers/tiktok-settings';
import type { DomainConfigT, DomainSortT } from '@/types/domains';
import { DomainSortE } from '@/types/domains';

export type PopupSettings = {
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
  domainRules: DomainConfigT[];
  domainSort: DomainSortT;
};

export const DEFAULT_SETTINGS: Omit<PopupSettings, 'domainRules'> = {
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  isEnabled: true,
  isDebugEnabled: false,
  isBetaFeaturesEnabled: true,
  isScrollSeekingEnabled: true,
  invertHorizontalScroll: false,
  scrollSpeedFactor: DEFAULT_SCROLL_SPEED_FACTOR,
  fastScrollHotkey: DEFAULT_FAST_SCROLL_HOTKEY,
  slowScrollHotkey: DEFAULT_SLOW_SCROLL_HOTKEY,
  isPlayPauseWheelEnabled: true,
  showTimelineOnHover: false,
  isTimelineSeekingEnabled: true,
  dragVideoToSeek: false,
  hideVideoControls: false,
  colorizedTimeline: true,
  instagramPlaybackSpeed: 1,
  instagramAutoSkip: false,
  instagramShowPlaybackSpeed: true,
  instagramShowAutoSkip: true,
  tiktokPlaybackSpeed: 1,
  tiktokAutoSkip: false,
  tiktokShowPlaybackSpeed: true,
  tiktokShowAutoSkip: true,
  isYouTubeChapteredTimelineEnabled: true,
  isSeekbarThumbnailPreviewEnabled: true,
  timelinePosition: 'bottom',
  timelineHeight: 6,
  timelineHeightUnit: 'px',
  actionArea: 'full',
  actionAreaSize: 30,
  actionAreaSizeUnit: '%',
  domainSort: DomainSortE.Custom,
};

const domainSortValues = new Set<DomainSortT>(Object.values(DomainSortE));

const normalizeDomainSort = (sort: unknown): DomainSortT =>
  domainSortValues.has(sort as DomainSortT)
    ? (sort as DomainSortT)
    : DEFAULT_SETTINGS.domainSort;

export const mergeDomainRules = (
  existingRules: DomainConfigT[]
): DomainConfigT[] => mergeAndMigrateDomainRules(existingRules);

export const loadPopupSettings = (): Promise<PopupSettings> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        'isEnabled',
        'settingsSchemaVersion',
        'isDebugEnabled',
        'isBetaFeaturesEnabled',
        'isScrollSeekingEnabled',
        'invertHorizontalScroll',
        'scrollSpeedFactor',
        'fastScrollHotkey',
        'slowScrollHotkey',
        'isPlayPauseWheelEnabled',
        'showTimelineOnHover',
        'isTimelineSeekingEnabled',
        'dragVideoToSeek',
        'hideVideoControls',
        'colorizedTimeline',
        'instagramPlaybackSpeed',
        'instagramAutoSkip',
        'instagramShowPlaybackSpeed',
        'instagramShowAutoSkip',
        'tiktokPlaybackSpeed',
        'tiktokAutoSkip',
        'tiktokShowPlaybackSpeed',
        'tiktokShowAutoSkip',
        'isYouTubeChapteredTimelineEnabled',
        'isSeekbarThumbnailPreviewEnabled',
        'timelinePosition',
        'timelineHeight',
        'timelineHeightUnit',
        'actionArea',
        'actionAreaSize',
        'actionAreaSizeUnit',
        'domainRules',
        'domainSort',
      ],
      (result) => {
        const stored = result as Partial<PopupSettings>;
        const existingRules = stored.domainRules;
        const finalRules = existingRules
          ? mergeDomainRules(existingRules)
          : getDefaultDomainRules();
        const scrollHotkeys = normalizeScrollHotkeys(
          stored.fastScrollHotkey,
          stored.slowScrollHotkey
        );
        const migratedSeekSettings = migrateSeekSettings(stored, {
          isScrollSeekingEnabled: DEFAULT_SETTINGS.isScrollSeekingEnabled,
          isTimelineSeekingEnabled: DEFAULT_SETTINGS.isTimelineSeekingEnabled,
          dragVideoToSeek: DEFAULT_SETTINGS.dragVideoToSeek,
          hideVideoControls: DEFAULT_SETTINGS.hideVideoControls,
        });

        // Save added defaults and the one-time YouTube-only default migration.
        if (
          existingRules &&
          JSON.stringify(finalRules) !== JSON.stringify(existingRules)
        ) {
          chrome.storage.sync.set({ domainRules: finalRules });
        }

        if (migratedSeekSettings.didMigrate) {
          chrome.storage.sync.set({
            settingsSchemaVersion: migratedSeekSettings.settingsSchemaVersion,
            isScrollSeekingEnabled: migratedSeekSettings.isScrollSeekingEnabled,
            isTimelineSeekingEnabled:
              migratedSeekSettings.isTimelineSeekingEnabled,
            dragVideoToSeek: migratedSeekSettings.dragVideoToSeek,
            hideVideoControls: migratedSeekSettings.hideVideoControls,
          });
        }

        resolve({
          settingsSchemaVersion: migratedSeekSettings.settingsSchemaVersion,
          isEnabled: stored.isEnabled ?? DEFAULT_SETTINGS.isEnabled,
          isDebugEnabled:
            stored.isDebugEnabled ?? DEFAULT_SETTINGS.isDebugEnabled,
          isBetaFeaturesEnabled:
            stored.isBetaFeaturesEnabled ??
            DEFAULT_SETTINGS.isBetaFeaturesEnabled,
          isScrollSeekingEnabled: migratedSeekSettings.isScrollSeekingEnabled,
          invertHorizontalScroll:
            stored.invertHorizontalScroll ??
            DEFAULT_SETTINGS.invertHorizontalScroll,
          scrollSpeedFactor: normalizeScrollSpeedFactor(
            stored.scrollSpeedFactor
          ),
          ...scrollHotkeys,
          isPlayPauseWheelEnabled:
            stored.isPlayPauseWheelEnabled ??
            DEFAULT_SETTINGS.isPlayPauseWheelEnabled,
          showTimelineOnHover:
            stored.showTimelineOnHover ?? DEFAULT_SETTINGS.showTimelineOnHover,
          isTimelineSeekingEnabled:
            migratedSeekSettings.isTimelineSeekingEnabled,
          dragVideoToSeek: migratedSeekSettings.dragVideoToSeek,
          hideVideoControls: migratedSeekSettings.hideVideoControls,
          colorizedTimeline:
            stored.colorizedTimeline ?? DEFAULT_SETTINGS.colorizedTimeline,
          instagramPlaybackSpeed: normalizeInstagramSpeed(
            stored.instagramPlaybackSpeed
          ),
          instagramAutoSkip: stored.instagramAutoSkip === true,
          instagramShowPlaybackSpeed:
            stored.instagramShowPlaybackSpeed ??
            DEFAULT_SETTINGS.instagramShowPlaybackSpeed,
          instagramShowAutoSkip:
            stored.instagramShowAutoSkip ??
            DEFAULT_SETTINGS.instagramShowAutoSkip,
          tiktokPlaybackSpeed: normalizeTikTokSpeed(stored.tiktokPlaybackSpeed),
          tiktokAutoSkip: stored.tiktokAutoSkip === true,
          tiktokShowPlaybackSpeed:
            stored.tiktokShowPlaybackSpeed ??
            DEFAULT_SETTINGS.tiktokShowPlaybackSpeed,
          tiktokShowAutoSkip:
            stored.tiktokShowAutoSkip ?? DEFAULT_SETTINGS.tiktokShowAutoSkip,
          isYouTubeChapteredTimelineEnabled:
            stored.isYouTubeChapteredTimelineEnabled ??
            DEFAULT_SETTINGS.isYouTubeChapteredTimelineEnabled,
          isSeekbarThumbnailPreviewEnabled:
            stored.isSeekbarThumbnailPreviewEnabled ??
            DEFAULT_SETTINGS.isSeekbarThumbnailPreviewEnabled,
          timelinePosition:
            stored.timelinePosition ?? DEFAULT_SETTINGS.timelinePosition,
          timelineHeight:
            stored.timelineHeight ?? DEFAULT_SETTINGS.timelineHeight,
          timelineHeightUnit:
            stored.timelineHeightUnit ?? DEFAULT_SETTINGS.timelineHeightUnit,
          actionArea: stored.actionArea ?? DEFAULT_SETTINGS.actionArea,
          actionAreaSize:
            stored.actionAreaSize ?? DEFAULT_SETTINGS.actionAreaSize,
          actionAreaSizeUnit:
            stored.actionAreaSizeUnit ?? DEFAULT_SETTINGS.actionAreaSizeUnit,
          domainRules: finalRules,
          domainSort: normalizeDomainSort(stored.domainSort),
        });
      }
    );
  });
};

export const saveSettings = (settings: Partial<PopupSettings>) => {
  chrome.storage.sync.set(settings);
};

export const subscribeToEnabledChanges = (
  onChange: (isEnabled: boolean) => void
) => {
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName
  ) => {
    const nextIsEnabled = changes.isEnabled?.newValue;

    if (areaName === 'sync' && typeof nextIsEnabled === 'boolean') {
      onChange(nextIsEnabled);
    }
  };

  chrome.storage.onChanged.addListener(handleStorageChange);

  return () => chrome.storage.onChanged.removeListener(handleStorageChange);
};

export const sendMessageToCurrentTab = (message: Record<string, unknown>) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
};

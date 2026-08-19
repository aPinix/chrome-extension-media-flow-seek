import {
  getDefaultDomainRules,
  mergeAndMigrateDomainRules,
} from '@/helpers/domains';
import {
  DEFAULT_FAST_SCROLL_HOTKEY,
  DEFAULT_SLOW_SCROLL_HOTKEY,
  normalizeScrollHotkeys,
  type ScrollHotkeyT,
} from '@/helpers/scroll-speed';
import type { DomainConfigT } from '@/types/domains';

export type PopupSettings = {
  isEnabled: boolean;
  isDebugEnabled: boolean;
  isBetaFeaturesEnabled: boolean;
  invertHorizontalScroll: boolean;
  fastScrollHotkey: ScrollHotkeyT;
  slowScrollHotkey: ScrollHotkeyT;
  showTimelineOnHover: boolean;
  isTimelineSeekingEnabled: boolean;
  dragVideoToSeek: boolean;
  hideVideoControls: boolean;
  colorizedTimeline: boolean;
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
  isBetaFeaturesEnabled: true,
  invertHorizontalScroll: false,
  fastScrollHotkey: DEFAULT_FAST_SCROLL_HOTKEY,
  slowScrollHotkey: DEFAULT_SLOW_SCROLL_HOTKEY,
  showTimelineOnHover: false,
  isTimelineSeekingEnabled: true,
  dragVideoToSeek: false,
  hideVideoControls: false,
  colorizedTimeline: false,
  timelinePosition: 'bottom',
  timelineHeight: 6,
  timelineHeightUnit: 'px',
  actionArea: 'full',
  actionAreaSize: 30,
};

export const mergeDomainRules = (
  existingRules: DomainConfigT[]
): DomainConfigT[] => mergeAndMigrateDomainRules(existingRules);

export const loadPopupSettings = (): Promise<PopupSettings> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        'isEnabled',
        'isDebugEnabled',
        'isBetaFeaturesEnabled',
        'invertHorizontalScroll',
        'fastScrollHotkey',
        'slowScrollHotkey',
        'showTimelineOnHover',
        'isTimelineSeekingEnabled',
        'dragVideoToSeek',
        'hideVideoControls',
        'colorizedTimeline',
        'timelinePosition',
        'timelineHeight',
        'timelineHeightUnit',
        'actionArea',
        'actionAreaSize',
        'domainRules',
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

        // Save added defaults and the one-time YouTube-only default migration.
        if (
          existingRules &&
          JSON.stringify(finalRules) !== JSON.stringify(existingRules)
        ) {
          chrome.storage.sync.set({ domainRules: finalRules });
        }

        resolve({
          isEnabled: stored.isEnabled ?? DEFAULT_SETTINGS.isEnabled,
          isDebugEnabled:
            stored.isDebugEnabled ?? DEFAULT_SETTINGS.isDebugEnabled,
          isBetaFeaturesEnabled:
            stored.isBetaFeaturesEnabled ??
            DEFAULT_SETTINGS.isBetaFeaturesEnabled,
          invertHorizontalScroll:
            stored.invertHorizontalScroll ??
            DEFAULT_SETTINGS.invertHorizontalScroll,
          ...scrollHotkeys,
          showTimelineOnHover:
            stored.showTimelineOnHover ?? DEFAULT_SETTINGS.showTimelineOnHover,
          isTimelineSeekingEnabled:
            stored.isTimelineSeekingEnabled ??
            DEFAULT_SETTINGS.isTimelineSeekingEnabled,
          dragVideoToSeek:
            stored.dragVideoToSeek ?? DEFAULT_SETTINGS.dragVideoToSeek,
          hideVideoControls:
            stored.hideVideoControls ?? DEFAULT_SETTINGS.hideVideoControls,
          colorizedTimeline:
            stored.colorizedTimeline ?? DEFAULT_SETTINGS.colorizedTimeline,
          timelinePosition:
            stored.timelinePosition ?? DEFAULT_SETTINGS.timelinePosition,
          timelineHeight:
            stored.timelineHeight ?? DEFAULT_SETTINGS.timelineHeight,
          timelineHeightUnit:
            stored.timelineHeightUnit ?? DEFAULT_SETTINGS.timelineHeightUnit,
          actionArea: stored.actionArea ?? DEFAULT_SETTINGS.actionArea,
          actionAreaSize:
            stored.actionAreaSize ?? DEFAULT_SETTINGS.actionAreaSize,
          domainRules: finalRules,
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

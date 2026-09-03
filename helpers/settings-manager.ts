import { IS_DEVELOPMENT } from '@/config/variables.config';
import {
  doesSiteRuleMatchUrl,
  getDefaultDomainRules,
  mergeAndMigrateDomainRules,
} from '@/helpers/domains';
import { DEFAULT_SETTINGS } from '@/helpers/popup-storage';
import {
  normalizeScrollHotkeys,
  normalizeScrollSpeedFactor,
} from '@/helpers/scroll-speed';
import { migrateSeekSettings } from '@/helpers/settings-migration';
import type { ContentSettingsT } from '@/types/content';
import type { DomainConfigT } from '@/types/domains';
import { DomainRuleTypeE } from '@/types/domains';

export class SettingsManager {
  private settings: ContentSettingsT;
  private readonly defaultSettings: ContentSettingsT = {
    ...DEFAULT_SETTINGS,
    domainRules: getDefaultDomainRules(),
  };

  constructor() {
    this.settings = { ...this.defaultSettings };
  }

  async initialize(): Promise<ContentSettingsT> {
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
          'isYouTubeChapteredTimelineEnabled',
          'isSeekbarThumbnailPreviewEnabled',
          'timelinePosition',
          'timelineHeight',
          'timelineHeightUnit',
          'actionArea',
          'actionAreaSize',
          'actionAreaSizeUnit',
          'domainRules',
        ],
        (result) => {
          const stored = result as Partial<ContentSettingsT>;
          const scrollHotkeys = normalizeScrollHotkeys(
            stored.fastScrollHotkey,
            stored.slowScrollHotkey
          );
          const migratedSeekSettings = migrateSeekSettings(stored, {
            isScrollSeekingEnabled: this.defaultSettings.isScrollSeekingEnabled,
            isTimelineSeekingEnabled:
              this.defaultSettings.isTimelineSeekingEnabled,
            dragVideoToSeek: this.defaultSettings.dragVideoToSeek,
            hideVideoControls: this.defaultSettings.hideVideoControls,
          });
          this.settings = {
            settingsSchemaVersion: migratedSeekSettings.settingsSchemaVersion,
            isEnabled: stored.isEnabled ?? this.defaultSettings.isEnabled,
            isDebugEnabled:
              stored.isDebugEnabled ?? this.defaultSettings.isDebugEnabled,
            isBetaFeaturesEnabled:
              stored.isBetaFeaturesEnabled ??
              this.defaultSettings.isBetaFeaturesEnabled,
            isScrollSeekingEnabled: migratedSeekSettings.isScrollSeekingEnabled,
            invertHorizontalScroll:
              stored.invertHorizontalScroll ??
              this.defaultSettings.invertHorizontalScroll,
            scrollSpeedFactor: normalizeScrollSpeedFactor(
              stored.scrollSpeedFactor
            ),
            ...scrollHotkeys,
            isPlayPauseWheelEnabled:
              stored.isPlayPauseWheelEnabled ??
              this.defaultSettings.isPlayPauseWheelEnabled,
            showTimelineOnHover:
              stored.showTimelineOnHover ??
              this.defaultSettings.showTimelineOnHover,
            isTimelineSeekingEnabled:
              migratedSeekSettings.isTimelineSeekingEnabled,
            dragVideoToSeek: migratedSeekSettings.dragVideoToSeek,
            hideVideoControls: migratedSeekSettings.hideVideoControls,
            colorizedTimeline:
              stored.colorizedTimeline ??
              this.defaultSettings.colorizedTimeline,
            isYouTubeChapteredTimelineEnabled:
              stored.isYouTubeChapteredTimelineEnabled ??
              this.defaultSettings.isYouTubeChapteredTimelineEnabled,
            isSeekbarThumbnailPreviewEnabled:
              stored.isSeekbarThumbnailPreviewEnabled ??
              this.defaultSettings.isSeekbarThumbnailPreviewEnabled,
            timelinePosition:
              stored.timelinePosition ?? this.defaultSettings.timelinePosition,
            timelineHeight:
              stored.timelineHeight ?? this.defaultSettings.timelineHeight,
            timelineHeightUnit:
              stored.timelineHeightUnit ??
              this.defaultSettings.timelineHeightUnit,
            actionArea: stored.actionArea ?? this.defaultSettings.actionArea,
            actionAreaSize:
              stored.actionAreaSize ?? this.defaultSettings.actionAreaSize,
            actionAreaSizeUnit:
              stored.actionAreaSizeUnit ??
              this.defaultSettings.actionAreaSizeUnit,
            domainRules: stored.domainRules
              ? mergeAndMigrateDomainRules(stored.domainRules)
              : this.defaultSettings.domainRules,
          };

          if (
            stored.domainRules &&
            JSON.stringify(stored.domainRules) !==
              JSON.stringify(this.settings.domainRules)
          ) {
            chrome.storage.sync.set({ domainRules: this.settings.domainRules });
          }

          if (migratedSeekSettings.didMigrate) {
            chrome.storage.sync.set({
              settingsSchemaVersion: migratedSeekSettings.settingsSchemaVersion,
              isScrollSeekingEnabled:
                migratedSeekSettings.isScrollSeekingEnabled,
              isTimelineSeekingEnabled:
                migratedSeekSettings.isTimelineSeekingEnabled,
              dragVideoToSeek: migratedSeekSettings.dragVideoToSeek,
              hideVideoControls: migratedSeekSettings.hideVideoControls,
            });
          }

          resolve(this.settings);
        }
      );
    });
  }

  getSettings(): ContentSettingsT {
    return { ...this.settings };
  }

  updateSetting<K extends keyof ContentSettingsT>(
    key: K,
    value: ContentSettingsT[K]
  ): void {
    this.settings[key] = value;
  }

  isEnabled(): boolean {
    return this.settings.isEnabled;
  }

  isDebugEnabled(): boolean {
    return IS_DEVELOPMENT && this.settings.isDebugEnabled;
  }

  isBetaFeaturesEnabled(): boolean {
    return this.settings.isBetaFeaturesEnabled;
  }

  isScrollSeekingEnabled(): boolean {
    return this.settings.isScrollSeekingEnabled;
  }

  shouldInvertHorizontalScroll(): boolean {
    return this.settings.invertHorizontalScroll;
  }

  getScrollSpeedFactor(): number {
    return this.settings.scrollSpeedFactor;
  }

  getFastScrollHotkey(): ContentSettingsT['fastScrollHotkey'] {
    return this.settings.fastScrollHotkey;
  }

  getSlowScrollHotkey(): ContentSettingsT['slowScrollHotkey'] {
    return this.settings.slowScrollHotkey;
  }

  isPlayPauseWheelEnabled(): boolean {
    return (
      this.settings.isScrollSeekingEnabled &&
      this.settings.isPlayPauseWheelEnabled
    );
  }

  shouldShowTimelineOnHover(): boolean {
    return (
      this.settings.showTimelineOnHover ||
      this.settings.isTimelineSeekingEnabled ||
      this.settings.isSeekbarThumbnailPreviewEnabled
    );
  }

  isTimelineSeekingEnabled(): boolean {
    return this.settings.isTimelineSeekingEnabled;
  }

  shouldDragVideoToSeek(): boolean {
    return this.settings.dragVideoToSeek;
  }

  shouldHideVideoControls(): boolean {
    return this.settings.hideVideoControls;
  }

  hasActiveVideoFeatures(): boolean {
    return (
      this.settings.isScrollSeekingEnabled ||
      this.settings.dragVideoToSeek ||
      this.settings.isTimelineSeekingEnabled ||
      this.settings.showTimelineOnHover ||
      this.settings.isSeekbarThumbnailPreviewEnabled ||
      this.settings.hideVideoControls
    );
  }

  shouldColorizeTimeline(): boolean {
    return this.settings.colorizedTimeline;
  }

  isYouTubeChapteredTimelineEnabled(): boolean {
    return this.settings.isYouTubeChapteredTimelineEnabled;
  }

  isSeekbarThumbnailPreviewEnabled(): boolean {
    return this.settings.isSeekbarThumbnailPreviewEnabled;
  }

  getTimelinePosition(): 'top' | 'bottom' {
    return this.settings.timelinePosition;
  }

  getTimelineHeight(): number {
    return this.settings.timelineHeight;
  }

  getTimelineHeightUnit(): 'px' | '%' {
    return this.settings.timelineHeightUnit;
  }

  getActionArea(): 'full' | 'top' | 'middle' | 'bottom' {
    return this.settings.actionArea;
  }

  getActionAreaSize(): number {
    return this.settings.actionAreaSize;
  }

  getActionAreaSizeUnit(): 'px' | '%' {
    return this.settings.actionAreaSizeUnit;
  }

  getDomainRules(): DomainConfigT[] {
    return this.settings.domainRules;
  }

  // Check if current domain should run the extension
  shouldRun(): boolean {
    if (!this.settings.isEnabled || !this.hasActiveVideoFeatures()) {
      return false;
    }

    let shouldRunDomain = false;
    const currentUrl = new URL(window.location.href);

    // Filter enabled rules, but always include global rule
    const enabledRules = this.settings.domainRules.filter(
      (rule) => rule.domain === '*' || rule.enabled
    );

    // Sort by specificity (page paths first, wildcard last)
    const sortedRules = [...enabledRules].sort((a, b) => {
      if (a.domain === '*') return 1;
      if (b.domain === '*') return -1;
      return b.domain.length - a.domain.length;
    });

    // Check rules in order of specificity
    for (const rule of sortedRules) {
      if (rule.domain === '*') {
        // Wildcard rule applies to all domains
        shouldRunDomain = rule.type === DomainRuleTypeE.Whitelist;
      } else {
        if (doesSiteRuleMatchUrl(rule.domain, currentUrl)) {
          // Specific domain rule takes precedence
          shouldRunDomain = rule.type === DomainRuleTypeE.Whitelist;
          break;
        }
      }
    }

    return shouldRunDomain;
  }
}

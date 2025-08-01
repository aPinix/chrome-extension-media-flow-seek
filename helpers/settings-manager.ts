import { getDefaultDomainRules } from '@/helpers/domains';
import { ContentSettingsT } from '@/types/content';
import { DomainConfigT, DomainRuleTypeE } from '@/types/domains';

export class SettingsManager {
  private settings: ContentSettingsT;
  private readonly defaultSettings: ContentSettingsT = {
    isEnabled: true,
    isDebugEnabled: false,
    invertHorizontalScroll: false,
    showTimelineOnHover: false,
    timelinePosition: 'bottom',
    timelineHeight: 6,
    timelineHeightUnit: 'px',
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
          'isDebugEnabled',
          'invertHorizontalScroll',
          'showTimelineOnHover',
          'timelinePosition',
          'timelineHeight',
          'timelineHeightUnit',
          'domainRules',
        ],
        (result) => {
          this.settings = {
            isEnabled: result.isEnabled ?? this.defaultSettings.isEnabled,
            isDebugEnabled:
              result.isDebugEnabled ?? this.defaultSettings.isDebugEnabled,
            invertHorizontalScroll:
              result.invertHorizontalScroll ??
              this.defaultSettings.invertHorizontalScroll,
            showTimelineOnHover:
              result.showTimelineOnHover ??
              this.defaultSettings.showTimelineOnHover,
            timelinePosition:
              result.timelinePosition ?? this.defaultSettings.timelinePosition,
            timelineHeight:
              result.timelineHeight ?? this.defaultSettings.timelineHeight,
            timelineHeightUnit:
              result.timelineHeightUnit ??
              this.defaultSettings.timelineHeightUnit,
            domainRules: result.domainRules
              ? this.mergeDomainRules(result.domainRules)
              : this.defaultSettings.domainRules,
          };

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
    return this.settings.isDebugEnabled;
  }

  shouldInvertHorizontalScroll(): boolean {
    return this.settings.invertHorizontalScroll;
  }

  shouldShowTimelineOnHover(): boolean {
    return this.settings.showTimelineOnHover;
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

  getDomainRules(): DomainConfigT[] {
    return this.settings.domainRules;
  }

  // Check if current domain should run the extension
  shouldRun(): boolean {
    if (!this.settings.isEnabled) return false;

    const currentHostname = window.location.hostname.toLowerCase();
    let shouldRunDomain = false;

    // Filter enabled rules, but always include global rule
    const enabledRules = this.settings.domainRules.filter(
      (rule) => rule.domain === '*' || rule.enabled
    );

    // Sort by specificity (specific domains first, wildcard last)
    const sortedRules = [...enabledRules].sort((a, b) => {
      if (a.domain === '*') return 1;
      if (b.domain === '*') return -1;
      return 0;
    });

    // Check rules in order of specificity
    for (const rule of sortedRules) {
      if (rule.domain === '*') {
        // Wildcard rule applies to all domains
        shouldRunDomain = rule.type === DomainRuleTypeE.Whitelist;
      } else {
        const ruleDomain = rule.domain.toLowerCase();

        // Check for exact match or subdomain match
        const isMatch =
          currentHostname === ruleDomain ||
          currentHostname.endsWith('.' + ruleDomain);

        if (isMatch) {
          // Specific domain rule takes precedence
          shouldRunDomain = rule.type === DomainRuleTypeE.Whitelist;
          break;
        }
      }
    }

    return shouldRunDomain;
  }

  // Merge existing rules with new defaults
  private mergeDomainRules(existingRules: DomainConfigT[]): DomainConfigT[] {
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
  }
}

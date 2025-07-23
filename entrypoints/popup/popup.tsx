import { useEffect, useState } from 'react';
import {
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  GlobeIcon,
  GripHorizontalIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { parse } from 'tldts';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type DomainRule = {
  domain: string;
  type: 'whitelist' | 'blacklist';
  enabled: boolean;
};

type CardListItemProps = {
  title: string;
  description: string;
  onClick?: () => void;
  components?: {
    RightSlot?: React.ReactNode;
    BottomSlot?: React.ReactNode;
  };
};

type SectionTitleProps = {
  title: string;
  children?: React.ReactNode;
  className?: string;
};

type DomainListItemProps = {
  rule: DomainRule;
  isGlobal?: boolean;
  isCurrentDomain?: boolean;
  onToggleEnabled?: (domain: string) => void;
  onToggleRuleType: (
    domain: string,
    currentType: 'whitelist' | 'blacklist'
  ) => void;
  onRemove?: (domain: string) => void;
};

const DomainListItem: React.FC<DomainListItemProps> = ({
  rule,
  isGlobal,
  isCurrentDomain,
  onToggleEnabled,
  onToggleRuleType,
  onRemove,
}) => {
  const getTitle = () => {
    if (isGlobal) {
      return 'All Websites (global)';
    }
    return rule.domain;
  };

  const getDescription = () => {
    if (isGlobal) {
      return rule.type === 'whitelist' ? 'Whitelisted' : 'Blacklisted';
    }

    if (!rule.enabled) {
      return 'Rule disabled';
    }

    return rule.type === 'whitelist'
      ? 'Extension enabled'
      : 'Extension disabled';
  };

  return (
    <div className="py-1">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-3 shadow-sm backdrop-blur-sm transition-all hover:shadow-md',
          rule.type === 'whitelist'
            ? 'border-green-200 bg-green-50/80 dark:border-green-800/50 dark:bg-green-900/20'
            : 'border-red-200 bg-red-50/80 dark:border-red-800/50 dark:bg-red-900/20',
          !isGlobal && !rule.enabled && 'opacity-50'
        )}
      >
        {/* Top Row: Switch, Favicon, Title, Delete Button */}
        <div className="flex items-center gap-3">
          {/* Enable/Disable Switch (only for non-global) */}
          {!isGlobal && onToggleEnabled ? (
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => onToggleEnabled(rule.domain)}
            />
          ) : null}

          {/* Domain Favicon */}
          <div className="flex-shrink-0">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800/50">
              {isGlobal ? (
                <GlobeIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${rule.domain}&sz=32`}
                    alt={`${rule.domain} favicon`}
                    className="h-5 w-5 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden">
                    <GlobeIcon className="hidden h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Domain Title */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {getTitle()}
              </span>
              {!isGlobal && isCurrentDomain && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                  Current
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {getDescription()}
            </span>
          </div>

          {/* Delete Button (only for non-global) */}
          {!isGlobal && onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(rule.domain)}
              className="h-8 w-8 p-0 text-red-500 transition-transform hover:scale-110 hover:bg-red-100 dark:hover:bg-red-900/30"
              title="Remove domain"
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {/* Bottom Row: Whitelist/Blacklist Actions */}
        <div className="flex justify-center gap-2">
          {/* Whitelist Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rule.type !== 'whitelist') {
                onToggleRuleType(rule.domain, rule.type);
              }
            }}
            disabled={!isGlobal && !rule.enabled}
            className={cn(
              'h-8 px-4 text-xs font-medium transition-all',
              rule.type === 'whitelist'
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                : 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-300'
            )}
            title="Set to whitelist (enable extension)"
          >
            <CheckIcon className="mr-1 h-3 w-3" />
            Whitelist
          </Button>

          {/* Blacklist Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rule.type !== 'blacklist') {
                onToggleRuleType(rule.domain, rule.type);
              }
            }}
            disabled={!isGlobal && !rule.enabled}
            className={cn(
              'h-8 px-4 text-xs font-medium transition-all',
              rule.type === 'blacklist'
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
                : 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300'
            )}
            title="Set to blacklist (disable extension)"
          >
            <XIcon className="mr-1 h-3 w-3" />
            Blacklist
          </Button>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  children,
  className,
}) => {
  return (
    <div className={cn('flex h-8 items-center justify-between', className)}>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
      {children}
    </div>
  );
};

const CardListItem: React.FC<CardListItemProps> = ({
  title,
  description,
  onClick,
  components,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30',
        onClick && 'cursor-pointer hover:shadow-lg dark:hover:bg-slate-800/80'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {title}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {description}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {components?.RightSlot}
          {onClick ? (
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          ) : null}
        </div>
      </div>
      {components?.BottomSlot ? (
        <div className="mt-4">{components.BottomSlot}</div>
      ) : null}
    </div>
  );
};

function Popup() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [isEnabled, setIsEnabled] = useState(true);
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [domainRules, setDomainRules] = useState<DomainRule[]>([
    { domain: '*', type: 'blacklist', enabled: true },
    { domain: 'youtube.com', type: 'whitelist', enabled: true },
    { domain: 'vimeo.com', type: 'whitelist', enabled: false },
    { domain: 'dailymotion.com', type: 'whitelist', enabled: false },
    { domain: 'twitch.tv', type: 'whitelist', enabled: false },
    { domain: 'tiktok.com', type: 'whitelist', enabled: false },
    { domain: 'instagram.com', type: 'whitelist', enabled: false },
    { domain: 'facebook.com', type: 'whitelist', enabled: false },
    { domain: 'x.com', type: 'whitelist', enabled: false },
  ]);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showDomainsView, setShowDomainsView] = useState(false);

  const MIN_TIMELINE_HEIGHT = 0;
  const MAX_TIMELINE_HEIGHT = 100;
  const timelineDefaultHeight = 6;
  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);

  // Check if current settings differ from defaults (excluding domains)
  const isAtDefaults =
    isEnabled === true &&
    invertHorizontalScroll === false &&
    showTimelineOnHover === false &&
    timelineHeight === timelineDefaultHeight;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Get current tab domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const url = new URL(tabs[0].url);

        // Extract just the main domain using tldts
        const parsed = parse(url.hostname);
        const domain = parsed.domain || url.hostname;

        setCurrentDomain(domain);
      }
    });

    // Default domain rules
    const getDefaultDomainRules = (): DomainRule[] => [
      { domain: '*', type: 'blacklist', enabled: true },
      { domain: 'youtube.com', type: 'whitelist', enabled: true },
      { domain: 'vimeo.com', type: 'whitelist', enabled: false },
      { domain: 'dailymotion.com', type: 'whitelist', enabled: false },
      { domain: 'twitch.tv', type: 'whitelist', enabled: false },
      { domain: 'tiktok.com', type: 'whitelist', enabled: false },
      { domain: 'instagram.com', type: 'whitelist', enabled: false },
      { domain: 'facebook.com', type: 'whitelist', enabled: false },
      { domain: 'x.com', type: 'whitelist', enabled: false },
    ];

    // Merge existing rules with new defaults
    const mergeDomainRules = (existingRules: DomainRule[]): DomainRule[] => {
      const defaults = getDefaultDomainRules();
      const merged = [...existingRules];

      // Add any missing default domains
      defaults.forEach((defaultRule) => {
        const exists = merged.find(
          (rule) => rule.domain === defaultRule.domain
        );
        if (!exists) {
          merged.push(defaultRule);
        }
      });

      return merged;
    };

    // Load saved settings
    chrome.storage.sync.get(
      [
        'isEnabled',
        'invertHorizontalScroll',
        'showTimelineOnHover',
        'timelineHeight',
        'domainRules',
      ],
      (result) => {
        setIsEnabled(result.isEnabled ?? true);
        setInvertHorizontalScroll(result.invertHorizontalScroll ?? false);
        setShowTimelineOnHover(result.showTimelineOnHover ?? false);
        setTimelineHeight(result.timelineHeight ?? timelineDefaultHeight);

        const existingRules = result.domainRules as DomainRule[] | undefined;
        const finalRules = existingRules
          ? mergeDomainRules(existingRules)
          : getDefaultDomainRules();

        setDomainRules(finalRules);

        // Save merged rules back to storage if we added new ones
        if (existingRules && finalRules.length !== existingRules.length) {
          chrome.storage.sync.set({ domainRules: finalRules });
        }
      }
    );
  }, []);

  const updateDomainRules = (newRules: DomainRule[]) => {
    setDomainRules(newRules);
    chrome.storage.sync.set({ domainRules: newRules });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateDomainRules',
          domainRules: newRules,
        });
      }
    });
  };

  const handleEnabledToggle = (checked: boolean) => {
    setIsEnabled(checked);
    chrome.storage.sync.set({ isEnabled: checked });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateEnabled',
          isEnabled: checked,
        });
      }
    });
  };

  const handleScrollInversionToggle = (checked: boolean) => {
    setInvertHorizontalScroll(checked);
    chrome.storage.sync.set({ invertHorizontalScroll: checked });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateScrollInversion',
          invertHorizontalScroll: checked,
        });
      }
    });
  };

  const handleTimelineHoverToggle = (checked: boolean) => {
    setShowTimelineOnHover(checked);
    chrome.storage.sync.set({ showTimelineOnHover: checked });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTimelineHover',
          showTimelineOnHover: checked,
        });
      }
    });
  };

  const handleTimelineHeightChange = (value: number[]) => {
    const height = value[0];
    setTimelineHeight(height);
    chrome.storage.sync.set({ timelineHeight: height });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTimelineHeight',
          timelineHeight: height,
        });
      }
    });
  };

  const handleResetDefaults = () => {
    const defaultSettings = {
      isEnabled: true,
      invertHorizontalScroll: false,
      showTimelineOnHover: false,
      timelineHeight: timelineDefaultHeight,
    };

    setIsEnabled(defaultSettings.isEnabled);
    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setTimelineHeight(defaultSettings.timelineHeight);

    chrome.storage.sync.set(defaultSettings);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateEnabled',
          isEnabled: defaultSettings.isEnabled,
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateScrollInversion',
          invertHorizontalScroll: defaultSettings.invertHorizontalScroll,
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTimelineHover',
          showTimelineOnHover: defaultSettings.showTimelineOnHover,
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTimelineHeight',
          timelineHeight: defaultSettings.timelineHeight,
        });
      }
    });
  };

  const addCurrentDomainRule = (type: 'whitelist' | 'blacklist') => {
    if (!currentDomain) return;

    const newRules = domainRules.filter(
      (rule) => rule.domain !== currentDomain
    );
    newRules.push({ domain: currentDomain, type, enabled: true });
    updateDomainRules(newRules);
  };

  const toggleDomainRule = (
    domain: string,
    currentType: 'whitelist' | 'blacklist'
  ) => {
    const newType = currentType === 'whitelist' ? 'blacklist' : 'whitelist';
    const newRules = domainRules.map((rule) =>
      rule.domain === domain ? { ...rule, type: newType } : rule
    ) as DomainRule[];
    updateDomainRules(newRules);
  };

  const toggleDomainEnabled = (domain: string) => {
    const newRules = domainRules.map((rule) =>
      rule.domain === domain ? { ...rule, enabled: !rule.enabled } : rule
    ) as DomainRule[];
    updateDomainRules(newRules);
  };

  const removeDomainRule = (domain: string) => {
    if (domain === '*') return; // Don't allow removing wildcard
    const newRules = domainRules.filter((rule) => rule.domain !== domain);
    updateDomainRules(newRules);
  };

  const getCurrentDomainRule = () => {
    return domainRules.find((rule) => rule.domain === currentDomain);
  };

  return (
    <div className={cn(isDark && 'dark')}>
      <div
        className={`relative flex h-[600px] w-[400px] flex-col overflow-hidden bg-slate-100 shadow-xl dark:bg-slate-700`}
      >
        {/* Main View */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out',
            showDomainsView ? '-translate-x-full' : 'translate-x-0'
          )}
        >
          {/* Fixed Header */}
          <div className="flex-none border-b border-slate-200/60 bg-white/90 p-6 backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/90">
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center gap-3">
                <img
                  src="/icon/48.png"
                  alt="Media Flow Seek"
                  className="h-8 w-8"
                />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Media Flow Seek
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Enhanced video controls & scrolling
              </p>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="flex flex-col gap-6 p-6">
              {/* Extension Section */}
              <div className="flex flex-none flex-col">
                <SectionTitle title="Extension" />
                <CardListItem
                  title="Enabled"
                  description="Enable or disable the extension"
                  components={{
                    RightSlot: (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={handleEnabledToggle}
                      />
                    ),
                  }}
                />
              </div>

              {/* Settings Section */}
              <div className="flex flex-none flex-col">
                <SectionTitle title="Settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isAtDefaults}
                    onClick={handleResetDefaults}
                    className={cn(
                      'h-7 px-3 text-xs font-medium transition-all',
                      isAtDefaults
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
                    )}
                  >
                    Reset Default
                  </Button>
                </SectionTitle>

                <div
                  className={cn(
                    'flex flex-col gap-4',
                    !isEnabled && 'pointer-events-none opacity-50'
                  )}
                >
                  <CardListItem
                    title="Invert horizontal scroll"
                    description="Reverse scroll direction for better control"
                    components={{
                      RightSlot: (
                        <Switch
                          checked={invertHorizontalScroll}
                          onCheckedChange={handleScrollInversionToggle}
                        />
                      ),
                    }}
                  />

                  <CardListItem
                    title="Show timeline on hover"
                    description="Display progress bar when hovering over videos"
                    components={{
                      RightSlot: (
                        <Switch
                          checked={showTimelineOnHover}
                          onCheckedChange={handleTimelineHoverToggle}
                        />
                      ),
                    }}
                  />

                  <CardListItem
                    title="Timeline height"
                    description="Adjust the height of the progress bar"
                    components={{
                      BottomSlot: (
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[timelineHeight]}
                            onValueChange={handleTimelineHeightChange}
                            min={MIN_TIMELINE_HEIGHT}
                            max={MAX_TIMELINE_HEIGHT}
                            className="flex-1"
                          />
                          <span className="w-8 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {timelineHeight}px
                          </span>
                        </div>
                      ),
                    }}
                  />
                </div>
              </div>

              {/* Domains Section */}
              <div className="flex flex-1 flex-col">
                <SectionTitle title="Domains" />
                <CardListItem
                  title="Domain Management"
                  description="Manage where the extension works"
                  onClick={() => setShowDomainsView(true)}
                />
              </div>
            </div>
          </ScrollArea>

          {/* Fixed Footer */}
          <div className="flex-none border-t border-slate-200/60 bg-white/90 p-4 backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/90">
            <div className="text-center text-xs text-slate-600 dark:text-slate-300">
              Made with ❤️ by{' '}
              <a
                href="https://www.linkedin.com/in/pinix/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-600 transition-all duration-200 hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
              >
                aPinix
              </a>{' '}
              (
              <a
                href="https://github.com/aPinix"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-600 transition-all duration-200 hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
              >
                GitHub
              </a>
              )
            </div>
          </div>
        </div>

        {/* Domains View */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out',
            showDomainsView ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          {/* Domains Header */}
          <div className="flex flex-col gap-4 border-b border-slate-200/60 bg-white/90 p-3 backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/90">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDomainsView(false)}
                className="p-1"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </Button>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Domain Management
              </h2>
            </div>

            {/* Quick Actions */}
            {currentDomain ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/95 to-slate-50/95 p-5 shadow-lg backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-800/95 dark:to-slate-900/95 dark:shadow-slate-900/20">
                {/* Domain Header */}
                <div className="mb-4 text-center">
                  <div className="mb-2 inline-flex items-center gap-3 rounded-full bg-white/60 px-4 py-2 shadow-sm ring-1 ring-slate-200/40 dark:bg-slate-800/60 dark:ring-slate-700/40">
                    <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm dark:bg-slate-700">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${currentDomain}&sz=32`}
                        alt={`${currentDomain} favicon`}
                        className="h-4 w-4 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback =
                            target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="hidden">
                        <GlobeIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {currentDomain}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Choose how the extension should behave on this domain
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {!getCurrentDomainRule() ||
                  getCurrentDomainRule()?.type !== 'whitelist' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addCurrentDomainRule('whitelist')}
                      className={cn(
                        'group relative flex-1 overflow-hidden rounded-xl border border-green-200/50 bg-gradient-to-r from-green-50 to-green-100/80 px-4 py-3 text-sm font-semibold text-green-700 shadow-sm transition-all duration-200 hover:from-green-100 hover:to-green-200/90 hover:shadow-md active:scale-95 dark:border-green-800/30 dark:from-green-900/30 dark:to-green-800/40 dark:text-green-300 dark:hover:from-green-900/50 dark:hover:to-green-800/60'
                      )}
                    >
                      <CheckIcon className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                      Whitelist
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-white/10" />
                    </Button>
                  ) : null}

                  {!getCurrentDomainRule() ||
                  getCurrentDomainRule()?.type !== 'blacklist' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addCurrentDomainRule('blacklist')}
                      className={cn(
                        'group relative flex-1 overflow-hidden rounded-xl border border-red-200/50 bg-gradient-to-r from-red-50 to-red-100/80 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm transition-all duration-200 hover:from-red-100 hover:to-red-200/90 hover:shadow-md active:scale-95 dark:border-red-800/30 dark:from-red-900/30 dark:to-red-800/40 dark:text-red-300 dark:hover:from-red-900/50 dark:hover:to-red-800/60'
                      )}
                    >
                      <XIcon className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                      Blacklist
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-white/10" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Domains List */}
          <div className="flex-1 overflow-hidden">
            <GroupedVirtuoso
              className="flex-1 [&_[data-testid='virtuoso-item-list']]:p-4 [&_[data-testid='virtuoso-top-item-list']]:px-4"
              groupCounts={(() => {
                const globalRule = domainRules.find(
                  (rule) => rule.domain === '*'
                );
                const regularDomains = domainRules.filter(
                  (rule) => rule.domain !== '*'
                );
                return globalRule
                  ? [1, regularDomains.length]
                  : [0, regularDomains.length];
              })()}
              groupContent={(index) => (
                <SectionTitle
                  title={index === 0 ? 'Global' : 'Domains'}
                  className="bg-slate-100 py-2 dark:bg-slate-700"
                />
              )}
              itemContent={(index) => {
                const globalRule = domainRules.find(
                  (rule) => rule.domain === '*'
                );
                const regularDomains = domainRules.filter(
                  (rule) => rule.domain !== '*'
                );

                // Determine if this is a global item or regular domain item
                const isGlobalItem = globalRule && index === 0;
                const rule = isGlobalItem
                  ? globalRule
                  : regularDomains[globalRule ? index - 1 : index];

                if (!rule) return null;

                return (
                  <DomainListItem
                    rule={rule}
                    isGlobal={isGlobalItem}
                    isCurrentDomain={rule.domain === currentDomain}
                    onToggleEnabled={
                      !isGlobalItem ? toggleDomainEnabled : undefined
                    }
                    onToggleRuleType={toggleDomainRule}
                    onRemove={!isGlobalItem ? removeDomainRule : undefined}
                  />
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Popup;

import { useEffect, useState } from 'react';
import { CheckIcon, ChevronLeft, GlobeIcon, XIcon } from 'lucide-react';
import { GroupedVirtuoso } from 'react-virtuoso';

import { CardListItem } from '@/components/popup/card-list-item';
import { DomainListItem } from '@/components/popup/domain-list-item';
import { SectionTitle } from '@/components/popup/section-title';
import { useTheme } from '@/components/theme-provider';
import { TimelineHeightControl } from '@/components/timeline-height-control';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  type PopupSettings,
  saveSettings,
  sendMessageToCurrentTab,
} from '@/helpers/popup-storage';
import {
  checkIsAtDefaults,
  findCurrentDomainRule,
  getCurrentDomain,
} from '@/lib/popup-utils';
import { cn } from '@/lib/utils';
import {
  DomainConfigT,
  DomainRuleTypeE,
  DomainRuleTypeT,
} from '@/types/domains';

const SHOW_DEBUG_CARD = false;
const YOUTUBE_ONLY = true;

export function PopupContent() {
  const { theme } = useTheme();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState<'top' | 'bottom'>(
    'bottom'
  );
  const [domainRules, setDomainRules] = useState<DomainConfigT[]>([]);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showDomainsView, setShowDomainsView] = useState(false);

  const timelineDefaultHeight = DEFAULT_SETTINGS.timelineHeight;
  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);
  const [timelineHeightUnit, setTimelineHeightUnit] = useState<'px' | '%'>(
    'px'
  );

  // Check if current settings differ from defaults (excluding domains)
  const isAtDefaults = checkIsAtDefaults(
    isEnabled,
    isDebugEnabled,
    invertHorizontalScroll,
    showTimelineOnHover,
    timelinePosition,
    timelineHeight
  );

  useEffect(() => {
    // Get current tab domain
    getCurrentDomain().then(setCurrentDomain);

    // Load saved settings
    loadPopupSettings().then((settings: PopupSettings) => {
      setIsEnabled(settings.isEnabled);
      setIsDebugEnabled(settings.isDebugEnabled);
      setInvertHorizontalScroll(settings.invertHorizontalScroll);
      setShowTimelineOnHover(settings.showTimelineOnHover);
      setTimelinePosition(settings.timelinePosition);
      setTimelineHeight(settings.timelineHeight);
      setTimelineHeightUnit(settings.timelineHeightUnit);
      setDomainRules(settings.domainRules);
    });
  }, []);

  const updateDomainRules = (newRules: DomainConfigT[]) => {
    setDomainRules(newRules);
    saveSettings({ domainRules: newRules });
    sendMessageToCurrentTab({
      action: 'updateDomainRules',
      domainRules: newRules,
    });
  };

  const handleEnabledToggle = (checked: boolean) => {
    setIsEnabled(checked);
    saveSettings({ isEnabled: checked });
    sendMessageToCurrentTab({
      action: 'updateEnabled',
      isEnabled: checked,
    });
  };

  const handleDebugToggle = (checked: boolean) => {
    setIsDebugEnabled(checked);
    saveSettings({ isDebugEnabled: checked });
    sendMessageToCurrentTab({
      action: 'updateDebug',
      isDebugEnabled: checked,
    });
  };

  const handleScrollInversionToggle = (checked: boolean) => {
    setInvertHorizontalScroll(checked);
    saveSettings({ invertHorizontalScroll: checked });
    sendMessageToCurrentTab({
      action: 'updateScrollInversion',
      invertHorizontalScroll: checked,
    });
  };

  const handleTimelineHoverToggle = (checked: boolean) => {
    setShowTimelineOnHover(checked);
    saveSettings({ showTimelineOnHover: checked });
    sendMessageToCurrentTab({
      action: 'updateTimelineHover',
      showTimelineOnHover: checked,
    });
  };

  const handleTimelinePositionChange = (position: 'top' | 'bottom') => {
    setTimelinePosition(position);
    saveSettings({ timelinePosition: position });
    sendMessageToCurrentTab({
      action: 'updateTimelinePosition',
      timelinePosition: position,
    });
  };

  const handleTimelineHeightChange = (height: number) => {
    setTimelineHeight(height);
    saveSettings({
      timelineHeight: height,
      timelineHeightUnit,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelineHeight',
      timelineHeight: height,
      timelineHeightUnit,
    });
  };

  const handleTimelineHeightUnitChange = (unit: 'px' | '%') => {
    setTimelineHeightUnit(unit);
    saveSettings({ timelineHeightUnit: unit });
    // Also trigger an update with the current height value
    sendMessageToCurrentTab({
      action: 'updateTimelineHeight',
      timelineHeight,
      timelineHeightUnit: unit,
    });
  };

  const handleResetDefaults = () => {
    const defaultSettings = DEFAULT_SETTINGS;

    setIsEnabled(defaultSettings.isEnabled);
    setIsDebugEnabled(defaultSettings.isDebugEnabled);
    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setTimelinePosition(defaultSettings.timelinePosition);
    setTimelineHeight(defaultSettings.timelineHeight);
    setTimelineHeightUnit(defaultSettings.timelineHeightUnit);

    saveSettings(defaultSettings);

    sendMessageToCurrentTab({
      action: 'updateEnabled',
      isEnabled: defaultSettings.isEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateDebug',
      isDebugEnabled: defaultSettings.isDebugEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollInversion',
      invertHorizontalScroll: defaultSettings.invertHorizontalScroll,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelineHover',
      showTimelineOnHover: defaultSettings.showTimelineOnHover,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelinePosition',
      timelinePosition: defaultSettings.timelinePosition,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelineHeight',
      timelineHeight: defaultSettings.timelineHeight,
      timelineHeightUnit: defaultSettings.timelineHeightUnit,
    });
  };

  const addCurrentDomainRule = (type: DomainRuleTypeT) => {
    if (!currentDomain) return;

    const newRules = domainRules.filter(
      (rule) => rule.domain !== currentDomain
    );
    newRules.push({ domain: currentDomain, type, enabled: true });
    updateDomainRules(newRules);
  };

  const toggleDomainRule = (domain: string, currentType: DomainRuleTypeT) => {
    const newType =
      currentType === DomainRuleTypeE.Whitelist
        ? DomainRuleTypeE.Blacklist
        : DomainRuleTypeE.Whitelist;
    const newRules = domainRules.map((rule) =>
      rule.domain === domain ? { ...rule, type: newType } : rule
    ) as DomainConfigT[];
    updateDomainRules(newRules);
  };

  const toggleDomainEnabled = (domain: string) => {
    const newRules = domainRules.map((rule) =>
      rule.domain === domain ? { ...rule, enabled: !rule.enabled } : rule
    ) as DomainConfigT[];
    updateDomainRules(newRules);
  };

  const removeDomainRule = (domain: string) => {
    if (domain === '*') return; // Don't allow removing wildcard
    const newRules = domainRules.filter((rule) => rule.domain !== domain);
    updateDomainRules(newRules);
  };

  const getCurrentDomainRule = () => {
    return findCurrentDomainRule(domainRules, currentDomain);
  };

  return (
    <div className={cn(theme === 'dark' && 'dark')}>
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
                <a
                  href="https://chromewebstore.google.com/detail/media-flow-seek/phhigkiikolopghmahejjlojejpocagg?authuser=0&hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-bold text-slate-900 no-underline transition-colors duration-200 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
                  title="View Media Flow Seek on Chrome Web Store"
                >
                  Media Flow Seek
                </a>
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
                <div className="flex flex-col gap-4">
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
                  {SHOW_DEBUG_CARD ? (
                    <CardListItem
                      title="Debug"
                      description="Show debug patterns on video overlays"
                      components={{
                        RightSlot: (
                          <Switch
                            checked={isDebugEnabled}
                            onCheckedChange={handleDebugToggle}
                          />
                        ),
                      }}
                    />
                  ) : null}
                </div>
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
                    title="Timeline position"
                    description="Choose where to display the progress bar"
                    components={{
                      RightSlot: (
                        <Select
                          value={timelinePosition}
                          onValueChange={handleTimelinePositionChange}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                          </SelectContent>
                        </Select>
                      ),
                    }}
                  />

                  <CardListItem
                    title="Timeline height"
                    description="Adjust the height of the progress bar"
                    components={{
                      BottomSlot: (
                        <TimelineHeightControl
                          value={timelineHeight}
                          unit={timelineHeightUnit}
                          onChange={handleTimelineHeightChange}
                          onUnitChange={handleTimelineHeightUnitChange}
                        />
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
                  disabled={YOUTUBE_ONLY}
                  description={
                    YOUTUBE_ONLY
                      ? 'YouTube only (for now)'
                      : 'Manage where the extension works'
                  }
                  onClick={() =>
                    YOUTUBE_ONLY ? null : setShowDomainsView(true)
                  }
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
              <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/95 to-slate-50/95 p-5 pt-2 shadow-lg backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-800/95 dark:to-slate-900/95 dark:shadow-slate-900/20">
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

                {/* Action Controls */}
                <div className="flex items-center gap-3">
                  {/* Enable/Disable Switch */}
                  {getCurrentDomainRule() && (
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={getCurrentDomainRule()?.enabled ?? false}
                        onCheckedChange={() =>
                          toggleDomainEnabled(currentDomain)
                        }
                        className="scale-90"
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {getCurrentDomainRule()?.enabled
                          ? 'Enabled'
                          : 'Disabled'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-1 gap-3">
                    {!getCurrentDomainRule() ||
                    getCurrentDomainRule()?.type !==
                      DomainRuleTypeE.Whitelist ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          addCurrentDomainRule(DomainRuleTypeE.Whitelist)
                        }
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
                    getCurrentDomainRule()?.type !==
                      DomainRuleTypeE.Blacklist ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          addCurrentDomainRule(DomainRuleTypeE.Blacklist)
                        }
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
              </div>
            ) : null}
          </div>

          {/* Domains List */}
          <div className="flex-1 overflow-hidden">
            <GroupedVirtuoso
              className="flex-1 [&_[data-testid='virtuoso-item-list']]:p-4 [&_[data-testid='virtuoso-item-list']]:!pb-3 [&_[data-testid='virtuoso-top-item-list']]:px-4"
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

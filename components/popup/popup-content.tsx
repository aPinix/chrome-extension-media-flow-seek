import { useEffect, useState } from 'react';
import {
  BugIcon,
  CheckIcon,
  ChevronLeft,
  EyeIcon,
  EyeOffIcon,
  GithubIcon,
  GlobeIcon,
  KeyboardIcon,
  LinkedinIcon,
  PanelBottomDashedIcon,
  PlayIcon,
  PowerIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SquareDashedIcon,
  TwitterIcon,
  XIcon,
} from 'lucide-react';
import { GroupedVirtuoso } from 'react-virtuoso';

import { ActionAreaSizeControl } from '@/components/action-area-size-control';
import { CardListItem } from '@/components/popup/card-list-item';
import { DomainListItem } from '@/components/popup/domain-list-item';
import { SectionTitle } from '@/components/popup/section-title';
import { TimelineSettings } from '@/components/settings/timeline-settings';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { EXT_URL } from '@/config/variables.config';
import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  saveSettings,
  sendMessageToCurrentTab,
} from '@/helpers/popup-storage';
import {
  checkIsAtDefaults,
  findCurrentDomainRule,
  getCurrentDomain,
} from '@/lib/popup-utils';
import { cn } from '@/lib/utils';
import { getExtensionVersion } from '@/lib/version';
import { ActionAreaE, type ActionAreaT } from '@/types/content';
import {
  type DomainConfigT,
  DomainRuleTypeE,
  type DomainRuleTypeT,
} from '@/types/domains';
import { ShortcutHotkeyStateE } from '@/types/shortcut';

import { VideoPlayerPreview } from '../video-player-preview';

import { CardListItemWrapper } from './card-list-item-wrapper';

export function PopupContent() {
  const { theme } = useTheme();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isBetaFeaturesEnabled, setIsBetaFeaturesEnabled] = useState(false);
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState<'top' | 'bottom'>(
    'bottom'
  );
  const [toggleShortcut, setToggleShortcut] = useState<string>('');
  const [domainRules, setDomainRules] = useState<DomainConfigT[]>([]);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showDomainsView, setShowDomainsView] = useState(false);

  const timelineDefaultHeight = DEFAULT_SETTINGS.timelineHeight;
  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);
  const [timelineHeightUnit, setTimelineHeightUnit] = useState<'px' | '%'>(
    'px'
  );
  const [actionArea, setActionArea] = useState<ActionAreaT>(ActionAreaE.Full);
  const [actionAreaSize, setActionAreaSize] = useState<number>(30);

  // Check if current settings differ from defaults (excluding domains)
  const isAtDefaults = checkIsAtDefaults(
    isEnabled,
    isDebugEnabled,
    invertHorizontalScroll,
    showTimelineOnHover,
    timelinePosition,
    timelineHeight,
    timelineHeightUnit,
    domainRules,
    actionArea,
    actionAreaSize
  );

  // Check if extension settings are at defaults
  const isExtensionAtDefaults =
    isEnabled === DEFAULT_SETTINGS.isEnabled &&
    isDebugEnabled === DEFAULT_SETTINGS.isDebugEnabled;

  // Check if settings are at defaults
  const isSettingsAtDefaults =
    invertHorizontalScroll === DEFAULT_SETTINGS.invertHorizontalScroll &&
    showTimelineOnHover === DEFAULT_SETTINGS.showTimelineOnHover &&
    timelinePosition === DEFAULT_SETTINGS.timelinePosition &&
    timelineHeight === DEFAULT_SETTINGS.timelineHeight &&
    timelineHeightUnit === DEFAULT_SETTINGS.timelineHeightUnit &&
    actionArea === DEFAULT_SETTINGS.actionArea &&
    actionAreaSize === DEFAULT_SETTINGS.actionAreaSize;

  useEffect(() => {
    // Get current tab domain
    getCurrentDomain().then(setCurrentDomain);

    const loadSettings = async () => {
      const settings = await loadPopupSettings();
      setIsEnabled(settings.isEnabled);
      setIsDebugEnabled(settings.isDebugEnabled);
      setIsBetaFeaturesEnabled(settings.isBetaFeaturesEnabled);
      setInvertHorizontalScroll(settings.invertHorizontalScroll);
      setShowTimelineOnHover(settings.showTimelineOnHover);
      setTimelinePosition(settings.timelinePosition);
      setTimelineHeight(settings.timelineHeight);
      setTimelineHeightUnit(settings.timelineHeightUnit);
      setDomainRules(settings.domainRules);
      setActionArea(settings.actionArea || 'full');
      setActionAreaSize(settings.actionAreaSize || 30);
    };

    const loadShortcuts = async () => {
      try {
        const commands = await chrome.commands.getAll();
        const toggleCommand = commands.find(
          (cmd) => cmd.name === 'toggle-extension'
        );
        if (toggleCommand?.shortcut) {
          setToggleShortcut(toggleCommand.shortcut);
        } else {
          setToggleShortcut(ShortcutHotkeyStateE.NotConfigured);
        }
      } catch (error) {
        console.error('Failed to load keyboard shortcuts:', error);
        setToggleShortcut(ShortcutHotkeyStateE.NotAvailable);
      }
    };

    loadSettings();
    loadShortcuts();
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

  const handleBetaFeaturesToggle = (checked: boolean) => {
    setIsBetaFeaturesEnabled(checked);
    saveSettings({ isBetaFeaturesEnabled: checked });
    sendMessageToCurrentTab({
      action: 'updateBetaFeatures',
      isBetaFeaturesEnabled: checked,
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

  const cycleActionArea = () => {
    const order: ActionAreaT[] = [
      ActionAreaE.Full,
      ActionAreaE.Top,
      ActionAreaE.Middle,
      ActionAreaE.Bottom,
    ];
    const currentIndex = order.indexOf(actionArea);
    const next = order[(currentIndex + 1) % order.length];
    applyActionArea(next);
  };

  const actionAreaLabelMap: Record<ActionAreaT, string> = {
    [ActionAreaE.Full]: 'Full',
    [ActionAreaE.Top]: 'Top',
    [ActionAreaE.Middle]: 'Middle',
    [ActionAreaE.Bottom]: 'Bottom',
  };

  const applyActionArea = (newActionArea: ActionAreaT) => {
    setActionArea(newActionArea);
    saveSettings({
      isEnabled,
      isDebugEnabled,
      invertHorizontalScroll,
      showTimelineOnHover,
      timelinePosition,
      timelineHeight,
      timelineHeightUnit,
      domainRules,
      actionArea: newActionArea,
      actionAreaSize,
    });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        isEnabled,
        isDebugEnabled,
        invertHorizontalScroll,
        showTimelineOnHover,
        timelinePosition,
        timelineHeight,
        timelineHeightUnit,
        actionArea: newActionArea,
        actionAreaSize,
      },
    });
  };

  const handleActionAreaSizeChange = (newSize: number) => {
    setActionAreaSize(newSize);
    saveSettings({
      isEnabled,
      isDebugEnabled,
      invertHorizontalScroll,
      showTimelineOnHover,
      timelinePosition,
      timelineHeight,
      timelineHeightUnit,
      domainRules,
      actionArea,
      actionAreaSize: newSize,
    });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        isEnabled,
        isDebugEnabled,
        invertHorizontalScroll,
        showTimelineOnHover,
        timelinePosition,
        timelineHeight,
        timelineHeightUnit,
        actionArea,
        actionAreaSize: newSize,
      },
    });
  };

  const handleResetExtensionDefaults = () => {
    const defaultSettings = DEFAULT_SETTINGS;

    setIsEnabled(defaultSettings.isEnabled);
    setIsDebugEnabled(defaultSettings.isDebugEnabled);

    // Save only extension-related settings
    saveSettings({
      isEnabled: defaultSettings.isEnabled,
      isDebugEnabled: defaultSettings.isDebugEnabled,
    });

    sendMessageToCurrentTab({
      action: 'updateEnabled',
      isEnabled: defaultSettings.isEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateDebug',
      isDebugEnabled: defaultSettings.isDebugEnabled,
    });
  };

  const handleResetSettingsDefaults = () => {
    const defaultSettings = DEFAULT_SETTINGS;

    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setTimelinePosition(defaultSettings.timelinePosition);
    setTimelineHeight(defaultSettings.timelineHeight);
    setTimelineHeightUnit(defaultSettings.timelineHeightUnit);
    setActionArea(defaultSettings.actionArea);
    setActionAreaSize(defaultSettings.actionAreaSize);

    // Save only settings-related values
    saveSettings({
      invertHorizontalScroll: defaultSettings.invertHorizontalScroll,
      showTimelineOnHover: defaultSettings.showTimelineOnHover,
      timelinePosition: defaultSettings.timelinePosition,
      timelineHeight: defaultSettings.timelineHeight,
      timelineHeightUnit: defaultSettings.timelineHeightUnit,
      actionArea: defaultSettings.actionArea,
      actionAreaSize: defaultSettings.actionAreaSize,
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
          <div className="fixed top-0 z-50 flex w-full flex-none flex-col items-center overflow-hidden border-b border-slate-200/60 bg-white/80 p-6 backdrop-blur-[20px] backdrop-saturate-[180%] dark:border-slate-600/50 dark:bg-slate-800/80">
            <img
              src="/icon/128.png"
              alt="Media Flow Seek"
              className="perspective-[1000] rotate-x-[25deg] rotate-z-[-5deg] rotate-y-[-25deg] absolute left-[-30px] top-[-30px] h-[128px] w-[128px] transform-gpu opacity-40 dark:opacity-50"
            />

            <div className="z-10 ml-14 inline-flex flex-col items-start text-center">
              <div className="mb-1 flex items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <a
                    href={EXT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-600 dark:hover:text-brand-400 text-xl font-bold text-slate-900 no-underline transition-colors duration-200 dark:text-white"
                    title="View Media Flow Seek on Chrome Web Store"
                  >
                    Media Flow Seek
                  </a>

                  {/* version */}
                  {getExtensionVersion() ? (
                    <span
                      className={cn(
                        'rounded-full border px-2 py-1 text-xs font-medium',
                        'border-brand-400 bg-brand-300/60 text-brand-500',
                        'dark:border-brand-500 dark:bg-brand-700/60 dark:text-brand-100'
                      )}
                    >
                      v{getExtensionVersion()}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enhanced video controls & scrolling
              </p>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 overflow-hidden [&_[data-slot='scroll-area-viewport']]:relative">
            <div className="flex flex-1 flex-col gap-6 p-6 pb-[80px] pt-[120px]">
              {/* Extension Section */}
              <div className="flex flex-none flex-col">
                <SectionTitle title="Extension">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isExtensionAtDefaults}
                    onClick={handleResetExtensionDefaults}
                    className={cn(
                      'h-7 px-3 text-xs font-medium transition-all',
                      isExtensionAtDefaults
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
                    )}
                  >
                    Reset Default
                  </Button>
                </SectionTitle>
                <CardListItemWrapper>
                  <CardListItem
                    title="Enable Extension"
                    icon={PowerIcon}
                    disabledSoft={!isEnabled}
                    classNameIcon={
                      isEnabled ? '!text-brand-400 filter-[saturate(2)]' : ''
                    }
                    description="Turn video seeking on/off"
                    components={{
                      RightSlot: (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={handleEnabledToggle}
                        />
                      ),
                    }}
                  />

                  <CardListItem
                    title="Debug"
                    icon={BugIcon}
                    classNameIcon={isDebugEnabled ? '!text-red-500' : ''}
                    description="Highlight video elements"
                    components={{
                      RightSlot: (
                        <Switch
                          checked={isDebugEnabled}
                          onCheckedChange={handleDebugToggle}
                        />
                      ),
                    }}
                  />

                  {/* <CardListItem
                    title="Beta Features"
                    description="Enable beta features (unlock domains)"
                    components={{
                      RightSlot: (
                        <Switch
                          checked={isBetaFeaturesEnabled}
                          onCheckedChange={handleBetaFeaturesToggle}
                        />
                      ),
                    }}
                  /> */}
                </CardListItemWrapper>
              </div>

              {/* Keyboard Shortcuts Section */}
              <div className="flex flex-none flex-col">
                <SectionTitle title="Keyboard Shortcuts" />
                <CardListItemWrapper>
                  <CardListItem
                    title="Toggle Extension"
                    icon={KeyboardIcon}
                    description={
                      toggleShortcut === ShortcutHotkeyStateE.NotConfigured
                        ? 'Set up a keyboard shortcut to quickly toggle the extension'
                        : toggleShortcut === ShortcutHotkeyStateE.NotAvailable
                          ? 'Keyboard shortcuts not available'
                          : `Press (${toggleShortcut}) to toggle`
                    }
                    components={{
                      RightSlot: (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            chrome.tabs.create({
                              url: 'chrome://extensions/shortcuts',
                            });
                          }}
                          className={cn(
                            'h-8 px-3 text-xs font-medium',
                            'bg-brand-50 text-brand-500 hover:bg-brand-100',
                            'dark:bg-brand-600 dark:text-brand-50 dark:hover:bg-brand-700'
                          )}
                        >
                          Configure
                        </Button>
                      ),
                    }}
                  />
                </CardListItemWrapper>
              </div>

              {/* Settings Section */}
              <div className="flex flex-none flex-col">
                <SectionTitle title="Settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSettingsAtDefaults}
                    onClick={handleResetSettingsDefaults}
                    className={cn(
                      'h-7 px-3 text-xs font-medium transition-all',
                      isSettingsAtDefaults
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
                    )}
                  >
                    Reset Default
                  </Button>
                </SectionTitle>

                <CardListItemWrapper
                  className={cn(!isEnabled && 'pointer-events-none opacity-50')}
                >
                  {/* Action Area using CardListItem with BottomSlot preview */}
                  <CardListItem
                    title="Action Area"
                    icon={SquareDashedIcon}
                    description="Choose which video area responds to scroll"
                    classNameContentBottom="flex flex-col items-center"
                    components={{
                      BottomSlot: (
                        <div
                          className={cn(
                            'flex w-full flex-col gap-4 transition-all',
                            actionArea !== ActionAreaE.Full &&
                              'rounded-3xl bg-slate-100 p-4 dark:bg-slate-800'
                          )}
                        >
                          <button
                            type="button"
                            className="relative z-10 aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-600"
                            onClick={cycleActionArea}
                            aria-label="Cycle action area selection"
                          >
                            <VideoPlayerPreview />

                            {/* Active area highlight - using dynamic sizing */}
                            <div
                              style={{
                                height:
                                  actionArea !== ActionAreaE.Full
                                    ? `${actionAreaSize}%`
                                    : undefined,
                                top:
                                  actionArea === ActionAreaE.Top
                                    ? 0
                                    : actionArea === ActionAreaE.Middle
                                      ? `${(100 - actionAreaSize) / 2}%`
                                      : actionArea === ActionAreaE.Bottom
                                        ? `${100 - actionAreaSize}%`
                                        : undefined,
                              }}
                              className={cn(
                                'bg-brand-400/70 dark:border-brand-300 dark:bg-brand-600/70 transition-discrete absolute border duration-300 ease-in-out',
                                actionArea === ActionAreaE.Full &&
                                  'inset-0 h-full rounded-lg',
                                actionArea === ActionAreaE.Top &&
                                  'inset-x-0 top-0 h-1/2 rounded-t-lg',
                                actionArea === ActionAreaE.Middle &&
                                  'inset-x-0 top-1/4 h-1/2 rounded',
                                actionArea === ActionAreaE.Bottom &&
                                  'inset-x-0 top-1/2 h-1/2 rounded-b-lg'
                              )}
                            >
                              <div className="flex h-full flex-col items-center justify-center">
                                <span className="select-none text-xl font-semibold text-white">
                                  {actionAreaLabelMap[actionArea]}
                                </span>
                                <span className="text-2xs select-none font-semibold text-white/40">
                                  (Click me to change)
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Action Area Size Control - only show for partial areas */}
                          <div
                            className={cn(
                              'space-y-2 transition-all duration-300 ease-in-out',
                              actionArea !== ActionAreaE.Full
                                ? 'max-h-[100px] translate-y-0 scale-100 opacity-100'
                                : 'scale-85 pointer-events-none max-h-0 -translate-y-5 overflow-hidden opacity-0'
                            )}
                          >
                            <CardDescription className="text-800 text-center text-xs dark:text-white">
                              Area Size
                            </CardDescription>
                            <ActionAreaSizeControl
                              value={actionAreaSize}
                              onChange={handleActionAreaSizeChange}
                            />
                          </div>
                        </div>
                      ),
                    }}
                  />

                  <CardListItem
                    title="Invert Scroll"
                    icon={RotateCcwIcon}
                    iconToggle={RotateCwIcon}
                    iconIsToggled={invertHorizontalScroll}
                    classNameIcon={cn(
                      'transition-all duration-700 ease-out',
                      invertHorizontalScroll && 'rotate-180 scale-110'
                    )}
                    description="Change scroll sirection"
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
                    title="Show Timeline on Hover"
                    icon={EyeIcon}
                    iconToggle={EyeOffIcon}
                    iconIsToggled={!showTimelineOnHover}
                    description="Show progress bar when hovering over videos"
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
                    title="Timeline Settings"
                    icon={PanelBottomDashedIcon}
                    description="Adjust position and height of the progress bar"
                    components={{
                      BottomSlot: (
                        <TimelineSettings
                          position={timelinePosition}
                          onPositionChange={handleTimelinePositionChange}
                          height={timelineHeight}
                          unit={timelineHeightUnit}
                          onHeightChange={handleTimelineHeightChange}
                          onUnitChange={handleTimelineHeightUnitChange}
                        />
                      ),
                    }}
                  />
                </CardListItemWrapper>
              </div>

              {/* Domains Section */}
              <div className="flex flex-1 flex-col">
                <SectionTitle title="Domains" />
                <CardListItemWrapper>
                  <CardListItem
                    title="Domain Management"
                    disabled={!isBetaFeaturesEnabled}
                    description={
                      !isBetaFeaturesEnabled
                        ? 'YouTube only (for now)'
                        : 'Manage where the extension works'
                    }
                    onClick={() =>
                      !isBetaFeaturesEnabled ? null : setShowDomainsView(true)
                    }
                  />
                </CardListItemWrapper>
              </div>
            </div>
          </ScrollArea>

          {/* Fixed Footer */}
          <div className="fixed bottom-0 z-50 flex w-full flex-none border-t border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur-[20px] backdrop-saturate-[180%] dark:border-slate-600/50 dark:bg-slate-800/80">
            <div className="flex w-full items-center gap-2">
              <div className="text-center text-xs text-slate-600 dark:text-slate-300">
                Made with ❤️ by{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  aPinix
                </span>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <a
                  href="https://x.com/apinix"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand hover:fill-brand fill-slate-400 text-slate-400 transition-colors duration-200"
                  title="Follow on Twitter/X"
                >
                  <TwitterIcon className="h-4 w-4 fill-inherit text-inherit" />
                </a>
                <a
                  href="https://github.com/aPinix"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand hover:fill-brand fill-slate-400 text-slate-400 transition-colors duration-200"
                  title="View on GitHub"
                >
                  <GithubIcon className="h-4 w-4 fill-inherit text-inherit" />
                </a>
                <a
                  href="https://www.linkedin.com/in/pinix/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand hover:fill-brand fill-slate-400 text-slate-400 transition-colors duration-200"
                  title="Connect on LinkedIn"
                >
                  <LinkedinIcon className="h-4 w-4 fill-inherit text-inherit" />
                </a>
              </div>
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

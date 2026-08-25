import {
  BugIcon,
  EyeOffIcon,
  GlobeIcon,
  PaletteIcon,
  PowerIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppBetaBadge } from '@/components/app/app-beta-badge';
import { AppSwitch } from '@/components/app/app-switch';
import { XBrandIcon } from '@/components/icons/icons';
import { CardListItem } from '@/components/popup/card-list-item';
import { SectionTitle } from '@/components/popup/section-title';
import { SiteAccessView } from '@/components/popup/site-access-view';
import { ViewTitle } from '@/components/popup/view-title';
import { SeekControlsSettings } from '@/components/settings/seek-controls-settings';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EXT_URL, IS_DEVELOPMENT } from '@/config/variables.config';
import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  saveSettings,
  sendMessageToCurrentTab,
  subscribeToEnabledChanges,
} from '@/helpers/popup-storage';
import type { ScrollHotkeyT } from '@/helpers/scroll-speed';
import { getCurrentDomain } from '@/lib/popup-utils';
import { cn } from '@/lib/utils';
import { getExtensionVersion } from '@/lib/version';
import { ActionAreaE, type ActionAreaT } from '@/types/content';
import type { DomainConfigT } from '@/types/domains';
import { ShortcutHotkeyStateE } from '@/types/shortcut';

import { CardListItemWrapper } from './card-list-item-wrapper';

const headerLinkClassName =
  'flex size-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-[color,background-color,border-color] hover:border-brand-100 hover:bg-brand-50 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 dark:text-slate-400 dark:hover:border-brand-800 dark:hover:bg-brand-900/50 dark:hover:text-brand-300';

const shortcutKeySymbols: Record<string, string> = {
  Alt: '⌥',
  Cmd: '⌘',
  Command: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  MacCtrl: '⌃',
  Meta: '⌘',
  Option: '⌥',
  Shift: '⇧',
};
const compactModifierSymbols = new Set(['⌘', '⇧', '⌥', '⌃']);

function getShortcutKeys(shortcut: string) {
  if (shortcut.includes('+')) {
    return shortcut
      .split('+')
      .map((key) => key.trim())
      .map((key) => shortcutKeySymbols[key] ?? key);
  }

  const characters = Array.from(shortcut);
  const keys: string[] = [];

  while (
    characters[0] !== undefined &&
    compactModifierSymbols.has(characters[0])
  ) {
    keys.push(characters.shift() as string);
  }

  if (characters.length > 0) keys.push(characters.join(''));

  return keys.length > 0 ? keys : [shortcut];
}

function ShortcutKeycaps({ shortcut }: { shortcut: string }) {
  const isStatus =
    shortcut === ShortcutHotkeyStateE.NotConfigured ||
    shortcut === ShortcutHotkeyStateE.NotAvailable;
  const label =
    shortcut === ShortcutHotkeyStateE.NotConfigured
      ? 'Not set'
      : shortcut === ShortcutHotkeyStateE.NotAvailable
        ? 'Unavailable'
        : shortcut;
  const keys = isStatus ? [label] : getShortcutKeys(label);

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <kbd
          className={cn(
            'grid shrink-0 place-items-center border-0 bg-slate-200 p-0 font-sans text-slate-600 leading-none shadow-none transition-colors group-hover/button:bg-brand-100 group-hover/button:text-brand-600 dark:bg-slate-600 dark:text-slate-200 dark:group-hover/button:bg-brand-800 dark:group-hover/button:text-brand-100',
            isStatus
              ? 'h-5 rounded-md px-1.5 text-[9px]'
              : 'size-4.5 rounded-[4px] text-[10px]'
          )}
          key={`${key}-${index}`}
        >
          <span className="flex translate-y-px items-center justify-center leading-none">
            {key}
          </span>
        </kbd>
      ))}
    </span>
  );
}

function HeaderLinks() {
  return (
    <nav aria-label="aPinix links" className="flex items-center gap-0.5">
      <a
        aria-label="Visit aPinix.com"
        className={headerLinkClassName}
        href="https://apinix.com"
        rel="noopener noreferrer"
        target="_blank"
        title="Visit aPinix.com"
      >
        <GlobeIcon className="size-3.5" />
      </a>
      <a
        aria-label="Follow aPinix on X"
        className={headerLinkClassName}
        href="https://x.com/apinix"
        rel="noopener noreferrer"
        target="_blank"
        title="Follow aPinix on X"
      >
        <XBrandIcon className="size-3" />
      </a>
    </nav>
  );
}

function PopupHeader() {
  const version = getExtensionVersion();

  return (
    <header className="absolute inset-x-3 top-2 z-50 h-14 px-3 py-2">
      <div className="flex h-full items-center gap-3">
        <a
          aria-label="View Better Video Controls on Chrome Web Store"
          className="shrink-0 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          href={EXT_URL}
          rel="noopener noreferrer"
          target="_blank"
          title="View Better Video Controls on Chrome Web Store"
        >
          <img
            alt=""
            className="size-10 object-contain drop-shadow-sm"
            src="/icon/128.png"
          />
        </a>

        <div className="flex min-w-0 flex-1 flex-col justify-center leading-none">
          <span className="truncate font-bold text-slate-900 text-sm dark:text-white">
            Better Video
          </span>
          {version ? (
            <span className="mt-1 shrink-0 text-[9px] text-slate-500 dark:text-slate-400">
              v{version}
            </span>
          ) : null}
        </div>

        <HeaderLinks />
      </div>
    </header>
  );
}

export function PopupContent() {
  const { theme } = useTheme();
  const carouselRef = useRef<HTMLElement>(null);
  const programmaticViewRef = useRef<boolean | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isScrollSeekingEnabled, setIsScrollSeekingEnabled] = useState(
    DEFAULT_SETTINGS.isScrollSeekingEnabled
  );
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [scrollSpeedFactor, setScrollSpeedFactor] = useState(
    DEFAULT_SETTINGS.scrollSpeedFactor
  );
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [isTimelineSeekingEnabled, setIsTimelineSeekingEnabled] = useState(
    DEFAULT_SETTINGS.isTimelineSeekingEnabled
  );
  const [dragVideoToSeek, setDragVideoToSeek] = useState(
    DEFAULT_SETTINGS.dragVideoToSeek
  );
  const [hideVideoControls, setHideVideoControls] = useState(
    DEFAULT_SETTINGS.hideVideoControls
  );
  const [colorizedTimeline, setColorizedTimeline] = useState(
    DEFAULT_SETTINGS.colorizedTimeline
  );
  const [timelinePosition, setTimelinePosition] = useState<'top' | 'bottom'>(
    'bottom'
  );
  const [toggleShortcut, setToggleShortcut] = useState<string>('');
  const [domainRules, setDomainRules] = useState<DomainConfigT[]>([]);
  const [currentDomain, setCurrentDomain] = useState('');
  const [showDomainsView, setShowDomainsView] = useState(false);
  const [fastScrollHotkey, setFastScrollHotkey] = useState<ScrollHotkeyT>(
    DEFAULT_SETTINGS.fastScrollHotkey
  );
  const [slowScrollHotkey, setSlowScrollHotkey] = useState<ScrollHotkeyT>(
    DEFAULT_SETTINGS.slowScrollHotkey
  );
  const [isPlayPauseWheelEnabled, setIsPlayPauseWheelEnabled] = useState(
    DEFAULT_SETTINGS.isPlayPauseWheelEnabled
  );

  const timelineDefaultHeight = DEFAULT_SETTINGS.timelineHeight;
  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);
  const [timelineHeightUnit, setTimelineHeightUnit] = useState<'px' | '%'>(
    'px'
  );
  const [actionArea, setActionArea] = useState<ActionAreaT>(ActionAreaE.Full);
  const [actionAreaSize, setActionAreaSize] = useState(
    DEFAULT_SETTINGS.actionAreaSize
  );
  const [actionAreaSizeUnit, setActionAreaSizeUnit] = useState<'px' | '%'>(
    DEFAULT_SETTINGS.actionAreaSizeUnit
  );

  // Check if extension settings are at defaults
  const isExtensionAtDefaults =
    isEnabled === DEFAULT_SETTINGS.isEnabled &&
    (!IS_DEVELOPMENT || isDebugEnabled === DEFAULT_SETTINGS.isDebugEnabled);

  // Check if settings are at defaults
  const isSettingsAtDefaults =
    isScrollSeekingEnabled === DEFAULT_SETTINGS.isScrollSeekingEnabled &&
    invertHorizontalScroll === DEFAULT_SETTINGS.invertHorizontalScroll &&
    scrollSpeedFactor === DEFAULT_SETTINGS.scrollSpeedFactor &&
    fastScrollHotkey === DEFAULT_SETTINGS.fastScrollHotkey &&
    slowScrollHotkey === DEFAULT_SETTINGS.slowScrollHotkey &&
    isPlayPauseWheelEnabled === DEFAULT_SETTINGS.isPlayPauseWheelEnabled &&
    showTimelineOnHover === DEFAULT_SETTINGS.showTimelineOnHover &&
    isTimelineSeekingEnabled === DEFAULT_SETTINGS.isTimelineSeekingEnabled &&
    dragVideoToSeek === DEFAULT_SETTINGS.dragVideoToSeek &&
    hideVideoControls === DEFAULT_SETTINGS.hideVideoControls &&
    colorizedTimeline === DEFAULT_SETTINGS.colorizedTimeline &&
    timelinePosition === DEFAULT_SETTINGS.timelinePosition &&
    timelineHeight === DEFAULT_SETTINGS.timelineHeight &&
    timelineHeightUnit === DEFAULT_SETTINGS.timelineHeightUnit &&
    actionArea === DEFAULT_SETTINGS.actionArea &&
    actionAreaSize === DEFAULT_SETTINGS.actionAreaSize &&
    actionAreaSizeUnit === DEFAULT_SETTINGS.actionAreaSizeUnit;

  useEffect(() => {
    // Get current tab domain
    getCurrentDomain().then(setCurrentDomain);

    const loadSettings = async () => {
      const settings = await loadPopupSettings();
      setIsEnabled(settings.isEnabled);
      setIsDebugEnabled(settings.isDebugEnabled);
      setIsScrollSeekingEnabled(settings.isScrollSeekingEnabled);
      setInvertHorizontalScroll(settings.invertHorizontalScroll);
      setScrollSpeedFactor(settings.scrollSpeedFactor);
      setFastScrollHotkey(settings.fastScrollHotkey);
      setSlowScrollHotkey(settings.slowScrollHotkey);
      setIsPlayPauseWheelEnabled(settings.isPlayPauseWheelEnabled);
      setShowTimelineOnHover(settings.showTimelineOnHover);
      setIsTimelineSeekingEnabled(settings.isTimelineSeekingEnabled);
      setDragVideoToSeek(settings.dragVideoToSeek);
      setHideVideoControls(settings.hideVideoControls);
      setColorizedTimeline(settings.colorizedTimeline);
      setTimelinePosition(settings.timelinePosition);
      setTimelineHeight(settings.timelineHeight);
      setTimelineHeightUnit(settings.timelineHeightUnit);
      setDomainRules(settings.domainRules);
      setActionArea(settings.actionArea || 'full');
      setActionAreaSize(settings.actionAreaSize);
      setActionAreaSizeUnit(settings.actionAreaSizeUnit);
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

    return subscribeToEnabledChanges(setIsEnabled);
  }, []);

  const updateDomainRules = useCallback((newRules: DomainConfigT[]) => {
    setDomainRules(newRules);
    saveSettings({ domainRules: newRules });
    sendMessageToCurrentTab({
      action: 'updateDomainRules',
      domainRules: newRules,
    });
  }, []);

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

  const handleScrollSeekingToggle = (checked: boolean) => {
    setIsScrollSeekingEnabled(checked);
    saveSettings({ isScrollSeekingEnabled: checked });
    sendMessageToCurrentTab({
      action: 'updateScrollSeeking',
      isScrollSeekingEnabled: checked,
    });
  };

  const handleScrollSpeedFactorChange = (factor: number) => {
    setScrollSpeedFactor(factor);
    saveSettings({ scrollSpeedFactor: factor });
    sendMessageToCurrentTab({
      action: 'updateScrollSpeedFactor',
      scrollSpeedFactor: factor,
    });
  };

  const updateScrollHotkeys = (fast: ScrollHotkeyT, slow: ScrollHotkeyT) => {
    setFastScrollHotkey(fast);
    setSlowScrollHotkey(slow);
    saveSettings({ fastScrollHotkey: fast, slowScrollHotkey: slow });
    sendMessageToCurrentTab({
      action: 'updateScrollHotkeys',
      fastScrollHotkey: fast,
      slowScrollHotkey: slow,
    });
  };

  const handleFastScrollHotkeyChange = (next: ScrollHotkeyT) => {
    updateScrollHotkeys(
      next,
      next === slowScrollHotkey ? fastScrollHotkey : slowScrollHotkey
    );
  };

  const handleSlowScrollHotkeyChange = (next: ScrollHotkeyT) => {
    updateScrollHotkeys(
      next === fastScrollHotkey ? slowScrollHotkey : fastScrollHotkey,
      next
    );
  };

  const handlePlayPauseWheelEnabledChange = (enabled: boolean) => {
    setIsPlayPauseWheelEnabled(enabled);
    saveSettings({ isPlayPauseWheelEnabled: enabled });
    sendMessageToCurrentTab({
      action: 'updateWheelActions',
      isPlayPauseWheelEnabled: enabled,
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

  const handleTimelineSeekingToggle = (checked: boolean) => {
    setIsTimelineSeekingEnabled(checked);
    saveSettings({ isTimelineSeekingEnabled: checked });
    sendMessageToCurrentTab({
      action: 'updateTimelineSeeking',
      isTimelineSeekingEnabled: checked,
    });
  };

  const handleDragVideoToSeekToggle = (checked: boolean) => {
    setDragVideoToSeek(checked);
    saveSettings({ dragVideoToSeek: checked });
    sendMessageToCurrentTab({
      action: 'updateDragVideoToSeek',
      dragVideoToSeek: checked,
    });
  };

  const handleHideVideoControlsToggle = (checked: boolean) => {
    setHideVideoControls(checked);
    saveSettings({ hideVideoControls: checked });
    sendMessageToCurrentTab({
      action: 'updateHideVideoControls',
      hideVideoControls: checked,
    });
  };

  const handleColorizedTimelineToggle = (checked: boolean) => {
    setColorizedTimeline(checked);
    saveSettings({ colorizedTimeline: checked });
    sendMessageToCurrentTab({
      action: 'updateColorizedTimeline',
      colorizedTimeline: checked,
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

  const handleTimelineHeightReset = () => {
    const height = DEFAULT_SETTINGS.timelineHeight;
    const unit = DEFAULT_SETTINGS.timelineHeightUnit;
    setTimelineHeight(height);
    setTimelineHeightUnit(unit);
    saveSettings({ timelineHeight: height, timelineHeightUnit: unit });
    sendMessageToCurrentTab({
      action: 'updateTimelineHeight',
      timelineHeight: height,
      timelineHeightUnit: unit,
    });
  };

  const applyActionArea = (newActionArea: ActionAreaT) => {
    setActionArea(newActionArea);
    saveSettings({ actionArea: newActionArea });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        actionArea: newActionArea,
        actionAreaSize,
        actionAreaSizeUnit,
      },
    });
  };

  const handleActionAreaSizeChange = (newSize: number) => {
    setActionAreaSize(newSize);
    saveSettings({ actionAreaSize: newSize });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        actionArea,
        actionAreaSize: newSize,
        actionAreaSizeUnit,
      },
    });
  };

  const handleActionAreaSizeUnitChange = (unit: 'px' | '%') => {
    setActionAreaSizeUnit(unit);
    saveSettings({ actionAreaSizeUnit: unit });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        actionArea,
        actionAreaSize,
        actionAreaSizeUnit: unit,
      },
    });
  };

  const handleActionAreaSizeReset = () => {
    const size = DEFAULT_SETTINGS.actionAreaSize;
    const unit = DEFAULT_SETTINGS.actionAreaSizeUnit;
    setActionAreaSize(size);
    setActionAreaSizeUnit(unit);
    saveSettings({ actionAreaSize: size, actionAreaSizeUnit: unit });
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        actionArea,
        actionAreaSize: size,
        actionAreaSizeUnit: unit,
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

    setIsScrollSeekingEnabled(defaultSettings.isScrollSeekingEnabled);
    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setScrollSpeedFactor(defaultSettings.scrollSpeedFactor);
    setFastScrollHotkey(defaultSettings.fastScrollHotkey);
    setSlowScrollHotkey(defaultSettings.slowScrollHotkey);
    setIsPlayPauseWheelEnabled(defaultSettings.isPlayPauseWheelEnabled);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setIsTimelineSeekingEnabled(defaultSettings.isTimelineSeekingEnabled);
    setDragVideoToSeek(defaultSettings.dragVideoToSeek);
    setHideVideoControls(defaultSettings.hideVideoControls);
    setColorizedTimeline(defaultSettings.colorizedTimeline);
    setTimelinePosition(defaultSettings.timelinePosition);
    setTimelineHeight(defaultSettings.timelineHeight);
    setTimelineHeightUnit(defaultSettings.timelineHeightUnit);
    setActionArea(defaultSettings.actionArea);
    setActionAreaSize(defaultSettings.actionAreaSize);
    setActionAreaSizeUnit(defaultSettings.actionAreaSizeUnit);

    // Save only settings-related values
    saveSettings({
      isScrollSeekingEnabled: defaultSettings.isScrollSeekingEnabled,
      invertHorizontalScroll: defaultSettings.invertHorizontalScroll,
      scrollSpeedFactor: defaultSettings.scrollSpeedFactor,
      fastScrollHotkey: defaultSettings.fastScrollHotkey,
      slowScrollHotkey: defaultSettings.slowScrollHotkey,
      isPlayPauseWheelEnabled: defaultSettings.isPlayPauseWheelEnabled,
      showTimelineOnHover: defaultSettings.showTimelineOnHover,
      isTimelineSeekingEnabled: defaultSettings.isTimelineSeekingEnabled,
      dragVideoToSeek: defaultSettings.dragVideoToSeek,
      hideVideoControls: defaultSettings.hideVideoControls,
      colorizedTimeline: defaultSettings.colorizedTimeline,
      timelinePosition: defaultSettings.timelinePosition,
      timelineHeight: defaultSettings.timelineHeight,
      timelineHeightUnit: defaultSettings.timelineHeightUnit,
      actionArea: defaultSettings.actionArea,
      actionAreaSize: defaultSettings.actionAreaSize,
      actionAreaSizeUnit: defaultSettings.actionAreaSizeUnit,
    });

    sendMessageToCurrentTab({
      action: 'updateScrollSeeking',
      isScrollSeekingEnabled: defaultSettings.isScrollSeekingEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollInversion',
      invertHorizontalScroll: defaultSettings.invertHorizontalScroll,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollSpeedFactor',
      scrollSpeedFactor: defaultSettings.scrollSpeedFactor,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollHotkeys',
      fastScrollHotkey: defaultSettings.fastScrollHotkey,
      slowScrollHotkey: defaultSettings.slowScrollHotkey,
    });
    sendMessageToCurrentTab({
      action: 'updateWheelActions',
      isPlayPauseWheelEnabled: defaultSettings.isPlayPauseWheelEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelineHover',
      showTimelineOnHover: defaultSettings.showTimelineOnHover,
    });
    sendMessageToCurrentTab({
      action: 'updateTimelineSeeking',
      isTimelineSeekingEnabled: defaultSettings.isTimelineSeekingEnabled,
    });
    sendMessageToCurrentTab({
      action: 'updateDragVideoToSeek',
      dragVideoToSeek: defaultSettings.dragVideoToSeek,
    });
    sendMessageToCurrentTab({
      action: 'updateHideVideoControls',
      hideVideoControls: defaultSettings.hideVideoControls,
    });
    sendMessageToCurrentTab({
      action: 'updateColorizedTimeline',
      colorizedTimeline: defaultSettings.colorizedTimeline,
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
    sendMessageToCurrentTab({
      type: 'SETTINGS_UPDATED',
      settings: {
        actionArea: defaultSettings.actionArea,
        actionAreaSize: defaultSettings.actionAreaSize,
        actionAreaSizeUnit: defaultSettings.actionAreaSizeUnit,
      },
    });
  };

  const selectPopupView = useCallback((showDomains: boolean) => {
    const carousel = carouselRef.current;
    setShowDomainsView(showDomains);
    if (!carousel) return;

    const targetLeft = showDomains ? carousel.clientWidth : 0;
    if (Math.abs(carousel.scrollLeft - targetLeft) < 1) {
      programmaticViewRef.current = null;
      return;
    }

    programmaticViewRef.current = showDomains;
    carousel.scrollTo({
      left: targetLeft,
    });
  }, []);

  return (
    <div className={cn(theme === 'dark' && 'dark')}>
      <div className="relative flex h-150 w-100 flex-col overflow-hidden bg-slate-100 shadow-xl dark:bg-slate-900">
        <PopupHeader />

        <main
          className="scrollbar-none relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            if (programmaticViewRef.current !== null) return;

            const carousel = event.currentTarget;
            const nextShowDomains =
              carousel.scrollLeft >= carousel.clientWidth / 2;
            setShowDomainsView((current) =>
              current === nextShowDomains ? current : nextShowDomains
            );
          }}
          onScrollEnd={(event) => {
            programmaticViewRef.current = null;
            const carousel = event.currentTarget;
            const nextShowDomains =
              carousel.scrollLeft >= carousel.clientWidth / 2;
            setShowDomainsView(nextShowDomains);
          }}
          ref={carouselRef}
        >
          {/* Main View */}
          <div
            aria-hidden={showDomainsView}
            className="flex h-full w-full shrink-0 snap-start snap-always flex-col"
            inert={showDomainsView}
          >
            {/* Scrollable Content */}
            <ScrollArea className="flex-1 overflow-hidden **:data-[slot='scroll-area-viewport']:relative">
              <div className="flex flex-1 flex-col gap-6 p-6 pt-22 pb-20">
                <ViewTitle
                  description="Customize video controls and scrolling"
                  title="Settings"
                />

                {/* Extension Section */}
                <div className="flex flex-none flex-col">
                  <SectionTitle title="Extension">
                    {!isExtensionAtDefaults && (
                      <Button
                        className="h-7 px-3 font-medium text-slate-600 text-xs transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                        onClick={handleResetExtensionDefaults}
                        size="sm"
                        variant="ghost"
                      >
                        Reset Default
                      </Button>
                    )}
                  </SectionTitle>
                  <CardListItemWrapper>
                    <CardListItem
                      classNameIcon={
                        isEnabled ? 'text-brand-400! filter-[saturate(2)]' : ''
                      }
                      components={{
                        RightSlot: (
                          <>
                            <Button
                              aria-label="Configure extension toggle shortcut"
                              className="h-7 min-w-22 max-w-36 rounded-lg border-slate-200 bg-slate-50 px-2.5 font-mono text-[11px] text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-500 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/50 dark:hover:text-brand-300"
                              onClick={() => {
                                chrome.tabs.create({
                                  url: 'chrome://extensions/shortcuts',
                                });
                              }}
                              size="sm"
                              title="Change extension toggle shortcut"
                              variant="outline"
                            >
                              <ShortcutKeycaps shortcut={toggleShortcut} />
                            </Button>
                            <AppSwitch
                              aria-label="Enable extension"
                              checked={isEnabled}
                              onCheckedChange={handleEnabledToggle}
                            />
                          </>
                        ),
                      }}
                      description="Turn video seeking on/off"
                      disabledSoft={!isEnabled}
                      icon={PowerIcon}
                      title="Enable Extension"
                    />

                    {IS_DEVELOPMENT && (
                      <CardListItem
                        classNameIcon={isDebugEnabled ? 'text-red-500!' : ''}
                        components={{
                          RightSlot: (
                            <AppSwitch
                              checked={isDebugEnabled}
                              disabled={!isEnabled}
                              onCheckedChange={handleDebugToggle}
                            />
                          ),
                        }}
                        description="Highlight video elements"
                        disabledSoft={!isEnabled}
                        icon={BugIcon}
                        title="Debug"
                      />
                    )}
                  </CardListItemWrapper>
                </div>

                <div className="flex flex-none flex-col">
                  <SectionTitle title="Seek Controls">
                    {!isSettingsAtDefaults ? (
                      <Button
                        className="h-7 px-3 font-medium text-slate-600 text-xs transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                        onClick={handleResetSettingsDefaults}
                        size="sm"
                        variant="ghost"
                      >
                        Reset Default
                      </Button>
                    ) : null}
                  </SectionTitle>

                  <div
                    className={cn(
                      !isEnabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    <SeekControlsSettings
                      actionArea={actionArea}
                      actionAreaSize={actionAreaSize}
                      actionAreaSizeUnit={actionAreaSizeUnit}
                      colorizedTimeline={colorizedTimeline}
                      fastScrollHotkey={fastScrollHotkey}
                      isDragSeekingEnabled={dragVideoToSeek}
                      isPlayPauseWheelEnabled={isPlayPauseWheelEnabled}
                      isScrollSeekingEnabled={isScrollSeekingEnabled}
                      isSeekbarSeekingEnabled={isTimelineSeekingEnabled}
                      onActionAreaChange={applyActionArea}
                      onActionAreaReset={() =>
                        applyActionArea(DEFAULT_SETTINGS.actionArea)
                      }
                      onActionAreaSizeChange={handleActionAreaSizeChange}
                      onActionAreaSizeReset={handleActionAreaSizeReset}
                      onActionAreaSizeUnitChange={
                        handleActionAreaSizeUnitChange
                      }
                      onDragSeekingEnabledChange={handleDragVideoToSeekToggle}
                      onFastScrollHotkeyChange={handleFastScrollHotkeyChange}
                      onHeightChange={handleTimelineHeightChange}
                      onHeightReset={handleTimelineHeightReset}
                      onPlayPauseWheelEnabledChange={
                        handlePlayPauseWheelEnabledChange
                      }
                      onPositionChange={handleTimelinePositionChange}
                      onPositionReset={() =>
                        handleTimelinePositionChange(
                          DEFAULT_SETTINGS.timelinePosition
                        )
                      }
                      onScrollInversionChange={handleScrollInversionToggle}
                      onScrollSeekingEnabledChange={handleScrollSeekingToggle}
                      onScrollSpeedFactorChange={handleScrollSpeedFactorChange}
                      onSeekbarSeekingEnabledChange={
                        handleTimelineSeekingToggle
                      }
                      onShowTimelineOnHoverChange={handleTimelineHoverToggle}
                      onSlowScrollHotkeyChange={handleSlowScrollHotkeyChange}
                      onUnitChange={handleTimelineHeightUnitChange}
                      scrollInverted={invertHorizontalScroll}
                      scrollSpeedFactor={scrollSpeedFactor}
                      showTimelineOnHover={showTimelineOnHover}
                      slowScrollHotkey={slowScrollHotkey}
                      timelineHeight={timelineHeight}
                      timelinePosition={timelinePosition}
                      timelineUnit={timelineHeightUnit}
                    />
                  </div>
                </div>

                <div className="flex flex-none flex-col">
                  <SectionTitle title="Player Appearance" />
                  <CardListItemWrapper
                    className={cn(
                      !isEnabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    <CardListItem
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Use minimal player"
                            checked={hideVideoControls}
                            onCheckedChange={handleHideVideoControlsToggle}
                          />
                        ),
                      }}
                      description="Hide the site's controls without changing seek methods"
                      icon={EyeOffIcon}
                      iconIsToggled={hideVideoControls}
                      title={
                        <span className="inline-flex items-center gap-2">
                          Minimal Player
                          <AppBetaBadge
                            featureName="Minimal Player"
                            tooltip="Minimal Player is experimental, so replacement controls may not be fully supported on every site."
                          />
                        </span>
                      }
                    />
                    <CardListItem
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Toggle match site color"
                            checked={colorizedTimeline}
                            onCheckedChange={handleColorizedTimelineToggle}
                          />
                        ),
                      }}
                      description="Use each site's favicon color for the timeline"
                      icon={PaletteIcon}
                      iconIsToggled={colorizedTimeline}
                      title="Match Site Color"
                    />
                  </CardListItemWrapper>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Domains View */}
          <div
            aria-hidden={!showDomainsView}
            className="flex h-full w-full shrink-0 snap-start snap-always flex-col"
            inert={!showDomainsView}
          >
            <SiteAccessView
              currentDomain={currentDomain}
              domainRules={domainRules}
              isActive={showDomainsView}
              onDomainRulesChange={updateDomainRules}
            />
          </div>
        </main>

        {/* Gradient edge blurs behind the fixed chrome */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-2.5 left-0 z-30 h-24 bg-gradient-to-b from-slate-100 via-slate-100/80 to-transparent backdrop-blur-xl backdrop-saturate-150 [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)] dark:from-slate-900 dark:via-slate-900/80"
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-2.5 bottom-0 left-0 z-40 bg-gradient-to-t from-slate-100 via-slate-100/80 to-transparent backdrop-blur-xl backdrop-saturate-150 dark:from-slate-900 dark:via-slate-900/80',
            showDomainsView
              ? 'h-36 [mask-image:linear-gradient(to_top,black_0%,black_70%,transparent_100%)]'
              : 'h-24 [mask-image:linear-gradient(to_top,black_0%,black_58%,transparent_100%)]'
          )}
          data-testid="bottom-gradient-blur"
        />

        {/* Persistent Tab Navigation */}
        <footer className="absolute inset-x-3 bottom-2 z-50 h-12 p-1">
          <div
            aria-hidden={!showDomainsView}
            className={cn(
              'absolute right-1 bottom-[calc(100%+0.25rem)] left-1 z-0 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none',
              showDomainsView
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-[calc(100%+0.75rem)] opacity-0'
            )}
            data-active={showDomainsView}
            data-testid="domain-toolbar-dock"
            id="domain-toolbar-root"
            inert={!showDomainsView || undefined}
          />
          <nav
            aria-label="Popup navigation"
            className="relative z-10 grid h-full grid-cols-2 rounded-full"
          >
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full bg-brand/20 shadow-sm ring-1 ring-brand/25 backdrop-blur-sm transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-brand-400/20 dark:ring-brand-300/25',
                showDomainsView ? 'translate-x-full' : 'translate-x-0'
              )}
            />
            <button
              aria-current={showDomainsView ? undefined : 'page'}
              className={cn(
                'relative z-10 flex min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full font-semibold text-2xs transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
                showDomainsView
                  ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  : 'text-brand dark:text-brand-200'
              )}
              onClick={() => selectPopupView(false)}
              type="button"
            >
              <SlidersHorizontalIcon className="size-4" />
              Settings
            </button>
            <button
              aria-current={showDomainsView ? 'page' : undefined}
              className={cn(
                'relative z-10 flex min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full font-semibold text-2xs transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
                showDomainsView
                  ? 'text-brand dark:text-brand-200'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
              onClick={() => selectPopupView(true)}
              type="button"
            >
              <GlobeIcon className="size-4" />
              Domains
            </button>
          </nav>
        </footer>
      </div>
    </div>
  );
}

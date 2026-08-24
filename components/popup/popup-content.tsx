import {
  BugIcon,
  EyeIcon,
  EyeOffIcon,
  GaugeIcon,
  GlobeIcon,
  LayoutTemplateIcon,
  MousePointer2Icon,
  MoveHorizontalIcon,
  PaletteIcon,
  PowerIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppSelect } from '@/components/app/app-select';
import { AppSwitch } from '@/components/app/app-switch';
import { XBrandIcon } from '@/components/icons/icons';
import { CardListItem } from '@/components/popup/card-list-item';
import { SectionTitle } from '@/components/popup/section-title';
import { SiteAccessView } from '@/components/popup/site-access-view';
import { ViewTitle } from '@/components/popup/view-title';
import { ScrollSpeedFactorControl } from '@/components/scroll-speed-factor-control';
import { VideoLayoutSettings } from '@/components/settings/video-layout-settings';
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
import {
  isScrollHotkey,
  ScrollHotkeyE,
  type ScrollHotkeyT,
} from '@/helpers/scroll-speed';
import { getCurrentDomain } from '@/lib/popup-utils';
import { cn } from '@/lib/utils';
import { getExtensionVersion } from '@/lib/version';
import { ActionAreaE, type ActionAreaT } from '@/types/content';
import type { DomainConfigT } from '@/types/domains';
import { ShortcutHotkeyStateE } from '@/types/shortcut';

import { CardListItemWrapper } from './card-list-item-wrapper';

const headerLinkClassName =
  'flex size-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-[color,background-color,border-color] hover:border-brand-100 hover:bg-brand-50 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 dark:text-slate-400 dark:hover:border-brand-800 dark:hover:bg-brand-900/50 dark:hover:text-brand-300';

const scrollHotkeyItems = [
  { label: 'Alt', value: ScrollHotkeyE.Alt },
  { label: 'Shift', value: ScrollHotkeyE.Shift },
  { label: 'Alt + Shift', value: ScrollHotkeyE.AltShift },
];

function ScrollHotkeySelect({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: ScrollHotkeyT) => void;
  value: ScrollHotkeyT;
}) {
  return (
    <AppSelect
      className="min-w-28"
      items={scrollHotkeyItems}
      label={label}
      onValueChange={(nextValue) => {
        if (isScrollHotkey(nextValue)) onChange(nextValue);
      }}
      value={value}
    />
  );
}

function BetaBadge() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-[9px] text-amber-700 leading-none ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25">
      Beta
    </span>
  );
}

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
    <header className="absolute inset-x-3 top-2 z-40 h-14 overflow-hidden rounded-full border border-white/45 bg-white/65 px-3 py-2 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.7)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-800/65">
      <div
        aria-hidden="true"
        className="absolute -top-14 -left-8 size-28 rounded-full bg-brand-200/25 blur-2xl dark:bg-brand-600/20"
      />

      <div className="relative flex h-full items-center gap-3">
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

        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
          <span className="truncate font-bold text-slate-900 text-sm dark:text-white">
            BetterVideo
          </span>
          {version ? (
            <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500">
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
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [scrollSpeedFactor, setScrollSpeedFactor] = useState(
    DEFAULT_SETTINGS.scrollSpeedFactor
  );
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [isTimelineSeekingEnabled, setIsTimelineSeekingEnabled] =
    useState(false);
  const [dragVideoToSeek, setDragVideoToSeek] = useState(false);
  const [hideVideoControls, setHideVideoControls] = useState(false);
  const [colorizedTimeline, setColorizedTimeline] = useState(false);
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
  const [actionAreaSize, setActionAreaSize] = useState<number>(30);

  // Check if extension settings are at defaults
  const isExtensionAtDefaults =
    isEnabled === DEFAULT_SETTINGS.isEnabled &&
    (!IS_DEVELOPMENT || isDebugEnabled === DEFAULT_SETTINGS.isDebugEnabled);

  const isScrollSpeedAndHotkeysAtDefaults =
    scrollSpeedFactor === DEFAULT_SETTINGS.scrollSpeedFactor &&
    fastScrollHotkey === DEFAULT_SETTINGS.fastScrollHotkey &&
    slowScrollHotkey === DEFAULT_SETTINGS.slowScrollHotkey;

  // Check if settings are at defaults
  const isSettingsAtDefaults =
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
    actionAreaSize === DEFAULT_SETTINGS.actionAreaSize;

  useEffect(() => {
    // Get current tab domain
    getCurrentDomain().then(setCurrentDomain);

    const loadSettings = async () => {
      const settings = await loadPopupSettings();
      setIsEnabled(settings.isEnabled);
      setIsDebugEnabled(settings.isDebugEnabled);
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

  const handleResetScrollSpeedAndHotkeys = () => {
    const {
      fastScrollHotkey: defaultFastHotkey,
      scrollSpeedFactor: defaultSpeedFactor,
      slowScrollHotkey: defaultSlowHotkey,
    } = DEFAULT_SETTINGS;

    setScrollSpeedFactor(defaultSpeedFactor);
    setFastScrollHotkey(defaultFastHotkey);
    setSlowScrollHotkey(defaultSlowHotkey);
    saveSettings({
      fastScrollHotkey: defaultFastHotkey,
      scrollSpeedFactor: defaultSpeedFactor,
      slowScrollHotkey: defaultSlowHotkey,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollSpeedFactor',
      scrollSpeedFactor: defaultSpeedFactor,
    });
    sendMessageToCurrentTab({
      action: 'updateScrollHotkeys',
      fastScrollHotkey: defaultFastHotkey,
      slowScrollHotkey: defaultSlowHotkey,
    });
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

  const applyActionArea = (newActionArea: ActionAreaT) => {
    setActionArea(newActionArea);
    saveSettings({
      isEnabled,
      isDebugEnabled,
      invertHorizontalScroll,
      showTimelineOnHover,
      isTimelineSeekingEnabled,
      dragVideoToSeek,
      hideVideoControls,
      colorizedTimeline,
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
        isTimelineSeekingEnabled,
        dragVideoToSeek,
        hideVideoControls,
        colorizedTimeline,
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
      isTimelineSeekingEnabled,
      dragVideoToSeek,
      hideVideoControls,
      colorizedTimeline,
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
        isTimelineSeekingEnabled,
        dragVideoToSeek,
        hideVideoControls,
        colorizedTimeline,
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

    // Save only settings-related values
    saveSettings({
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
      <div
        className={`relative flex h-150 w-100 flex-col overflow-hidden bg-slate-100 shadow-xl dark:bg-slate-700`}
      >
        <PopupHeader />

        <main
          className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
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

                {/* Settings Section */}
                <div className="flex flex-none flex-col">
                  <SectionTitle title="Settings">
                    {!isSettingsAtDefaults && (
                      <Button
                        className="h-7 px-3 font-medium text-slate-600 text-xs transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                        onClick={handleResetSettingsDefaults}
                        size="sm"
                        variant="ghost"
                      >
                        Reset Default
                      </Button>
                    )}
                  </SectionTitle>

                  <CardListItemWrapper
                    className={cn(
                      !isEnabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    <CardListItem
                      components={{
                        BottomSlot: (
                          <VideoLayoutSettings
                            actionArea={actionArea}
                            actionAreaSize={actionAreaSize}
                            colorizedTimeline={colorizedTimeline}
                            height={timelineHeight}
                            isPlayPauseWheelEnabled={isPlayPauseWheelEnabled}
                            onActionAreaChange={applyActionArea}
                            onActionAreaSizeChange={handleActionAreaSizeChange}
                            onActionAreaSizeReset={() =>
                              handleActionAreaSizeChange(
                                DEFAULT_SETTINGS.actionAreaSize
                              )
                            }
                            onHeightChange={handleTimelineHeightChange}
                            onHeightReset={() =>
                              handleTimelineHeightChange(
                                DEFAULT_SETTINGS.timelineHeight
                              )
                            }
                            onPlayPauseWheelEnabledChange={
                              handlePlayPauseWheelEnabledChange
                            }
                            onPositionChange={handleTimelinePositionChange}
                            onUnitChange={handleTimelineHeightUnitChange}
                            position={timelinePosition}
                            unit={timelineHeightUnit}
                          />
                        ),
                      }}
                      description="Adjust scroll area and timeline appearance"
                      icon={LayoutTemplateIcon}
                      title="Video Layout"
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

                    <CardListItem
                      classNameIcon={cn(
                        'transition-all duration-700 ease-out',
                        invertHorizontalScroll && 'rotate-180 scale-110'
                      )}
                      components={{
                        RightSlot: (
                          <AppSwitch
                            checked={invertHorizontalScroll}
                            onCheckedChange={handleScrollInversionToggle}
                          />
                        ),
                      }}
                      description="Change scroll sirection"
                      icon={RotateCcwIcon}
                      iconIsToggled={invertHorizontalScroll}
                      iconToggle={RotateCwIcon}
                      title="Invert Scroll"
                    />

                    <CardListItem
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Toggle timeline on hover"
                            checked={showTimelineOnHover}
                            disabled={isTimelineSeekingEnabled}
                            onCheckedChange={handleTimelineHoverToggle}
                          />
                        ),
                      }}
                      description={
                        isTimelineSeekingEnabled ? (
                          <span className="flex items-start gap-1 text-amber-700 dark:text-amber-300">
                            <TriangleAlertIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3 shrink-0"
                            />
                            <span>
                              <strong>Interactive Timeline</strong> overrides
                              this setting
                            </span>
                          </span>
                        ) : (
                          'Show progress bar when hovering over videos'
                        )
                      }
                      icon={EyeIcon}
                      iconIsToggled={!showTimelineOnHover}
                      iconToggle={EyeOffIcon}
                      title="Show Timeline on Hover"
                    />

                    <CardListItem
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Toggle interactive timeline seeking"
                            checked={isTimelineSeekingEnabled}
                            onCheckedChange={handleTimelineSeekingToggle}
                          />
                        ),
                      }}
                      description="Click or drag the progress bar to seek"
                      icon={MousePointer2Icon}
                      iconIsToggled={isTimelineSeekingEnabled}
                      title="Interactive Timeline"
                    />

                    <CardListItem
                      className="pl-10"
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Drag on video area to seek"
                            checked={dragVideoToSeek}
                            onCheckedChange={handleDragVideoToSeekToggle}
                          />
                        ),
                      }}
                      description="Drag across the video area to seek"
                      icon={MoveHorizontalIcon}
                      iconIsToggled={dragVideoToSeek}
                      title={
                        <span className="flex items-center gap-2">
                          Drag on Video Area
                          <BetaBadge />
                        </span>
                      }
                    />

                    <CardListItem
                      className="pl-10"
                      components={{
                        RightSlot: (
                          <AppSwitch
                            aria-label="Use minimal player"
                            checked={hideVideoControls}
                            onCheckedChange={handleHideVideoControlsToggle}
                          />
                        ),
                      }}
                      description={
                        hideVideoControls
                          ? 'Turn off to restore the original player'
                          : 'Hide controls for a minimal player'
                      }
                      icon={EyeOffIcon}
                      iconIsToggled={hideVideoControls}
                      title={
                        <span className="flex items-center gap-2">
                          Minimal Player
                          <BetaBadge />
                        </span>
                      }
                    />
                  </CardListItemWrapper>
                </div>

                {/* Scroll speed and keyboard shortcuts section */}
                <div className="flex flex-none flex-col">
                  <SectionTitle title="Scroll Speed & Hotkeys">
                    {!isScrollSpeedAndHotkeysAtDefaults && (
                      <Button
                        className="h-7 px-3 font-medium text-slate-600 text-xs transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                        onClick={handleResetScrollSpeedAndHotkeys}
                        size="sm"
                        variant="ghost"
                      >
                        Reset Default
                      </Button>
                    )}
                  </SectionTitle>
                  <CardListItemWrapper>
                    <CardListItem
                      components={{
                        BottomSlot: (
                          <ScrollSpeedFactorControl
                            onChange={handleScrollSpeedFactorChange}
                            value={scrollSpeedFactor}
                          />
                        ),
                      }}
                      description="Scales seeking while staying relative to video length"
                      icon={GaugeIcon}
                      title="Scroll Speed"
                    />

                    <CardListItem
                      components={{
                        RightSlot: (
                          <ScrollHotkeySelect
                            label="Fast scroll hotkey"
                            onChange={handleFastScrollHotkeyChange}
                            value={fastScrollHotkey}
                          />
                        ),
                      }}
                      description="Hold while scrolling for 3× seeking"
                      icon={GaugeIcon}
                      title="Fast Scroll"
                    />

                    <CardListItem
                      components={{
                        RightSlot: (
                          <ScrollHotkeySelect
                            label="Slow scroll hotkey"
                            onChange={handleSlowScrollHotkeyChange}
                            value={slowScrollHotkey}
                          />
                        ),
                      }}
                      description="Hold while scrolling for ¼× precision"
                      icon={GaugeIcon}
                      title="Slow Scroll"
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
              onDomainRulesChange={updateDomainRules}
            />
          </div>
        </main>

        {/* Gradient edge blurs behind the fixed chrome */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-slate-100/90 via-slate-100/45 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] dark:from-slate-700/90 dark:via-slate-700/45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-20 bg-gradient-to-t from-slate-100/90 via-slate-100/45 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_top,black_0%,black_55%,transparent_100%)] dark:from-slate-700/90 dark:via-slate-700/45"
        />

        {/* Persistent Tab Navigation */}
        <footer className="absolute inset-x-3 bottom-2 z-50 h-12 rounded-full border border-white/45 bg-white/65 p-1 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.7)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-800/65">
          <nav
            aria-label="Popup navigation"
            className="relative grid h-full grid-cols-2 rounded-full"
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

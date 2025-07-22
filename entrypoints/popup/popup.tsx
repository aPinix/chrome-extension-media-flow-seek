import { useEffect, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function Popup() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [isEnabled, setIsEnabled] = useState(true);
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const [blacklistedDomains, setBlacklistedDomains] = useState('');
  const MIN_TIMELINE_HEIGHT = 0;
  const MAX_TIMELINE_HEIGHT = 100;
  const timelineDefaultHeight = 6;

  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);

  // Check if current settings differ from defaults
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
    // Load saved settings
    chrome.storage.sync.get(
      [
        'isEnabled',
        'invertHorizontalScroll',
        'showTimelineOnHover',
        'timelineHeight',
        'blacklistedDomains',
      ],
      (result) => {
        setIsEnabled(result.isEnabled ?? true);
        setInvertHorizontalScroll(result.invertHorizontalScroll ?? false);
        setShowTimelineOnHover(result.showTimelineOnHover ?? false);
        setTimelineHeight(result.timelineHeight ?? timelineDefaultHeight);
        setBlacklistedDomains(result.blacklistedDomains ?? '');
      }
    );
  }, []);

  const handleEnabledToggle = (checked: boolean) => {
    setIsEnabled(checked);
    // Save setting
    chrome.storage.sync.set({ isEnabled: checked });
    // Send message to content script
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
    // Save setting
    chrome.storage.sync.set({ invertHorizontalScroll: checked });
    // Send message to content script
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
    // Save setting
    chrome.storage.sync.set({ showTimelineOnHover: checked });
    // Send message to content script
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
    // Save setting
    chrome.storage.sync.set({ timelineHeight: height });
    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTimelineHeight',
          timelineHeight: height,
        });
      }
    });
  };

  const handleBlacklistedDomainsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const domains = event.target.value;
    setBlacklistedDomains(domains);
    // Save setting
    chrome.storage.sync.set({ blacklistedDomains: domains });
    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateBlacklistedDomains',
          blacklistedDomains: domains,
        });
      }
    });
  };

  const handleResetDefaults = () => {
    // Reset all settings to defaults (except blacklisted domains)
    const defaultSettings = {
      isEnabled: true,
      invertHorizontalScroll: false,
      showTimelineOnHover: false,
      timelineHeight: timelineDefaultHeight,
    };

    // Update local state (keep blacklisted domains unchanged)
    setIsEnabled(defaultSettings.isEnabled);
    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setTimelineHeight(defaultSettings.timelineHeight);

    // Save to storage (don't modify blacklisted domains)
    chrome.storage.sync.set(defaultSettings);

    // Send messages to content script (don't send blacklisted domains update)
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

  return (
    <div
      className={`flex h-[600px] w-80 flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-xl dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 ${isDark ? 'dark' : ''}`}
    >
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b border-slate-200/60 bg-white/90 p-6 backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/90">
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-3">
            <img src="/icon/48.png" alt="Media Flow Seek" className="h-8 w-8" />
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
      <div className="flex-1 overflow-y-auto p-6 dark:bg-slate-600">
        <div className="flex flex-col gap-6">
          {/* Extension Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Extension
              </h3>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30 dark:hover:bg-slate-800/80">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Enabled
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Enable or disable the extension
                  </span>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleEnabledToggle}
                />
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Settings
              </h3>
              <button
                onClick={handleResetDefaults}
                disabled={isAtDefaults}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isAtDefaults
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 hover:shadow-sm dark:bg-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-600 dark:hover:shadow-md'
                }`}
              >
                Reset Default
              </button>
            </div>

            {/* Settings Content - Disabled when not enabled */}
            <div
              className={`flex flex-col gap-4 ${!isEnabled ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30 dark:hover:bg-slate-800/80">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Invert horizontal scroll
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Reverse scroll direction for better control
                    </span>
                  </div>
                  <Switch
                    checked={invertHorizontalScroll}
                    onCheckedChange={handleScrollInversionToggle}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30 dark:hover:bg-slate-800/80">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Show timeline on hover
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Display progress bar when hovering over videos
                    </span>
                  </div>
                  <Switch
                    checked={showTimelineOnHover}
                    onCheckedChange={handleTimelineHoverToggle}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30 dark:hover:bg-slate-800/80">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Timeline height
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Adjust the height of the progress bar
                    </span>
                  </div>
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
                </div>
              </div>
            </div>
          </div>

          {/* Blacklisted Domains Section */}
          <div>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Blacklisted Domains
              </h3>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-600/40 dark:bg-slate-800/60 dark:shadow-slate-900/30 dark:hover:bg-slate-800/80">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Domains
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Domains where the extension will be disabled (one per line)
                  </span>
                </div>
                <Textarea
                  value={blacklistedDomains}
                  onChange={handleBlacklistedDomainsChange}
                  placeholder="youtube.com&#10;vimeo.com"
                  className="min-h-16 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t border-slate-200/60 bg-white/90 p-4 backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/90">
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
  );
}

export default Popup;

import { useEffect, useState } from 'react';

function Popup() {
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(true);
  const [showTimelineOnHover, setShowTimelineOnHover] = useState(false);
  const MIN_TIMELINE_HEIGHT = 0;
  const MAX_TIMELINE_HEIGHT = 100;
  const timelineDefaultHeight = 6;

  const [timelineHeight, setTimelineHeight] = useState(timelineDefaultHeight);

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(
      ['invertHorizontalScroll', 'showTimelineOnHover', 'timelineHeight'],
      (result) => {
        setInvertHorizontalScroll(result.invertHorizontalScroll ?? true);
        setShowTimelineOnHover(result.showTimelineOnHover ?? false);
        setTimelineHeight(result.timelineHeight ?? timelineDefaultHeight);
      }
    );
  }, []);

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

  const handleTimelineHeightChange = (height: number) => {
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

  const handleResetDefaults = () => {
    // Reset all settings to defaults
    const defaultSettings = {
      invertHorizontalScroll: true,
      showTimelineOnHover: false,
      timelineHeight: timelineDefaultHeight,
    };

    // Update local state
    setInvertHorizontalScroll(defaultSettings.invertHorizontalScroll);
    setShowTimelineOnHover(defaultSettings.showTimelineOnHover);
    setTimelineHeight(defaultSettings.timelineHeight);

    // Save to storage
    chrome.storage.sync.set(defaultSettings);

    // Send messages to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
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
    <div className="w-80 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-lg dark:from-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-1 flex items-center justify-center gap-3">
          <img src="/icon/48.png" alt="Media Flow Seek" className="h-8 w-8" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Media Flow Seek
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Enhanced video controls & scrolling
        </p>
      </div>

      {/* Settings Section */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="mb-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Scroll Settings
          </h3>
          <button
            onClick={handleResetDefaults}
            className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            Reset Default
          </button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Invert horizontal scroll
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Reverse scroll direction for better control
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={invertHorizontalScroll}
                onChange={(e) => handleScrollInversionToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer relative h-5 w-9 rounded-full bg-gray-100 peer-checked:bg-sky-600 peer-focus:ring-4 peer-focus:ring-sky-300 peer-focus:outline-none after:absolute after:start-[1px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full dark:border-gray-500 dark:bg-gray-600 dark:peer-checked:bg-sky-600 dark:peer-focus:ring-sky-800"></div>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Show timeline on hover
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Display progress bar when hovering over videos
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showTimelineOnHover}
                onChange={(e) => handleTimelineHoverToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer relative h-5 w-9 rounded-full bg-gray-100 peer-checked:bg-sky-600 peer-focus:ring-4 peer-focus:ring-sky-300 peer-focus:outline-none after:absolute after:start-[1px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full dark:border-gray-500 dark:bg-gray-600 dark:peer-checked:bg-sky-600 dark:peer-focus:ring-sky-800"></div>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Timeline height
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Adjust the height of the progress bar
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN_TIMELINE_HEIGHT}
                max={MAX_TIMELINE_HEIGHT}
                value={timelineHeight}
                onChange={(e) =>
                  handleTimelineHeightChange(Number(e.target.value))
                }
                className="h-2 w-16 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                style={{
                  background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${((timelineHeight - MIN_TIMELINE_HEIGHT) / (MAX_TIMELINE_HEIGHT - MIN_TIMELINE_HEIGHT)) * 100}%, #d1d5db ${((timelineHeight - MIN_TIMELINE_HEIGHT) / (MAX_TIMELINE_HEIGHT - MIN_TIMELINE_HEIGHT)) * 100}%, #d1d5db 100%)`,
                }}
              />
              <span className="w-8 font-mono text-xs text-slate-600 dark:text-slate-400">
                {timelineHeight}px
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Made with ❤️ by{' '}
        <a
          href="https://www.linkedin.com/in/pinix/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sky-500 transition-colors duration-200 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          aPinix
        </a>{' '}
        (
        <a
          href="https://github.com/aPinix"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sky-500 transition-colors duration-200 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          GitHub
        </a>
        )
      </div>
    </div>
  );
}

export default Popup;

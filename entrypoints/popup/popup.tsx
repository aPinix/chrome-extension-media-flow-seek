import { useEffect, useState } from 'react';

function Popup() {
  const [invertHorizontalScroll, setInvertHorizontalScroll] = useState(false);

  useEffect(() => {
    // Load saved setting
    chrome.storage.sync.get(['invertHorizontalScroll'], (result) => {
      setInvertHorizontalScroll(result.invertHorizontalScroll || false);
    });
  }, []);

  const handleToggle = (checked: boolean) => {
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

  return (
    <div className="w-80 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-lg dark:from-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-1 text-xl font-bold text-slate-800 dark:text-slate-100">
          Media Flow Seek
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Enhanced video controls & scrolling
        </p>
      </div>

      {/* Settings Section */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Scroll Settings
        </h3>
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
                onChange={(e) => handleToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer relative h-5 w-9 rounded-full bg-gray-100 peer-checked:bg-sky-600 peer-focus:ring-4 peer-focus:ring-sky-300 peer-focus:outline-none after:absolute after:start-[1px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full dark:border-gray-500 dark:bg-gray-600 dark:peer-checked:bg-sky-600 dark:peer-focus:ring-sky-800"></div>
            </label>
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

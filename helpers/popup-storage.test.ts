import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  saveSettings,
  subscribeToEnabledChanges,
} from '@/helpers/popup-storage';

describe('timeline seeking storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults timeline seeking to enabled when no preference is stored', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) => callback({})),
          set: vi.fn(),
        },
      },
    });

    const settings = await loadPopupSettings();

    expect(DEFAULT_SETTINGS.isTimelineSeekingEnabled).toBe(true);
    expect(settings.isTimelineSeekingEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.dragVideoToSeek).toBe(false);
    expect(settings.dragVideoToSeek).toBe(false);
    expect(DEFAULT_SETTINGS.hideVideoControls).toBe(false);
    expect(settings.hideVideoControls).toBe(false);
    expect(DEFAULT_SETTINGS.colorizedTimeline).toBe(false);
    expect(settings.colorizedTimeline).toBe(false);
  });

  it('loads and saves an enabled timeline seeking preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ isTimelineSeekingEnabled: true })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ isTimelineSeekingEnabled: false });

    expect(settings.isTimelineSeekingEnabled).toBe(true);
    expect(set).toHaveBeenCalledWith({ isTimelineSeekingEnabled: false });
  });

  it('loads and saves the hide video controls preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ hideVideoControls: true })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ hideVideoControls: false });

    expect(settings.hideVideoControls).toBe(true);
    expect(set).toHaveBeenCalledWith({ hideVideoControls: false });
  });

  it('loads and saves the drag video to seek preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) => callback({ dragVideoToSeek: true })),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ dragVideoToSeek: false });

    expect(settings.dragVideoToSeek).toBe(true);
    expect(set).toHaveBeenCalledWith({ dragVideoToSeek: false });
  });

  it('loads and saves the colorized timeline preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ colorizedTimeline: true })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ colorizedTimeline: false });

    expect(settings.colorizedTimeline).toBe(true);
    expect(set).toHaveBeenCalledWith({ colorizedTimeline: false });
  });
});

describe('subscribeToEnabledChanges', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards sync storage changes and removes its listener on cleanup', () => {
    let storageListener:
      | ((
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: chrome.storage.AreaName
        ) => void)
      | undefined;
    const removeListener = vi.fn();

    vi.stubGlobal('chrome', {
      storage: {
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener,
        },
      },
    });

    const onChange = vi.fn();
    const cleanup = subscribeToEnabledChanges(onChange);

    storageListener?.(
      { isEnabled: { oldValue: true, newValue: false } },
      'sync'
    );
    storageListener?.(
      { isEnabled: { oldValue: false, newValue: true } },
      'local'
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(false);

    cleanup();
    expect(removeListener).toHaveBeenCalledWith(storageListener);
  });
});

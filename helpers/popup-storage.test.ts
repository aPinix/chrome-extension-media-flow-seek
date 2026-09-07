import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  saveSettings,
  subscribeToEnabledChanges,
} from '@/helpers/popup-storage';
import { SettingsManager } from '@/helpers/settings-manager';
import { SETTINGS_SCHEMA_VERSION } from '@/helpers/settings-migration';
import { DomainSortE } from '@/types/domains';

describe('timeline seeking storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['popup', 'content'] as const)(
    'loads new-install defaults in %s',
    async (loader) => {
      vi.stubGlobal('chrome', {
        storage: {
          sync: {
            get: vi.fn((_keys, callback) => callback({})),
            set: vi.fn(),
          },
        },
      });

      const settings =
        loader === 'popup'
          ? await loadPopupSettings()
          : await new SettingsManager().initialize();

      expect(DEFAULT_SETTINGS.isTimelineSeekingEnabled).toBe(true);
      expect(settings.isTimelineSeekingEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.isScrollSeekingEnabled).toBe(true);
      expect(settings.isScrollSeekingEnabled).toBe(true);
      expect(settings.settingsSchemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
      expect(DEFAULT_SETTINGS.dragVideoToSeek).toBe(false);
      expect(settings.dragVideoToSeek).toBe(false);
      expect(DEFAULT_SETTINGS.hideVideoControls).toBe(false);
      expect(settings.hideVideoControls).toBe(false);
      expect(DEFAULT_SETTINGS.colorizedTimeline).toBe(true);
      expect(settings.colorizedTimeline).toBe(true);
      expect(DEFAULT_SETTINGS.isYouTubeChapteredTimelineEnabled).toBe(true);
      expect(settings.isYouTubeChapteredTimelineEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.isSeekbarThumbnailPreviewEnabled).toBe(true);
      expect(settings.isSeekbarThumbnailPreviewEnabled).toBe(true);
      expect(settings.instagramShowPlaybackSpeed).toBe(true);
      expect(settings.instagramShowAutoSkip).toBe(true);
      expect(settings.tiktokShowPlaybackSpeed).toBe(true);
      expect(settings.tiktokShowAutoSkip).toBe(true);
      expect(settings.instagramAutoSkip).toBe(false);
      expect(settings.tiktokAutoSkip).toBe(false);
      expect(settings.instagramPlaybackSpeed).toBe(1);
      expect(settings.tiktokPlaybackSpeed).toBe(1);
      expect(DEFAULT_SETTINGS.isPlayPauseWheelEnabled).toBe(true);
      expect(settings.isPlayPauseWheelEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.scrollSpeedFactor).toBe(1);
      expect(settings.scrollSpeedFactor).toBe(1);
      expect(DEFAULT_SETTINGS.actionAreaSizeUnit).toBe('%');
      expect(settings.actionAreaSizeUnit).toBe('%');
      expect(DEFAULT_SETTINGS.domainSort).toBe(DomainSortE.Custom);
      if ('domainSort' in settings) {
        expect(settings.domainSort).toBe(DomainSortE.Custom);
      }
    }
  );

  it('loads and saves the website sort preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ domainSort: DomainSortE.DateDescending })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ domainSort: DomainSortE.Custom });

    expect(settings.domainSort).toBe(DomainSortE.DateDescending);
    expect(set).toHaveBeenCalledWith({ domainSort: DomainSortE.Custom });
  });

  it('migrates dormant legacy children without activating them', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({
              isTimelineSeekingEnabled: false,
              dragVideoToSeek: true,
              hideVideoControls: true,
            })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();

    expect(settings.isScrollSeekingEnabled).toBe(true);
    expect(settings.isTimelineSeekingEnabled).toBe(false);
    expect(settings.dragVideoToSeek).toBe(false);
    expect(settings.hideVideoControls).toBe(false);
    expect(set).toHaveBeenCalledWith({
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
      isScrollSeekingEnabled: true,
      isTimelineSeekingEnabled: false,
      dragVideoToSeek: false,
      hideVideoControls: false,
    });
  });

  it('preserves independent Drag and Minimal Player in the current schema', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({
              settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
              isScrollSeekingEnabled: false,
              isTimelineSeekingEnabled: false,
              dragVideoToSeek: true,
              hideVideoControls: true,
            })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();

    expect(settings.isScrollSeekingEnabled).toBe(false);
    expect(settings.dragVideoToSeek).toBe(true);
    expect(settings.hideVideoControls).toBe(true);
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
      })
    );
  });

  it('loads a valid scroll speed factor and normalizes invalid values', async () => {
    let storedFactor = 1.75;
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ scrollSpeedFactor: storedFactor })
          ),
          set: vi.fn(),
        },
      },
    });

    expect((await loadPopupSettings()).scrollSpeedFactor).toBe(1.75);
    storedFactor = 99;
    expect((await loadPopupSettings()).scrollSpeedFactor).toBe(3);
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

  it('preserves saved opt-outs for features enabled by default', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({
              colorizedTimeline: false,
              isYouTubeChapteredTimelineEnabled: false,
              isSeekbarThumbnailPreviewEnabled: false,
              instagramShowPlaybackSpeed: false,
              instagramShowAutoSkip: false,
              tiktokShowPlaybackSpeed: false,
              tiktokShowAutoSkip: false,
            })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ isSeekbarThumbnailPreviewEnabled: false });

    const contentSettings = await new SettingsManager().initialize();
    expect(settings.colorizedTimeline).toBe(false);
    expect(contentSettings.colorizedTimeline).toBe(false);
    expect(settings.isYouTubeChapteredTimelineEnabled).toBe(false);
    expect(contentSettings.isYouTubeChapteredTimelineEnabled).toBe(false);
    expect(settings.isSeekbarThumbnailPreviewEnabled).toBe(false);
    expect(contentSettings.isSeekbarThumbnailPreviewEnabled).toBe(false);
    expect(settings.instagramShowPlaybackSpeed).toBe(false);
    expect(contentSettings.instagramShowPlaybackSpeed).toBe(false);
    expect(settings.instagramShowAutoSkip).toBe(false);
    expect(contentSettings.instagramShowAutoSkip).toBe(false);
    expect(settings.tiktokShowPlaybackSpeed).toBe(false);
    expect(contentSettings.tiktokShowPlaybackSpeed).toBe(false);
    expect(settings.tiktokShowAutoSkip).toBe(false);
    expect(contentSettings.tiktokShowAutoSkip).toBe(false);
    expect(set).toHaveBeenCalledWith({
      isSeekbarThumbnailPreviewEnabled: false,
    });
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

  it('loads and saves the YouTube chaptered timeline preference', async () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_keys, callback) =>
            callback({ isYouTubeChapteredTimelineEnabled: true })
          ),
          set,
        },
      },
    });

    const settings = await loadPopupSettings();
    saveSettings({ isYouTubeChapteredTimelineEnabled: false });

    expect(settings.isYouTubeChapteredTimelineEnabled).toBe(true);
    expect(set).toHaveBeenCalledWith({
      isYouTubeChapteredTimelineEnabled: false,
    });
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

import { describe, expect, it, vi } from 'vitest';

import type { OverlayCreator } from '@/helpers/overlay-creator';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import { MessageHandler } from '@/lib/message-handler';
import type { ChromeMessageT } from '@/types/content';

describe('MessageHandler timeline seeking updates', () => {
  it('previews committed action-area changes on existing page videos', () => {
    const updateSetting = vi.fn();
    const updateAllOverlaysForActionArea = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateAllOverlaysForActionArea,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        isEnabled: () => true,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        type: 'SETTINGS_UPDATED',
        settings: {
          actionArea: 'middle',
          actionAreaSize: 48,
          actionAreaSizeUnit: 'px',
        },
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('actionArea', 'middle');
    expect(updateSetting).toHaveBeenCalledWith('actionAreaSize', 48);
    expect(updateSetting).toHaveBeenCalledWith('actionAreaSizeUnit', 'px');
    expect(updateAllOverlaysForActionArea).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('previews and clears action areas without changing stored settings', () => {
    const updateSetting = vi.fn();
    const previewActionArea = vi.fn();
    const clearActionAreaPreview = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        clearActionAreaPreview,
        previewActionArea,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'previewActionArea',
        actionAreaSize: 35,
        actionAreaSizeUnit: 'px',
        previewActionArea: 'top',
      } as unknown as ChromeMessageT,
      sendResponse
    );
    testHandler.handleMessage(
      {
        action: 'previewActionArea',
        previewActionArea: null,
      } as unknown as ChromeMessageT,
      sendResponse
    );

    expect(previewActionArea).toHaveBeenCalledWith('top', 35, 'px');
    expect(clearActionAreaPreview).toHaveBeenCalledOnce();
    expect(updateSetting).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledTimes(2);
  });

  it('applies a normalized scroll speed factor immediately', () => {
    const updateSetting = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {} as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateScrollSpeedFactor',
        scrollSpeedFactor: 1.75,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('scrollSpeedFactor', 1.75);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies the Scroll to Seek parent switch immediately', () => {
    const updateSetting = vi.fn();
    const updateScrollSeekingState = vi.fn();
    const checkForVideos = vi.fn();
    const handler = new MessageHandler({
      checkForVideos,
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateScrollSeekingState,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        shouldRun: () => true,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateScrollSeeking',
        isScrollSeekingEnabled: false,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('isScrollSeekingEnabled', false);
    expect(updateScrollSeekingState).toHaveBeenCalledOnce();
    expect(checkForVideos).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies popup timeline seeking messages to existing overlays', () => {
    const updateSetting = vi.fn();
    const updateTimelineSeekingState = vi.fn();
    const updateVideoDraggingState = vi.fn();
    const updateVideoControlsVisibility = vi.fn();
    const updateScrollSeekingState = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateTimelineSeekingState,
        updateVideoDraggingState,
        updateVideoControlsVisibility,
        updateScrollSeekingState,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        shouldRun: () => true,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();

    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };
    testHandler.handleMessage(
      {
        action: 'updateTimelineSeeking',
        isTimelineSeekingEnabled: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith(
      'isTimelineSeekingEnabled',
      true
    );
    expect(updateTimelineSeekingState).toHaveBeenCalledOnce();
    expect(updateVideoDraggingState).toHaveBeenCalledOnce();
    expect(updateVideoControlsVisibility).toHaveBeenCalledOnce();
    expect(updateScrollSeekingState).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies drag video to seek messages to existing overlays', () => {
    const updateSetting = vi.fn();
    const updateVideoDraggingState = vi.fn();
    const updateScrollSeekingState = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateVideoDraggingState,
        updateScrollSeekingState,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        shouldRun: () => true,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateDragVideoToSeek',
        dragVideoToSeek: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('dragVideoToSeek', true);
    expect(updateVideoDraggingState).toHaveBeenCalledOnce();
    expect(updateScrollSeekingState).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies hide video controls messages to existing videos', () => {
    const updateSetting = vi.fn();
    const updateVideoControlsVisibility = vi.fn();
    const updateScrollSeekingState = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateVideoControlsVisibility,
        updateScrollSeekingState,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        shouldRun: () => true,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateHideVideoControls',
        hideVideoControls: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('hideVideoControls', true);
    expect(updateVideoControlsVisibility).toHaveBeenCalledOnce();
    expect(updateScrollSeekingState).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('recolors existing timelines when colorization changes', () => {
    const updateSetting = vi.fn();
    const updateTimelineColorization = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateTimelineColorization,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateColorizedTimeline',
        colorizedTimeline: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('colorizedTimeline', true);
    expect(updateTimelineColorization).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('updates chaptered YouTube timelines immediately', () => {
    const updateSetting = vi.fn();
    const updateYouTubeChapteredTimelineState = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateYouTubeChapteredTimelineState,
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      {
        action: 'updateYouTubeChapteredTimeline',
        isYouTubeChapteredTimelineEnabled: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith(
      'isYouTubeChapteredTimelineEnabled',
      true
    );
    expect(updateYouTubeChapteredTimelineState).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('rejects malformed YouTube chaptered timeline messages', () => {
    const updateSetting = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateYouTubeChapteredTimelineState: vi.fn(),
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();
    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };

    testHandler.handleMessage(
      { action: 'updateYouTubeChapteredTimeline' } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid YouTube chaptered timeline setting',
    });
  });

  it('rejects malformed timeline seeking messages', () => {
    const updateSetting = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateTimelineSeekingState: vi.fn(),
      } as unknown as OverlayCreator,
      settingsManager: {
        isDebugEnabled: () => false,
        updateSetting,
      } as unknown as SettingsManager,
      videoStateManager: {} as VideoStateManager,
    });
    const sendResponse = vi.fn();

    const testHandler = handler as unknown as {
      handleMessage: (
        message: ChromeMessageT,
        respond: (response: { success: boolean; error?: string }) => void
      ) => void;
    };
    testHandler.handleMessage(
      { action: 'updateTimelineSeeking' } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid timeline seeking setting',
    });
  });
});

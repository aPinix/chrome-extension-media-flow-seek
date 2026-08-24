import { describe, expect, it, vi } from 'vitest';

import type { OverlayCreator } from '@/helpers/overlay-creator';
import type { SettingsManager } from '@/helpers/settings-manager';
import type { VideoStateManager } from '@/helpers/video-state';
import { MessageHandler } from '@/lib/message-handler';
import type { ChromeMessageT } from '@/types/content';

describe('MessageHandler timeline seeking updates', () => {
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

  it('applies popup timeline seeking messages to existing overlays', () => {
    const updateSetting = vi.fn();
    const updateTimelineSeekingState = vi.fn();
    const updateVideoDraggingState = vi.fn();
    const updateVideoControlsVisibility = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateTimelineSeekingState,
        updateVideoDraggingState,
        updateVideoControlsVisibility,
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
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies drag video to seek messages to existing overlays', () => {
    const updateSetting = vi.fn();
    const updateVideoDraggingState = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateVideoDraggingState,
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
        action: 'updateDragVideoToSeek',
        dragVideoToSeek: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('dragVideoToSeek', true);
    expect(updateVideoDraggingState).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies hide video controls messages to existing videos', () => {
    const updateSetting = vi.fn();
    const updateVideoControlsVisibility = vi.fn();
    const handler = new MessageHandler({
      checkForVideos: vi.fn(),
      getDebugColorBackground: () => '',
      getDebugImageBackground: () => '',
      overlayCreator: {
        updateVideoControlsVisibility,
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
        action: 'updateHideVideoControls',
        hideVideoControls: true,
      } as ChromeMessageT,
      sendResponse
    );

    expect(updateSetting).toHaveBeenCalledWith('hideVideoControls', true);
    expect(updateVideoControlsVisibility).toHaveBeenCalledOnce();
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

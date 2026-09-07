// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.tiktok.com/pt/"}
import { afterEach, expect, it } from 'vitest';
import { OverlayCreator } from '@/helpers/overlay-creator';
import {
  getDocumentOverlayHost,
  removeEmptyOverlayHost,
} from '@/helpers/overlay-portal';
import { SettingsManager } from '@/helpers/settings-manager';
import { VideoStateManager } from '@/helpers/video-state';
import type { VideoStateT } from '@/types/content';

afterEach(() => {
  document.querySelector('.mfs-viewport-portal')?.remove();
});

it('contains offscreen TikTok controls without changing the page overflow', () => {
  const video = document.createElement('video');
  const htmlStyle = document.documentElement.style.cssText;
  const bodyStyle = document.body.style.cssText;
  const host = getDocumentOverlayHost(video);
  const nextVideoControl = document.createElement('div');
  nextVideoControl.style.cssText =
    'position: absolute; top: 1400px; left: 450px; width: 387px; height: 10px';
  host.append(nextVideoControl);
  expect(host.parentElement).toBe(document.documentElement);
  expect(host.style.position).toBe('fixed');
  expect(host.style.inset).toBe('0px');
  expect(host.style.overflow).toBe('hidden');
  expect(host.style.contain).toBe('strict');
  expect(host.style.pointerEvents).toBe('none');
  expect(getDocumentOverlayHost(document.createElement('video'))).toBe(host);
  expect(document.documentElement.style.cssText).toBe(htmlStyle);
  expect(document.body.style.cssText).toBe(bodyStyle);
  removeEmptyOverlayHost(document);
  expect(host.isConnected).toBe(true);
  nextVideoControl.remove();
  removeEmptyOverlayHost(document);
  expect(host.isConnected).toBe(false);
});

it('routes TikTok timeline and volume through the clipped host and preserves fullscreen placement', () => {
  const manager = new VideoStateManager();
  const creator = new OverlayCreator(new SettingsManager(), manager, () => {});
  const methods = creator as unknown as {
    updateTimelinePlacement: (
      video: HTMLVideoElement,
      state: VideoStateT,
      interactive: boolean,
      portal: boolean
    ) => void;
    updateMediaControlsPlacement: (
      video: HTMLVideoElement,
      state: VideoStateT
    ) => void;
  };
  const video = document.createElement('video');
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () =>
    ({
      left: 450,
      right: 837,
      top: 736,
      bottom: 1424,
      width: 387,
      height: 688,
    }) as DOMRect;
  const controls = document.createElement('div');
  controls.dataset.mfsActive = 'true';
  const state: VideoStateT = {
    wrapper,
    mediaControls: controls,
    overlay: document.createElement('div'),
    scrollContent: document.createElement('div'),
    timeline: document.createElement('div'),
    thumbnailPreview: document.createElement('div'),
    debugIndicator: document.createElement('a'),
    isHovering: false,
    isUserScrubbing: false,
  };
  const player = document.createElement('section');
  player.append(video, wrapper);
  document.body.append(player);
  manager.set(video, state);
  try {
    methods.updateTimelinePlacement(video, state, true, true);
    methods.updateMediaControlsPlacement(video, state);
    const host = getDocumentOverlayHost(video);
    expect(state.timeline.parentElement).toBe(host);
    expect(state.thumbnailPreview?.parentElement).toBe(host);
    expect(controls.parentElement).toBe(host);
    expect(controls.style.top).toBe('1344px');
    expect(state.timeline.style.top).toBe('1414px');
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: player,
    });
    methods.updateTimelinePlacement(video, state, true, true);
    methods.updateMediaControlsPlacement(video, state);
    expect(state.timeline.parentElement).toBe(player);
    expect(controls.parentElement).toBe(player);
    Reflect.deleteProperty(document, 'fullscreenElement');
    methods.updateTimelinePlacement(video, state, true, true);
    methods.updateMediaControlsPlacement(video, state);
    manager.delete(video);
    expect(document.querySelector('.mfs-viewport-portal')).toBeNull();
  } finally {
    Reflect.deleteProperty(document, 'fullscreenElement');
    manager.clear();
    player.remove();
  }
});

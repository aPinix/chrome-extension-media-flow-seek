// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/player/"}

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSeekbarThumbnailPreviewElement,
  formatThumbnailPreviewTime,
  getTextTrackThumbnailFrame,
  LazyVideoThumbnailSource,
  SeekbarThumbnailPreviewController,
} from '@/helpers/thumbnail-preview';

const rect = (
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('thumbnail preview labels and metadata', () => {
  it('formats VOD and DVR times', () => {
    expect(formatThumbnailPreviewTime(65)).toBe('1:05');
    expect(formatThumbnailPreviewTime(3_665)).toBe('1:01:05');
    expect(
      formatThumbnailPreviewTime(150, {
        duration: 100,
        end: 200,
        start: 100,
      })
    ).toBe('−0:50');
    expect(
      formatThumbnailPreviewTime(200, {
        duration: 100,
        end: 200,
        start: 100,
      })
    ).toBe('LIVE');
  });

  it('resolves WebVTT thumbnail sprites relative to the track', () => {
    const video = document.createElement('video');
    const track = document.createElement('track');
    track.kind = 'metadata';
    track.src = '/previews/thumbs.vtt';
    Object.defineProperty(track, 'track', {
      configurable: true,
      value: {
        cues: {
          0: {
            endTime: 20,
            startTime: 0,
            text: 'sprites.jpg#xywh=160,90,160,90',
          },
          length: 1,
        },
        kind: 'metadata',
        mode: 'hidden',
      },
    });
    video.appendChild(track);

    expect(getTextTrackThumbnailFrame(video, 10)).toEqual({
      crop: { height: 90, width: 160, x: 160, y: 90 },
      url: 'https://example.com/previews/sprites.jpg',
    });
  });
});

describe('lazy generic video thumbnails', () => {
  it('does not load until requested and never seeks the original video', () => {
    vi.useFakeTimers();
    const source = document.createElement('video');
    source.src = 'https://cdn.example.com/movie.mp4';
    source.currentTime = 12;
    const preview = document.createElement('video');
    preview.load = vi.fn();
    Object.defineProperties(preview, {
      duration: { configurable: true, value: 120 },
      readyState: { configurable: true, value: preview.HAVE_METADATA },
    });
    const onFrameReady = vi.fn();
    const thumbnailSource = new LazyVideoThumbnailSource(
      source,
      preview,
      onFrameReady,
      vi.fn()
    );

    expect(preview.getAttribute('src')).toBeNull();
    expect(thumbnailSource.request(45)).toBe(true);
    expect(preview.src).toBe('https://cdn.example.com/movie.mp4');

    vi.advanceTimersByTime(100);
    expect(preview.currentTime).toBe(45);
    expect(source.currentTime).toBe(12);

    preview.dispatchEvent(new Event('seeked'));
    expect(onFrameReady).toHaveBeenCalledOnce();

    thumbnailSource.cleanup();
  });

  it('declines blob-backed media instead of mutating it', () => {
    const source = document.createElement('video');
    source.src = 'blob:https://example.com/media';
    const preview = document.createElement('video');
    preview.load = vi.fn();
    const thumbnailSource = new LazyVideoThumbnailSource(
      source,
      preview,
      vi.fn(),
      vi.fn()
    );

    expect(thumbnailSource.request(20)).toBe(false);
    expect(preview.getAttribute('src')).toBeNull();

    thumbnailSource.cleanup();
  });
});

describe('seekbar thumbnail preview controller', () => {
  it('shows time and chapter text when no image provider is available', () => {
    const video = document.createElement('video');
    video.src = 'blob:https://example.com/media';
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    wrapper.append(timeline, preview);
    document.body.appendChild(wrapper);
    wrapper.getBoundingClientRect = () => rect(0, 0, 120, 100);
    timeline.getBoundingClientRect = () => rect(10, 90, 100, 6);
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => [{ end: 70, start: 30, title: 'The demo' }],
      isEnabled: () => true,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(60, 92);

    expect(preview.dataset.mfsVisible).toBe('true');
    expect(preview.dataset.mfsImageVisible).toBe('false');
    expect(
      preview.querySelector<HTMLElement>('.mfs-thumbnail-time')?.dataset.mfsTime
    ).toBe('0:50');
    expect(preview.querySelector('.mfs-thumbnail-time')?.textContent).toBe(
      '0:50'
    );
    expect(preview.querySelector('.mfs-thumbnail-chapter')?.textContent).toBe(
      'The demo'
    );

    controller.hide(true);
    expect(preview.dataset.mfsVisible).toBe('false');
    controller.cleanup();
  });

  it('morphs between chapter titles while animating their width', () => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      scheduledFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      scheduledFrames.delete(frameId);
    });
    const runNextFrame = () => {
      const nextFrame = scheduledFrames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      if (!nextFrame) throw new Error('Expected an animation frame');
      scheduledFrames.delete(nextFrame[0]);
      nextFrame[1](0);
    };

    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    wrapper.append(timeline, preview);
    document.body.appendChild(wrapper);
    wrapper.getBoundingClientRect = () => rect(0, 0, 120, 100);
    timeline.getBoundingClientRect = () => rect(10, 90, 100, 6);
    const stage = preview.querySelector<HTMLElement>(
      '.mfs-thumbnail-chapter-stage'
    );
    const measure = preview.querySelector<HTMLElement>(
      '.mfs-thumbnail-chapter-measure'
    );
    if (!(stage && measure)) throw new Error('Missing chapter transition UI');
    stage.getBoundingClientRect = () =>
      rect(0, 0, Number.parseFloat(stage.style.width) || 0, 14);
    Object.defineProperty(measure, 'scrollWidth', {
      configurable: true,
      get: () => (measure.textContent?.length ?? 0) * 6,
    });
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => [
        { end: 50, start: 0, title: 'Intro' },
        { end: 100, start: 50, title: 'A longer chapter' },
      ],
      isEnabled: () => true,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(35, 92);
    runNextFrame();
    expect(stage.style.width).toBe('30px');

    controller.updateAtPoint(85, 92);
    expect(
      preview.querySelector('.mfs-thumbnail-chapter-outgoing')?.textContent
    ).toBe('Intro');
    expect(
      preview.querySelector<HTMLElement>('.mfs-thumbnail-chapter')?.dataset
        .mfsState
    ).toBe('entering');
    runNextFrame();
    expect(stage.style.width).toBe('96px');
    expect(
      preview.querySelector<HTMLElement>('.mfs-thumbnail-chapter-outgoing')
        ?.dataset.mfsState
    ).toBe('leaving');
    expect(
      preview.querySelector<HTMLElement>('.mfs-thumbnail-chapter')?.dataset
        .mfsState
    ).toBe('visible');

    controller.cleanup();
  });

  it('aligns title changes with the midpoint of rendered chapter gaps', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const firstSegment = document.createElement('div');
    firstSegment.className = 'mfs-youtube-chapter-segment';
    firstSegment.getBoundingClientRect = () => rect(10, 90, 24, 6);
    const secondSegment = document.createElement('div');
    secondSegment.className = 'mfs-youtube-chapter-segment';
    secondSegment.getBoundingClientRect = () => rect(38, 90, 72, 6);
    timeline.append(firstSegment, secondSegment);
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    wrapper.append(timeline, preview);
    document.body.appendChild(wrapper);
    wrapper.getBoundingClientRect = () => rect(0, 0, 120, 100);
    timeline.getBoundingClientRect = () => rect(10, 90, 100, 6);
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => [
        { end: 25, start: 0, title: 'First chapter' },
        { end: 100, start: 25, title: 'Second chapter' },
      ],
      isEnabled: () => true,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(35, 92);
    expect(preview.querySelector('.mfs-thumbnail-chapter')?.textContent).toBe(
      'First chapter'
    );

    controller.updateAtPoint(37, 92);
    expect(preview.querySelector('.mfs-thumbnail-chapter')?.textContent).toBe(
      'Second chapter'
    );

    controller.cleanup();
  });

  it('keeps a portaled thumbnail and pill aligned to the seekbar', () => {
    const video = document.createElement('video');
    video.src = 'blob:https://example.com/media';
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    preview.dataset.mfsPortaled = 'true';
    document.body.append(video, wrapper);
    document.documentElement.append(timeline, preview);
    wrapper.getBoundingClientRect = () => rect(100, 50, 300, 200);
    timeline.getBoundingClientRect = () => rect(100, 240, 300, 10);
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => undefined,
      isEnabled: () => true,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(250, 245);

    expect(preview.style.left).toBe('250px');
    expect(preview.style.top).toBe('200px');
    expect(preview.style.maxWidth).toBe('284px');

    controller.cleanup();
    timeline.remove();
    preview.remove();
  });

  it('reuses the preview for loop handles when normal hover thumbnails are disabled', () => {
    const video = document.createElement('video');
    video.src = 'blob:https://example.com/media';
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    preview.dataset.mfsPortaled = 'true';
    document.body.append(video, wrapper);
    document.documentElement.append(timeline, preview);
    wrapper.getBoundingClientRect = () => rect(100, 50, 300, 200);
    timeline.getBoundingClientRect = () => rect(100, 240, 300, 10);
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => undefined,
      isEnabled: () => false,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(250, 245);
    expect(preview.dataset.mfsVisible).toBe('false');
    controller.updateAtPoint(250, 245, 50);
    expect(preview.dataset.mfsVisible).toBe('true');
    expect(preview.querySelector('.mfs-thumbnail-time')?.textContent).toBe('0:50');
    controller.updateAtPoint(250, 245, 65);
    expect(preview.querySelector('.mfs-thumbnail-time')?.textContent).toBe('1:05');

    expect(preview.style.left).toBe('250px');
    expect(preview.style.top).toBe('200px');
    expect(preview.style.maxWidth).toBe('284px');

    controller.cleanup();
    timeline.remove();
    preview.remove();
  });

  it('stays hidden on devices without a fine hover pointer', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: '',
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      }))
    );
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 100,
    });
    const wrapper = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.style.opacity = '1';
    const preview = createSeekbarThumbnailPreviewElement(document);
    const decoder = preview.querySelector('video');
    if (!decoder) throw new Error('Missing decoder video');
    decoder.load = vi.fn();
    wrapper.append(timeline, preview);
    document.body.appendChild(wrapper);
    wrapper.getBoundingClientRect = () => rect(0, 0, 300, 200);
    timeline.getBoundingClientRect = () => rect(10, 190, 280, 6);
    const controller = new SeekbarThumbnailPreviewController({
      getTimelinePosition: () => 'bottom',
      getYouTubeChapters: () => undefined,
      isEnabled: () => true,
      isScrubbing: () => false,
      preview,
      timeline,
      video,
      wrapper,
    });

    controller.updateAtPoint(150, 192);

    expect(preview.dataset.mfsVisible).toBe('false');
    controller.cleanup();
  });
});

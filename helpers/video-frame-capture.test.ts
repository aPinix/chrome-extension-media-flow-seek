// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { screenshotVideo } from './player-actions';

const drawImage = vi.fn();
const createUrl = vi.fn(() => 'blob:test-screenshot');
let downloaded: HTMLAnchorElement | undefined;
let video: HTMLVideoElement;
let context: { drawImage: typeof drawImage; filter: string };
beforeEach(() => {
  vi.useFakeTimers();
  drawImage.mockReset();
  createUrl.mockClear();
  downloaded = undefined;
  context = { drawImage, filter: 'none' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type
  ) {
    expect(this.width).toBe(1920);
    expect(this.height).toBe(1080);
    expect(type).toBe('image/png');
    callback(new Blob(['frame'], { type }));
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloaded = this;
  });
  vi.stubGlobal('URL', {
    createObjectURL: createUrl,
    revokeObjectURL: vi.fn(),
  });
  document.title = 'Test video - YouTube';
  video = document.createElement('video');
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
    readyState: { value: 4 },
  });
  video.currentTime = 65;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('downloads a full-resolution PNG named with the title and video time', async () => {
  await screenshotVideo(video);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0);
  expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
  expect(downloaded?.download).toBe('Test video - YouTube-1-05.png');
  expect(downloaded?.href).toBe('blob:test-screenshot');
  await vi.advanceTimersByTimeAsync(10000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-screenshot');
});
it('does not download when the video source blocks canvas export', async () => {
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(() => {
    throw new DOMException('Tainted canvas', 'SecurityError');
  });
  await expect(screenshotVideo(video)).rejects.toThrow(
    'Screenshot blocked by this video source.'
  );
  expect(downloaded).toBeUndefined();
  expect(createUrl).not.toHaveBeenCalled();
});
it('applies requested effects to the exported frame while clean captures ignore displayed filters', async () => {
  video.style.filter = 'brightness(140%)';
  await screenshotVideo(video);
  expect(context.filter).toBe('none');
  await screenshotVideo(video, {
    brightness: 140,
    contrast: 110,
    saturation: 125,
    grayscale: 20,
  });
  expect(context.filter).toBe(
    'brightness(140%) contrast(110%) saturate(125%) grayscale(20%)'
  );
  expect(video.style.filter).toBe('brightness(140%)');
});

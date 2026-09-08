import { DeferredMediaSeek, getMediaSeekRange } from './media';
import { clamp, type VideoFilters } from './player-tools-settings';

export type LoopRange = { start: number; end: number };
export function remainingSeconds(
  duration: number,
  current: number,
  speed: number
): number | null {
  return Number.isFinite(duration) &&
    duration > 0 &&
    Number.isFinite(speed) &&
    speed > 0
    ? Math.max(0, duration - current) / speed
    : null;
}
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(whole / 3600);
  return `${hours ? `${hours}:` : ''}${hours ? String(Math.floor(whole / 60) % 60).padStart(2, '0') : Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
export function normalizeLoop(
  start: number,
  end: number,
  duration: number
): LoopRange | null {
  if (![start, end, duration].every(Number.isFinite) || duration <= 0)
    return null;
  const a = clamp(Math.min(start, end), 0, duration);
  const b = clamp(Math.max(start, end), 0, duration);
  return b - a + 1e-9 >= 0.1 ? { start: a, end: b } : null;
}
export function moveLoop(
  loop: LoopRange,
  delta: number,
  duration: number
): LoopRange {
  const shift = clamp(delta, -loop.start, duration - loop.end);
  return { start: loop.start + shift, end: loop.end + shift };
}
const seekControllers = new WeakMap<HTMLVideoElement, DeferredMediaSeek>();
export function registerPlayerSeek(
  video: HTMLVideoElement,
  controller = new DeferredMediaSeek(video)
): () => void {
  seekControllers.set(video, controller);
  return () => {
    controller.cancel();
    if (seekControllers.get(video) === controller)
      seekControllers.delete(video);
  };
}
export function seekVideo(video: HTMLVideoElement, time: number): void {
  const range = getMediaSeekRange(video);
  if (range && Number.isFinite(time)) {
    const target = clamp(time, range.start, range.end);
    const controller = seekControllers.get(video);
    if (controller) {
      controller.stage(target);
      controller.commit();
    } else video.currentTime = target;
  }
}
export function skipVideo(video: HTMLVideoElement, delta: number): void {
  seekVideo(video, video.currentTime + delta);
}
export function filterCSS(filters: VideoFilters): string {
  return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%)`;
}
export function downloadBlob(
  doc: Document,
  blob: Blob,
  filename: string
): void {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function screenshotVideo(
  video: HTMLVideoElement,
  filters?: VideoFilters
): Promise<void> {
  if (
    !video.videoWidth ||
    !video.videoHeight ||
    video.readyState < 2 ||
    video.mediaKeys
  )
    throw new Error('Screenshot unavailable for this video.');
  const canvas = video.ownerDocument.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Screenshot unavailable in this browser.');
  if (filters) ctx.filter = filterCSS(filters);
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('Screenshot blocked by this video source.')),
        'image/png'
      );
    } catch {
      reject(new Error('Screenshot blocked by this video source.'));
    }
  });
  const title =
    video.ownerDocument.title
      .replace(/[^\p{L}\p{N} ._-]/gu, '')
      .slice(0, 100) || 'video';
  downloadBlob(
    video.ownerDocument,
    blob,
    `${title}-${formatTime(video.currentTime).replaceAll(':', '-')}.png`
  );
}

type AudioChain = {
  context: AudioContext;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
};
const audioChains = new WeakMap<HTMLVideoElement, AudioChain>();
const boostVersions = new WeakMap<HTMLVideoElement, number>();
// A canvas origin-clean probe checks the *actual* media response (including redirects)
// before an irreversible createMediaElementSource call can silence opaque media.
export function canBoostVideo(video: HTMLVideoElement): boolean {
  if (video.mediaKeys || video.readyState < 2 || !video.videoWidth)
    return false;
  try {
    const canvas = video.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}
export async function boostVideo(
  video: HTMLVideoElement,
  percent: number
): Promise<void> {
  const version = (boostVersions.get(video) ?? 0) + 1;
  boostVersions.set(video, version);
  let chain = audioChains.get(video);
  if (!chain) {
    if (percent <= 100) return;
    if (!canBoostVideo(video))
      throw new Error(
        'Extra volume is unavailable for this video source. Normal volume is unchanged.'
      );
    const context = new AudioContext();
    try {
      const gain = context.createGain();
      const source = context.createMediaElementSource(video);
      source.connect(gain).connect(context.destination);
      chain = { context, gain, source };
      audioChains.set(video, chain);
    } catch {
      await context.close();
      throw new Error('Extra volume is unavailable for this player.');
    }
  }
  await chain.context.resume();
  if (boostVersions.get(video) !== version) return;
  chain.gain.disconnect();
  chain.gain.connect(chain.context.destination);
  chain.gain.gain.setValueAtTime(
    clamp(percent, 100, 1000) / 100,
    chain.context.currentTime
  );
}
export function resetBoost(video: HTMLVideoElement): void {
  boostVersions.set(video, (boostVersions.get(video) ?? 0) + 1);
  const chain = audioChains.get(video);
  if (chain) {
    chain.gain.gain.setValueAtTime(1, chain.context.currentTime);
    chain.gain.disconnect();
    chain.gain.connect(chain.context.destination);
  }
}

import {
  getMediaSeekRange,
  getMediaSeekTarget,
  type MediaSeekRangeT,
} from '@/helpers/media';
import {
  THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT,
  THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE,
  THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT,
} from '@/helpers/thumbnail-preview-time-events';
import type { YouTubeChapterT } from '@/helpers/youtube-chapters';
import {
  getYouTubeStoryboardFrame,
  requestYouTubeStoryboardMetadata,
  type YouTubeStoryboardMetadataT,
} from '@/helpers/youtube-storyboards';

export type ThumbnailImageFrameT = {
  crop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  url: string;
};

const THUMBNAIL_TRACK_KINDS = new Set(['metadata', 'chapters']);
const GENERIC_PREVIEW_SEEK_DELAY_MS = 100;
const GENERIC_PREVIEW_TIMEOUT_MS = 2500;
const GENERIC_PREVIEW_IDLE_RELEASE_MS = 10_000;

const getCueText = (cue: TextTrackCue | null): string => {
  if (!cue) return '';
  const value = (cue as TextTrackCue & { text?: unknown }).text;
  return typeof value === 'string' ? value.trim() : '';
};

const getCueAtTime = (
  cues: TextTrackCueList | null,
  time: number
): TextTrackCue | null => {
  if (!cues) return null;

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (cue && time >= cue.startTime && time < cue.endTime) return cue;
  }

  return null;
};

export const formatThumbnailPreviewTime = (
  time: number,
  range?: MediaSeekRangeT
): string => {
  if (!Number.isFinite(time)) return '0:00';

  if (range && range.start > 0) {
    const remaining = Math.max(0, range.end - time);
    if (remaining < 0.5) return 'LIVE';
    return `−${formatThumbnailPreviewTime(remaining)}`;
  }

  const roundedSeconds = Math.max(0, Math.floor(time));
  const seconds = roundedSeconds % 60;
  const minutes = Math.floor(roundedSeconds / 60) % 60;
  const hours = Math.floor(roundedSeconds / 3600);
  const clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : clock;
};

export const getTextTrackChapterTitle = (
  video: HTMLVideoElement,
  time: number
): string | null => {
  for (let index = 0; index < video.textTracks.length; index += 1) {
    const track = video.textTracks[index];
    if (track?.kind !== 'chapters') continue;
    const title = getCueText(getCueAtTime(track.cues, time));
    if (title) return title;
  }

  return null;
};

const parseThumbnailCue = (
  value: string,
  baseUrl: string
): ThumbnailImageFrameT | null => {
  const firstLine = value.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) return null;

  const cropMatch = firstLine.match(
    /^(.*?)#xywh=(?:pixel:)?(\d+),(\d+),(\d+),(\d+)$/i
  );
  const source = cropMatch?.[1] || firstLine;

  let url: URL;
  try {
    url = new URL(source, baseUrl);
  } catch {
    return null;
  }
  if (!['blob:', 'data:', 'http:', 'https:'].includes(url.protocol)) {
    return null;
  }

  if (!cropMatch) return { url: url.href };
  const [x, y, width, height] = cropMatch.slice(2).map(Number);
  if (
    x === undefined ||
    y === undefined ||
    !width ||
    !height ||
    [x, y, width, height].some((number) => !Number.isFinite(number))
  ) {
    return null;
  }

  return { crop: { height, width, x, y }, url: url.href };
};

export const getTextTrackThumbnailFrame = (
  video: HTMLVideoElement,
  time: number
): ThumbnailImageFrameT | null => {
  const trackElements = Array.from(video.querySelectorAll('track'));
  for (const trackElement of trackElements) {
    if (trackElement.kind !== 'metadata') continue;
    const cue = getCueAtTime(trackElement.track.cues, time);
    if (!cue) continue;
    const frame = parseThumbnailCue(
      getCueText(cue),
      trackElement.src || video.ownerDocument.baseURI
    );
    if (frame) return frame;
  }

  return null;
};

export const prepareThumbnailTextTracks = (
  video: HTMLVideoElement
): (() => void) => {
  const changedTracks: Array<{ mode: TextTrackMode; track: TextTrack }> = [];
  video.querySelectorAll('track').forEach((trackElement) => {
    if (
      !THUMBNAIL_TRACK_KINDS.has(trackElement.kind) ||
      trackElement.track.mode !== 'disabled'
    ) {
      return;
    }

    changedTracks.push({
      mode: trackElement.track.mode,
      track: trackElement.track,
    });
    trackElement.track.mode = 'hidden';
  });

  return () => {
    changedTracks.forEach(({ mode, track }) => {
      track.mode = mode;
    });
  };
};

const getDirectPreviewSource = (video: HTMLVideoElement): string | null => {
  const value = video.currentSrc || video.src;
  if (!value || video.srcObject) return null;

  try {
    const url = new URL(value, video.ownerDocument.baseURI);
    return ['data:', 'file:', 'http:', 'https:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
};

export class LazyVideoThumbnailSource {
  private failedSource: string | null = null;
  private frameTimeout: number | null = null;
  private idleTimeout: number | null = null;
  private requestedTime: number | null = null;
  private seekTimeout: number | null = null;
  private source: string | null = null;

  constructor(
    private readonly sourceVideo: HTMLVideoElement,
    private readonly previewVideo: HTMLVideoElement,
    private readonly onFrameReady: () => void,
    private readonly onUnavailable: () => void
  ) {
    previewVideo.addEventListener('loadedmetadata', this.applyPendingSeek);
    previewVideo.addEventListener('seeked', this.handleSeeked);
    previewVideo.addEventListener('error', this.handleUnavailable);
    previewVideo.addEventListener('encrypted', this.handleUnavailable);
  }

  request(time: number): boolean {
    const nextSource = getDirectPreviewSource(this.sourceVideo);
    if (!nextSource || nextSource === this.failedSource) return false;

    this.clearIdleTimeout();
    if (nextSource !== this.source) this.loadSource(nextSource);
    this.requestedTime = time;
    this.clearSeekTimeout();
    this.seekTimeout = this.ownerWindow.setTimeout(
      this.applyPendingSeek,
      GENERIC_PREVIEW_SEEK_DELAY_MS
    );
    this.restartFrameTimeout();
    return true;
  }

  releaseAfterIdle(): void {
    this.clearIdleTimeout();
    this.idleTimeout = this.ownerWindow.setTimeout(
      () => this.release(),
      GENERIC_PREVIEW_IDLE_RELEASE_MS
    );
  }

  releaseNow(): void {
    this.clearIdleTimeout();
    this.release();
  }

  cleanup(): void {
    this.clearSeekTimeout();
    this.clearFrameTimeout();
    this.clearIdleTimeout();
    this.previewVideo.removeEventListener(
      'loadedmetadata',
      this.applyPendingSeek
    );
    this.previewVideo.removeEventListener('seeked', this.handleSeeked);
    this.previewVideo.removeEventListener('error', this.handleUnavailable);
    this.previewVideo.removeEventListener('encrypted', this.handleUnavailable);
    this.release();
  }

  private get ownerWindow(): Window {
    return this.sourceVideo.ownerDocument.defaultView ?? window;
  }

  private loadSource(source: string): void {
    this.release();
    this.source = source;
    this.previewVideo.muted = true;
    this.previewVideo.autoplay = false;
    this.previewVideo.controls = false;
    this.previewVideo.playsInline = true;
    this.previewVideo.preload = 'metadata';
    const crossOrigin = this.sourceVideo.getAttribute('crossorigin');
    if (crossOrigin === null) {
      this.previewVideo.removeAttribute('crossorigin');
    } else {
      this.previewVideo.setAttribute('crossorigin', crossOrigin);
    }
    this.previewVideo.src = source;
    try {
      this.previewVideo.load();
    } catch {
      this.handleUnavailable();
    }
  }

  private readonly applyPendingSeek = (): void => {
    this.clearSeekTimeout();
    if (
      this.requestedTime === null ||
      this.previewVideo.readyState < this.previewVideo.HAVE_METADATA
    ) {
      return;
    }

    const duration = this.previewVideo.duration;
    const target =
      Number.isFinite(duration) && duration > 0
        ? Math.min(Math.max(0, this.requestedTime), duration)
        : this.requestedTime;
    try {
      this.previewVideo.currentTime = target;
    } catch {
      this.handleUnavailable();
    }
  };

  private readonly handleSeeked = (): void => {
    if (this.requestedTime === null) return;
    this.clearFrameTimeout();
    this.onFrameReady();
  };

  private readonly handleUnavailable = (): void => {
    if (this.source) this.failedSource = this.source;
    this.clearSeekTimeout();
    this.clearFrameTimeout();
    this.onUnavailable();
    this.release();
  };

  private restartFrameTimeout(): void {
    this.clearFrameTimeout();
    this.frameTimeout = this.ownerWindow.setTimeout(
      this.handleUnavailable,
      GENERIC_PREVIEW_TIMEOUT_MS
    );
  }

  private release(): void {
    this.clearSeekTimeout();
    this.clearFrameTimeout();
    this.requestedTime = null;
    this.source = null;
    this.previewVideo.removeAttribute('src');
    try {
      this.previewVideo.load();
    } catch {
      // Removing src is sufficient when a DOM implementation has no load().
    }
  }

  private clearSeekTimeout(): void {
    if (this.seekTimeout === null) return;
    this.ownerWindow.clearTimeout(this.seekTimeout);
    this.seekTimeout = null;
  }

  private clearFrameTimeout(): void {
    if (this.frameTimeout === null) return;
    this.ownerWindow.clearTimeout(this.frameTimeout);
    this.frameTimeout = null;
  }

  private clearIdleTimeout(): void {
    if (this.idleTimeout === null) return;
    this.ownerWindow.clearTimeout(this.idleTimeout);
    this.idleTimeout = null;
  }
}

export const createSeekbarThumbnailPreviewElement = (
  ownerDocument: Document
): HTMLDivElement => {
  const preview = ownerDocument.createElement('div');
  preview.className = 'mfs-seekbar-thumbnail-preview';
  preview.dataset.mfsVisible = 'false';
  preview.dataset.mfsImageVisible = 'false';
  preview.setAttribute('aria-hidden', 'true');
  preview.innerHTML = `
    <div class="mfs-thumbnail-frame">
      <div class="mfs-thumbnail-image"></div>
      <video class="mfs-thumbnail-video" muted playsinline preload="metadata"></video>
      <img class="mfs-thumbnail-loader" alt="" />
    </div>
    <div class="mfs-thumbnail-copy">
      <span class="mfs-thumbnail-time"></span>
      <span class="mfs-thumbnail-chapter-stage" hidden>
        <span class="mfs-thumbnail-chapter" data-mfs-state="entering"></span>
        <span class="mfs-thumbnail-chapter-outgoing" data-mfs-state="idle" aria-hidden="true"></span>
        <span class="mfs-thumbnail-chapter-measure" aria-hidden="true"></span>
      </span>
    </div>
  `;
  return preview;
};

type SeekbarThumbnailPreviewControllerOptionsT = {
  getTimelinePosition: () => 'top' | 'bottom';
  getYouTubeChapters: () => YouTubeChapterT[] | undefined;
  isEnabled: () => boolean;
  isScrubbing: () => boolean;
  preview: HTMLDivElement;
  timeline: HTMLDivElement;
  video: HTMLVideoElement;
  wrapper: HTMLDivElement;
};

export class SeekbarThumbnailPreviewController {
  private currentChapterTitle: string | null = null;
  private currentImageRequest = '';
  private genericSource: LazyVideoThumbnailSource;
  private restoreTextTracks: (() => void) | null = null;
  private storyboardAttemptAt = 0;
  private storyboardAttemptKey: string | null = null;
  private storyboardMetadata: YouTubeStoryboardMetadataT | null = null;
  private lastClientX: number | null = null;
  private readonly chapterElement: HTMLElement;
  private readonly chapterMeasureElement: HTMLElement;
  private readonly chapterOutgoingElement: HTMLElement;
  private readonly chapterStageElement: HTMLElement;
  private chapterTransitionFrame: number | null = null;
  private chapterTransitionTimeout: number | null = null;
  private readonly frameElement: HTMLElement;
  private readonly imageElement: HTMLElement;
  private readonly imageLoader: HTMLImageElement;
  private readonly previewVideo: HTMLVideoElement;
  private currentTimeLabel = '';
  private readonly timeElement: HTMLElement;

  constructor(
    private readonly options: SeekbarThumbnailPreviewControllerOptionsT
  ) {
    const getRequiredElement = <T extends Element>(selector: string): T => {
      const element = options.preview.querySelector<T>(selector);
      if (!element) throw new Error(`Missing thumbnail preview ${selector}`);
      return element;
    };

    this.chapterElement = getRequiredElement('.mfs-thumbnail-chapter');
    this.chapterMeasureElement = getRequiredElement(
      '.mfs-thumbnail-chapter-measure'
    );
    this.chapterOutgoingElement = getRequiredElement(
      '.mfs-thumbnail-chapter-outgoing'
    );
    this.chapterStageElement = getRequiredElement(
      '.mfs-thumbnail-chapter-stage'
    );
    this.frameElement = getRequiredElement('.mfs-thumbnail-frame');
    this.imageElement = getRequiredElement('.mfs-thumbnail-image');
    this.imageLoader = getRequiredElement('.mfs-thumbnail-loader');
    this.previewVideo = getRequiredElement('.mfs-thumbnail-video');
    this.timeElement = getRequiredElement('.mfs-thumbnail-time');
    this.genericSource = new LazyVideoThumbnailSource(
      options.video,
      this.previewVideo,
      () => this.showGenericVideoFrame(),
      () => this.hideImage()
    );
  }

  updateAtPoint(clientX: number, clientY: number, loopTime?: number): void {
    const { timeline, video, wrapper } = this.options;
    const ownerWindow = video.ownerDocument.defaultView;
    const canHoverWithFinePointer =
      !ownerWindow?.matchMedia ||
      ownerWindow.matchMedia('(any-hover: hover) and (any-pointer: fine)')
        .matches;
    if (
      loopTime === undefined && (
      !this.options.isEnabled() ||
      !canHoverWithFinePointer ||
      timeline.style.opacity !== '1')
    ) {
      this.hide();
      return;
    }

    const timelineRect = timeline.getBoundingClientRect();
    const isWithinHorizontalBounds =
      timelineRect.width > 0 &&
      clientX >= timelineRect.left &&
      clientX <= timelineRect.right;
    const isWithinVerticalBounds =
      clientY >= timelineRect.top && clientY <= timelineRect.bottom;
    if (
      !isWithinHorizontalBounds ||
      (!isWithinVerticalBounds && !this.options.isScrubbing() && loopTime === undefined)
    ) {
      this.hide();
      return;
    }

    const range = getMediaSeekRange(video);
    const target = range
      ? getMediaSeekTarget(
          range,
          clientX,
          timelineRect.left,
          timelineRect.width
        )
      : null;
    if (target && loopTime !== undefined && range)
      target.time = Math.max(range.start, Math.min(range.end, loopTime));
    if (!range || !target) {
      this.hide();
      return;
    }

    if (!this.restoreTextTracks) {
      this.restoreTextTracks = prepareThumbnailTextTracks(video);
    }

    this.updateTimeLabel(formatThumbnailPreviewTime(target.time, range), loopTime !== undefined);
    const chapterTitle =
      this.getYouTubeChapterTitleAtPoint(clientX, target.time, timelineRect) ??
      getTextTrackChapterTitle(video, target.time);
    this.updateChapterTitle(chapterTitle);
    this.options.preview.dataset.mfsVisible = 'true';
    this.lastClientX = clientX;
    this.position(clientX, timelineRect, wrapper.getBoundingClientRect());
    this.updateFrame(target.time);
  }

  updateEnabled(): void {
    if (!this.options.isEnabled()) this.hide(true);
  }

  hide(releaseImmediately = false): void {
    this.options.preview.dataset.mfsVisible = 'false';
    if (releaseImmediately) {
      this.resetSources();
    } else {
      this.genericSource.releaseAfterIdle();
    }
  }

  cleanup(): void {
    this.resetSources();
    this.genericSource.cleanup();
    this.timeElement.dispatchEvent(
      new CustomEvent(THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT, { bubbles: true })
    );
  }

  private updateFrame(time: number): void {
    const wrapperRect = this.options.wrapper.getBoundingClientRect();
    if (wrapperRect.width < 144 || wrapperRect.height < 120) {
      this.hideImage();
      return;
    }

    const storyboardFrame = this.getStoryboardMetadata()
      ? getYouTubeStoryboardFrame(
          this.storyboardMetadata as YouTubeStoryboardMetadataT,
          time,
          Math.min(220, wrapperRect.width - 16),
          this.options.video.ownerDocument.defaultView?.devicePixelRatio ?? 1
        )
      : null;
    if (storyboardFrame) {
      this.showBackgroundImage(
        {
          backgroundPosition: storyboardFrame.backgroundPosition,
          backgroundSize: storyboardFrame.backgroundSize,
          height: storyboardFrame.height,
          url: storyboardFrame.url,
          width: storyboardFrame.width,
        },
        () => this.updateTrackOrGenericFrame(time)
      );
      return;
    }

    this.updateTrackOrGenericFrame(time);
  }

  private updateTrackOrGenericFrame(time: number): void {
    const trackFrame = getTextTrackThumbnailFrame(this.options.video, time);
    if (trackFrame) {
      this.showTrackImage(trackFrame, () => this.updateGenericFrame(time));
      return;
    }

    this.updateGenericFrame(time);
  }

  private updateGenericFrame(time: number): void {
    this.imageElement.style.backgroundImage = '';
    this.imageElement.hidden = true;
    this.previewVideo.hidden = false;
    if (!this.genericSource.request(time)) this.hideImage();
  }

  private getStoryboardMetadata(): YouTubeStoryboardMetadataT | null {
    const attemptKey = `${this.options.video.ownerDocument.location.href}|${
      this.options.video.currentSrc
    }`;
    if (attemptKey === this.storyboardAttemptKey && this.storyboardMetadata) {
      return this.storyboardMetadata;
    }

    const now = Date.now();
    if (
      attemptKey === this.storyboardAttemptKey &&
      now - this.storyboardAttemptAt < 1000
    )
      return null;

    this.storyboardAttemptKey = attemptKey;
    this.storyboardAttemptAt = now;
    this.storyboardMetadata = requestYouTubeStoryboardMetadata(
      this.options.video
    );
    return this.storyboardMetadata;
  }

  private showTrackImage(
    frame: ThumbnailImageFrameT,
    onError: () => void
  ): void {
    this.showBackgroundImage(
      {
        crop: frame.crop,
        url: frame.url,
      },
      onError
    );
  }

  private showBackgroundImage(
    {
      backgroundPosition,
      backgroundSize,
      crop,
      height,
      url,
      width,
    }: ThumbnailImageFrameT & {
      backgroundPosition?: string;
      backgroundSize?: string;
      height?: number;
      width?: number;
    },
    onError: () => void
  ): void {
    const requestKey = `${url}|${backgroundPosition}|${backgroundSize}|${
      crop ? `${crop.x},${crop.y},${crop.width},${crop.height}` : ''
    }`;
    if (requestKey === this.currentImageRequest) return;
    this.currentImageRequest = requestKey;
    this.options.preview.dataset.mfsImageVisible = 'false';
    this.previewVideo.hidden = true;
    this.imageElement.hidden = false;

    const applyLoadedImage = () => {
      if (this.currentImageRequest !== requestKey) return;
      let resolvedSize = backgroundSize;
      let resolvedPosition = backgroundPosition;
      if (
        crop &&
        this.imageLoader.naturalWidth &&
        this.imageLoader.naturalHeight
      ) {
        resolvedSize = `${
          (this.imageLoader.naturalWidth / crop.width) * 100
        }% ${(this.imageLoader.naturalHeight / crop.height) * 100}%`;
        resolvedPosition = `${
          this.imageLoader.naturalWidth === crop.width
            ? 0
            : (crop.x / (this.imageLoader.naturalWidth - crop.width)) * 100
        }% ${
          this.imageLoader.naturalHeight === crop.height
            ? 0
            : (crop.y / (this.imageLoader.naturalHeight - crop.height)) * 100
        }%`;
      }

      this.imageElement.style.backgroundImage = `url(${JSON.stringify(url)})`;
      this.imageElement.style.backgroundPosition = resolvedPosition ?? 'center';
      this.imageElement.style.backgroundSize = resolvedSize ?? 'cover';
      this.frameElement.style.aspectRatio =
        width && height
          ? `${width} / ${height}`
          : crop
            ? `${crop.width} / ${crop.height}`
            : '16 / 9';
      this.options.preview.dataset.mfsImageVisible = 'true';
      this.reposition();
    };
    this.imageLoader.onload = applyLoadedImage;
    this.imageLoader.onerror = () => {
      if (this.currentImageRequest !== requestKey) return;
      this.hideImage();
      onError();
    };
    this.imageLoader.src = url;
    if (this.imageLoader.complete && this.imageLoader.naturalWidth > 0) {
      applyLoadedImage();
    }
  }

  private showGenericVideoFrame(): void {
    this.imageElement.hidden = true;
    this.previewVideo.hidden = false;
    this.frameElement.style.aspectRatio = '16 / 9';
    this.options.preview.dataset.mfsImageVisible = 'true';
    this.reposition();
  }

  private hideImage(): void {
    this.currentImageRequest = '';
    this.options.preview.dataset.mfsImageVisible = 'false';
    this.imageElement.hidden = true;
    this.previewVideo.hidden = true;
    this.imageLoader.removeAttribute('src');
  }

  private position(
    clientX: number,
    timelineRect: DOMRect,
    wrapperRect: DOMRect
  ): void {
    this.options.preview.style.maxWidth = `${Math.max(0, wrapperRect.width - 16)}px`;
    const previewWidth =
      this.options.preview.offsetWidth ||
      Math.min(220, Math.max(0, wrapperRect.width - 16));
    const previewHeight =
      this.options.preview.offsetHeight ||
      (this.options.preview.dataset.mfsImageVisible === 'true' ? 158 : 32);
    const halfWidth = previewWidth / 2;
    const relativeX = clientX - wrapperRect.left;
    const left = Math.min(
      Math.max(relativeX, halfWidth + 8),
      wrapperRect.width - halfWidth - 8
    );
    const desiredTop =
      this.options.getTimelinePosition() === 'top'
        ? timelineRect.bottom - wrapperRect.top + 8
        : timelineRect.top - wrapperRect.top - previewHeight - 8;
    const maxTop = Math.max(8, wrapperRect.height - previewHeight - 8);

    const top = Math.min(Math.max(8, desiredTop), maxTop);
    const portalHost = this.options.preview.parentElement;
    if (this.options.preview.dataset.mfsPortaled === 'true' && portalHost) {
      const ownerWindow =
        this.options.video.ownerDocument.defaultView ?? window;
      let portalLeft = wrapperRect.left + left + ownerWindow.scrollX;
      let portalTop = wrapperRect.top + top + ownerWindow.scrollY;

      if (portalHost !== this.options.video.ownerDocument.documentElement) {
        const portalRect = portalHost.getBoundingClientRect();
        portalLeft =
          wrapperRect.left -
          portalRect.left +
          portalHost.scrollLeft -
          portalHost.clientLeft +
          left;
        portalTop =
          wrapperRect.top -
          portalRect.top +
          portalHost.scrollTop -
          portalHost.clientTop +
          top;
      }

      this.options.preview.style.left = `${portalLeft}px`;
      this.options.preview.style.top = `${portalTop}px`;
      return;
    }

    this.options.preview.style.left = `${left}px`;
    this.options.preview.style.top = `${top}px`;
  }

  private updateTimeLabel(label: string, plainText = false): void {
    // Loop previews can update while the animated renderer is hidden. Keep
    // their timestamp readable without depending on custom-element animation.
    if (plainText) {
      if (this.timeElement.getAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE) === 'true')
        this.timeElement.dispatchEvent(new CustomEvent(THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT, { bubbles: true }));
      this.timeElement.textContent = label;
      this.timeElement.dataset.mfsTime = label;
      this.currentTimeLabel = '';
      return;
    }
    if (label === this.currentTimeLabel) return;
    this.currentTimeLabel = label;
    this.timeElement.dataset.mfsTime = label;
    if (
      this.timeElement.getAttribute(
        THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE
      ) !== 'true'
    ) {
      this.timeElement.textContent = label;
    }
    this.timeElement.dispatchEvent(
      new CustomEvent(THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT, {
        bubbles: true,
        detail: { value: label },
      })
    );
  }

  private updateChapterTitle(title: string | null): void {
    const nextTitle = title?.trim() || null;
    if (nextTitle === this.currentChapterTitle) return;

    const previousTitle = this.currentChapterTitle;
    const ownerWindow = this.options.video.ownerDocument.defaultView;
    const currentWidth = this.chapterStageElement.getBoundingClientRect().width;
    this.clearChapterTransition();
    this.currentChapterTitle = nextTitle;
    this.chapterStageElement.hidden = false;
    this.chapterStageElement.style.width = `${currentWidth}px`;
    this.chapterOutgoingElement.textContent = previousTitle ?? '';
    this.chapterOutgoingElement.dataset.mfsState = previousTitle
      ? 'visible'
      : 'idle';
    this.chapterElement.textContent = nextTitle ?? '';
    this.chapterElement.dataset.mfsState = 'entering';

    let targetWidth = 0;
    if (nextTitle) {
      this.chapterMeasureElement.textContent = nextTitle;
      targetWidth = Math.ceil(
        Math.max(
          this.chapterMeasureElement.getBoundingClientRect().width,
          this.chapterMeasureElement.scrollWidth
        )
      );
      this.chapterMeasureElement.textContent = '';
    }

    // Commit the starting width and blur states before morphing to the next
    // title. The stage width drives the pill's intrinsic fit-content width.
    void this.chapterStageElement.offsetWidth;
    const startTransition = () => {
      this.chapterTransitionFrame = null;
      this.chapterOutgoingElement.dataset.mfsState = 'leaving';
      this.chapterElement.dataset.mfsState = nextTitle ? 'visible' : 'entering';
      this.chapterStageElement.style.width = `${targetWidth}px`;

      const finishTransition = () => {
        this.chapterTransitionTimeout = null;
        this.chapterOutgoingElement.textContent = '';
        this.chapterOutgoingElement.dataset.mfsState = 'idle';
        if (nextTitle) {
          this.chapterElement.dataset.mfsState = 'visible';
          return;
        }

        this.chapterElement.textContent = '';
        this.chapterStageElement.hidden = true;
      };

      if (!ownerWindow) {
        finishTransition();
        return;
      }
      this.chapterTransitionTimeout = ownerWindow.setTimeout(
        finishTransition,
        220
      );
    };

    if (!ownerWindow) {
      startTransition();
      return;
    }
    this.chapterTransitionFrame =
      ownerWindow.requestAnimationFrame(startTransition);
  }

  private clearChapterTransition(): void {
    const ownerWindow = this.options.video.ownerDocument.defaultView;
    if (this.chapterTransitionFrame !== null && ownerWindow) {
      ownerWindow.cancelAnimationFrame(this.chapterTransitionFrame);
    }
    if (this.chapterTransitionTimeout !== null && ownerWindow) {
      ownerWindow.clearTimeout(this.chapterTransitionTimeout);
    }
    this.chapterTransitionFrame = null;
    this.chapterTransitionTimeout = null;
    this.chapterOutgoingElement.textContent = '';
    this.chapterOutgoingElement.dataset.mfsState = 'idle';
  }

  private getYouTubeChapterTitleAtPoint(
    clientX: number,
    time: number,
    timelineRect: DOMRect
  ): string | null {
    const chapters = this.options.getYouTubeChapters();
    if (!chapters) return null;

    const segmentRects = Array.from(
      this.options.timeline.querySelectorAll<HTMLElement>(
        '.mfs-youtube-chapter-segment'
      ),
      (segment) => segment.getBoundingClientRect()
    );
    const hasRenderedChapterGeometry =
      segmentRects.length === chapters.length &&
      segmentRects.every(({ width }) => width > 0);
    if (hasRenderedChapterGeometry) {
      const renderedChapterIndex = segmentRects.findIndex((rect, index) => {
        const previousRect = segmentRects[index - 1];
        const nextRect = segmentRects[index + 1];
        const leftBoundary = previousRect
          ? (previousRect.right + rect.left) / 2
          : timelineRect.left;
        const rightBoundary = nextRect
          ? (rect.right + nextRect.left) / 2
          : timelineRect.right;
        return (
          clientX >= leftBoundary &&
          (index === segmentRects.length - 1
            ? clientX <= rightBoundary
            : clientX < rightBoundary)
        );
      });
      if (renderedChapterIndex >= 0) {
        return chapters[renderedChapterIndex]?.title?.trim() || null;
      }
    }

    const chapter = chapters.find(
      ({ end, start }) => time >= start && time < end
    );
    return chapter?.title?.trim() || null;
  }

  reposition(): void {
    if (this.lastClientX === null) return;
    this.position(
      this.lastClientX,
      this.options.timeline.getBoundingClientRect(),
      this.options.wrapper.getBoundingClientRect()
    );
  }

  private resetSources(): void {
    this.clearChapterTransition();
    this.currentChapterTitle = null;
    this.chapterElement.textContent = '';
    this.chapterElement.dataset.mfsState = 'entering';
    this.chapterStageElement.hidden = true;
    this.chapterStageElement.style.width = '0px';
    this.genericSource.releaseNow();
    this.hideImage();
    this.storyboardAttemptAt = 0;
    this.storyboardAttemptKey = null;
    this.storyboardMetadata = null;
    this.restoreTextTracks?.();
    this.restoreTextTracks = null;
  }
}

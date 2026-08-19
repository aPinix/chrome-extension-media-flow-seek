export type MediaSeekRangeT = {
  start: number;
  end: number;
  duration: number;
};

export type MediaSeekTargetT = {
  progress: number;
  time: number;
};

export const MEDIA_SEEK_SETTLE_DELAY_MS = 150;
export const MEDIA_SCROLL_SEEK_SETTLE_DELAY_MS = 300;

const PLAYER_DURATION_ANCESTOR_LIMIT = 4;
const PLAYER_TIME_TOLERANCE_SECONDS = 2;
const FORCED_SEEK_TOLERANCE_SECONDS = 0.1;
const NATIVE_SEEK_ACCEPTANCE_SECONDS = 3;
const NATIVE_SEEK_FALLBACK_DELAY_MS = 1500;
const NATIVE_SEEK_ANCESTOR_LIMIT = 6;
const NATIVE_SEEK_MIN_WIDTH_RATIO = 0.55;
const NATIVE_SEEK_MAX_WIDTH_RATIO = 1.15;
const NATIVE_SEEK_MAX_HEIGHT_PX = 48;
const NATIVE_SEEK_TRACK_MAX_HEIGHT_PX = 12;
const NATIVE_SEEK_CONTROL_PATTERN =
  /(?:^|[\s_-])(seek|scrub|timeline|progress)(?:$|[\s_-])/i;
const NATIVE_SEEK_REQUEST_EVENT = 'media-flow-seek:native-player-seek';
const NATIVE_SEEK_TIME_ATTRIBUTE = 'data-media-flow-seek-native-time';
const NATIVE_SEEK_RESULT_ATTRIBUTE = 'data-media-flow-seek-native-result';
const MEDIA_FLOW_SEEK_ELEMENT_SELECTOR =
  '.scrub-wrapper, .scrub-timeline, .scrub-overlay, .mfs-media-controls, .mfs-seek-speed-label';
const FORCED_SEEK_RETRY_EVENTS: Array<keyof HTMLMediaElementEventMap> = [
  'progress',
  'durationchange',
  'loadedmetadata',
];
const NATIVE_SEEK_CONFIRMATION_EVENTS: Array<keyof HTMLMediaElementEventMap> = [
  'seeking',
  'seeked',
  'timeupdate',
];
const CLOCK_TIME_SOURCE = String.raw`\d+:\d{2}(?::\d{2})?`;
const PLAYER_TIME_PAIR_PATTERN = new RegExp(
  `(${CLOCK_TIME_SOURCE})\\s*\\/\\s*(${CLOCK_TIME_SOURCE})`,
  'g'
);
const playerDurationCache = new WeakMap<
  HTMLVideoElement,
  { source: string; duration: number }
>();

type NativeSeekResultT = 'none' | 'tentative' | 'handled';

const parseClockTime = (value: string): number | null => {
  const parts = value.split(':').map(Number);
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((part) => !Number.isFinite(part) || part < 0)
  )
    return null;

  const seconds = parts.at(-1) ?? 0;
  const minutes = parts.at(-2) ?? 0;
  const hours = parts.length === 3 ? (parts[0] ?? 0) : 0;
  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) return null;

  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Some static Media Source players keep `video.duration` at `Infinity` while
 * incrementally appending segments. Their own controls still expose the known
 * current/total time pair, so use that total instead of mistaking the growing
 * seekable buffer for the complete video. Cache successful hints per source;
 * custom controls can briefly lag behind `currentTime` during a seek.
 */
const getPlayerDurationHint = (video: HTMLVideoElement): number | null => {
  const source = video.currentSrc ?? '';
  const cached = playerDurationCache.get(video);
  if (source && cached?.source === source) return cached.duration;

  let element = video.parentElement;
  for (
    let depth = 0;
    element && depth < PLAYER_DURATION_ANCESTOR_LIMIT;
    depth += 1, element = element.parentElement
  ) {
    const text = element.textContent ?? '';
    PLAYER_TIME_PAIR_PATTERN.lastIndex = 0;

    for (const match of text.matchAll(PLAYER_TIME_PAIR_PATTERN)) {
      const displayedCurrentTime = parseClockTime(match[1] ?? '');
      const displayedDuration = parseClockTime(match[2] ?? '');
      if (
        displayedCurrentTime === null ||
        displayedDuration === null ||
        displayedDuration <= 0 ||
        displayedCurrentTime > displayedDuration ||
        (Number.isFinite(video.currentTime) &&
          Math.abs(displayedCurrentTime - video.currentTime) >
            PLAYER_TIME_TOLERANCE_SECONDS)
      )
        continue;

      if (source) {
        playerDurationCache.set(video, {
          source,
          duration: displayedDuration,
        });
      }
      return displayedDuration;
    }
  }

  return null;
};

export const isMediaTimeBuffered = (
  media: HTMLMediaElement,
  time: number
): boolean => {
  if (!Number.isFinite(time) || !media.buffered) return false;

  for (let index = 0; index < media.buffered.length; index += 1) {
    if (
      time >= media.buffered.start(index) &&
      time <= media.buffered.end(index)
    ) {
      return true;
    }
  }

  return false;
};

type NativeSeekControlCandidateT = {
  element: HTMLElement;
  isSemantic: boolean;
  rect: DOMRect;
  score: number;
};

const isVideoElement = (media: HTMLMediaElement): media is HTMLVideoElement =>
  media.tagName === 'VIDEO';

const isUsableControlRect = (
  rect: DOMRect,
  videoRect: DOMRect,
  allowThinControl: boolean
): boolean => {
  const widthRatio = rect.width / videoRect.width;
  const minimumHeight = allowThinControl ? 2 : 14;

  return (
    Number.isFinite(widthRatio) &&
    widthRatio >= NATIVE_SEEK_MIN_WIDTH_RATIO &&
    widthRatio <= NATIVE_SEEK_MAX_WIDTH_RATIO &&
    rect.height >= minimumHeight &&
    rect.height <= NATIVE_SEEK_MAX_HEIGHT_PX &&
    rect.right >= videoRect.left &&
    rect.left <= videoRect.right &&
    rect.top >= videoRect.top + videoRect.height * 0.5 &&
    rect.bottom <= videoRect.bottom + 12
  );
};

const hasWideThinTrack = (
  element: HTMLElement,
  elementRect: DOMRect,
  ownerWindow: Window & typeof globalThis
): boolean => {
  for (const descendant of element.querySelectorAll<HTMLElement>('*')) {
    if (
      descendant.closest(MEDIA_FLOW_SEEK_ELEMENT_SELECTOR) ||
      !(descendant instanceof ownerWindow.HTMLElement)
    )
      continue;

    const rect = descendant.getBoundingClientRect();
    if (
      rect.width >= elementRect.width * 0.8 &&
      rect.height >= 2 &&
      rect.height <= NATIVE_SEEK_TRACK_MAX_HEIGHT_PX &&
      rect.left >= elementRect.left - 2 &&
      rect.right <= elementRect.right + 2 &&
      rect.top >= elementRect.top - 2 &&
      rect.bottom <= elementRect.bottom + 2
    ) {
      return true;
    }
  }

  return false;
};

const getNativeSeekControl = (
  video: HTMLVideoElement
): NativeSeekControlCandidateT | null => {
  const ownerWindow = video.ownerDocument.defaultView;
  if (!ownerWindow) return null;

  const videoRect = video.getBoundingClientRect();
  if (videoRect.width <= 0 || videoRect.height <= 0) return null;

  let root = video.parentElement;
  for (
    let depth = 0;
    root && depth < NATIVE_SEEK_ANCESTOR_LIMIT;
    depth += 1, root = root.parentElement
  ) {
    const candidates: NativeSeekControlCandidateT[] = [];

    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (
        element === video ||
        !(element instanceof ownerWindow.HTMLElement) ||
        element.closest(MEDIA_FLOW_SEEK_ELEMENT_SELECTOR)
      )
        continue;

      const style = ownerWindow.getComputedStyle(element);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.pointerEvents === 'none' ||
        style.opacity === '0'
      )
        continue;

      const rect = element.getBoundingClientRect();
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role')?.toLowerCase() ?? '';
      const isRangeInput =
        tagName === 'input' &&
        (element as HTMLInputElement).type.toLowerCase() === 'range';
      const controlName = [
        element.id,
        element.className,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-testid'),
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
      const isSemantic =
        isRangeInput ||
        role === 'slider' ||
        NATIVE_SEEK_CONTROL_PATTERN.test(controlName);
      const hasTrack =
        !isSemantic &&
        rect.height >= 14 &&
        hasWideThinTrack(element, rect, ownerWindow);

      if (
        !(isSemantic || hasTrack) ||
        !isUsableControlRect(rect, videoRect, isSemantic)
      )
        continue;

      const widthSimilarity = 1 - Math.abs(1 - rect.width / videoRect.width);
      const bottomProximity = Math.max(
        0,
        1 - Math.abs(videoRect.bottom - rect.bottom) / videoRect.height
      );
      candidates.push({
        element,
        isSemantic,
        rect,
        score:
          (isRangeInput || role === 'slider' ? 200 : isSemantic ? 100 : 50) +
          widthSimilarity * 10 +
          bottomProximity * 5,
      });
    }

    if (candidates.length > 0) {
      candidates.sort((left, right) => right.score - left.score);
      return candidates[0] ?? null;
    }

    if (
      root === video.ownerDocument.body ||
      root === video.ownerDocument.documentElement
    )
      break;
  }

  return null;
};

type ReactClickHandlerT = (event: {
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
  defaultPrevented: boolean;
  isDefaultPrevented: () => boolean;
  isPropagationStopped: () => boolean;
  nativeEvent: MouseEvent;
  pageX: number;
  pageY: number;
  persist: () => void;
  preventDefault: () => void;
  stopPropagation: () => void;
  target: HTMLElement;
  type: 'click';
}) => unknown;

const getReactClickHandler = (
  element: HTMLElement
): ReactClickHandlerT | null => {
  for (const propertyName of Object.getOwnPropertyNames(element)) {
    if (!propertyName.startsWith('__reactProps$')) continue;

    const props = (element as unknown as Record<string, unknown>)[propertyName];
    if (
      props &&
      typeof props === 'object' &&
      typeof (props as { onClick?: unknown }).onClick === 'function'
    ) {
      return (props as { onClick: ReactClickHandlerT }).onClick;
    }
  }

  return null;
};

const seekWithNativeControl = (
  video: HTMLVideoElement,
  time: number
): NativeSeekResultT => {
  const range = getMediaSeekRange(video);
  if (range?.start !== 0) return 'none';

  const candidate = getNativeSeekControl(video);
  const ownerWindow = video.ownerDocument.defaultView;
  if (!candidate || !ownerWindow) return 'none';

  const progress = Math.min(
    1,
    Math.max(0, (time - range.start) / range.duration)
  );
  const { element, isSemantic, rect } = candidate;

  if (element instanceof ownerWindow.HTMLInputElement) {
    const minimum = Number(element.min || 0);
    const maximum = Number(element.max || 100);
    if (
      Number.isFinite(minimum) &&
      Number.isFinite(maximum) &&
      maximum > minimum
    ) {
      element.value = String(minimum + progress * (maximum - minimum));
      element.dispatchEvent(
        new ownerWindow.Event('input', { bubbles: true, composed: true })
      );
      element.dispatchEvent(
        new ownerWindow.Event('change', { bubbles: true, composed: true })
      );
      return 'tentative';
    }
  }

  const clientX = rect.left + progress * rect.width;
  const clientY = rect.top + rect.height / 2;
  const nativeEvent = new ownerWindow.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    composed: true,
  });
  const reactClickHandler = getReactClickHandler(element);

  // React's delegated event listener is hidden from an extension's isolated
  // world. In the MAIN-world bridge we can invoke the site's own handler with
  // the same values its synthetic click event exposes. Steam's handler then
  // replaces the active MSE segment, just like a real click on its timeline.
  if (reactClickHandler) {
    let defaultPrevented = false;
    let propagationStopped = false;
    const pageX = clientX + ownerWindow.scrollX;
    const pageY = clientY + ownerWindow.scrollY;

    try {
      reactClickHandler({
        button: 0,
        buttons: 0,
        clientX,
        clientY,
        currentTarget: element,
        get defaultPrevented() {
          return defaultPrevented;
        },
        isDefaultPrevented: () => defaultPrevented,
        isPropagationStopped: () => propagationStopped,
        nativeEvent,
        pageX,
        pageY,
        persist: () => undefined,
        preventDefault: () => {
          defaultPrevented = true;
          nativeEvent.preventDefault();
        },
        stopPropagation: () => {
          propagationStopped = true;
          nativeEvent.stopPropagation();
        },
        target: element,
        type: 'click',
      });
      return 'handled';
    } catch {
      // Fall through to the native event path for non-standard handlers.
    }
  }

  const wasNotCancelled = element.dispatchEvent(nativeEvent);

  // Geometry-only candidates are deliberately conservative: a real timeline
  // normally cancels the click after handling it (Steam does). Semantic
  // sliders are safe to await even when their framework does not cancel it.
  return !wasNotCancelled ? 'handled' : isSemantic ? 'tentative' : 'none';
};

const requestMainWorldNativeSeek = (
  video: HTMLVideoElement,
  time: number
): NativeSeekResultT => {
  const ownerWindow = video.ownerDocument.defaultView;
  if (!ownerWindow) return 'none';

  video.setAttribute(NATIVE_SEEK_TIME_ATTRIBUTE, String(time));
  video.removeAttribute(NATIVE_SEEK_RESULT_ATTRIBUTE);

  try {
    video.dispatchEvent(
      new ownerWindow.Event(NATIVE_SEEK_REQUEST_EVENT, {
        bubbles: true,
        composed: true,
      })
    );
    const result = video.getAttribute(NATIVE_SEEK_RESULT_ATTRIBUTE);
    return result === 'handled' || result === 'tentative' ? result : 'none';
  } finally {
    video.removeAttribute(NATIVE_SEEK_TIME_ATTRIBUTE);
    video.removeAttribute(NATIVE_SEEK_RESULT_ATTRIBUTE);
  }
};

const tryNativePlayerSeekResult = (
  video: HTMLVideoElement,
  time: number
): NativeSeekResultT => {
  if (
    !Number.isFinite(time) ||
    Number.isFinite(video.duration) ||
    isMediaTimeBuffered(video, time)
  )
    return 'none';

  const bridgedResult = requestMainWorldNativeSeek(video, time);
  return bridgedResult === 'none'
    ? seekWithNativeControl(video, time)
    : bridgedResult;
};

/**
 * Install the small DOM-event bridge used by the MAIN-world content script.
 * DOM attributes are used only for the duration of the synchronous request so
 * Firefox and Chromium do not need to clone cross-world CustomEvent details.
 */
export const installNativePlayerSeekBridge = (
  ownerDocument: Document = document
): (() => void) => {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) return () => undefined;

  const handleSeekRequest = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof ownerWindow.HTMLVideoElement)) return;

    const time = Number(target.getAttribute(NATIVE_SEEK_TIME_ATTRIBUTE));
    if (!Number.isFinite(time)) return;

    target.setAttribute(
      NATIVE_SEEK_RESULT_ATTRIBUTE,
      seekWithNativeControl(target, time)
    );
  };

  ownerDocument.addEventListener(
    NATIVE_SEEK_REQUEST_EVENT,
    handleSeekRequest,
    true
  );
  return () => {
    ownerDocument.removeEventListener(
      NATIVE_SEEK_REQUEST_EVENT,
      handleSeekRequest,
      true
    );
  };
};

/**
 * Ask a nearby site-owned timeline to perform the seek when an incrementally
 * loaded MSE video clamps direct `currentTime` assignments. Players such as
 * Steam know how to replace the active SourceBuffer with the segment around
 * the requested position, while assigning `video.currentTime` alone can only
 * advance to the end of the currently appended range.
 */
export const tryNativePlayerSeek = (
  video: HTMLVideoElement,
  time: number
): boolean => tryNativePlayerSeekResult(video, time) !== 'none';

/**
 * Seek immediately inside already buffered media, while coalescing unbuffered
 * scrub targets into one seek. Assigning `currentTime` for every unbuffered
 * scroll event can make streaming players request many intermediate byte
 * ranges instead of loading only around the final target.
 */
export class DeferredMediaSeek {
  private pendingTime: number | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private forcedTime: number | null = null;
  private forceRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isListeningForForceRetry = false;
  private nativeSeekTime: number | null = null;
  private nativeSeekFallbackTimeout: ReturnType<typeof setTimeout> | null =
    null;
  private isListeningForNativeSeek = false;

  private readonly queueForceRetry = (): void => {
    if (
      this.forcedTime === null ||
      this.pendingTime !== null ||
      this.forceRetryTimeout !== null
    )
      return;

    this.forceRetryTimeout = setTimeout(() => {
      this.forceRetryTimeout = null;
      if (this.forcedTime === null || this.pendingTime !== null) return;

      this.apply(this.forcedTime, false);
    }, 0);
  };

  private readonly confirmNativeSeek = (): void => {
    if (this.nativeSeekTime === null) return;

    const actualTime = this.media.currentTime;
    if (
      Number.isFinite(actualTime) &&
      Math.abs(actualTime - this.nativeSeekTime) <=
        NATIVE_SEEK_ACCEPTANCE_SECONDS
    ) {
      this.stopNativeSeekFallback();
    }
  };

  constructor(
    private readonly media: HTMLMediaElement,
    private readonly delayMs = MEDIA_SEEK_SETTLE_DELAY_MS,
    private readonly onError?: (error: unknown) => void
  ) {}

  /**
   * Update a gesture's target without starting an unloaded media request.
   * Buffered targets remain immediate so ordinary local scrubbing stays live.
   */
  stage(time: number): void {
    if (!Number.isFinite(time)) return;

    // A new gesture always supersedes a previously clamped target.
    this.stopForcedSeek();
    this.stopNativeSeekFallback();

    if (isMediaTimeBuffered(this.media, time)) {
      this.pendingTime = null;
      this.clearTimeout();
      this.apply(time);
      return;
    }

    this.pendingTime = time;
    this.clearTimeout();
  }

  schedule(time: number): void {
    this.stage(time);
    if (this.pendingTime === null) return;

    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.commit();
    }, this.delayMs);
  }

  commit(): void {
    if (this.pendingTime === null) return;

    const time = this.pendingTime;
    this.pendingTime = null;
    this.clearTimeout();

    this.apply(time);
  }

  cancel(): void {
    this.pendingTime = null;
    this.clearTimeout();
    this.stopForcedSeek();
    this.stopNativeSeekFallback();
  }

  private apply(time: number, allowNativeSeek = true): void {
    try {
      if (allowNativeSeek && isVideoElement(this.media)) {
        const nativeSeekResult = tryNativePlayerSeekResult(this.media, time);
        if (nativeSeekResult === 'handled') return;
        if (nativeSeekResult === 'tentative') {
          this.startNativeSeekFallback(time);
          return;
        }
      }

      this.media.currentTime = time;

      const actualTime = this.media.currentTime;
      const wasClamped =
        !Number.isFinite(actualTime) ||
        Math.abs(actualTime - time) > FORCED_SEEK_TOLERANCE_SECONDS;

      if (wasClamped && !isMediaTimeBuffered(this.media, time)) {
        this.startForcedSeek(time);
      } else {
        this.stopForcedSeek();
      }
    } catch (error) {
      this.onError?.(error);
    }
  }

  private startNativeSeekFallback(time: number): void {
    this.stopNativeSeekFallback();
    this.nativeSeekTime = time;

    NATIVE_SEEK_CONFIRMATION_EVENTS.forEach((eventName) => {
      this.media.addEventListener(eventName, this.confirmNativeSeek);
    });
    this.isListeningForNativeSeek = true;

    this.nativeSeekFallbackTimeout = setTimeout(() => {
      const fallbackTime = this.nativeSeekTime;
      this.stopNativeSeekFallback();
      if (fallbackTime !== null) this.apply(fallbackTime, false);
    }, NATIVE_SEEK_FALLBACK_DELAY_MS);

    const actualTime = this.media.currentTime;
    if (
      Number.isFinite(actualTime) &&
      Math.abs(actualTime - time) <= FORCED_SEEK_TOLERANCE_SECONDS
    ) {
      this.stopNativeSeekFallback();
    }
  }

  private startForcedSeek(time: number): void {
    this.forcedTime = time;
    if (this.isListeningForForceRetry) return;

    FORCED_SEEK_RETRY_EVENTS.forEach((eventName) => {
      this.media.addEventListener(eventName, this.queueForceRetry);
    });
    this.isListeningForForceRetry = true;
  }

  private stopForcedSeek(): void {
    this.forcedTime = null;
    if (this.forceRetryTimeout !== null) {
      clearTimeout(this.forceRetryTimeout);
      this.forceRetryTimeout = null;
    }
    if (!this.isListeningForForceRetry) return;

    FORCED_SEEK_RETRY_EVENTS.forEach((eventName) => {
      this.media.removeEventListener(eventName, this.queueForceRetry);
    });
    this.isListeningForForceRetry = false;
  }

  private stopNativeSeekFallback(): void {
    this.nativeSeekTime = null;
    if (this.nativeSeekFallbackTimeout !== null) {
      clearTimeout(this.nativeSeekFallbackTimeout);
      this.nativeSeekFallbackTimeout = null;
    }
    if (!this.isListeningForNativeSeek) return;

    NATIVE_SEEK_CONFIRMATION_EVENTS.forEach((eventName) => {
      this.media.removeEventListener(eventName, this.confirmNativeSeek);
    });
    this.isListeningForNativeSeek = false;
  }

  private clearTimeout(): void {
    if (this.timeout === null) return;
    clearTimeout(this.timeout);
    this.timeout = null;
  }
}

/**
 * Return the usable timeline for both regular videos and live/DVR streams.
 * A finite media duration is preferable because `seekable` may initially only
 * contain the buffered portion of an otherwise seekable on-demand video.
 */
export const getMediaSeekRange = (
  video: HTMLVideoElement
): MediaSeekRangeT | null => {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return { start: 0, end: video.duration, duration: video.duration };
  }

  const playerDuration = getPlayerDurationHint(video);
  if (playerDuration !== null) {
    let end = playerDuration;
    for (let index = 0; index < video.seekable.length; index += 1) {
      const seekableEnd = video.seekable.end(index);
      if (Number.isFinite(seekableEnd)) end = Math.max(end, seekableEnd);
    }
    return { start: 0, end, duration: end };
  }

  if (video.seekable.length === 0) return null;

  const lastRangeIndex = video.seekable.length - 1;
  const start = video.seekable.start(lastRangeIndex);
  const end = video.seekable.end(lastRangeIndex);
  const duration = end - start;

  // A non-finite on-demand MSE video often exposes [0, appendedEnd] here.
  // That end grows with the download and is not a usable total duration. A
  // positive start, however, identifies a bounded live/DVR window.
  if (
    !Number.isFinite(start) ||
    start <= 0 ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    return null;

  return { start, end, duration };
};

export const getMediaProgress = (
  video: HTMLVideoElement,
  range: MediaSeekRangeT
): number => {
  const progress = (video.currentTime - range.start) / range.duration;
  return Math.min(1, Math.max(0, progress));
};

export const getMediaSeekTarget = (
  range: MediaSeekRangeT,
  clientX: number,
  timelineLeft: number,
  timelineWidth: number
): MediaSeekTargetT | null => {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(timelineLeft) ||
    !Number.isFinite(timelineWidth) ||
    timelineWidth <= 0
  )
    return null;

  const progress = Math.min(
    1,
    Math.max(0, (clientX - timelineLeft) / timelineWidth)
  );

  return {
    progress,
    time: range.start + progress * range.duration,
  };
};

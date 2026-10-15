export const YOUTUBE_PIP_REQUEST = 'mfs-youtube-pip-request';
export const YOUTUBE_PIP_RESULT = 'mfs-youtube-pip-result';
export const YOUTUBE_PIP_SETTINGS_CHANGED = 'mfs-youtube-pip-settings';
export const YOUTUBE_PIP_SIZE_KEY = 'youtubePipSize';
export const DEFAULT_YOUTUBE_PIP_SIZE = { width: 360, height: 203 };

export type DocumentPip = {
  window: Window | null;
  requestWindow(options: {
    width: number;
    height: number;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
};
export type PipWindow = Window & { documentPictureInPicture?: DocumentPip };

export function normalizeYouTubePipSize(value: unknown) {
  const size = value as Partial<typeof DEFAULT_YOUTUBE_PIP_SIZE> | null;
  return size &&
    typeof size.width === 'number' &&
    Number.isFinite(size.width) &&
    size.width >= 1 &&
    typeof size.height === 'number' &&
    Number.isFinite(size.height) &&
    size.height >= 1
    ? { width: Math.round(size.width), height: Math.round(size.height) }
    : { ...DEFAULT_YOUTUBE_PIP_SIZE };
}

// Runs in the page's MAIN world so YouTube's own requests and Media Session
// registrations reach the same controller as the extension's PiP button.
export function installYouTubePipBridge(
  doc: Document
): (() => void) | undefined {
  const win = doc.defaultView as PipWindow | null;
  if (
    !win ||
    win !== win.top ||
    !/(^|\.)youtube\.com$/.test(doc.location.hostname) ||
    !win.documentPictureInPicture
  )
    return;
  const videoPrototype = (win as Window & typeof globalThis).HTMLVideoElement
    .prototype;
  const originalRequest = videoPrototype.requestPictureInPicture;
  const requests = new WeakMap<HTMLVideoElement, Promise<Window>>();
  const request = (video: HTMLVideoElement): Promise<Window> | null => {
    const pending = requests.get(video);
    if (pending) return pending;
    // DOM events and attributes cross extension worlds. JavaScript objects and
    // promise properties on CustomEvent.detail do not reliably cross them.
    const event = new Event(YOUTUBE_PIP_REQUEST, { cancelable: true });
    let finish: () => void = () => {};
    const promise = new Promise<Window>((resolve, reject) => {
      finish = () => {
        video.removeEventListener(YOUTUBE_PIP_RESULT, finish);
        const error = video.dataset.mfsPipError;
        delete video.dataset.mfsPipError;
        const pip = win.documentPictureInPicture?.window;
        if (error || !pip)
          reject(new Error(error || 'Picture-in-Picture was closed.'));
        else resolve(pip);
      };
      video.addEventListener(YOUTUBE_PIP_RESULT, finish);
    });
    video.dispatchEvent(event);
    if (!event.defaultPrevented) {
      video.removeEventListener(YOUTUBE_PIP_RESULT, finish);
      return null;
    }
    requests.set(video, promise);
    void promise.then(
      () => requests.delete(video),
      () => requests.delete(video)
    );
    return promise;
  };
  videoPrototype.requestPictureInPicture = function () {
    if (
      this.dataset.mfsPipOverride !== 'true' ||
      this.dataset.mfsPipMode === 'chrome-video'
    )
      return originalRequest.call(this);
    const pending = request(this);
    if (!pending) return originalRequest.call(this);
    return pending.then((pip) => {
      if (!pip) throw new Error('Picture-in-Picture was closed.');
      const result = new EventTarget();
      Object.defineProperties(result, {
        width: { get: () => pip.innerWidth },
        height: { get: () => pip.innerHeight },
      });
      pip.addEventListener('resize', () =>
        result.dispatchEvent(new Event('resize'))
      );
      return result as PictureInPictureWindow;
    });
  };
  const session = win.navigator.mediaSession;
  if (!session)
    return () => {
      videoPrototype.requestPictureInPicture = originalRequest;
    };
  // TypeScript's DOM types do not yet include this Chromium Media Session action.
  const pipAction = 'enterpictureinpicture' as MediaSessionAction;
  const setActionHandler = session.setActionHandler.bind(session);
  let siteHandler: MediaSessionActionHandler | null = null;
  let overriding = false;
  let active: HTMLVideoElement | null = null;
  const activeVideo = () => {
    if (active?.dataset.mfsPipOverride === 'true' && active.isConnected)
      return active;
    active = doc.querySelector<HTMLVideoElement>(
      'video[data-mfs-pip-override="true"]'
    );
    return active;
  };
  const api = win.documentPictureInPicture;
  const originalDocumentRequest = api.requestWindow;
  api.requestWindow = function (options) {
    const video = activeVideo();
    const pending =
      video && video.dataset.mfsPipMode !== 'chrome-video'
        ? request(video)
        : null;
    return pending
      ? pending.then((pip) => {
          if (!pip) throw new Error('Picture-in-Picture was closed.');
          return pip;
        })
      : originalDocumentRequest.call(this, options);
  };
  const handler: MediaSessionActionHandler = (details) => {
    const video = activeVideo();
    if (!video) {
      siteHandler?.(details);
      return;
    }
    const reason =
      (
        details as MediaSessionActionDetails & {
          enterPictureInPictureReason?: string;
          reason?: string;
        }
      ).enterPictureInPictureReason ??
      (details as MediaSessionActionDetails & { reason?: string }).reason;
    // Chromium can deliver the automatic action before visibility changes.
    // Prefer its explicit reason; older versions fall back to document.hidden.
    const automatic = reason === 'contentoccluded' || (!reason && doc.hidden);
    if (
      automatic &&
      (video.dataset.mfsPipAuto !== 'true' || video.paused || video.ended)
    )
      return;
    if (video.dataset.mfsPipMode === 'chrome-video')
      void originalRequest.call(video).catch(() => {});
    else void request(video)?.catch(() => {});
  };
  const originalSetActionHandler = session.setActionHandler;
  session.setActionHandler = (action, callback) => {
    if (action === pipAction) {
      siteHandler = callback;
      if (overriding) return;
    }
    setActionHandler(action, callback);
  };
  const changed = () => {
    const enabled = Boolean(activeVideo());
    if (enabled === overriding) return;
    try {
      setActionHandler(pipAction, enabled ? handler : siteHandler);
      overriding = enabled;
    } catch {
      // Older Chromium versions do not support this Media Session action.
    }
  };
  doc.addEventListener(YOUTUBE_PIP_SETTINGS_CHANGED, changed);
  return () => {
    doc.removeEventListener(YOUTUBE_PIP_SETTINGS_CHANGED, changed);
    videoPrototype.requestPictureInPicture = originalRequest;
    api.requestWindow = originalDocumentRequest;
    session.setActionHandler = originalSetActionHandler;
    if (overriding) setActionHandler(pipAction, siteHandler);
  };
}

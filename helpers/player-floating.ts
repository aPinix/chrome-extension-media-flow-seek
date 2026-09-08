import {
  formatTime,
  type LoopRange,
  remainingSeconds,
  seekVideo,
  skipVideo,
} from './player-actions';
import { clamp, type PlayerToolsSettings } from './player-tools-settings';
import { button, element, TOOLS_STYLES } from './player-tools-ui';

type Geometry = { x: number; y: number; width: number };
export function clampMiniGeometry(
  g: Geometry,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number
): Geometry {
  const maxWidth = Math.max(
    100,
    Math.min(viewportWidth - 16, (viewportHeight - 64) * aspect)
  );
  const width = clamp(g.width, Math.min(240, maxWidth), maxWidth);
  return {
    width,
    x: clamp(g.x, 8, Math.max(8, viewportWidth - width - 8)),
    y: clamp(g.y, 40, Math.max(40, viewportHeight - width / aspect - 8)),
  };
}
type DocumentPip = {
  window: Window | null;
  requestWindow(options: { width: number; height: number }): Promise<Window>;
};
type PipWindow = Window & { documentPictureInPicture?: DocumentPip };

export class FloatingPlayer {
  private doc: Document;
  private win: Window;
  private placeholder: HTMLElement | null = null;
  private player: HTMLElement | null = null;
  private restoreStyles: (() => void) | null = null;
  private bar: HTMLElement;
  private resize: HTMLButtonElement;
  private geometry: Geometry = { x: 10000, y: 10000, width: 360 };
  private suppressed = false;
  private pip: Window | null = null;
  private restorePip: (() => void) | null = null;
  private disposed = false;
  private pendingPip = false;
  private generation = 0;
  private geometrySignature = '';
  private drag: {
    x: number;
    y: number;
    geometry: Geometry;
    resize: boolean;
  } | null = null;
  private cleanupEvents: Array<() => void> = [];

  constructor(
    private video: HTMLVideoElement,
    root: ShadowRoot,
    private settings: () => PlayerToolsSettings,
    private isYouTube: boolean,
    private report: (text: string) => void,
    private setSpeed: (speed: number) => void,
    private getLoop: () => { range: LoopRange | null; enabled: boolean }
  ) {
    this.doc = video.ownerDocument;
    this.win = this.doc.defaultView ?? window;
    this.bar = element(this.doc, 'div', 'mini-bar');
    this.bar.hidden = true;
    this.bar.append(element(this.doc, 'span', '', 'Better Video Controls'));
    button(
      this.doc,
      'Close',
      () => {
        this.suppressed = true;
        this.restoreMini();
      },
      this.bar
    );
    this.resize = element(this.doc, 'button', 'resize', '↘');
    this.resize.title = 'Resize mini player';
    this.resize.setAttribute('aria-label', this.resize.title);
    this.resize.hidden = true;
    root.append(this.bar, this.resize);
    const listen = (
      target: EventTarget,
      type: string,
      handler: EventListener
    ) => {
      target.addEventListener(type, handler);
      this.cleanupEvents.push(() => target.removeEventListener(type, handler));
    };
    const start = (event: Event, resizing: boolean) => {
      const e = event as PointerEvent;
      if (
        e.button !== 0 ||
        (!resizing && (e.target as Element).closest('button'))
      )
        return;
      e.preventDefault();
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        geometry: { ...this.geometry },
        resize: resizing,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    listen(this.bar, 'pointerdown', (e) => start(e, false));
    listen(this.resize, 'pointerdown', (e) => start(e, true));
    for (const node of [this.bar, this.resize]) {
      listen(node, 'pointermove', (event) => {
        if (!this.drag) return;
        const e = event as PointerEvent;
        const old = this.drag.geometry;
        this.geometry = this.drag.resize
          ? { ...old, width: old.width + e.clientX - this.drag.x }
          : {
              ...old,
              x: old.x + e.clientX - this.drag.x,
              y: old.y + e.clientY - this.drag.y,
            };
        this.layoutMini();
      });
      const finish = () => {
        if (!this.drag) return;
        this.drag = null;
        void chrome.storage.local
          .set({ miniPlayerGeometry: this.geometry })
          .catch(() => this.report('Could not save mini player position.'));
      };
      listen(node, 'pointerup', finish);
      listen(node, 'pointercancel', finish);
    }
    void chrome.storage.local
      .get('miniPlayerGeometry')
      .then((data) => {
        const g = data.miniPlayerGeometry as Geometry | undefined;
        if (!this.disposed && g && [g.x, g.y, g.width].every(Number.isFinite))
          this.geometry = g;
      })
      .catch(() => {});
  }
  get inPip(): boolean {
    return Boolean(
      this.pip ||
        this.pendingPip ||
        this.doc.pictureInPictureElement === this.video
    );
  }
  update(): void {
    if (this.disposed) return;
    if (
      !this.isYouTube ||
      !this.settings().miniPlayer ||
      this.inPip ||
      this.doc.fullscreenElement ||
      this.suppressed
    ) {
      this.restoreMini();
      return;
    }
    const anchor = this.placeholder ?? this.video;
    const rect = anchor.getBoundingClientRect();
    const outside = rect.bottom <= 0 || rect.top >= this.win.innerHeight;
    if (!outside) {
      this.restoreMini();
      return;
    }
    if (!this.player && !this.video.paused) this.startMini();
    this.layoutMini();
  }
  private startMini(): void {
    const player = this.video.closest<HTMLElement>('#movie_player');
    if (!player || player.classList.contains('ad-showing')) return;
    this.player = player;
    const rect = player.getBoundingClientRect();
    this.placeholder = element(this.doc, 'div');
    this.placeholder.style.height = `${rect.height}px`;
    this.placeholder.style.width = '100%';
    player.before(this.placeholder);
    const snapshots: Array<{
      element: HTMLElement;
      property: string;
      value: string;
      priority: string;
    }> = [];
    const preserve = (element: HTMLElement, properties: string[]) => {
      for (const property of properties)
        snapshots.push({
          element,
          property,
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property),
        });
    };
    preserve(player, [
      'position',
      'left',
      'top',
      'width',
      'height',
      'z-index',
      'margin',
      'max-width',
      'max-height',
    ]);
    preserve(this.video, ['width', 'height', 'left', 'top', 'object-fit']);
    const videoContainer = this.video.closest<HTMLElement>(
      '.html5-video-container'
    );
    if (videoContainer) {
      preserve(videoContainer, ['width', 'height']);
      videoContainer.style.setProperty('width', '100%', 'important');
      videoContainer.style.setProperty('height', '100%', 'important');
    }
    for (const [property, value] of Object.entries({
      width: '100%',
      height: '100%',
      left: '0',
      top: '0',
      'object-fit': 'contain',
    }))
      this.video.style.setProperty(property, value, 'important');
    // YouTube's #player creates a stacking context below recommendation cards.
    // Raise that context while floating, without reparenting the site's player.
    const stackingHost = player.closest<HTMLElement>('#player');
    if (stackingHost) {
      preserve(stackingHost, ['z-index']);
      stackingHost.style.setProperty('z-index', '2147483644', 'important');
    }
    const playerHost = player.closest<HTMLElement>('ytd-player');
    if (playerHost) {
      preserve(playerHost, ['overflow']);
      playerHost.style.setProperty('overflow', 'visible', 'important');
    }
    player.dataset.mfsMini = 'true';
    this.restoreStyles = () => {
      for (const { element, property, value, priority } of snapshots) {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
      delete player.dataset.mfsMini;
    };
    this.bar.hidden = this.resize.hidden = false;
  }
  private layoutMini(): void {
    if (!this.player) return;
    const aspect =
      this.video.videoWidth && this.video.videoHeight
        ? this.video.videoWidth / this.video.videoHeight
        : 16 / 9;
    this.geometry = clampMiniGeometry(
      this.geometry,
      this.win.innerWidth,
      this.win.innerHeight,
      aspect
    );
    const { x, y, width } = this.geometry;
    const height = width / aspect;
    const signature = `${x}:${y}:${width}:${height}`;
    if (signature === this.geometrySignature) return;
    this.geometrySignature = signature;
    for (const [key, value] of Object.entries({
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      'z-index': '2147483645',
      margin: '0',
      'max-width': 'none',
      'max-height': 'none',
    }))
      this.player.style.setProperty(key, value, 'important');
    this.bar.style.cssText = `left:${x}px;top:${y - 32}px;width:${width}px;height:32px`;
    this.resize.style.cssText = `left:${x + width - 25}px;top:${y + height - 25}px`;
  }
  restoreMini(): void {
    if (!this.player) return;
    this.restoreStyles?.();
    this.restoreStyles = null;
    this.placeholder?.remove();
    this.placeholder = null;
    this.player = null;
    this.geometrySignature = '';
    this.bar.hidden = this.resize.hidden = true;
  }
  async openPip(): Promise<void> {
    if (this.inPip) return;
    this.restoreMini();
    const generation = this.generation;
    const api = (this.win as PipWindow).documentPictureInPicture;
    if (!api || this.win !== this.win.top) {
      if (
        !this.doc.pictureInPictureEnabled ||
        !this.video.requestPictureInPicture
      )
        throw new Error('Picture-in-Picture is unavailable for this player.');
      this.pendingPip = true;
      try {
        await this.video.requestPictureInPicture();
      } finally {
        this.pendingPip = false;
      }
      if (this.disposed || generation !== this.generation) {
        if (this.doc.pictureInPictureElement === this.video)
          await this.doc.exitPictureInPicture();
        return;
      }
      this.report(
        'Native PiP is active; this browser provides its own controls.'
      );
      return;
    }
    this.pendingPip = true;
    let pip: Window;
    try {
      pip = await api.requestWindow({ width: 560, height: 400 });
    } finally {
      this.pendingPip = false;
    }
    if (this.disposed || generation !== this.generation) {
      pip.close();
      return;
    }
    this.pip = pip;
    const video = this.video;
    const marker = this.doc.createComment('mfs-pip-video');
    video.before(marker);
    const style = video.getAttribute('style');
    const wasPlaying = !video.paused;
    const host = element(pip.document, 'div');
    pip.document.body.style.cssText = 'margin:0;background:#000;color:#fff';
    // Source-page overlays may follow the moved video through their portal.
    // PiP owns its own controls; keep those source overlays out of this window.
    const sourceOverlayStyle = pip.document.createElement('style');
    sourceOverlayStyle.textContent =
      '.scrub-wrapper,.mfs-media-controls,.mfs-seekbar-thumbnail-preview,.mfs-youtube-chapter-tooltip,.mfs-seek-speed-label{display:none!important}';
    pip.document.head.append(sourceOverlayStyle);
    pip.document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const css = element(pip.document, 'style');
    css.textContent = TOOLS_STYLES;
    shadow.append(css);
    video.dataset.mfsPip = 'true';
    shadow.append(video);
    video.style.cssText =
      'display:block;width:100%;height:calc(100vh - 112px);object-fit:contain';
    if (style) {
      const original = this.doc.createElement('div');
      original.setAttribute('style', style);
      video.style.filter = original.style.filter;
    }
    const controls = element(pip.document, 'div', 'pip-controls');
    shadow.append(controls);
    const play = button(
      pip.document,
      'Play / pause',
      () => {
        if (video.paused)
          void video
            .play()
            .catch(() => this.report('Playback could not start.'));
        else video.pause();
      },
      controls
    );
    button(
      pip.document,
      'Rewind',
      () => skipVideo(video, -this.settings().backward),
      controls
    );
    button(
      pip.document,
      'Forward',
      () => skipVideo(video, this.settings().forward),
      controls
    );
    const seek = element(pip.document, 'input');
    seek.type = 'range';
    seek.min = '0';
    seek.step = '.1';
    seek.setAttribute('aria-label', 'Seek');
    controls.append(seek);
    seek.oninput = () => seekVideo(video, seek.valueAsNumber);
    const volume = element(pip.document, 'input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '1';
    volume.step = '.01';
    volume.setAttribute('aria-label', 'Volume');
    controls.append(volume);
    volume.oninput = () => {
      video.volume = volume.valueAsNumber;
      video.muted = video.volume === 0;
    };
    const speed = element(pip.document, 'input');
    speed.type = 'number';
    speed.min = '.25';
    speed.max = '4';
    speed.step = '.05';
    speed.setAttribute('aria-label', 'Playback speed');
    controls.append(speed);
    speed.onchange = () => {
      if (speed.checkValidity()) this.setSpeed(speed.valueAsNumber);
    };
    const remaining = element(pip.document, 'span');
    controls.append(remaining);
    const loopButton = button(
      pip.document,
      'Toggle loop',
      () =>
        this.doc.dispatchEvent(
          new CustomEvent('mfs-toggle-active-loop', { detail: video })
        ),
      controls
    );
    button(pip.document, 'Back to tab', () => pip.close(), controls);
    const sync = () => {
      const activeLoop = this.getLoop();
      loopButton.disabled = !activeLoop.range;
      loopButton.textContent = activeLoop.range
        ? `${activeLoop.enabled ? 'Disable' : 'Enable'} loop ${formatTime(activeLoop.range.start)}–${formatTime(activeLoop.range.end)}`
        : 'No active loop';
      play.textContent = video.paused ? 'Play' : 'Pause';
      seek.max = String(Number.isFinite(video.duration) ? video.duration : 0);
      seek.disabled = !Number.isFinite(video.duration);
      seek.value = String(video.currentTime);
      volume.value = String(video.muted ? 0 : video.volume);
      if (shadow.activeElement !== speed)
        speed.value = String(video.playbackRate);
      const left = remainingSeconds(
        video.duration,
        video.currentTime,
        video.playbackRate
      );
      remaining.textContent = left === null ? '' : `${formatTime(left)} left`;
    };
    for (const event of [
      'timeupdate',
      'volumechange',
      'ratechange',
      'play',
      'pause',
    ])
      video.addEventListener(event, sync);
    sync();
    if (wasPlaying) void video.play().catch(() => {});
    const restore = () => {
      if (!this.restorePip) return;
      this.restorePip = null;
      for (const event of [
        'timeupdate',
        'volumechange',
        'ratechange',
        'play',
        'pause',
      ])
        video.removeEventListener(event, sync);
      const playing = !video.paused;
      if (marker.parentNode) marker.replaceWith(video);
      if (style === null) video.removeAttribute('style');
      else video.setAttribute('style', style);
      delete video.dataset.mfsPip;
      this.pip = null;
      if (playing && video.isConnected && !this.disposed)
        void video.play().catch(() => {});
      this.win.dispatchEvent(new Event('resize'));
    };
    this.restorePip = restore;
    pip.addEventListener('pagehide', restore, { once: true });
  }
  reset(): void {
    this.generation++;
    this.suppressed = false;
    this.restoreMini();
    const pip = this.pip;
    this.restorePip?.();
    pip?.close();
    if (this.doc.pictureInPictureElement === this.video)
      void this.doc.exitPictureInPicture().catch(() => {});
  }
  cleanup(): void {
    this.disposed = true;
    this.reset();
    for (const clean of this.cleanupEvents) clean();
    this.bar.remove();
    this.resize.remove();
  }
}

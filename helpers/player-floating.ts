import { getMediaSeekRange } from './media';
import {
  DEFAULT_MINI_PLAYER_GEOMETRY,
  MINI_PLAYER_GEOMETRY_KEY,
  type MiniPlayerGeometry,
  normalizeMiniPlayerGeometry,
} from './mini-player-settings';
import {
  formatTime,
  type LoopRange,
  remainingSeconds,
  seekVideo,
  skipVideo,
} from './player-actions';
import { clamp, type PlayerToolsSettings } from './player-tools-settings';
import { button, element, TOOLS_STYLES } from './player-tools-ui';

type Geometry = MiniPlayerGeometry;
export function clampMiniGeometry(
  g: Geometry,
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
  top = DEFAULT_MINI_PLAYER_GEOMETRY.y
): Geometry {
  const maxWidth = Math.max(
    1,
    Math.min(viewportWidth - 16, (viewportHeight - top - 8) * aspect)
  );
  const width = clamp(g.width, Math.min(240, maxWidth), maxWidth);
  return {
    width,
    x: clamp(g.x, 8, Math.max(8, viewportWidth - width - 8)),
    y: clamp(
      g.y,
      Math.min(top, Math.max(32, viewportHeight - width / aspect - 8)),
      Math.max(top, viewportHeight - width / aspect - 8)
    ),
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
  private overlayHost: HTMLElement;
  private placeholder: HTMLElement | null = null;
  private player: HTMLElement | null = null;
  private restoreStyles: (() => void) | null = null;
  private bar: HTMLElement;
  private resize: HTMLButtonElement;
  private controls: HTMLElement;
  private miniStatus: HTMLElement;
  private play: HTMLButtonElement;
  private backward: HTMLButtonElement;
  private forward: HTMLButtonElement;
  private mute: HTMLButtonElement;
  private volume: HTMLInputElement;
  private seek: HTMLInputElement;
  private seekHint: HTMLElement;
  private seekDrag: { x: number; y: number; time: number } | null = null;
  private geometry: Geometry = { ...DEFAULT_MINI_PLAYER_GEOMETRY };
  private renderedGeometry: Geometry = { ...DEFAULT_MINI_PLAYER_GEOMETRY };
  private geometryReady = false;
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
    private getLoop: () => { range: LoopRange | null; enabled: boolean },
    private onFloat: () => void = () => {}
  ) {
    this.doc = video.ownerDocument;
    this.win = this.doc.defaultView ?? window;
    this.overlayHost = root.host as HTMLElement;
    this.bar = element(this.doc, 'div', 'mini-bar');
    this.bar.hidden = true;
    this.bar.tabIndex = 0;
    this.bar.setAttribute('role', 'group');
    this.bar.setAttribute(
      'aria-label',
      'Move mini player. Use arrow keys; Shift for fine adjustments.'
    );
    const back = button(
      this.doc,
      'Back to top',
      () => {
        this.restoreMini();
        this.win.scrollTo({ top: 0, behavior: 'instant' });
      },
      this.bar
    );
    this.setIcon(back, 'Back to top', 'M5 19V5h14M5 5l14 14');
    back.className = 'mini-return';
    const close = button(
      this.doc,
      'Close',
      () => {
        this.suppressed = true;
        this.restoreMini();
      },
      this.bar
    );
    this.setIcon(close, 'Close mini player', 'M6 6l12 12M18 6 6 18');
    close.className = 'mini-close';
    close.append(element(this.doc, 'span', '', 'Close'));
    this.controls = element(this.doc, 'div', 'mini-controls');
    this.controls.hidden = true;
    this.controls.setAttribute('role', 'group');
    this.controls.setAttribute('aria-label', 'Mini player playback controls');
    this.miniStatus = element(this.doc, 'p', 'mini-status');
    this.miniStatus.setAttribute('role', 'status');
    this.controls.append(this.miniStatus);
    const middle = element(this.doc, 'div', 'mini-middle');
    this.controls.append(middle);
    this.play = button(
      this.doc,
      'Play',
      () => {
        if (this.video.paused)
          void this.video
            .play()
            .catch(() => this.report('Playback could not start.'));
        else this.video.pause();
      },
      middle
    );
    this.backward = button(
      this.doc,
      'Seek backward',
      () => skipVideo(this.video, -this.settings().backward),
      middle
    );
    this.forward = button(
      this.doc,
      'Seek forward',
      () => skipVideo(this.video, this.settings().forward),
      middle
    );
    this.play.className = 'mini-play';
    this.backward.className = this.forward.className = 'mini-skip';
    middle.replaceChildren(this.backward, this.play, this.forward);
    const volumeControls = element(this.doc, 'div', 'mini-volume');
    this.controls.append(volumeControls);
    this.mute = button(
      this.doc,
      'Mute',
      () => {
        this.video.muted = !this.video.muted;
      },
      volumeControls
    );
    this.volume = element(this.doc, 'input');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '1';
    this.volume.step = '.01';
    this.volume.setAttribute('aria-label', 'Mini player volume');
    volumeControls.append(this.volume);
    this.volume.addEventListener('input', () => {
      this.video.volume = this.volume.valueAsNumber;
      this.video.muted = this.video.volume === 0;
    });
    this.seek = element(this.doc, 'input', 'mini-seek');
    this.seek.type = 'range';
    this.seek.step = '.1';
    this.seek.setAttribute('aria-label', 'Mini player seek');
    this.seek.addEventListener('input', () =>
      seekVideo(this.video, this.seek.valueAsNumber)
    );
    this.controls.append(this.seek);
    this.seekHint = element(this.doc, 'p', 'mini-seek-hint');
    this.seekHint.hidden = true;
    this.controls.append(this.seekHint);
    this.resize = element(this.doc, 'button', 'resize', '↘');
    this.resize.title = 'Resize mini player';
    this.resize.setAttribute('aria-label', this.resize.title);
    this.resize.hidden = true;
    root.append(this.bar, this.controls, this.resize);
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
        geometry: { ...this.renderedGeometry },
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
        this.geometry = { ...this.renderedGeometry };
      });
      const finish = () => {
        if (!this.drag) return;
        this.drag = null;
        this.saveGeometry();
      };
      listen(node, 'pointerup', finish);
      listen(node, 'pointercancel', finish);
      listen(node, 'lostpointercapture', finish);
      listen(node, 'keydown', (event) => {
        const e = event as KeyboardEvent;
        if (
          e.target !== node ||
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const delta =
          (e.shiftKey ? 1 : 10) *
          (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
        this.geometry = { ...this.renderedGeometry };
        if (node === this.resize) this.geometry.width += delta;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
          this.geometry.x += delta;
        else this.geometry.y += delta;
        this.layoutMini();
        this.geometry = { ...this.renderedGeometry };
      });
      listen(node, 'keyup', (event) => {
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
            (event as KeyboardEvent).key
          )
        )
          this.saveGeometry();
      });
    }
    for (const type of [
      'play',
      'pause',
      'volumechange',
      'durationchange',
      'loadedmetadata',
      'resize',
      'timeupdate',
      'progress',
      'seeked',
    ])
      listen(video, type, () => {
        this.update();
        this.syncControls();
      });
    const keyboardMode = (enabled: boolean) => {
      for (const node of [this.bar, this.controls, this.resize])
        node.dataset.keyboard = String(enabled);
    };
    listen(this.doc, 'keydown', () => keyboardMode(true));
    listen(this.doc, 'pointerdown', () => keyboardMode(false));
    listen(this.seek, 'pointerdown', (event) => {
      const e = event as PointerEvent;
      const range = getMediaSeekRange(this.video);
      if (e.button !== 0 || !range) return;
      e.preventDefault();
      const rect = this.seek.getBoundingClientRect();
      const time =
        range.start +
        clamp((e.clientX - rect.left) / rect.width, 0, 1) *
          (range.end - range.start);
      seekVideo(this.video, time);
      this.seekDrag = { x: e.clientX, y: e.clientY, time };
      this.seek.setPointerCapture?.(e.pointerId);
      this.controls.dataset.seeking = 'true';
      this.seekHint.textContent = 'Drag upwards to seek precisely';
      this.seekHint.hidden = false;
      this.syncControls();
    });
    listen(this.seek, 'pointermove', (event) => {
      if (!this.seekDrag) return;
      const e = event as PointerEvent;
      const range = getMediaSeekRange(this.video);
      if (!range) return;
      const upwards = Math.max(0, this.seekDrag.y - e.clientY);
      const sensitivity = 1 / (1 + upwards / 24);
      const delta =
        ((e.clientX - this.seekDrag.x) /
          this.seek.getBoundingClientRect().width) *
        (range.end - range.start) *
        sensitivity;
      this.seekDrag.time = clamp(
        this.seekDrag.time + delta,
        range.start,
        range.end
      );
      this.seekDrag.x = e.clientX;
      seekVideo(this.video, this.seekDrag.time);
      this.seekHint.textContent =
        upwards >= 24 ? 'Precise seeking' : 'Drag upwards to seek precisely';
      this.syncControls();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      listen(this.seek, type, () => {
        this.seekDrag = null;
        this.controls.dataset.seeking = 'false';
        this.seekHint.hidden = true;
      });
    const storageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (
        area === 'local' &&
        changes[MINI_PLAYER_GEOMETRY_KEY] &&
        !this.disposed &&
        !this.drag
      ) {
        this.geometry = normalizeMiniPlayerGeometry(
          changes[MINI_PLAYER_GEOMETRY_KEY].newValue
        );
        this.update();
      }
    };
    chrome.storage.onChanged?.addListener(storageChanged);
    this.cleanupEvents.push(() =>
      chrome.storage.onChanged?.removeListener(storageChanged)
    );
    void chrome.storage.local
      .get(MINI_PLAYER_GEOMETRY_KEY)
      .then((data) => {
        if (!this.disposed)
          this.geometry = normalizeMiniPlayerGeometry(
            data[MINI_PLAYER_GEOMETRY_KEY]
          );
      })
      .catch(() => {})
      .finally(() => {
        if (!this.disposed) {
          this.geometryReady = true;
          this.update();
        }
      });
  }
  private setIcon(node: HTMLButtonElement, label: string, path: string): void {
    node.title = label;
    node.setAttribute('aria-label', label);
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const shape = this.doc.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    node.replaceChildren(svg);
  }
  private syncControls(): void {
    this.setIcon(
      this.play,
      this.video.paused ? 'Play' : 'Pause',
      this.video.paused
        ? 'M3 3Q3 1 5 2l17 9q2 1 0 2L5 22q-2 1-2-1Z'
        : 'M8 3v18M16 3v18'
    );
    this.setIcon(
      this.backward,
      `Seek backward ${this.settings().backward} seconds`,
      'M9 4a8 8 0 1 0 6 0'
    );
    this.setIcon(
      this.forward,
      `Seek forward ${this.settings().forward} seconds`,
      'M15 4a8 8 0 1 1-6 0'
    );
    for (const [node, interval] of [
      [this.backward, this.settings().backward],
      [this.forward, this.settings().forward],
    ] as const) {
      const arrow = this.doc.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      arrow.setAttribute(
        'd',
        node === this.backward ? 'M13 0 6 4l7 4Z' : 'M11 0l7 4-7 4Z'
      );
      arrow.setAttribute('fill', 'currentColor');
      arrow.setAttribute('stroke', 'none');
      node.querySelector('svg')?.append(arrow);
      const text = this.doc.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('x', '12');
      text.setAttribute('y', '12');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', 'currentColor');
      text.setAttribute('stroke', 'none');
      text.setAttribute(
        'font-size',
        String(Math.min(8, 24 / String(interval).length))
      );
      text.setAttribute('font-weight', '700');
      text.textContent = String(interval);
      node.querySelector('svg')?.append(text);
    }
    this.setIcon(
      this.mute,
      this.video.muted ? 'Unmute' : 'Mute',
      `M11 5 6 9H3v6h3l5 4V5Z${this.video.muted ? 'm16 9 5 6m0-6-5 6' : 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'}`
    );
    this.volume.value = String(this.video.muted ? 0 : this.video.volume);
    const volumePercentage = this.video.muted ? 0 : this.video.volume * 100;
    this.volume.style.setProperty(
      '--seek-background',
      `linear-gradient(to right,#fff ${volumePercentage}%,#ffffff55 ${volumePercentage}%)`
    );
    const range = getMediaSeekRange(this.video);
    this.seek.disabled = !range;
    if (range) {
      this.seek.min = String(range.start);
      this.seek.max = String(range.end);
      this.seek.value = String(this.video.currentTime);
      this.seek.setAttribute(
        'aria-valuetext',
        `${formatTime(this.video.currentTime)} of ${formatTime(range.end)}`
      );
      const percentage = clamp(
        ((this.video.currentTime - range.start) / (range.end - range.start)) *
          100,
        0,
        100
      );
      this.seek.style.setProperty(
        '--seek-background',
        `linear-gradient(to right,#fff ${percentage}%,#ffffff55 ${percentage}%)`
      );
    }
  }
  private saveGeometry(): void {
    this.miniStatus.textContent = '';
    void chrome.storage.local
      .set({ [MINI_PLAYER_GEOMETRY_KEY]: { ...this.geometry } })
      .catch(() => {
        if (this.disposed) return;
        this.miniStatus.textContent =
          'Could not save mini player position and size.';
        this.report(this.miniStatus.textContent);
      });
  }
  private headerBottom(): number {
    const header = this.doc.querySelector('ytd-masthead, #masthead-container');
    return Math.max(0, header?.getBoundingClientRect().bottom || 64);
  }
  get inMini(): boolean {
    return this.player !== null;
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
      this.doc.location.pathname !== '/watch' ||
      !this.video.isConnected ||
      !this.settings().miniPlayer ||
      this.inPip ||
      this.doc.fullscreenElement ||
      this.video
        .closest('#movie_player')
        ?.matches('.ad-showing,.ad-interrupting')
    ) {
      this.restoreMini();
      return;
    }
    const anchor =
      this.placeholder ?? this.video.closest('#movie_player') ?? this.video;
    const rect = anchor.getBoundingClientRect();
    const outside = rect.bottom <= this.headerBottom();
    if (!outside) {
      this.suppressed = false;
      this.restoreMini();
      return;
    }
    if (this.suppressed || !this.geometryReady) return;
    if (!this.player && !this.video.paused) this.startMini();
    this.layoutMini();
    this.syncControls();
  }
  private startMini(): void {
    const player = this.video.closest<HTMLElement>('#movie_player');
    if (!player || player.matches('.ad-showing,.ad-interrupting')) return;
    this.player = player;
    this.onFloat();
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
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'max-width',
      'max-height',
      'border-radius',
      'overflow',
      'border',
      'padding',
      ...['top', 'right', 'bottom', 'left'].flatMap((side) => [
        `border-${side}-width`,
        `border-${side}-style`,
        `border-${side}-color`,
        `padding-${side}`,
      ]),
      'border-image',
    ]);
    preserve(this.video, [
      'width',
      'height',
      'max-width',
      'max-height',
      'left',
      'top',
      'object-fit',
    ]);
    const videoContainer = this.video.closest<HTMLElement>(
      '.html5-video-container'
    );
    if (videoContainer) {
      preserve(videoContainer, [
        'width',
        'height',
        'max-width',
        'max-height',
        'left',
        'top',
      ]);
      videoContainer.style.setProperty('width', '100%', 'important');
      videoContainer.style.setProperty('height', '100%', 'important');
    }
    for (const [property, value] of Object.entries({
      width: '100%',
      height: '100%',
      'max-width': 'none',
      'max-height': 'none',
      left: '0',
      top: '0',
      'object-fit': 'cover',
    }))
      this.video.style.setProperty(property, value, 'important');
    let restoreLayers = () => {};
    let promoted = false;
    // The browser top layer keeps the same DOM/video nodes while escaping
    // YouTube's clipping and stacking, without raising the full-size backdrop.
    if (
      typeof player.showPopover === 'function' &&
      typeof this.overlayHost.showPopover === 'function' &&
      !player.hasAttribute('popover') &&
      !this.overlayHost.hasAttribute('popover')
    ) {
      const host = this.overlayHost;
      const originalHostStyle = host.getAttribute('style');
      for (const [property, value] of Object.entries({
        margin: '0',
        border: '0',
        padding: '0',
        width: '100vw',
        height: '100vh',
        background: 'transparent',
      }))
        host.style.setProperty(property, value, 'important');
      player.setAttribute('popover', 'manual');
      host.setAttribute('popover', 'manual');
      const releasePromotion = () => {
        for (const node of [host, player]) {
          try {
            node.hidePopover();
          } catch {
            // Navigation may have already disconnected or closed the popover.
          }
          node.removeAttribute('popover');
        }
        if (originalHostStyle === null) host.removeAttribute('style');
        else host.setAttribute('style', originalHostStyle);
      };
      try {
        player.showPopover();
        host.showPopover();
        promoted = true;
        restoreLayers = releasePromotion;
      } catch {
        releasePromotion();
      }
    }
    // Fallback for browsers without the top-layer API: escape ancestor contexts.
    // Escape ancestor stacking/containing contexts instead of raising their
    // full-size backgrounds above the header at the scroll transition.
    for (
      let ancestor = player.parentElement;
      !promoted && ancestor && ancestor !== this.doc.documentElement;
      ancestor = ancestor.parentElement
    ) {
      const style = this.win.getComputedStyle(ancestor);
      if (
        ['overflow-x', 'overflow-y'].some((property) =>
          ['hidden', 'clip'].includes(style.getPropertyValue(property))
        )
      ) {
        preserve(ancestor, ['overflow', 'overflow-x', 'overflow-y']);
        ancestor.style.setProperty('overflow', 'visible', 'important');
      }
      for (const [property, neutral] of Object.entries({
        'z-index': 'auto',
        transform: 'none',
        perspective: 'none',
        filter: 'none',
        'backdrop-filter': 'none',
        contain: 'none',
        'will-change': 'auto',
        isolation: 'auto',
      })) {
        const value = style.getPropertyValue(property);
        if (!value || value === neutral || value === 'normal') continue;
        preserve(ancestor, [property]);
        ancestor.style.setProperty(property, neutral, 'important');
      }
    }
    const playerHost = player.closest<HTMLElement>('ytd-player');
    if (playerHost) {
      preserve(playerHost, ['overflow']);
      playerHost.style.setProperty('overflow', 'visible', 'important');
    }
    player.dataset.mfsMini = 'true';
    this.doc.documentElement.dataset.mfsMiniPlayerActive = 'true';
    this.restoreStyles = () => {
      restoreLayers();
      for (const { element, property, value, priority } of snapshots) {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
      delete player.dataset.mfsMini;
      delete this.doc.documentElement.dataset.mfsMiniPlayerActive;
    };
    this.bar.hidden = this.resize.hidden = this.controls.hidden = false;
  }
  private layoutMini(): void {
    if (!this.player) return;
    // YouTube rewrites media dimensions after its own resize observer runs.
    // Keep the existing media fitted to our container without reloading it.
    const container = this.video.closest<HTMLElement>('.html5-video-container');
    for (const node of [this.video, container]) {
      if (!node) continue;
      for (const [property, value] of Object.entries({
        width: '100%',
        height: '100%',
        'max-width': 'none',
        'max-height': 'none',
        left: '0px',
        top: '0px',
        ...(node === this.video ? { 'object-fit': 'cover' } : {}),
      })) {
        if (
          node.style.getPropertyValue(property) !== value ||
          node.style.getPropertyPriority(property) !== 'important'
        )
          node.style.setProperty(property, value, 'important');
      }
    }
    const aspect =
      this.video.videoWidth && this.video.videoHeight
        ? this.video.videoWidth / this.video.videoHeight
        : 16 / 9;
    this.renderedGeometry = clampMiniGeometry(
      this.geometry,
      this.win.innerWidth,
      this.win.innerHeight,
      aspect,
      this.headerBottom() + 8
    );
    const { x, y, width } = this.renderedGeometry;
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
      'border-radius': '8px',
      overflow: 'hidden',
      border: '0',
      padding: '0',
    }))
      this.player.style.setProperty(key, value, 'important');
    this.bar.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;--mini-scale:${width / 310}`;
    this.resize.style.cssText = `left:${x + width - 25}px;top:${y + height - 25}px`;
    this.controls.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;--mini-scale:${width / 310}`;
  }
  restoreMini(): void {
    if (!this.player) return;
    this.restoreStyles?.();
    this.restoreStyles = null;
    this.placeholder?.remove();
    this.placeholder = null;
    this.player = null;
    this.drag = null;
    this.seekDrag = null;
    this.controls.dataset.seeking = 'false';
    this.seekHint.hidden = true;
    this.geometrySignature = '';
    this.bar.hidden = this.resize.hidden = this.controls.hidden = true;
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
    this.controls.remove();
  }
}

import type { DeferredMediaSeek } from './media';
import {
  boostVideo,
  filterCSS,
  formatTime,
  type LoopRange,
  moveLoop,
  normalizeLoop,
  registerPlayerSeek,
  remainingSeconds,
  resetBoost,
  screenshotVideo,
  seekVideo,
  skipVideo,
} from './player-actions';
import { FloatingPlayer } from './player-floating';
import {
  DEFAULT_FILTERS,
  DEFAULT_PLAYER_TOOLS,
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  type PlayerToolsSettings,
  savePlayerTools,
  type VideoFilters,
} from './player-tools-settings';
import {
  button,
  element,
  field,
  numberInput,
  TOOLS_STYLES,
} from './player-tools-ui';
import {
  LIBRARY_KEY,
  libraryRequest,
  mediaIdentity,
  type SavedMoment,
} from './saved-media';
import {
  extractYouTubeChapterModel,
  isYouTubeHostname,
} from './youtube-chapters';
import { YouTubePlayerButtons } from './youtube-player-buttons';

type LoopHistory = { sections: SavedMoment[]; activeId: string | null; enabled: boolean };

/** Per-video tools own their listeners, timers, floating surfaces and reversible styles. */
export class PlayerTools {
  private static instances = new Set<PlayerTools>();
  private doc: Document;
  private win: Window;
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private panel: HTMLDivElement;
  private launcher: HTMLButtonElement;
  private status: HTMLParagraphElement;
  private remaining: HTMLSpanElement;
  private track: HTMLDivElement;
  private loopSurface: HTMLDivElement;
  private markers: HTMLDivElement;
  private selection: HTMLDivElement;
  private a: HTMLInputElement;
  private b: HTMLInputElement;
  private name: HTMLInputElement;
  private itemsNode: HTMLDivElement;
  private chaptersNode: HTMLDivElement;
  private loopToggle: HTMLButtonElement;
  private loopPanel: HTMLDivElement;
  private loopStatus: HTMLParagraphElement;
  private loopName: HTMLInputElement;
  private loopItemsNode: HTMLDivElement;
  private loopOpen = false;
  private loopClosing = false;
  private loopWasShown = false;
  private loopAnimationTimer: number | undefined;
  private rememberingLoops = false;
  private youtubeButtons: YouTubePlayerButtons | null;
  private editToggle: HTMLButtonElement;
  private settings = { ...DEFAULT_PLAYER_TOOLS };
  private filters: VideoFilters = { ...DEFAULT_FILTERS };
  private loop: LoopRange | null = null;
  private loopEnabled = false;
  private activeSavedId: string | null = null;
  private saveLoopButton: HTMLButtonElement;
  private editing = false;
  private identity: ReturnType<typeof mediaIdentity>;
  private items: SavedMoment[] = [];
  private sessions: SavedMoment[] = [];
  private undoLoops: LoopHistory[] = [];
  private redoLoops: LoopHistory[] = [];
  private historyBusy = false;
  private fineTune = false;
  private boostActive = false;
  private autoBoostSuppressed = false;
  private boostBusy = false;
  private boostUnavailable = false;
  private appliedBoost = 0;
  private fineTuneWasPlaying: boolean | null = null;
  private fineTuneTimer: number | undefined;
  private editBaseline: LoopHistory | null = null;
  private editUndoBaseline: LoopHistory[] = [];
  private editRedoBaseline: LoopHistory[] = [];
  private floating: FloatingPlayer;
  private disposed = false;
  private open = false;
  private hovering = false;
  private cinema = false;
  private shades: HTMLDivElement[] = [];
  private cleanupFns: Array<() => void> = [];
  private loopTimer: number | undefined;
  private originalFilter: string;
  private originalFilterPriority: string;
  private lastAppliedFilter: string | null = null;
  private originalSpeed: number;
  private lastAppliedSpeed: number | null = null;
  private initialized = false;
  private youtube: boolean;
  private ad = false;
  private source = '';
  private identityGeneration = 0;
  private claiming = false;
  private claimedKey = '';
  private uiSync: Array<() => void> = [];
  private cardPlayer: HTMLElement | null;
  private cardStyle: HTMLStyleElement;
  private dragging: {
    mode: string;
    time: number;
    range: LoopRange | null;
    pointerId: number;
    previousId: string | null;
    previousName: string;
    previousEnabled: boolean;
    playbackInside: boolean;
    originalPlaybackTime: number;
    minTime: number;
    maxTime: number;
    moved: boolean;
  } | null = null;

  constructor(
    private video: HTMLVideoElement,
    private timeline: HTMLElement,
    seekController?: DeferredMediaSeek,
    private loopPreview?: (time: number | null) => void
  ) {
    this.cleanupFns.push(registerPlayerSeek(video, seekController));
    this.doc = video.ownerDocument;
    this.win = this.doc.defaultView ?? window;
    this.youtube = isYouTubeHostname(this.doc.location.hostname);
    this.identity = mediaIdentity(video, this.doc.location.href);
    this.source = video.currentSrc;
    this.originalFilter = video.style.getPropertyValue('filter');
    this.originalFilterPriority = video.style.getPropertyPriority('filter');
    this.originalSpeed = video.playbackRate;
    this.cardPlayer = this.youtube
      ? video.closest<HTMLElement>('#movie_player, .html5-video-player')
      : null;
    this.host = element(this.doc, 'div', 'mfs-player-tools');
    this.host.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = element(this.doc, 'style');
    style.textContent = TOOLS_STYLES;
    this.root.append(style);
    this.launcher = button(
      this.doc,
      'Tools',
      () => this.setOpen(!this.open),
      this.root
    );
    this.launcher.className = 'launcher';
    this.launcher.setAttribute('aria-label', 'Video tools');
    this.launcher.setAttribute('aria-expanded', 'false');
    this.panel = element(this.doc, 'div', 'panel');
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'region');
    this.panel.setAttribute('aria-label', 'Video tools');
    this.root.append(this.panel);
    const header = element(this.doc, 'header');
    header.append(element(this.doc, 'h2', '', 'Video tools'));
    button(this.doc, 'Close', () => this.setOpen(false), header);
    this.panel.append(header);
    this.remaining = element(this.doc, 'span', 'muted');
    this.panel.append(this.remaining);
    this.status = element(this.doc, 'p', 'status');
    this.status.setAttribute('role', 'status');
    this.panel.append(this.status);
    this.loopPanel = element(this.doc, 'div', 'panel loop-editor');
    this.loopPanel.hidden = true;
    this.loopPanel.setAttribute('role', 'dialog');
    this.loopPanel.setAttribute('aria-label', 'Loop controls');
    const loopHeader = element(this.doc, 'header');
    loopHeader.append(
      element(this.doc, 'h2', '', 'Loop Sections'),
      element(
        this.doc,
        'span',
        'loop-hint',
        'Drag to edit · Shift-drag adds a section'
      )
    );
    button(this.doc, 'Close', () => this.setLoopOpen(false), loopHeader);
    this.loopStatus = element(this.doc, 'p', 'status');
    this.loopStatus.setAttribute('role', 'status');
    this.loopPanel.append(loopHeader, this.loopStatus);
    this.root.append(this.loopPanel);
    this.youtubeButtons = this.youtube
      ? new YouTubePlayerButtons(video, () => {
          if (!this.canLoop()) return;
          if (!this.loop) {
            const first = this.items.find(item => item.end !== undefined);
            if (!first) { this.setLoopOpen(true); return; }
            this.activateItem(first, true);
          } else this.toggleLoop();
          this.layout();
        }, () => this.setLoopOpen(true), () => this.toggleBoost())
      : null;
    this.floating = new FloatingPlayer(
      video,
      this.root,
      () => this.settings,
      this.youtube,
      (message) => this.report(message),
      (speed) => {
        if (this.youtube) this.preference('youtubeSpeed', speed);
        else this.video.playbackRate = speed;
      },
      () => ({ range: this.loop, enabled: this.loopEnabled })
    );
    this.track = element(this.doc, 'div', 'timeline');
    this.track.setAttribute('aria-label', 'Loop timeline');
    const loopActions = element(this.doc, 'div', 'loop-editor-actions');
    loopActions.setAttribute('role', 'group');
    loopActions.setAttribute('aria-label', 'Loop editing');
    this.track.append(loopActions);
    const loopHint = element(this.doc, 'span', 'loop-edit-hint');
    loopHint.append(
      element(this.doc, 'kbd', '', 'Shift'),
      this.doc.createTextNode(' + drag to add a section')
    );
    loopActions.append(loopHint);
    const discard = button(this.doc, 'Discard changes', () => this.perform(async () => {
      if (!this.editBaseline || this.historyBusy) return;
      await this.applyLoopSnapshot(this.editBaseline);
      this.undoLoops = [...this.editUndoBaseline];
      this.redoLoops = [...this.editRedoBaseline];
      this.setLoopOpen(false);
    }), loopActions);
    discard.className = 'discard-loop-edits';
    const closeLoop = button(this.doc, '✓ Done editing', () => this.setLoopOpen(false), loopActions);
    closeLoop.className = 'close-loop-editor';
    closeLoop.setAttribute('aria-label', 'Done editing');
    closeLoop.title = 'Keep sections and finish editing';
    const clearLoops = button(this.doc, 'Clear sections', () => this.perform(async () => {
      const sections = this.items.filter(item => item.end !== undefined);
      if (sections.length) this.recordLoopHistory();
      this.loop = null;
      this.loopEnabled = false;
      this.activeSavedId = null;
      this.dragging = null;
      this.loopPreview?.(null);
      this.renderLoop();
      for (const section of sections) await this.deleteLoopItem(section.id);
      this.renderItems();
      this.layout();
    }), loopActions);
    clearLoops.className = 'clear-loop-sections';
    const undo = button(this.doc, 'Undo', () => this.perform(() => this.restoreLoopHistory(false)), loopActions);
    undo.className = 'undo-loop-sections';
    const redo = button(this.doc, 'Redo', () => this.perform(() => this.restoreLoopHistory(true)), loopActions);
    redo.className = 'redo-loop-sections';
    const fineTune = button(this.doc, 'Fine tune', () => {
      this.fineTune = !this.fineTune;
      fineTune.setAttribute('aria-pressed', String(this.fineTune));
      this.track.dataset.fineTune = String(this.fineTune);
    }, loopActions);
    fineTune.className = 'fine-tune-loop';
    fineTune.setAttribute('aria-pressed', 'false');
    const fineTuneHelp = element(this.doc, 'span', 'fine-tune-help', 'Drag either handle to preview that moment with sound. Each brief preview pauses at the handle. Release to return to your original playback position, paused.');
    fineTuneHelp.id = 'fine-tune-help';
    fineTuneHelp.setAttribute('role', 'tooltip');
    fineTune.setAttribute('aria-describedby', fineTuneHelp.id);
    const fineTuneControl = element(this.doc, 'span', 'fine-tune-control');
    fineTune.replaceWith(fineTuneControl);
    fineTuneControl.append(fineTune, fineTuneHelp);
    for (const [control, mirrored] of [[undo, false], [redo, true]] as const) {
      const icon = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true');
      const path = this.doc.createElementNS(icon.namespaceURI, 'path');
      path.setAttribute('d', 'M3 7h10a7 7 0 0 1 0 14h-2 M3 7l4-4 M3 7l4 4');
      if (mirrored) path.setAttribute('transform', 'translate(24 0) scale(-1 1)');
      icon.append(path);
      control.prepend(icon);
    }
    loopActions.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.track.hidden = true;
    this.markers = element(this.doc, 'div');
    this.track.append(this.markers);
    this.selection = element(this.doc, 'div', 'range');
    this.selection.dataset.mode = 'move';
    this.track.append(this.selection);
    this.selection.addEventListener('click', () => {
      if (!this.editing && this.loopEnabled && this.loop && this.canLoop()) {
        seekVideo(this.video, this.loop.start);
        this.scheduleLoop();
      }
    });
    this.addSectionDeleteButton(this.selection, () => this.activeSavedId);
    for (const side of ['start', 'end'] as const) {
      const handle = element(this.doc, 'button', `handle ${side}`);
      handle.type = 'button';
      handle.dataset.mode = side;
      handle.setAttribute('aria-label', `Loop ${side}`);
      handle.append(element(this.doc, 'span', 'time-pill'));
      handle.addEventListener('keydown', (event) => {
        if (!this.loop || !['ArrowLeft', 'ArrowRight'].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        const neighbours = this.items.filter(item => item.end !== undefined && item.id !== this.activeSavedId);
        const lower = Math.max(0, ...neighbours.filter(item => item.end! <= this.loop!.start).map(item => item.end!));
        const upper = Math.min(video.duration, ...neighbours.filter(item => item.start >= this.loop!.end).map(item => item.start));
        const delta =
          (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1);
        const next = normalizeLoop(
          side === 'start'
            ? Math.max(lower, Math.min(this.loop.end - 0.1, this.loop.start + delta))
            : this.loop.start,
          side === 'end'
            ? Math.min(upper, Math.max(this.loop.start + 0.1, this.loop.end + delta))
            : this.loop.end,
          video.duration
        );
        if (next) {
          this.loop = next;
          this.renderLoop();
          this.commitLoop();
        }
      });
      this.selection.append(handle);
    }
    this.loopSurface = element(this.doc, 'div', 'mfs-loop-surface');
    this.loopSurface.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;overflow:visible';
    const loopRoot = this.loopSurface.attachShadow({ mode: 'open' });
    const loopStyle = element(this.doc, 'style');
    loopStyle.textContent = TOOLS_STYLES + '.timeline,.timeline.editing{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;background:transparent}';
    if (this.loopPreview) loopStyle.textContent += '.time-pill{display:none!important}';
    loopRoot.append(loopStyle, this.track);
    this.timeline.append(this.loopSurface);
    const barStyle = element(this.doc, 'style');
    barStyle.textContent = '.scrub-timeline[data-mfs-loop-animating=true]{transition:height 220ms ease,top 220ms ease,opacity 300ms ease!important}.scrub-timeline[data-mfs-loop-editing=true]{overflow:visible!important;clip-path:none!important;opacity:1!important;pointer-events:auto!important;visibility:visible!important}@media(prefers-reduced-motion:reduce){.scrub-timeline{transition:none!important}}';
    this.doc.documentElement.append(barStyle);
    this.cleanupFns.push(() => { this.loopSurface.remove(); barStyle.remove(); delete this.timeline.dataset.mfsLoopEditing; delete this.timeline.dataset.mfsLoopAnimating; });
    for (const type of ['click', 'dblclick', 'pointerdown', 'wheel'])
      this.listen(loopRoot, type, (event) => event.stopPropagation());
    this.buildPlayback();
    this.heading('Bookmarks');
    const loopRow = this.row(this.loopPanel);
    this.editToggle = button(
      this.doc,
      'Edit loop',
      () => {
        if (!this.canLoop()) return;
        this.editing = !this.editing;
        this.renderLoop();
        this.layout();
      },
      loopRow
    );
    this.loopToggle = button(
      this.doc,
      'Enable loop',
      () => this.toggleLoop(),
      loopRow
    );
    button(
      this.doc,
      'Clear loop',
      () => {
        if (this.activeSavedId)
          this.perform(() => this.deleteLoopItem(this.activeSavedId as string));
        this.loop = null;
        this.activeSavedId = null;
        this.loopEnabled = false;
        this.editing = false;
        this.renderLoop();
      },
      loopRow
    );
    this.a = numberInput(this.doc, 0, 0, 86400, 0.1, () =>
      this.setNumericLoop()
    );
    this.b = numberInput(this.doc, 5, 0, 86400, 0.1, () =>
      this.setNumericLoop()
    );
    field(this.doc, 'A (seconds)', this.a, this.loopPanel);
    field(this.doc, 'B (seconds)', this.b, this.loopPanel);
    this.loopName = element(this.doc, 'input');
    this.loopName.maxLength = 160;
    this.loopName.addEventListener('change', () => this.commitLoop());
    field(this.doc, 'Section name', this.loopName, this.loopPanel);
    this.name = element(this.doc, 'input');
    this.name.type = 'text';
    this.name.maxLength = 160;
    this.name.placeholder = 'Name this moment or section';
    field(this.doc, 'Name', this.name, this.panel);
    const saveRow = this.row();
    this.saveLoopButton = button(
      this.doc,
      'Save loop',
      () => this.perform(() => this.saveMoment(true)),
      this.loopPanel
    );
    button(
      this.doc,
      'Bookmark this moment',
      () => this.perform(() => this.saveMoment(false)),
      saveRow
    );
    this.loopItemsNode = element(this.doc, 'div', 'items');
    this.loopPanel.append(this.loopItemsNode);
    this.itemsNode = element(this.doc, 'div', 'items');
    this.panel.append(this.itemsNode);
    this.chaptersNode = element(this.doc, 'div', 'items');
    if (this.youtube) {
      this.heading('Chapters');
      this.panel.append(this.chaptersNode);
    }
    this.buildVisuals();
    this.cardStyle = element(this.doc, 'style');
    this.cardStyle.textContent =
      '[data-mfs-mini="true"] :is(.ytp-chrome-bottom,.ytp-chrome-top,.ytp-gradient-bottom,.ytp-gradient-top){display:none!important}[data-mfs-hide-cards="true"] :is(.ytp-cards-button,.ytp-cards-teaser,.ytp-cards-teaser-box,.ytp-cards-card){display:none!important}[data-mfs-hide-end-screens="true"] :is(.ytp-ce-element,.ytp-endscreen-content){display:none!important}';
    this.doc.documentElement.append(this.cardStyle, this.host);
    this.buildViewing();
    this.listen(this.doc, 'pointermove', (event) => {
      const e = event as PointerEvent;
      const rect = video.getBoundingClientRect();
      this.hovering =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
    });
    this.listen(
      this.doc,
      'keydown',
      (event) => this.keydown(event as KeyboardEvent),
      true
    );
    this.listen(this.root, 'keydown', (event) => {
      if ((event as KeyboardEvent).key !== 'Escape') event.stopPropagation();
    });
    // Site/player click handlers must not interpret tools interaction as a play/seek.
    for (const type of ['click', 'dblclick', 'pointerdown', 'wheel'])
      this.listen(this.root, type, (event) => event.stopPropagation());
    this.listen(this.doc, 'mfs-toggle-active-loop', (event) => {
      if ((event as CustomEvent).detail === this.video) this.toggleLoop();
    });
    for (const type of [
      'timeupdate',
      'ratechange',
      'play',
      'pause',
      'seeked',
      'durationchange',
      'loadedmetadata',
      'ended',
    ])
      this.listen(video, type, () => this.sync());
    this.listen(video, 'emptied', () => this.resetMedia());
    this.listen(this.doc, 'yt-navigate-start', () => this.resetMedia());
    this.listen(this.doc, 'yt-navigate-finish', () => {
      this.refreshIdentity();
      this.sync();
    });
    this.listen(this.doc, 'fullscreenchange', () => this.layout());
    this.listen(this.doc, 'scroll', () => this.layout(), true);
    this.listen(this.win, 'resize', () => this.layout());
    this.listen(this.win, 'pagehide', () => this.cleanup());
    this.setupLoopDrag();
    const storage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY]) {
        this.settings = normalizePlayerTools(
          changes[PLAYER_TOOLS_KEY].newValue
        );
        this.applyPreferences();
      }
      if (area === 'local' && changes[LIBRARY_KEY]) void this.loadItems();
    };
    chrome.storage.onChanged.addListener(storage);
    this.cleanupFns.push(() =>
      chrome.storage.onChanged.removeListener(storage)
    );
    const timer = this.win.setInterval(() => {
      this.refreshIdentity();
      this.sync();
      this.layout();
    }, 300);
    this.cleanupFns.push(() => this.win.clearInterval(timer));
    void loadPlayerTools()
      .then((settings) => {
        if (this.disposed) return;
        this.settings = settings;
        this.initialized = true;
        this.applyPreferences();
        this.applyFilterPreset();
        this.sync();
      })
      .catch(() => this.report('Could not load saved preferences.'));
    void this.loadItems();
    this.layout();
    PlayerTools.instances.add(this);
  }
  private listen(
    target: EventTarget,
    type: string,
    handler: EventListener,
    capture = false
  ): void {
    target.addEventListener(type, handler, capture);
    this.cleanupFns.push(() =>
      target.removeEventListener(type, handler, capture)
    );
  }
  private row(parent: HTMLElement = this.panel): HTMLDivElement {
    const row = element(this.doc, 'div', 'row');
    parent.append(row);
    return row;
  }
  private heading(text: string): void {
    this.panel.append(element(this.doc, 'h3', '', text));
  }
  private report(message: string): void {
    if (!this.disposed) {
      this.status.textContent = message;
      this.loopStatus.textContent = message;
    }
  }
  private perform(action: () => Promise<unknown>): void {
    void action().catch((error) =>
      this.report(
        error instanceof Error ? error.message : 'This action is unavailable.'
      )
    );
  }
  private async savePreferences(): Promise<void> {
    this.settings = normalizePlayerTools(this.settings);
    this.applyPreferences();
    await savePlayerTools(this.settings);
  }
  private preference<K extends keyof PlayerToolsSettings>(
    key: K,
    value: PlayerToolsSettings[K]
  ): void {
    this.settings = {
      ...this.settings,
      [key]: value,
      ...(key === 'youtubeSpeed' ? { rememberYoutubeSpeed: true } : {}),
    };
    this.perform(() => this.savePreferences());
  }
  private check(
    text: string,
    initial: boolean,
    action: (value: boolean) => void
  ): HTMLInputElement {
    const input = element(this.doc, 'input');
    input.type = 'checkbox';
    input.checked = initial;
    input.onchange = () => action(input.checked);
    field(this.doc, text, input, this.panel);
    return input;
  }
  private buildPlayback(): void {
    this.heading('Playback');
    const row = this.row();
    button(
      this.doc,
      'Play / pause',
      () => {
        if (this.video.paused) this.perform(() => this.video.play());
        else this.video.pause();
      },
      row
    );
    if (this.youtube) {
      const speed = numberInput(this.doc, 1, 0.25, 4, 0.05, (value) =>
        this.preference('youtubeSpeed', value)
      );
      field(this.doc, 'Playback speed', speed, this.panel);
      this.uiSync.push(() => {
        if (this.root.activeElement !== speed)
          speed.value = String(this.settings.youtubeSpeed);
      });
      const speeds = this.row();
      for (const value of [0.5, 1, 1.25, 1.5, 2, 3, 4])
        button(
          this.doc,
          `${value}×`,
          () => this.preference('youtubeSpeed', value),
          speeds
        );
    }
    if (this.youtube) return;
    const boost = numberInput(this.doc, 100, 100, 300, 10, (value) =>
      this.perform(async () => {
        await boostVideo(this.video, value);
        this.report(`Volume boost: ${value}%`);
      })
    );
    field(this.doc, 'Extra volume (%)', boost, this.panel);
    button(
      this.doc,
      'Reset boost',
      () => {
        resetBoost(this.video);
        boost.value = '100';
      },
      this.row()
    );
  }
  private buildVisuals(): void {
    this.heading('Video filters');
    for (const key of [
      'brightness',
      'contrast',
      'saturation',
      'grayscale',
    ] as const) {
      const input = element(this.doc, 'input');
      input.type = 'range';
      input.min = '0';
      input.max = key === 'grayscale' ? '100' : '200';
      input.value = String(this.filters[key]);
      input.oninput = () => {
        this.filters[key] = input.valueAsNumber;
        this.applyFilters();
      };
      field(
        this.doc,
        key.charAt(0).toUpperCase() + key.slice(1),
        input,
        this.panel
      );
      this.uiSync.push(() => {
        if (this.root.activeElement !== input)
          input.value = String(this.filters[key]);
      });
    }
    const row = this.row();
    button(
      this.doc,
      'Reset filters',
      () => {
        this.filters = { ...DEFAULT_FILTERS };
        this.applyFilters();
        this.uiSync.forEach((sync) => {
          sync();
        });
      },
      row
    );
    button(
      this.doc,
      'Save site preset',
      () => {
        this.preference('siteFilters', {
          ...this.settings.siteFilters,
          [this.doc.location.hostname]: { ...this.filters },
        });
        this.report('Filter preset saved for this site.');
      },
      row
    );
    button(
      this.doc,
      'Forget site preset',
      () => {
        const presets = { ...this.settings.siteFilters };
        delete presets[this.doc.location.hostname];
        this.preference('siteFilters', presets);
      },
      this.row()
    );
    const includeFilters = this.check(
      'Include filters in screenshot',
      false,
      () => {}
    );
    button(
      this.doc,
      'Screenshot PNG',
      () =>
        this.perform(async () => {
          await screenshotVideo(
            this.video,
            includeFilters.checked ? this.filters : undefined
          );
          this.report('Screenshot saved.');
        }),
      this.row()
    );
  }
  private buildViewing(): void {
    this.heading('Viewing');
    const row = this.row();
    button(
      this.doc,
      'Cinema mode',
      () => {
        this.cinema = !this.cinema;
        this.layout();
      },
      row
    );
    button(
      this.doc,
      'Picture-in-Picture',
      () => {
        this.cinema = false;
        this.layout();
        this.perform(() => this.floating.openPip());
      },
      row
    );
    const dim = numberInput(this.doc, 80, 0, 100, 1, (value) =>
      this.preference('dimming', value)
    );
    field(this.doc, 'Cinema dimming (%)', dim, this.panel);
    this.uiSync.push(() => {
      dim.value = String(this.settings.dimming);
    });
    if (this.youtube) {
      for (const [key, label] of [
        ['hideCards', 'Hide info cards'],
        ['hideEndScreens', 'Hide end screens'],
        ['miniPlayer', 'Mini player on scroll'],
        ['autoChapters', 'Detect description chapters'],
      ] as const) {
        const input = this.check(label, false, (value) =>
          this.preference(key, value)
        );
        this.uiSync.push(() => {
          input.checked = this.settings[key];
        });
      }
    }
  }
  private applyPreferences(): void {
    if (!this.settings.youtubeBoostEnabled) {
      resetBoost(this.video);
      this.boostActive = false;
      this.appliedBoost = 0;
    } else if (this.boostActive && this.appliedBoost !== this.settings.youtubeBoost) {
      this.appliedBoost = this.settings.youtubeBoost;
      this.perform(() => boostVideo(this.video, this.settings.youtubeBoost * 100));
    }
    if (this.disposed) return;
    if (
      this.youtube &&
      this.settings.rememberYoutubeSpeed &&
      this.initialized &&
      !this.isAd() &&
      this.video.readyState >= 1
    ) {
      if (this.video.playbackRate !== this.settings.youtubeSpeed) {
        this.video.playbackRate = this.settings.youtubeSpeed;
        this.lastAppliedSpeed = this.settings.youtubeSpeed;
      }
    }
    if (this.cardPlayer) {
      this.cardPlayer.dataset.mfsHideCards = String(this.settings.hideCards);
      this.cardPlayer.dataset.mfsHideEndScreens = String(
        this.settings.hideEndScreens
      );
      this.cardPlayer.dataset.mfsAutoChapters = String(
        this.settings.autoChapters
      );
    }
    this.uiSync.forEach((sync) => {
      sync();
    });
    if (!this.youtube || !this.settings.youtubeLoop) {
      this.loopOpen = false;
      this.editing = false;
      this.loopEnabled = false;
      this.loop = null;
      this.activeSavedId = null;
      this.dragging = null;
      this.win.clearTimeout(this.loopTimer);
    }
    if (this.rememberingLoops !== this.settings.rememberYoutubeLoops) {
      this.rememberingLoops = this.settings.rememberYoutubeLoops;
      if (this.rememberingLoops && this.identity.persistent) {
        const sections = this.sessions.filter(
          (item) =>
            item.mediaKey === this.identity.key && item.end !== undefined
        );
        this.perform(async () => {
          for (const item of sections)
            await libraryRequest({ op: 'put', item });
        });
      }
      void this.loadItems();
    }
    this.renderLoop();
    this.renderItems();
    this.layout();
    if (this.open) this.renderChapters();
  }
  private applyFilters(): void {
    const css = filterCSS(this.filters);
    this.video.style.setProperty('filter', css, 'important');
    this.lastAppliedFilter = css;
  }
  private applyFilterPreset(): void {
    this.filters = {
      ...(this.settings.siteFilters[this.doc.location.hostname] ??
        DEFAULT_FILTERS),
    };
    if (this.settings.siteFilters[this.doc.location.hostname])
      this.applyFilters();
    this.uiSync.forEach((sync) => {
      sync();
    });
  }
  private setOpen(value: boolean): void {
    if (value) {
      this.loopOpen = false;
      this.editing = false;
    }
    this.open = value;
    this.panel.hidden = !value;
    this.launcher.setAttribute('aria-expanded', String(value));
    if (value) {
      void this.loadItems();
      this.renderChapters();
    } else {
      if (!this.loopOpen) this.editing = false;
      this.renderLoop();
      this.launcher.focus();
    }
    this.layout();
  }
  private toggleBoost(automatic = false): void {
    if (!this.settings.youtubeBoostEnabled || this.boostBusy || this.isAd()) return;
    if (this.boostActive) {
      if (!automatic) this.autoBoostSuppressed = true;
      resetBoost(this.video);
      this.boostActive = false;
      this.appliedBoost = 0;
      this.layout();
      return;
    }
    this.boostBusy = true;
    this.layout();
    void boostVideo(this.video, this.settings.youtubeBoost * 100).then(() => {
      if (!this.disposed && this.settings.youtubeBoostEnabled && !this.isAd()) {
        this.boostActive = true;
        this.appliedBoost = this.settings.youtubeBoost;
      }
    }).catch(error => {
      this.boostUnavailable = true;
      this.report(error instanceof Error ? error.message : 'Boost Volume unavailable.');
    }).finally(() => {
      this.boostBusy = false;
      if (!this.disposed) this.layout();
    });
  }
  private canLoop(): boolean {
    return this.youtube && this.settings.youtubeLoop && this.finite();
  }
  private setLoopOpen(value: boolean): void {
    if (value && !this.canLoop()) return;
    if (value) this.setOpen(false);
    if (!value) this.loopPreview?.(null);
    if (value && !this.loopOpen) {
      this.fineTuneWasPlaying = null;
      this.editBaseline = this.loopSnapshot();
      this.editUndoBaseline = [...this.undoLoops];
      this.editRedoBaseline = [...this.redoLoops];
    }
    if (!value && this.loopOpen && this.fineTuneWasPlaying !== null) {
      const resume = this.fineTuneWasPlaying;
      this.fineTuneWasPlaying = null;
      this.win.clearTimeout(this.fineTuneTimer);
      if (resume && this.video.paused) this.perform(() => this.video.play());
      else if (!resume && !this.video.paused) this.video.pause();
    }
    this.loopOpen = value;
    this.editing = value;
    if (value) void this.loadItems();
    this.renderLoop();
    this.layout();
    
  }
  private isAd(): boolean {
    return Boolean(this.cardPlayer?.matches('.ad-showing,.ad-interrupting'));
  }
  private isLive(): boolean {
    return (
      this.video.duration === Infinity ||
      Boolean(this.video.closest('.ytp-live, ytd-watch-flexy[is-live]'))
    );
  }
  private finite(): boolean {
    return (
      Number.isFinite(this.video.duration) &&
      this.video.duration > 0 &&
      !this.isLive() &&
      !this.isAd()
    );
  }
  private setNumericLoop(): void {
    if (!this.canLoop()) return;
    if (this.a.valueAsNumber >= this.b.valueAsNumber) {
      this.report('The loop end must be after its start.');
      return;
    }
    const range = normalizeLoop(
      this.a.valueAsNumber,
      this.b.valueAsNumber,
      this.video.duration
    );
    if (!range) {
      this.report('Choose a finite range at least 0.1 seconds long.');
      return;
    }
    this.loop = range;
    this.renderLoop();
    this.commitLoop();
  }
  private toggleLoop(): void {
    if (!this.canLoop()) return;
    if (!this.loop)
      this.loop = normalizeLoop(
        this.video.currentTime,
        this.video.currentTime + 5,
        this.video.duration
      );
    if (!this.loop) return;
    this.loopEnabled = !this.loopEnabled;
    this.commitLoop();
    if (this.loopEnabled) seekVideo(this.video, this.loop.start);
    this.renderLoop();
    this.scheduleLoop();
  }
  private renderLoop(): void {
    this.updateEditingActions();
    this.updateClearSectionsButton();
    this.saveLoopButton.textContent = this.activeSavedId
      ? 'Save changes'
      : 'Save loop';
    this.youtubeButtons?.update(this.settings.youtubeLoop, this.canLoop(), this.loopOpen, this.loopEnabled, Boolean(this.loop) || this.items.some(item => item.end !== undefined), this.settings.youtubeBoostEnabled ? this.settings.youtubeBoost : 0, this.boostActive, !this.boostBusy && !this.boostUnavailable && !this.isAd());
    this.track.classList.toggle('editing', this.editing);
    const undo = this.track.querySelector<HTMLButtonElement>('.undo-loop-sections');
    const redo = this.track.querySelector<HTMLButtonElement>('.redo-loop-sections');
    if (undo) undo.disabled = this.historyBusy || !this.undoLoops.length;
    if (redo) redo.disabled = this.historyBusy || !this.redoLoops.length;
    this.editToggle.textContent = this.editing ? 'Finish editing' : 'Edit loop';
    this.editToggle.disabled = !this.canLoop();
    this.loopToggle.disabled = !this.canLoop();
    this.loopToggle.textContent = this.loopEnabled
      ? 'Disable loop'
      : 'Enable loop';
    this.selection.hidden = !this.loop;
    this.track.dataset.loopEnabled = String(this.loopEnabled);
    this.track.dataset.dragging = String(Boolean(this.dragging));
    if (this.loop) {
      this.selection.classList.toggle(
        'narrow',
        ((this.loop.end - this.loop.start) / this.video.duration) *
          this.track.getBoundingClientRect().width <
          110
      );
      for (const side of ['start', 'end'] as const) {
        const handle = this.selection.querySelector<HTMLButtonElement>(
          `.handle.${side}`
        );
        const pill = handle?.querySelector('.time-pill');
        if (pill) pill.textContent = this.loopTime(this.loop[side]);
        handle?.setAttribute(
          'aria-label',
          `Loop ${side} ${this.loopTime(this.loop[side])}`
        );
      }
      this.selection.style.left = `${(this.loop.start / this.video.duration) * 100}%`;
      this.selection.style.width = `${((this.loop.end - this.loop.start) / this.video.duration) * 100}%`;
      if (this.root.activeElement !== this.a)
        this.a.value = this.loop.start.toFixed(1);
      if (this.root.activeElement !== this.b)
        this.b.value = this.loop.end.toFixed(1);
      this.a.max = this.b.max = String(this.video.duration);
    }
    this.renderMarkers();
    this.scheduleLoop();
  }
  private scheduleLoop(): void {
    this.win.clearTimeout(this.loopTimer);
    if (
      !this.loop ||
      !this.loopEnabled ||
      this.video.paused ||
      this.dragging ||
      !this.canLoop() ||
      this.video.seeking
    )
      return;
    const left =
      (this.loop.end - this.video.currentTime) / this.video.playbackRate;
    this.loopTimer = this.win.setTimeout(
      () => {
        if (
          this.disposed ||
          !this.loop ||
          !this.loopEnabled ||
          this.video.paused ||
          !this.canLoop()
        )
          return;
        if (this.video.currentTime >= this.loop.end - 0.025)
          this.advanceLoopSection();
        else if (this.video.currentTime < this.loop.start)
          seekVideo(this.video, this.loop.start);
        this.scheduleLoop();
      },
      Math.max(16, Math.min(1000, left * 1000))
    );
  }
  private advanceLoopSection(): void {
    if (!this.loop || !this.canLoop()) return;
    const sections = this.items.filter(item => item.end !== undefined &&
      item.start >= 0 && item.end <= this.video.duration && item.end > item.start)
      .sort((a, b) => a.start - b.start || a.end! - b.end! || a.id.localeCompare(b.id));
    const current = sections.findIndex(item => item.id === this.activeSavedId);
    const next = sections.length ? sections[(current + 1) % sections.length] : undefined;
    if (next) {
      this.activeSavedId = next.id;
      this.loop = { start: next.start, end: next.end! };
      this.loopName.value = next.name;
    }
    seekVideo(this.video, this.loop.start);
    this.renderLoop();
  }
  private setupLoopDrag(): void {
    const timeAt = (e: PointerEvent) => {
      const r = this.track.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(
          this.video.duration,
          ((e.clientX - r.left) / Math.max(1, r.width)) * this.video.duration
        )
      );
    };
    this.listen(this.track, 'pointerdown', (event) => {
      const e = event as PointerEvent;
      const target = e.target as HTMLElement;
      if (
        !this.editing ||
        !this.canLoop() ||
        e.button !== 0 ||
        (target.closest('.marker') && !e.shiftKey)
      )
        return;
      const anchorTime = timeAt(e);
      if (e.shiftKey && this.items.some(item => item.end !== undefined &&
          anchorTime > item.start && anchorTime < item.end)) return;
      e.preventDefault();
      e.stopPropagation();
      const section = target.closest<HTMLElement>('[data-loop-id]');
      if (section && !e.shiftKey) {
        const item = this.items.find(
          (item) => item.id === section.dataset.loopId
        );
        if (item) this.activateItem(item, this.loopEnabled, false);
      }
      const previousId = this.activeSavedId;
      const previousName = this.loopName.value;
      const previousEnabled = this.loopEnabled;
      const previousRange = this.loop ? { ...this.loop } : null;
      const mode = e.shiftKey
        ? 'create'
        : (target.closest<HTMLElement>('[data-mode]')?.dataset.mode ??
          'create');
      if (e.shiftKey && this.loop) this.commitLoop();
      const neighbours = this.items.filter(item => item.end !== undefined &&
        (e.shiftKey || item.id !== this.activeSavedId));
      const anchorStart = mode === 'create' ? anchorTime : (previousRange?.start ?? anchorTime);
      const anchorEnd = mode === 'create' ? anchorTime : (previousRange?.end ?? anchorTime);
      const minTime = Math.max(0, ...neighbours.filter(item => item.end! <= anchorStart).map(item => item.end!));
      const maxTime = Math.min(this.video.duration, ...neighbours.filter(item => item.start >= anchorEnd).map(item => item.start));
      this.dragging = {
        mode,
        minTime,
        maxTime,
        time: anchorTime,
        range: previousRange,
        pointerId: e.pointerId,
        previousId,
        previousName,
        previousEnabled,
        originalPlaybackTime: this.video.currentTime,
        playbackInside: !this.video.paused && Boolean(previousRange &&
          this.video.currentTime >= previousRange.start && this.video.currentTime < previousRange.end),
        moved: false,
      };
      if (mode === 'create' && (e.shiftKey || !this.loop)) {
        this.activeSavedId = null;
        this.loopName.value = '';
      }
      if (this.fineTune && previousRange && (mode === 'start' || mode === 'end')) {
        this.fineTuneWasPlaying ??= !this.video.paused;
        this.previewFineTune(previousRange[mode]);
      }
      this.track.setPointerCapture?.(e.pointerId);
      this.renderLoop();
    });
    this.listen(this.track, 'pointermove', (event) => {
      const e = event as PointerEvent;
      const drag = this.dragging;
      if (!drag) {
        const handle = (e.target as HTMLElement).closest<HTMLElement>('.handle');
        const section = handle?.closest<HTMLElement>('[data-loop-id]');
        const range = section ? this.items.find(item => item.id === section.dataset.loopId) : this.loop;
        const time = handle?.dataset.mode === 'start' ? range?.start : range?.end;
        this.loopPreview?.(this.editing && handle && time !== undefined ? time : null);
        return;
      }
      if (drag.pointerId !== e.pointerId) return;
      const grabOffset = drag.range && (drag.mode === 'start' || drag.mode === 'end')
        ? drag.time - drag.range[drag.mode]
        : 0;
      const t = Math.max(drag.minTime, Math.min(drag.maxTime, timeAt(e) - grabOffset)),
        old = drag.range;
      let next: LoopRange | null = null;
      if (drag.mode === 'move' && old)
        next = moveLoop(old, Math.max(drag.minTime - old.start, Math.min(drag.maxTime - old.end, t - drag.time)), this.video.duration);
      else if (drag.mode === 'start' && old)
        next = normalizeLoop(
          Math.min(t, old.end - 0.1),
          old.end,
          this.video.duration
        );
      else if (drag.mode === 'end' && old)
        next = normalizeLoop(
          old.start,
          Math.max(t, old.start + 0.1),
          this.video.duration
        );
      else next = normalizeLoop(drag.time, t, this.video.duration);
      if (next) {
        drag.moved = true;
        this.loop = next;
        if (this.fineTune && (drag.mode === 'start' || drag.mode === 'end')) {
          this.previewFineTune(next[drag.mode]);
        } else if (drag.mode === 'move' && !this.video.paused &&
          (this.video.currentTime < next.start || this.video.currentTime >= next.end)) {
          seekVideo(this.video, next.start);
        } else if (drag.playbackInside && !this.video.paused) {
          if (drag.mode === 'start' && this.video.currentTime < next.start)
            seekVideo(this.video, next.start);
          else if (drag.mode === 'end' && this.video.currentTime >= next.end)
            seekVideo(this.video, next.start);
        }
        this.renderLoop();
        this.loopPreview?.(drag.mode === 'start' ? next.start : next.end);
      }
    });
    this.listen(this.track, 'pointerleave', () => {
      if (!this.dragging) this.loopPreview?.(null);
    });
    const finish = (cancel: boolean) => {
      const drag = this.dragging;
      if (!drag) return;
      this.dragging = null;
      this.win.clearTimeout(this.fineTuneTimer);
      if (this.fineTune && this.loop && (drag.mode === 'start' || drag.mode === 'end')) {
        this.video.pause();
        seekVideo(this.video, drag.originalPlaybackTime);
      }
      this.loopPreview?.(null);
      if (cancel || !drag.moved) {
        this.loop = drag.range;
        this.activeSavedId = drag.previousId;
        this.loopName.value = drag.previousName;
        this.loopEnabled = drag.previousEnabled;
      } else {
        if (drag.mode === 'create') this.loopEnabled = drag.range ? drag.previousEnabled : true;
        this.commitLoop();
      }
      this.renderLoop();
      if (this.track.hasPointerCapture?.(drag.pointerId))
        this.track.releasePointerCapture(drag.pointerId);
    };
    this.listen(this.track, 'pointerup', () => finish(false));
    this.listen(this.track, 'pointercancel', () => finish(true));
    this.listen(this.track, 'lostpointercapture', () => finish(true));
  }
  private previewFineTune(time: number): void {
    this.win.clearTimeout(this.fineTuneTimer);
    seekVideo(this.video, time);
    if (this.video.paused) this.perform(() => this.video.play());
    this.fineTuneTimer = this.win.setTimeout(() => {
      if (this.disposed || !this.dragging) return;
      this.video.pause();
      seekVideo(this.video, time);
    }, 180);
  }
  private loopTime(time: number): string {
    const rounded = Math.round(time * 10) / 10;
    const tenth = Math.round((rounded % 1) * 10);
    return `${formatTime(rounded)}${tenth ? `.${tenth}` : ''}`;
  }
  private commitLoop(): void {
    if (this.canLoop() && this.loop) this.perform(() => this.saveMoment(true));
  }
  private loopSnapshot(): LoopHistory {
    return { sections: this.items.filter(item => item.end !== undefined).map(item => ({ ...item })), activeId: this.activeSavedId, enabled: this.loopEnabled };
  }
  private recordLoopHistory(): void {
    this.undoLoops.push(this.loopSnapshot());
    if (this.undoLoops.length > 50) this.undoLoops.shift();
    this.redoLoops = [];
  }
  private async restoreLoopHistory(redo: boolean): Promise<void> {
    if (this.historyBusy || !this.canLoop()) return;
    const source = redo ? this.redoLoops : this.undoLoops;
    const snapshot = source.pop();
    if (!snapshot) return;
    const previous = this.loopSnapshot();
    (redo ? this.undoLoops : this.redoLoops).push(previous);
    await this.applyLoopSnapshot(snapshot);
  }
  private async applyLoopSnapshot(snapshot: LoopHistory): Promise<void> {
    const previous = this.loopSnapshot();
    this.historyBusy = true;
    this.items = [...this.items.filter(item => item.end === undefined), ...snapshot.sections];
    this.sessions = [...this.sessions.filter(item => item.mediaKey !== this.identity.key || item.end === undefined), ...snapshot.sections];
    const active = snapshot.sections.find(item => item.id === snapshot.activeId) ?? snapshot.sections[0];
    this.activeSavedId = active?.id ?? null;
    this.loop = active ? { start: active.start, end: active.end! } : null;
    this.loopName.value = active?.name ?? '';
    this.loopEnabled = Boolean(active) && snapshot.enabled;
    this.renderItems();
    this.renderLoop();
    this.layout();
    try {
      if (this.identity.persistent && this.settings.rememberYoutubeLoops) {
        for (const item of previous.sections)
          if (!snapshot.sections.some(section => section.id === item.id))
            await libraryRequest({ op: 'delete', id: item.id });
        for (const item of snapshot.sections) await libraryRequest({ op: 'put', item });
      }
    } finally {
      this.historyBusy = false;
      if (!this.disposed) this.renderLoop();
    }
  }
  private async deleteLoopItem(id: string): Promise<void> {
    this.sessions = this.sessions.filter((item) => item.id !== id);
    this.items = this.items.filter((item) => item.id !== id);
    if (this.activeSavedId === id) {
      this.activeSavedId = null;
      this.loop = null;
      this.loopEnabled = false;
      this.renderLoop();
    }
    if (this.identity.persistent) await libraryRequest({ op: 'delete', id });
    this.renderItems();
  }
  private async saveMoment(asLoop: boolean): Promise<void> {
    if (asLoop && !this.canLoop())
      throw new Error('Enable Loop Sections in YouTube settings to save sections.');
    if (!this.finite())
      throw new Error('Saved moments require a video with a finite duration.');
    if (asLoop && !this.loop) throw new Error('Create a loop range first.');
    const range = asLoop ? this.loop : null;
    const start = range ? range.start : this.video.currentTime;
    const item: SavedMoment = {
      id:
        asLoop && this.activeSavedId ? this.activeSavedId : crypto.randomUUID(),
      mediaKey: this.identity.key,
      url: this.doc.location.href,
      title: this.doc.title,
      name:
        (asLoop ? this.loopName.value : this.name.value).trim() ||
        `${asLoop ? 'Section' : 'Moment'} ${formatTime(start)}`,
      start,
      ...(range ? { end: range.end } : {}),
      createdAt:
        this.items.find((saved) => saved.id === this.activeSavedId)
          ?.createdAt ?? Date.now(),
    };
    if (asLoop) {
      const previous = this.items.find(entry => entry.id === item.id);
      if (!previous || previous.start !== item.start || previous.end !== item.end || previous.name !== item.name)
        this.recordLoopHistory();
    }
    const persist =
      this.identity.persistent &&
      (!asLoop || this.settings.rememberYoutubeLoops);
    this.sessions = this.sessions.filter((entry) => entry.id !== item.id);
    this.sessions.push(item);
    this.items = this.items.filter((entry) => entry.id !== item.id);
    this.items.push(item);
    if (asLoop) this.activeSavedId = item.id;
    this.renderItems();
    this.renderLoop();
    if (persist) await libraryRequest({ op: 'put', item });
    this.report(
      persist
        ? 'Saved to your local library.'
        : asLoop
          ? 'Sections kept for this visit. Enable Remember loops to keep them for next time.'
          : 'Saved for this session only: this site does not expose a stable video address.'
    );
  }
  private async loadItems(): Promise<void> {
    const generation = this.identityGeneration;
    try {
      const { library } = await libraryRequest({ op: 'list' });
      if (this.disposed || generation !== this.identityGeneration) return;
      const saved = (library?.items ?? []).filter(
        (item) => item.end === undefined || this.settings.rememberYoutubeLoops
      );
      const combined = new Map(
        [...saved, ...this.sessions].map((item) => [item.id, item])
      );
      this.items = [...combined.values()].filter(
        (item) => item.mediaKey === this.identity.key
      );
      this.renderItems();
    } catch (error) {
      this.report(
        error instanceof Error ? error.message : 'Library unavailable.'
      );
    }
  }
  private activateItem(item: SavedMoment, enable = true, seek = true): void {
    if (item.end !== undefined && !this.canLoop()) {
      this.report(
        'Enable Loop Sections in YouTube settings to open this saved section.'
      );
      return;
    }
    if (
      !this.finite() ||
      item.start >= this.video.duration ||
      (item.end !== undefined && item.end > this.video.duration)
    ) {
      this.report('This saved range is outside the current video.');
      return;
    }
    this.activeSavedId = item.end !== undefined ? item.id : null;
    this.loop =
      item.end !== undefined
        ? normalizeLoop(item.start, item.end, this.video.duration)
        : null;
    this.loopEnabled = Boolean(this.loop) && enable;
    if (item.end !== undefined) this.loopName.value = item.name;
    else this.name.value = item.name;
    if (seek && (enable || item.end === undefined)) seekVideo(this.video, item.start);
    this.renderLoop();
  }
  private renderItems(): void {
    this.updateEditingActions();
    this.updateClearSectionsButton();
    this.itemsNode.replaceChildren();
    this.loopItemsNode.replaceChildren();
    for (const item of this.items) {
      if (item.end !== undefined && !this.canLoop()) continue;
      const row = element(this.doc, 'div', 'item');
      (item.end !== undefined ? this.loopItemsNode : this.itemsNode).append(
        row
      );
      button(
        this.doc,
        `${item.end !== undefined ? '↻' : '◆'} ${formatTime(item.start)} · ${item.name}`,
        () => this.activateItem(item),
        row
      );
      button(
        this.doc,
        'Delete',
        () => this.perform(() => this.deleteLoopItem(item.id)),
        row
      );
    }
    this.renderMarkers();
  }
  private updateEditingActions(): void {
    const signature = (sections: SavedMoment[]) => JSON.stringify(
      [...sections].sort((a, b) => a.id.localeCompare(b.id))
        .map(({ id, start, end, name }) => ({ id, start, end, name }))
    );
    const changed = this.editBaseline !== null &&
      signature(this.loopSnapshot().sections) !== signature(this.editBaseline.sections);
    const done = this.track.querySelector<HTMLButtonElement>('.close-loop-editor');
    if (done) {
      done.textContent = changed ? '✓ Done editing' : 'Close';
      done.setAttribute('aria-label', changed ? 'Done editing' : 'Close editing');
      done.title = changed ? 'Keep changes and finish editing' : 'Close editing';
      done.disabled = this.historyBusy;
    }
    const discard = this.track.querySelector<HTMLButtonElement>('.discard-loop-edits');
    if (discard) discard.disabled = !changed || this.historyBusy;
  }
  private updateClearSectionsButton(): void {
    const clear = this.track.querySelector<HTMLButtonElement>('.clear-loop-sections');
    if (clear) clear.disabled = !this.loop && !this.items.some(item => item.end !== undefined);
  }
  private addSectionDeleteButton(section: HTMLElement, getId: () => string | null): void {
    const remove = button(this.doc, '×', () => {
      const id = getId();
      if (!this.editing || !id) return;
      this.recordLoopHistory();
      this.perform(async () => {
        await this.deleteLoopItem(id);
        this.renderLoop();
        this.layout();
      });
    }, section);
    remove.className = 'delete-loop-section';
    remove.setAttribute('aria-label', 'Delete section');
    remove.title = 'Delete section';
    for (const type of ['pointerdown', 'click', 'keydown'])
      remove.addEventListener(type, event => event.stopPropagation());
  }
  private renderMarkers(): void {
    this.markers.replaceChildren();
    if (!this.finite()) return;
    for (const item of this.items) {
      if (item.start >= this.video.duration) continue;
      if (item.end !== undefined) {
        if (!this.canLoop() || item.id === this.activeSavedId) continue;
        const section = element(this.doc, 'div', 'saved-range');
        section.dataset.loopId = item.id;
        section.dataset.mode = 'move';
        section.tabIndex = 0;
        section.setAttribute('role', 'button');
        section.setAttribute(
          'aria-label',
          `${item.name}, ${this.loopTime(item.start)} to ${this.loopTime(item.end)}`
        );
        section.style.left = `${(item.start / this.video.duration) * 100}%`;
        section.style.width = `${((item.end - item.start) / this.video.duration) * 100}%`;
        section.addEventListener('click', () => {
          if (!this.editing) this.activateItem(item, this.loopEnabled);
        });
        section.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.activateItem(item, this.loopEnabled);
          }
        });
        for (const side of ['start', 'end'] as const) {
          const handle = element(this.doc, 'button', `handle ${side}`);
          handle.type = 'button';
          handle.dataset.mode = side;
          handle.setAttribute('aria-label', `${item.name} ${side}`);
          handle.append(
            element(
              this.doc,
              'span',
              'time-pill',
              this.loopTime(side === 'start' ? item.start : item.end)
            )
          );
          handle.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            event.stopPropagation();
            this.activateItem(item, this.loopEnabled, false);
            const active = this.selection.querySelector<HTMLButtonElement>(
              `.handle.${side}`
            );
            active?.focus();
            active?.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: event.key,
                shiftKey: event.shiftKey,
              })
            );
          });
          section.append(handle);
        }
        this.addSectionDeleteButton(section, () => item.id);
        this.markers.append(section);
      } else {
        const node = button(
          this.doc,
          '',
          () => this.activateItem(item),
          this.markers
        );
        node.className = 'marker';
        node.title = item.name;
        node.setAttribute(
          'aria-label',
          `${item.name} at ${formatTime(item.start)}`
        );
        node.style.left = `${(item.start / this.video.duration) * 100}%`;
      }
    }
  }
  private renderChapters(): void {
    if (!this.youtube) return;
    const model = extractYouTubeChapterModel({
      video: this.video,
      ownerDocument: this.doc,
    });
    this.chaptersNode.replaceChildren();
    if (!model) {
      this.chaptersNode.append(
        element(
          this.doc,
          'p',
          'muted',
          'No chapters or titled description timestamps found.'
        )
      );
      return;
    }
    if (model.source === 'description')
      this.chaptersNode.append(
        element(
          this.doc,
          'p',
          'muted',
          'Detected sections from the description'
        )
      );
    for (const chapter of model.chapters)
      button(
        this.doc,
        `${formatTime(chapter.start)} · ${chapter.title ?? 'Section'}`,
        () => seekVideo(this.video, chapter.start),
        this.chaptersNode
      );
  }
  private keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.editing && !event.isComposing &&
        !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
        !event.composedPath().some(node => node instanceof HTMLElement &&
          (node.matches('input,textarea,select,[role="textbox"]') || node.isContentEditable))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.setLoopOpen(false);
      return;
    }
    if (event.key === 'Escape') {
      this.setLoopOpen(false);
      this.cinema = false;
      this.editing = false;
      if (this.open) this.setOpen(false);
      this.layout();
      return;
    }
    if (
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element &&
            (node.matches(
              'input,textarea,select,[role="textbox"],[role="slider"],[role="menuitem"],[role="tab"]'
            ) ||
              node === this.host ||
              (node as HTMLElement).isContentEditable)
        )
    )
      return;
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing
    )
      return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const candidates = [...PlayerTools.instances].filter((tools) => {
      const rect = tools.video.getBoundingClientRect();
      return (
        tools.doc === this.doc &&
        tools.video.isConnected &&
        !tools.isAd() &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < this.win.innerHeight &&
        rect.right > 0 &&
        rect.left < this.win.innerWidth
      );
    });
    const score = (tools: PlayerTools) => {
      const rect = tools.video.getBoundingClientRect();
      const focused =
        tools.video === this.doc.activeElement ||
        Boolean(
          tools.video.closest('#movie_player')?.contains(this.doc.activeElement)
        );
      return (
        (focused ? 1e12 : 0) +
        (tools.hovering ? 1e10 : 0) +
        (!tools.video.paused ? 1e8 : 0) +
        rect.width * rect.height
      );
    };
    candidates.sort((a, b) => score(b) - score(a));
    if (candidates[0] !== this) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    skipVideo(
      this.video,
      event.key === 'ArrowLeft'
        ? -this.settings.backward
        : this.settings.forward
    );
  }

  private refreshIdentity(): void {
    const next = mediaIdentity(this.video, this.doc.location.href);
    if (next.key !== this.identity.key) {
      this.resetMedia();
      this.identity = next;
      this.source = this.video.currentSrc;
      this.applyFilterPreset();
      void this.loadItems();
    } else if (this.video.currentSrc !== this.source) {
      this.source = this.video.currentSrc;
      resetBoost(this.video);
      if (!this.youtube) {
        this.resetMedia();
        this.applyFilterPreset();
      }
    }
  }
  private async claimSavedItem(): Promise<void> {
    if (
      !this.initialized ||
      !this.identity.persistent ||
      !this.finite() ||
      this.video.readyState < 1 ||
      this.claiming ||
      this.claimedKey === this.identity.key
    )
      return;
    const watchId = this.doc
      .querySelector('ytd-watch-flexy')
      ?.getAttribute('video-id');
    if (this.youtube && watchId && this.identity.key !== `youtube:${watchId}`)
      return;
    this.claiming = true;
    const key = this.identity.key;
    const generation = this.identityGeneration;
    try {
      const { item } = await libraryRequest({ op: 'claim', mediaKey: key });
      if (this.disposed || generation !== this.identityGeneration) return;
      this.claimedKey = key;
      if (item) this.activateItem(item);
    } catch {
      /* Background may be restarting; retry on the next metadata tick. */
    } finally {
      this.claiming = false;
    }
  }
  private sync(): void {
    if (this.disposed) return;
    const ad = this.isAd();
    if (ad !== this.ad) {
      this.ad = ad;
      if (ad) {
        this.boostActive = false;
        this.appliedBoost = 0;
        this.floating.restoreMini();
        resetBoost(this.video);
      } else this.applyPreferences();
    }
    if (this.youtube && this.settings.youtubeBoostEnabled && this.settings.youtubeAutoBoost &&
        !this.boostActive && !this.boostBusy && !this.boostUnavailable && !this.autoBoostSuppressed &&
        !ad && !this.video.paused && this.video.readyState >= 2 && this.video.videoWidth > 0)
      this.toggleBoost(true);
    const left = remainingSeconds(
      this.video.duration,
      this.video.currentTime,
      this.video.playbackRate
    );
    this.remaining.textContent =
      left === null || ad || this.isLive()
        ? ''
        : `${formatTime(left)} remaining at ${this.video.playbackRate}×`;
    this.editToggle.disabled = !this.canLoop();
    this.loopToggle.disabled = !this.canLoop();
    if (this.loopEnabled && this.loop && this.video.ended && !ad) {
      this.advanceLoopSection();
      this.perform(() => this.video.play());
    }
    this.scheduleLoop();
    if (
      this.youtube &&
      this.settings.rememberYoutubeSpeed &&
      this.initialized &&
      !ad &&
      this.video.readyState >= 1 &&
      this.lastAppliedSpeed === null
    )
      this.applyPreferences();
    void this.claimSavedItem();
  }
  private layout(): void {
    if (this.disposed) return;
    const fullscreen = this.doc.fullscreenElement;
    const target =
      fullscreen?.contains(this.video) && fullscreen.tagName !== 'VIDEO'
        ? fullscreen
        : this.doc.documentElement;
    if (this.host.parentElement !== target) target.appendChild(this.host);
    this.floating.update();
    this.youtubeButtons?.update(
      this.settings.youtubeLoop,
      this.canLoop(),
      this.loopOpen,
      this.loopEnabled,
      Boolean(this.loop) || this.items.some(item => item.end !== undefined),
      this.settings.youtubeBoostEnabled ? this.settings.youtubeBoost : 0, this.boostActive, !this.boostBusy && !this.boostUnavailable && !this.isAd()
    );
    const r = this.video.getBoundingClientRect();
    const visible =
      r.width >= 120 &&
      r.height >= 60 &&
      r.bottom > 0 &&
      r.top < this.win.innerHeight &&
      !this.isAd() &&
      !this.floating.inPip;
    this.launcher.hidden =
      !visible || (!this.hovering && !this.open && !this.editing);
    this.panel.hidden = !this.open || !visible;
    const showLoop = this.loopOpen && visible && this.canLoop();
    if (this.timeline.dataset.mfsLoopEditing !== String(showLoop)) {
      if (this.timeline.dataset.mfsLoopEditing !== undefined) {
        this.win.clearTimeout(this.loopAnimationTimer);
        this.timeline.dataset.mfsLoopAnimating = 'true';
        this.loopAnimationTimer = this.win.setTimeout(() => {
          delete this.timeline.dataset.mfsLoopAnimating;
        }, 240);
      }
      this.timeline.dataset.mfsLoopEditing = String(showLoop);
      this.timeline.dispatchEvent(new Event('mfs-loop-layout'));
    }
    this.loopPanel.hidden = true;
    this.loopPanel.setAttribute('aria-hidden', 'true');
    this.launcher.style.left = `${Math.max(8, Math.min(this.win.innerWidth - 80, r.right - 76))}px`;
    this.launcher.style.top = `${Math.max(8, r.top + 8)}px`;
    this.panel.style.left = `${Math.max(8, Math.min(this.win.innerWidth - 328, r.right - 328))}px`;
    this.panel.style.top = `${Math.max(8, Math.min(this.win.innerHeight - 180, r.top + 44))}px`;
    this.panel.style.maxHeight = `${Math.max(100, this.win.innerHeight - Number.parseFloat(this.panel.style.top) - 8)}px`;
    this.track.hidden =
      !visible ||
      !this.finite() ||
      (!this.editing && !this.loop && !this.items.some(item => item.end !== undefined) && !(this.hovering || this.open));

    this.layoutCinema(r, visible);
  }
  private layoutCinema(r: DOMRect, visible: boolean): void {
    if (!this.cinema || !visible) {
      this.shades.forEach((shade) => {
        shade.remove();
      });
      this.shades = [];
      return;
    }
    if (!this.shades.length)
      for (let i = 0; i < 4; i++) {
        const shade = element(this.doc, 'div', 'shade');
        shade.onclick = () => {
          this.cinema = false;
          this.layout();
        };
        this.root.prepend(shade);
        this.shades.push(shade);
      }
    const rects = [
      [0, 0, this.win.innerWidth, Math.max(0, r.top)],
      [
        0,
        r.bottom,
        this.win.innerWidth,
        Math.max(0, this.win.innerHeight - r.bottom),
      ],
      [0, Math.max(0, r.top), Math.max(0, r.left), r.height],
      [
        r.right,
        Math.max(0, r.top),
        Math.max(0, this.win.innerWidth - r.right),
        r.height,
      ],
    ];
    this.shades.forEach((shade, i) => {
      const [x, y, width, height] = rects[i] ?? [0, 0, 0, 0];
      shade.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;opacity:${this.settings.dimming / 100}`;
    });
  }
  private restoreFilter(): void {
    if (
      this.lastAppliedFilter !== null &&
      this.video.style.getPropertyValue('filter') === this.lastAppliedFilter
    ) {
      if (this.originalFilter)
        this.video.style.setProperty(
          'filter',
          this.originalFilter,
          this.originalFilterPriority
        );
      else this.video.style.removeProperty('filter');
    }
    this.lastAppliedFilter = null;
  }
  private resetMedia(): void {
    this.autoBoostSuppressed = false;
    this.boostActive = false;
    this.boostUnavailable = false;
    this.appliedBoost = 0;
    this.fineTuneWasPlaying = null;
    this.win.clearTimeout(this.fineTuneTimer);
    this.undoLoops = [];
    this.redoLoops = [];
    this.editBaseline = null;
    this.loopPreview?.(null);
    this.identityGeneration++;
    this.loopOpen = false;
    this.activeSavedId = null;
    this.claimedKey = '';
    this.loop = null;
    this.loopEnabled = false;
    this.editing = false;
    this.dragging = null;
    this.win.clearTimeout(this.loopTimer);
    this.floating.reset();
    this.restoreFilter();
    resetBoost(this.video);
    this.filters = { ...DEFAULT_FILTERS };
    this.lastAppliedSpeed = null;
    this.renderLoop();
    this.items = [];
    this.renderItems();
  }
  cleanup(): void {
    this.win.clearTimeout(this.fineTuneTimer);
    PlayerTools.instances.delete(this);
    if (this.disposed) return;
    this.disposed = true;
    this.youtubeButtons?.cleanup();
    this.win.clearTimeout(this.loopAnimationTimer);
    this.win.clearTimeout(this.loopTimer);
    this.floating.cleanup();
    this.restoreFilter();
    resetBoost(this.video);
    if (
      this.lastAppliedSpeed !== null &&
      this.video.playbackRate === this.lastAppliedSpeed
    )
      this.video.playbackRate = this.originalSpeed;
    for (const clean of this.cleanupFns) clean();
    this.cleanupFns = [];
    this.cardPlayer?.removeAttribute('data-mfs-hide-cards');
    this.cardPlayer?.removeAttribute('data-mfs-hide-end-screens');
    this.cardPlayer?.removeAttribute('data-mfs-auto-chapters');
    this.cardStyle.remove();
    this.host.remove();
  }
}

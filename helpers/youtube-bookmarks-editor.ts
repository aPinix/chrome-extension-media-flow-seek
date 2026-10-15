import { formatTime } from './player-actions';
import { button, element, field } from './player-tools-ui';
import { dismissPopoverOutside } from './popover-dismiss';
import type { SavedMoment } from './saved-media';

const styles = `
:host{font:13px/1.4 system-ui,sans-serif;color:#fff;color-scheme:dark;pointer-events:none;white-space:normal}
*{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit;color:inherit}
button{cursor:pointer;border:1px solid #ffffff26;border-radius:999px;padding:6px 10px;background:#ffffff14;white-space:nowrap}button:hover{background:#ffffff28}button:disabled{opacity:.4;cursor:default}
button:focus-visible,input:focus-visible{outline:2px solid #a4c4ff;outline-offset:2px}
.lane{position:absolute;inset:0;background:#172033cc;border:1px solid #a4c4ff;border-radius:5px;touch-action:none;pointer-events:auto;transition:opacity 200ms ease,transform 220ms ease}
.actions{position:absolute;bottom:calc(100% + 12px + var(--toolbar-clearance,0px));left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;width:max-content;max-width:calc(100% - 8px);padding:6px 8px;background:#202020f2;border:1px solid #ffffff30;border-radius:20px;box-shadow:0 3px 12px #0006;pointer-events:auto;transition:opacity 200ms ease,transform 220ms ease}
.actions strong{font-size:12px}.done{background:white;color:#202020}.done:hover{background:#ddd}
:host([data-compact=true]) .actions strong{display:none}:host([data-compact=true]) .actions{gap:4px}:host([data-compact=true]) .actions button{padding:5px 8px}
.inspector{position:absolute;bottom:calc(100% + 64px + var(--toolbar-clearance,0px));right:0;width:300px;max-width:calc(100% - 8px);max-height:var(--inspector-max-height,none);overflow:auto;padding:12px;background:#202020f2;border:1px solid #ffffff30;border-radius:14px;box-shadow:0 4px 16px #0006;pointer-events:auto;transition:opacity 200ms ease,transform 220ms ease}
header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}h2{font-size:13px;margin:0}.status{font-size:10px;color:#aaa;text-align:right}.status[data-error=true]{color:#fca5a5}
.field{display:flex;align-items:center;gap:8px;margin:8px 0}.field>span{min-width:42px;color:#ccc;font-size:12px}.field input{width:100%;min-width:0;border:1px solid #ffffff30;border-radius:6px;background:#121212;padding:5px 7px}.field input[type=number]{width:100px}
.row{display:flex;gap:6px}.hint{margin:8px 0 0;color:#aaa;font-size:11px}.empty{font-size:12px;color:#ccc;margin:0}
.point{position:absolute;top:0;bottom:0;width:16px;padding:0;border:0;border-radius:4px;background:transparent;transform:translateX(-50%);cursor:ew-resize;touch-action:none}.point::before{content:'';position:absolute;top:0;bottom:0;left:6px;width:4px;border-radius:2px;background:#38d9ff}.point[aria-pressed=true],.point:hover{background:#38d9ff22}.point:hover::before,.point[aria-pressed=true]::before{background:#8beaff}
.point-label{position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);max-width:180px;overflow:hidden;text-overflow:ellipsis;background:#202020f2;border-radius:7px;padding:4px 7px;font-size:11px;white-space:nowrap;pointer-events:none;opacity:0}.point:hover .point-label,.point:focus-visible .point-label,.lane[data-dragging=true] .point[aria-pressed=true] .point-label{opacity:1}
:host([data-closing=true]) .lane{opacity:0;transform:scaleY(.2)}:host([data-closing=true]) .actions,:host([data-closing=true]) .inspector{opacity:0;transform:translateY(12px);pointer-events:none}:host([data-closing=true]) .actions{transform:translate(-50%,12px)}
@media(prefers-reduced-motion:reduce){.lane,.actions,.inspector{transition:none}}
`;

/** Edits the existing point bookmarks without creating a separate library. */
export class YouTubeBookmarksEditor {
  readonly host: HTMLDivElement;
  private root: ShadowRoot;
  private lane: HTMLDivElement;
  private name: HTMLInputElement;
  private time: HTMLInputElement;
  private inspector: HTMLDivElement;
  private status: HTMLSpanElement;
  private empty: HTMLParagraphElement;
  private fields: HTMLDivElement;
  private controls: HTMLDivElement;
  private discard: HTMLButtonElement;
  private clear: HTMLButtonElement;
  private undo: HTMLButtonElement;
  private redo: HTMLButtonElement;
  private baseline: SavedMoment[] = [];
  private undoStack: SavedMoment[][] = [];
  private redoStack: SavedMoment[][] = [];
  private items: SavedMoment[] = [];
  private selected: string | null = null;
  private opened = false;
  private closing = false;
  private enabled = false;
  private available = false;
  private busy = false;
  private disposed = false;
  private dragClick = false;
  private generation = 0;
  private anchor: HTMLButtonElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private cleanups: Array<() => void> = [];
  private drag: {
    item: SavedMoment;
    x: number;
    pointer: number;
    width: number;
    moved: boolean;
    created: boolean;
    start: number;
  } | null = null;

  constructor(
    private video: HTMLVideoElement,
    private timeline: HTMLElement,
    private actions: {
      onSave: (item: SavedMoment) => Promise<void>;
      onDelete: (id: string) => Promise<void>;
      onAdd: (time: number) => Promise<void>;
      onRestore: (items: SavedMoment[]) => Promise<void>;
      onSeek: (time: number) => void;
      onOpenChange: () => void;
    }
  ) {
    const doc = video.ownerDocument;
    this.host = element(doc, 'div', 'mfs-youtube-bookmarks-editor');
    this.host.style.cssText =
      'position:absolute;inset:0;z-index:12;pointer-events:none;overflow:visible';
    this.host.hidden = true;
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = element(doc, 'style');
    style.textContent = styles;
    this.lane = element(doc, 'div', 'lane');
    this.controls = element(doc, 'div', 'actions');
    const controls = this.controls;
    controls.setAttribute('aria-label', 'Bookmark editing');
    controls.append(element(doc, 'strong', '', 'Bookmarks'));
    this.discard = button(
      doc,
      'Discard changes',
      () => {
        void this.mutate(
          () => actions.onRestore(this.snapshot(this.baseline)),
          false
        ).then((saved) => {
          if (saved) this.close(true);
        });
      },
      controls
    );
    button(doc, 'Close', () => this.close(true), controls).className = 'done';
    this.clear = button(
      doc,
      'Clear bookmarks',
      () => {
        void this.mutate(() => actions.onRestore([]));
      },
      controls
    );
    this.undo = button(
      doc,
      'Undo',
      () => void this.restoreHistory(false),
      controls
    );
    this.redo = button(
      doc,
      'Redo',
      () => void this.restoreHistory(true),
      controls
    );
    for (const control of controls.querySelectorAll('button')) {
      const label = control.textContent ?? '';
      control.setAttribute('aria-label', label);
      control.title = label;
    }
    this.lane.setAttribute(
      'aria-label',
      'Click the timeline to add a bookmark'
    );
    this.lane.addEventListener('pointerdown', (event) => {
      if (event.target === this.lane)
        this.createDrag(event, this.timeline.getBoundingClientRect());
    });
    this.lane.addEventListener('click', (event) => {
      if (event.target !== this.lane || !this.opened || this.busy) return;
      const rect = this.timeline.getBoundingClientRect();
      if (!rect.width) return;
      const time = this.clamp(
        ((event.clientX - rect.left) / rect.width) * video.duration
      );
      const existingIds = new Set(this.items.map((item) => item.id));
      void this.mutate(async () => {
        await actions.onAdd(time);
        this.selected =
          this.items.find((item) => !existingIds.has(item.id))?.id ??
          this.selected;
      });
    });
    this.inspector = element(doc, 'div', 'inspector');
    this.inspector.setAttribute('role', 'dialog');
    this.inspector.setAttribute('aria-label', 'Edit bookmarks');
    const header = element(doc, 'header');
    header.append(element(doc, 'h2', '', 'Edit bookmark'));
    this.status = element(doc, 'span', 'status');
    this.status.setAttribute('role', 'status');
    header.append(this.status);
    this.fields = element(doc, 'div');
    this.name = element(doc, 'input');
    this.name.maxLength = 160;
    this.name.setAttribute('aria-label', 'Bookmark name');
    this.name.addEventListener('change', () => this.rename());
    this.name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.rename();
      }
    });
    field(doc, 'Name', this.name, this.fields);
    this.time = element(doc, 'input');
    this.time.type = 'number';
    this.time.min = '0';
    this.time.step = '0.001';
    this.time.setAttribute('aria-label', 'Bookmark time in seconds');
    this.time.addEventListener('change', () => {
      const item = this.current();
      if (item && this.time.checkValidity())
        this.save({ ...item, start: this.clamp(this.time.valueAsNumber) });
    });
    field(doc, 'Time', this.time, this.fields);
    const row = element(doc, 'div', 'row');
    button(
      doc,
      'Go to moment',
      () => {
        const item = this.current();
        if (item) actions.onSeek(item.start);
      },
      row
    );
    button(
      doc,
      'Delete',
      () => {
        const item = this.current();
        if (item) void this.mutate(() => actions.onDelete(item.id));
      },
      row
    );
    this.fields.append(row);
    this.empty = element(
      doc,
      'p',
      'empty',
      'Click the timeline to add a bookmark.'
    );
    this.inspector.append(
      header,
      this.fields,
      this.empty,
      element(
        doc,
        'p',
        'hint',
        'Click the timeline to add. Drag bars to move. Arrow keys move 1s; Shift moves 0.1s.'
      )
    );
    this.root.append(style, this.lane, controls, this.inspector);
    timeline.append(this.host);
    const listen = (
      target: EventTarget,
      type: string,
      handler: EventListener,
      capture = false
    ) => {
      target.addEventListener(type, handler, capture);
      this.cleanups.push(() =>
        target.removeEventListener(type, handler, capture)
      );
    };
    for (const type of [
      'pointerdown',
      'mousedown',
      'click',
      'dblclick',
      'wheel',
      'keydown',
    ])
      listen(this.root, type, (event) => event.stopPropagation());
    listen(
      doc,
      'pointermove',
      (event) => this.move(event as PointerEvent),
      true
    );
    listen(
      doc,
      'pointerup',
      (event) => this.finish(event as PointerEvent),
      true
    );
    listen(doc, 'pointercancel', () => this.cancelDrag(), true);
    listen(
      doc,
      'pointerdown',
      () => {
        this.dragClick = false;
      },
      true
    );
    for (const type of ['mouseup', 'click'])
      listen(
        doc,
        type,
        (event) => {
          if (!this.dragClick) return;
          if (type === 'click') this.dragClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true
      );
    const seekbarEvent = (event: Event) => {
      if (
        !this.opened ||
        event.composedPath().includes(this.host) ||
        !this.isSeekbarPath(event.composedPath())
      )
        return;
      const mouse = event as PointerEvent;
      if (mouse.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === 'pointerdown') {
        const native = this.video
          .closest('#movie_player,.html5-video-player')
          ?.querySelector('.ytp-progress-bar');
        this.createDrag(
          mouse,
          native?.getBoundingClientRect() ??
            this.timeline.getBoundingClientRect()
        );
      }
    };
    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ])
      listen(doc, type, seekbarEvent, true);
    listen(
      doc,
      'keydown',
      (event) => {
        if (
          (this.opened || this.closing) &&
          (event as KeyboardEvent).key === 'Escape'
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.close(true);
        }
      },
      true
    );
    this.cleanups.push(
      dismissPopoverOutside(
        doc,
        () => this.opened,
        (path) =>
          path.includes(this.host) ||
          path.includes(this.anchor as EventTarget) ||
          this.isSeekbarPath(path),
        () => this.close()
      )
    );
  }

  get isOpen() {
    return this.opened;
  }
  get isVisible() {
    return this.opened || this.closing;
  }

  update(items: SavedMoment[], enabled: boolean, available: boolean) {
    if (this.disposed) return;
    this.enabled = enabled;
    this.available = available;
    this.items = items
      .filter((item) => item.end === undefined)
      .map((item) => ({ ...item }));
    if (this.drag?.created)
      this.items.push({ ...this.drag.item, start: this.drag.start });
    if (!enabled || !available) this.close(false, false);
    if (!this.drag) this.render();
  }

  layout() {
    if (!this.isVisible) return;
    const player = this.video.closest('.html5-video-player');
    const toolbar = player?.querySelector<HTMLElement>(
      '.mfs-youtube-controls[data-stacked=true]'
    );
    const rect = this.timeline.getBoundingClientRect();
    const scale = this.timeline.clientWidth
      ? rect.width / this.timeline.clientWidth
      : 1;
    const compact = rect.width / scale < 540;
    this.host.dataset.compact = String(compact);
    this.discard.textContent = compact ? 'Discard' : 'Discard changes';
    this.clear.textContent = compact ? 'Clear' : 'Clear bookmarks';
    this.undo.textContent = compact ? '↶' : 'Undo';
    this.redo.textContent = compact ? '↷' : 'Redo';
    const clearance =
      toolbar && scale > 0
        ? Math.max(0, (rect.top - toolbar.getBoundingClientRect().top) / scale)
        : 0;
    this.host.style.setProperty('--toolbar-clearance', `${clearance}px`);
    const inspectorGap = Math.max(
      64,
      this.controls.getBoundingClientRect().height / scale + 20
    );
    this.inspector.style.bottom = `calc(100% + ${inspectorGap + clearance}px)`;
    if (player && scale > 0) {
      const height =
        (rect.top - player.getBoundingClientRect().top) / scale -
        inspectorGap -
        clearance -
        8;
      this.host.style.setProperty(
        '--inspector-max-height',
        `${Math.max(48, height)}px`
      );
    }
  }

  open(anchor: HTMLButtonElement) {
    if (this.disposed || !this.enabled || !this.available) return;
    if (!this.opened) {
      this.baseline = this.snapshot();
      this.undoStack = [];
      this.redoStack = [];
    }
    clearTimeout(this.closeTimer);
    this.closing = false;
    this.anchor = anchor;
    this.opened = true;
    this.host.hidden = false;
    this.host.dataset.closing = 'false';
    this.host.inert = false;
    this.selected ??= this.items[0]?.id ?? null;
    this.status.textContent = '';
    this.render();
    this.layout();
    this.actions.onOpenChange();
  }

  close(focus = false, animate = true) {
    if (!this.opened && !this.closing) return;
    this.cancelDrag();
    this.opened = false;
    clearTimeout(this.closeTimer);
    this.closing =
      animate &&
      !this.video.ownerDocument.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches;
    this.host.dataset.closing = String(this.closing);
    this.host.inert = true;
    if (this.closing)
      this.closeTimer = setTimeout(() => {
        this.closing = false;
        this.host.hidden = true;
        this.actions.onOpenChange();
      }, 240);
    else this.host.hidden = true;
    if (focus && this.anchor?.isConnected) this.anchor.focus();
    this.actions.onOpenChange();
  }

  reset() {
    this.generation++;
    this.close(false, false);
    this.items = [];
    this.selected = null;
    this.busy = false;
    this.baseline = [];
    this.undoStack = [];
    this.redoStack = [];
    this.render();
  }
  private current() {
    return this.items.find((item) => item.id === this.selected);
  }
  private isSeekbarPath(path: EventTarget[]) {
    const player = this.video.closest('#movie_player,.html5-video-player');
    return (
      path.includes(this.timeline) ||
      path.some(
        (target) =>
          target instanceof HTMLElement &&
          player?.contains(target) &&
          target.matches(
            '.ytp-progress-bar,.ytp-progress-bar-container,.ytp-progress-list'
          )
      )
    );
  }
  private createDrag(event: PointerEvent, rect: DOMRect) {
    if (
      event.button !== 0 ||
      !this.opened ||
      this.busy ||
      this.drag ||
      !rect.width
    )
      return;
    event.preventDefault();
    const start = this.clamp(
      ((event.clientX - rect.left) / rect.width) * this.video.duration
    );
    if (!Number.isFinite(start)) return;
    const item: SavedMoment = {
      id: crypto.randomUUID(),
      start,
      name: `Moment ${formatTime(start)}`,
      mediaKey: 'draft',
      url: this.video.ownerDocument.location.href,
      title: this.video.ownerDocument.title,
      createdAt: Date.now(),
    };
    this.items.push(item);
    this.selected = item.id;
    this.render();
    this.drag = {
      item,
      x: event.clientX,
      pointer: event.pointerId,
      width: rect.width,
      moved: false,
      created: true,
      start,
    };
    this.lane.dataset.dragging = 'true';
  }
  private clamp(time: number) {
    return (
      Math.round(
        Math.max(0, Math.min(this.video.duration - 0.001, time)) * 1000
      ) / 1000
    );
  }
  private rename() {
    const item = this.current();
    if (!item || this.busy) return;
    const name = this.name.value.trim();
    if (!name) {
      this.status.textContent = 'Choose a name.';
      this.status.dataset.error = 'true';
      return;
    }
    if (name !== item.name) this.save({ ...item, name });
  }
  private save(item: SavedMoment) {
    if (!Number.isFinite(item.start) || this.busy || !this.opened) return;
    void this.mutate(() => this.actions.onSave(item));
  }
  private snapshot(items = this.items) {
    return items.map((item) => ({ ...item }));
  }
  private signature(items: SavedMoment[]) {
    return JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)));
  }
  private async restoreHistory(redo: boolean) {
    const from = redo ? this.redoStack : this.undoStack;
    const to = redo ? this.undoStack : this.redoStack;
    const next = from.at(-1);
    if (!next || this.busy) return;
    const previous = this.snapshot();
    const saved = await this.mutate(
      () => this.actions.onRestore(this.snapshot(next)),
      false
    );
    if (saved) {
      from.pop();
      to.push(previous);
      this.render();
    }
  }
  private async mutate(
    action: () => Promise<void>,
    record = true
  ): Promise<boolean> {
    if (this.busy || !this.opened || !this.available) return false;
    const generation = this.generation;
    const previous = this.snapshot();
    this.busy = true;
    this.status.textContent = 'Saving…';
    this.status.dataset.error = 'false';
    this.renderInspector();
    try {
      await action();
      if (generation === this.generation && !this.disposed) {
        if (record && this.signature(previous) !== this.signature(this.items)) {
          this.undoStack.push(previous);
          if (this.undoStack.length > 100) this.undoStack.shift();
          this.redoStack = [];
        }
        this.status.textContent = 'Saved';
        return true;
      }
    } catch (error) {
      if (generation === this.generation && !this.disposed) {
        this.status.textContent =
          error instanceof Error ? error.message : 'Could not save bookmark.';
        this.status.dataset.error = 'true';
      }
    } finally {
      if (generation === this.generation && !this.disposed) {
        this.busy = false;
        this.render();
      }
    }
    return false;
  }
  private render() {
    if (this.disposed || this.drag) return;
    const focused = (this.root.activeElement as HTMLElement | null)?.dataset
      .bookmarkId;
    if (!this.current()) this.selected = this.items[0]?.id ?? null;
    this.lane.replaceChildren();
    for (const item of [...this.items].sort((a, b) => a.start - b.start)) {
      if (item.start >= this.video.duration) continue;
      const node = button(
        this.video.ownerDocument,
        '',
        () => {
          if (!this.busy) {
            this.selected = item.id;
            this.render();
          }
        },
        this.lane
      );
      node.className = 'point';
      node.dataset.bookmarkId = item.id;
      node.setAttribute(
        'aria-label',
        `${item.name} at ${formatTime(item.start)}`
      );
      node.setAttribute('aria-pressed', String(item.id === this.selected));
      node.style.left = `${(item.start / this.video.duration) * 100}%`;
      node.append(
        element(
          this.video.ownerDocument,
          'span',
          'point-label',
          `${formatTime(item.start)} · ${item.name}`
        )
      );
      node.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || this.busy || !this.opened) return;
        event.preventDefault();
        this.selected = item.id;
        this.renderInspector();
        for (const point of this.lane.querySelectorAll('button'))
          point.setAttribute('aria-pressed', String(point === node));
        this.drag = {
          item: { ...item },
          x: event.clientX,
          pointer: event.pointerId,
          width: this.timeline.getBoundingClientRect().width,
          moved: false,
          created: false,
          start: item.start,
        };
        this.lane.dataset.dragging = 'true';
        node.focus();
      });
      node.addEventListener('keydown', (event) => {
        if (
          this.busy ||
          !this.opened ||
          !['ArrowLeft', 'ArrowRight'].includes(event.key)
        )
          return;
        event.preventDefault();
        this.selected = item.id;
        this.save({
          ...item,
          start: this.clamp(
            item.start +
              (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.1 : 1)
          ),
        });
      });
    }
    this.renderInspector();
    if (focused)
      [...this.lane.querySelectorAll<HTMLButtonElement>('.point')]
        .find((node) => node.dataset.bookmarkId === focused)
        ?.focus();
  }
  private renderInspector() {
    this.discard.disabled =
      this.busy || this.signature(this.items) === this.signature(this.baseline);
    this.clear.disabled = this.busy || !this.items.length;
    this.undo.disabled = this.busy || !this.undoStack.length;
    this.redo.disabled = this.busy || !this.redoStack.length;
    const item = this.current();
    this.fields.hidden = !item;
    this.empty.hidden = Boolean(item);
    const heading = this.inspector.querySelector('h2');
    if (heading) heading.textContent = item ? 'Edit bookmark' : 'Bookmarks';
    if (item) {
      if (this.root.activeElement !== this.name) this.name.value = item.name;
      if (this.root.activeElement !== this.time)
        this.time.value = String(Math.round(item.start * 1000) / 1000);
      this.time.max = String(Math.max(0, this.video.duration - 0.001));
    }
    for (const control of this.fields.querySelectorAll<
      HTMLInputElement | HTMLButtonElement
    >('input,button'))
      control.disabled = this.busy;
  }
  private move(event: PointerEvent) {
    if (!this.drag || event.pointerId !== this.drag.pointer || !this.drag.width)
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const start = this.clamp(
      this.drag.item.start +
        ((event.clientX - this.drag.x) / this.drag.width) * this.video.duration
    );
    this.drag.moved ||= Math.abs(event.clientX - this.drag.x) > 2;
    this.drag.start = start;
    const node = [...this.lane.querySelectorAll<HTMLElement>('.point')].find(
      (node) => node.dataset.bookmarkId === this.drag?.item.id
    );
    if (node) {
      node.style.left = `${(start / this.video.duration) * 100}%`;
      node.dataset.draftTime = String(start);
      const label = node.querySelector('.point-label');
      if (label)
        label.textContent = `${formatTime(start)} · ${this.drag.item.name}`;
    }
    this.time.value = String(start);
  }
  private finish(event: PointerEvent) {
    if (!this.drag || event.pointerId !== this.drag.pointer) return;
    const drag = this.drag;
    const start = drag.start;
    this.drag = null;
    this.lane.dataset.dragging = 'false';
    if (drag.created) {
      this.items = this.items.filter((item) => item.id !== drag.item.id);
      const ids = new Set(this.items.map((item) => item.id));
      this.dragClick = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      void this.mutate(async () => {
        await this.actions.onAdd(start);
        this.selected =
          this.items.find((item) => !ids.has(item.id))?.id ?? null;
      });
    } else if (drag.moved) {
      this.dragClick = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.save({ ...drag.item, start });
    }
  }
  private cancelDrag() {
    if (!this.drag) return;
    if (this.drag.created)
      this.items = this.items.filter((item) => item.id !== this.drag?.item.id);
    this.drag = null;
    this.lane.dataset.dragging = 'false';
    this.render();
  }
  cleanup() {
    this.reset();
    this.disposed = true;
    clearTimeout(this.closeTimer);
    for (const cleanup of this.cleanups) cleanup();
    this.host.remove();
  }
}

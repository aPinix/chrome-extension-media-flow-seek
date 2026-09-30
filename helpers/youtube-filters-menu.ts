import { filterCSS } from './player-actions';
import { DEFAULT_FILTERS, type VideoFilters } from './player-tools-settings';
import { dismissPopoverOutside } from './popover-dismiss';
import { createYouTubeControlIcon } from './youtube-control-icons';

type FilterMenuState = {
  filters: VideoFilters;
  enabled: boolean;
  available: boolean;
  hasPreset: boolean;
};
type FilterMenuActions = {
  onChange: (filters: VideoFilters) => void;
  onSave: (filters: VideoFilters) => Promise<void>;
  onForget: () => Promise<void>;
  onOpenChange: () => void;
};
let menuId = 0;

const presets: Array<{ name: string; filters: VideoFilters }> = [
  { name: 'Original', filters: { ...DEFAULT_FILTERS } },
  {
    name: 'Vivid',
    filters: { brightness: 105, contrast: 115, saturation: 145, grayscale: 0 },
  },
  {
    name: 'Cinema',
    filters: { brightness: 95, contrast: 125, saturation: 80, grayscale: 0 },
  },
  {
    name: 'Soft',
    filters: { brightness: 108, contrast: 90, saturation: 90, grayscale: 0 },
  },
  {
    name: 'Mono',
    filters: { brightness: 105, contrast: 115, saturation: 0, grayscale: 100 },
  },
];

const styles = `
:host{font:14px/1.4 Roboto,Arial,sans-serif;color:#fff;color-scheme:dark;pointer-events:auto;text-align:left}
*{box-sizing:border-box}[hidden]{display:none!important}
.menu{overflow:auto;max-height:inherit;background:rgba(15,15,15,.9);border-radius:12px;padding:8px 0;box-shadow:0 4px 20px #0005;scrollbar-width:thin}
header{display:flex;align-items:center;gap:10px;padding:10px 20px;font-weight:500;border-bottom:1px solid #ffffff1a}header svg{display:block;flex:none;width:20px;height:20px}h2{font:inherit;line-height:20px;margin:0}
.filter{display:block;padding:6px 20px 4px}.filter:hover{background:#ffffff0c}.label{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:4px}.value{color:#ccc;font-variant-numeric:tabular-nums}
input{display:block;appearance:none;width:100%;height:14px;background:transparent;margin:0;cursor:pointer}input::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:var(--track)}input::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:#fff}input::-moz-range-track{height:4px;border-radius:999px;background:var(--track)}input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
.actions{margin-top:8px;padding-top:6px;border-top:1px solid #ffffff1a;font-size:13px}button{display:block;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:8px 20px;cursor:pointer}button:hover{background:#ffffff1a}button:disabled{opacity:.45;cursor:default}input:focus-visible,button:focus-visible{outline:2px solid #fff;outline-offset:-2px}
.status{margin:0 0 0 auto;color:#aaa;font-size:11px;font-weight:400;line-height:1.3;text-align:right;max-width:45%}.status:empty{display:none}
.presets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:12px 20px 6px}.preset{padding:0;background:none!important;font-size:11px;text-align:center}.thumbnail{display:block;aspect-ratio:16/10;width:100%;overflow:hidden;border:2px solid transparent;border-radius:5px;background:linear-gradient(160deg,#1e899a,#ac905e 55%,#25313a)}.thumbnail img{width:100%;height:100%;object-fit:cover}.preset-label{display:block;margin-top:5px}.preset:hover .thumbnail{border-color:#ffffff80}.preset[aria-pressed=true] .thumbnail{border-color:#fff}.preset[aria-pressed=true] .preset-label{font-weight:600}
`;

/** A player-owned, nonmodal filter popup that follows YouTube into fullscreen. */
export class YouTubeFiltersMenu {
  readonly host: HTMLDivElement;
  private root: ShadowRoot;
  private inputs = new Map<
    keyof VideoFilters,
    { input: HTMLInputElement; value: HTMLElement }
  >();
  private presetButtons: Array<{
    button: HTMLButtonElement;
    image: HTMLImageElement;
    filters: VideoFilters;
  }> = [];
  private status: HTMLElement;
  private save: HTMLButtonElement;
  private forget: HTMLButtonElement;
  private anchor: HTMLButtonElement | null = null;
  private owner: HTMLElement | null = null;
  private state: FilterMenuState = {
    filters: { ...DEFAULT_FILTERS },
    enabled: false,
    available: false,
    hasPreset: false,
  };
  private opened = false;
  private disposed = false;
  private saving = false;
  private generation = 0;
  private cleanups: Array<() => void> = [];

  constructor(
    private video: HTMLVideoElement,
    private actions: FilterMenuActions
  ) {
    const doc = video.ownerDocument;
    this.host = doc.createElement('div');
    this.host.className = 'mfs-youtube-filters-popup';
    this.host.id = `mfs-youtube-filters-${++menuId}`;
    this.host.hidden = true;
    this.host.style.cssText = 'position:absolute;right:12px;z-index:65;';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = styles;
    const menu = doc.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Video Filters');
    const header = doc.createElement('header');
    const title = doc.createElement('h2');
    title.textContent = 'Video Filters';
    header.append(createYouTubeControlIcon(doc, 'filters'), title);
    menu.append(header);
    for (const key of [
      'brightness',
      'contrast',
      'saturation',
      'grayscale',
    ] as const) {
      const label = doc.createElement('label');
      label.className = 'filter';
      const caption = doc.createElement('span');
      caption.className = 'label';
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      const value = doc.createElement('span');
      value.className = 'value';
      caption.append(name, value);
      const input = doc.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = key === 'grayscale' ? '100' : '200';
      input.step = '1';
      input.setAttribute('aria-label', name);
      input.addEventListener('input', () => {
        if (this.disposed || !this.state.available) return;
        this.state.filters = {
          ...this.state.filters,
          [key]: input.valueAsNumber,
        };
        this.render();
        actions.onChange({ ...this.state.filters });
      });
      label.append(caption, input);
      menu.append(label);
      this.inputs.set(key, { input, value });
    }
    const presetRow = doc.createElement('div');
    presetRow.className = 'presets';
    presetRow.setAttribute('role', 'group');
    presetRow.setAttribute('aria-label', 'Filter presets');
    for (const preset of presets) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'preset';
      button.setAttribute('aria-label', `${preset.name} preset`);
      const thumbnail = doc.createElement('span');
      thumbnail.className = 'thumbnail';
      const image = doc.createElement('img');
      image.alt = '';
      image.hidden = true;
      thumbnail.style.filter = filterCSS(preset.filters);
      thumbnail.append(image);
      const label = doc.createElement('span');
      label.className = 'preset-label';
      label.textContent = preset.name;
      button.append(thumbnail, label);
      button.addEventListener('click', () => {
        if (this.disposed || !this.state.enabled || !this.state.available)
          return;
        this.state.filters = { ...preset.filters };
        this.render();
        actions.onChange({ ...preset.filters });
      });
      presetRow.append(button);
      this.presetButtons.push({ button, image, filters: preset.filters });
    }
    menu.append(presetRow);
    const footer = doc.createElement('div');
    footer.className = 'actions';
    const action = (label: string, run: () => void) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        if (!this.disposed && !button.disabled) run();
      });
      footer.append(button);
      return button;
    };
    action('Reset filters', () => {
      this.state.filters = { ...DEFAULT_FILTERS };
      this.render();
      actions.onChange({ ...DEFAULT_FILTERS });
    });
    this.save = action('Save for YouTube', () => {
      void this.persist('save');
    });
    this.forget = action('Remove saved preset', () => {
      void this.persist('forget');
    });
    this.status = doc.createElement('p');
    this.status.className = 'status';
    this.status.setAttribute('role', 'status');
    header.append(this.status);
    menu.append(footer);
    this.root.append(style, menu);
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
      'click',
      'dblclick',
      'pointerdown',
      'mousedown',
      'wheel',
      'keydown',
    ])
      listen(this.root, type, (event) => event.stopPropagation());
    this.cleanups.push(
      dismissPopoverOutside(
        doc,
        () => this.opened,
        (path) =>
          path.includes(this.host) || path.includes(this.anchor as EventTarget),
        () => this.close()
      )
    );
    listen(
      doc,
      'keydown',
      (event) => {
        const key = event as KeyboardEvent;
        if (this.opened && key.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.close(true);
        }
      },
      true
    );
    for (const type of ['yt-navigate-start', 'fullscreenchange'])
      listen(doc, type, () => this.close());
    listen(video, 'enterpictureinpicture', () => this.close());
  }

  get isOpen(): boolean {
    return this.opened;
  }

  update(state: FilterMenuState): void {
    if (this.disposed) return;
    this.state = { ...state, filters: { ...state.filters } };
    const player = this.video.closest<HTMLElement>(
      '#movie_player, .html5-video-player'
    );
    if (
      !state.enabled ||
      !state.available ||
      !player ||
      (player.querySelector('video.html5-main-video') ??
        player.querySelector('video')) !== this.video
    ) {
      this.close();
      this.host.remove();
      return;
    }
    if (this.owner !== player) {
      this.close();
      this.owner = player;
    }
    if (this.host.parentElement !== player) player.append(this.host);
    this.render();
    if (this.opened) this.position();
  }

  toggle(anchor: HTMLButtonElement): void {
    if (this.disposed || !this.state.enabled || !this.state.available) return;
    if (this.opened) {
      this.close();
      return;
    }
    const nativeMenu =
      this.owner?.querySelector<HTMLElement>('.ytp-settings-menu');
    if (
      nativeMenu &&
      this.video.ownerDocument.defaultView?.getComputedStyle(nativeMenu)
        .display !== 'none' &&
      nativeMenu.getBoundingClientRect().height > 0
    )
      this.owner
        ?.querySelector<HTMLButtonElement>('.ytp-settings-button')
        ?.click();
    this.anchor = anchor;
    anchor.setAttribute('aria-controls', this.host.id);
    this.opened = true;
    this.host.hidden = false;
    this.owner?.classList.add('mfs-filters-open');
    this.refreshThumbnails();
    this.position();
    this.actions.onOpenChange();
    this.inputs.get('brightness')?.input.focus({ preventScroll: true });
  }

  close(restoreFocus = false): void {
    if (!this.opened) return;
    this.opened = false;
    this.host.hidden = true;
    this.owner?.classList.remove('mfs-filters-open');
    this.actions.onOpenChange();
    if (restoreFocus && this.anchor?.isConnected)
      this.anchor.focus({ preventScroll: true });
  }

  private position(): void {
    const rect = this.owner?.getBoundingClientRect();
    if (!rect) return;
    const controls = this.owner
      ?.querySelector('.ytp-chrome-bottom')
      ?.getBoundingClientRect();
    const bottom = Math.max(controls?.height || 48, 36) + 12;
    this.host.style.width = `${Math.max(0, Math.min(320, rect.width - 24))}px`;
    this.host.style.bottom = `${bottom}px`;
    this.host.style.maxHeight = `${Math.max(0, rect.height - bottom - 12)}px`;
  }

  private render(): void {
    for (const [key, { input, value }] of this.inputs) {
      input.value = String(this.state.filters[key]);
      input.disabled = !this.state.available;
      input.setAttribute('aria-valuetext', `${this.state.filters[key]}%`);
      value.textContent = `${this.state.filters[key]}%`;
      const percentage = (this.state.filters[key] / Number(input.max)) * 100;
      input.style.setProperty(
        '--track',
        `linear-gradient(to right,#fff ${percentage}%,#ffffff55 ${percentage}%)`
      );
    }
    for (const { button, filters } of this.presetButtons) {
      button.disabled = !this.state.available;
      button.setAttribute(
        'aria-pressed',
        String(
          (Object.keys(DEFAULT_FILTERS) as Array<keyof VideoFilters>).every(
            (key) => filters[key] === this.state.filters[key]
          )
        )
      );
    }
    this.save.disabled = this.saving;
    this.forget.disabled = this.saving || !this.state.hasPreset;
  }

  private refreshThumbnails(): void {
    for (const { image } of this.presetButtons) {
      image.removeAttribute('src');
      image.hidden = true;
    }
    try {
      if (
        this.video.readyState < 2 ||
        !this.video.videoWidth ||
        this.video.mediaKeys
      )
        return;
      const canvas = this.video.ownerDocument.createElement('canvas');
      canvas.width = 160;
      canvas.height = Math.max(
        1,
        Math.min(
          320,
          Math.round((160 * this.video.videoHeight) / this.video.videoWidth)
        )
      );
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL('image/jpeg', 0.7);
      for (const { image } of this.presetButtons) {
        image.src = frame;
        image.hidden = false;
      }
    } catch {
      // Protected or cross-origin frames keep the filtered thumbnail fallback.
    }
  }

  private async persist(kind: 'save' | 'forget'): Promise<void> {
    if (this.saving || this.disposed) return;
    this.saving = true;
    this.status.textContent = '';
    const generation = this.generation;
    this.render();
    try {
      if (kind === 'save') await this.actions.onSave({ ...this.state.filters });
      else await this.actions.onForget();
      if (this.disposed || generation !== this.generation) return;
      this.state.hasPreset = kind === 'save';
      this.status.textContent =
        kind === 'save'
          ? 'Filters saved for YouTube.'
          : 'Saved preset removed.';
    } catch {
      if (!this.disposed && generation === this.generation)
        this.status.textContent =
          'Could not save filter preferences. Try again.';
    } finally {
      if (!this.disposed && generation === this.generation) {
        this.saving = false;
        this.render();
      }
    }
  }

  reset(): void {
    this.close();
    this.generation++;
    this.saving = false;
    this.status.textContent = '';
  }

  cleanup(): void {
    this.close();
    this.disposed = true;
    for (const clean of this.cleanups) clean();
    this.host.remove();
  }
}

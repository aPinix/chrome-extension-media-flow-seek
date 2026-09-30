import { cinemaPresets } from './player-cinema-presets';
import type { PlayerToolsSettings } from './player-tools-settings';
import { dismissPopoverOutside } from './popover-dismiss';
import {
  createYouTubeControlIcon,
  YOUTUBE_CONTROL_LABELS,
  type YouTubeAdvancedControl,
} from './youtube-control-icons';

export type YouTubeAdvancedPreferences = Pick<
  PlayerToolsSettings,
  | 'youtubeBoost'
  | 'youtubeAutoBoost'
  | 'dimming'
  | 'cinemaColor'
  | 'cinemaColorCustom'
  | 'youtubeScreenshotIncludeFilters'
>;
let menuId = 0;

const styles = `
:host{font:14px/1.4 Roboto,Arial,sans-serif;color:#fff;color-scheme:dark;pointer-events:auto;text-align:left}*{box-sizing:border-box}[hidden]{display:none!important}
.menu{overflow:auto;max-height:inherit;background:rgba(15,15,15,.9);border-radius:12px;padding:8px 0;box-shadow:0 4px 20px #0005;scrollbar-width:thin}header{display:flex;align-items:center;gap:10px;padding:10px 20px;font-weight:500;border-bottom:1px solid #ffffff1a}header svg{display:block;flex:none;width:20px;height:20px}h2{font:inherit;line-height:20px;margin:0}
.section{padding:12px 20px}.label{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}.value,.muted{color:#aaa;font-variant-numeric:tabular-nums}
input[type=range]{display:block;appearance:none;width:100%;height:16px;background:transparent;margin:0;cursor:pointer}input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:var(--track)}input[type=range]::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:#fff}input[type=range]::-moz-range-track{height:4px;border-radius:999px;background:var(--track)}input[type=range]::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
.switch{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 20px;cursor:pointer}.switch:hover{background:#ffffff1a}.switch input{appearance:none;width:36px;height:20px;border-radius:999px;background:#ffffff40;position:relative;flex:none;margin:0;cursor:pointer}.switch input::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}.switch input:checked{background:#3ea6ff}.switch input:checked::after{transform:translateX(16px)}
fieldset{border:0;margin:0;padding:12px 20px}legend{padding:0;float:left;width:100%;margin-bottom:12px}.colors{display:flex;gap:12px;clear:both}.color{width:28px;height:28px;flex:none;border:1px solid #ffffff40;border-radius:50%;cursor:pointer;padding:0;position:relative}.color[aria-pressed=true]{outline:2px solid #fff;outline-offset:3px}.color:hover{box-shadow:0 0 0 2px #ffffff60}.custom{background:conic-gradient(#ff7070,#ffd766,#72e7ad,#74adff,#bd8aff,#ff7070)}.custom span{display:flex;align-items:center;justify-content:center;font-size:18px}.custom input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
input:focus-visible,button:focus-visible,.custom:focus-within{outline:2px solid #fff;outline-offset:3px}input:disabled{opacity:.5;cursor:default}.reset{display:block;width:100%;padding:10px 20px;border:0;border-top:1px solid #ffffff1a;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}.reset:hover{background:#ffffff1a}.status{font-size:11px;font-weight:400;line-height:1.3;color:#aaa;margin:0 0 0 auto;text-align:right;max-width:45%}.status:empty{display:none}
`;

/** Advanced options share the saved settings, anchored inside the actual player. */
export class YouTubeAdvancedMenu {
  readonly host: HTMLDivElement;
  private root: ShadowRoot;
  private content: HTMLDivElement;
  private status: HTMLParagraphElement;
  private kind: YouTubeAdvancedControl | null = null;
  private anchor: HTMLButtonElement | null = null;
  private owner: HTMLElement | null = null;
  private settings: PlayerToolsSettings | null = null;
  private available = false;
  private disposed = false;
  private generation = 0;
  private cleanups: Array<() => void> = [];
  private renderValues: () => void = () => {};
  private editingSlider: HTMLInputElement | null = null;

  constructor(
    private video: HTMLVideoElement,
    private actions: {
      onPreview: (patch: Partial<YouTubeAdvancedPreferences>) => void;
      onSave: (patch: Partial<YouTubeAdvancedPreferences>) => Promise<void>;
      onOpenChange: () => void;
    }
  ) {
    const doc = video.ownerDocument;
    this.host = doc.createElement('div');
    this.host.className = 'mfs-youtube-advanced-popup';
    this.host.id = `mfs-youtube-advanced-${++menuId}`;
    this.host.hidden = true;
    this.host.style.cssText = 'position:absolute;z-index:65;';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = styles;
    this.content = doc.createElement('div');
    this.content.className = 'menu';
    this.content.setAttribute('role', 'dialog');
    this.status = doc.createElement('p');
    this.status.className = 'status';
    this.status.setAttribute('role', 'status');
    this.root.append(style, this.content);
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
        () => Boolean(this.kind),
        (path) =>
          path.includes(this.host) || path.includes(this.anchor as EventTarget),
        () => this.close()
      )
    );
    listen(
      doc,
      'keydown',
      (event) => {
        if (this.kind && (event as KeyboardEvent).key === 'Escape') {
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

  update(settings: PlayerToolsSettings, available: boolean): void {
    if (this.disposed) return;
    this.settings = settings;
    this.available = available;
    const owner = this.video.closest<HTMLElement>(
      '#movie_player, .html5-video-player'
    );
    const enabled =
      this.kind === 'boost'
        ? settings.youtubeBoostEnabled
        : this.kind === 'cinema'
          ? settings.youtubeCinemaEnabled
          : settings.youtubeScreenshotEnabled;
    if (
      !available ||
      !enabled ||
      !owner ||
      (this.owner && this.owner !== owner) ||
      (this.kind && !this.anchor?.isConnected)
    )
      this.close();
    this.owner = owner;
    if (this.kind) {
      this.renderValues();
      this.position();
    }
  }

  open(kind: YouTubeAdvancedControl, anchor: HTMLButtonElement): void {
    if (
      this.disposed ||
      !this.available ||
      !this.settings ||
      anchor.disabled ||
      !anchor.isConnected ||
      !this.owner
    )
      return;
    const nativeMenu =
      this.owner.querySelector<HTMLElement>('.ytp-settings-menu');
    if (
      nativeMenu &&
      nativeMenu.getBoundingClientRect().height > 0 &&
      this.video.ownerDocument.defaultView?.getComputedStyle(nativeMenu)
        .display !== 'none'
    )
      this.owner
        .querySelector<HTMLButtonElement>('.ytp-settings-button')
        ?.click();
    this.close();
    this.kind = kind;
    this.anchor = anchor;
    this.owner.append(this.host);
    anchor.setAttribute('aria-controls', this.host.id);
    anchor.setAttribute('aria-expanded', 'true');
    this.content.setAttribute(
      'aria-label',
      `${YOUTUBE_CONTROL_LABELS[kind]} options`
    );
    this.content.replaceChildren();
    this.status.textContent = '';
    const doc = this.video.ownerDocument;
    const header = doc.createElement('header');
    const title = doc.createElement('h2');
    title.textContent = YOUTUBE_CONTROL_LABELS[kind];
    header.append(createYouTubeControlIcon(doc, kind), title, this.status);
    this.content.append(header);
    const renders: Array<() => void> = [];
    const range = (
      label: string,
      key: 'youtubeBoost' | 'dimming',
      min: number,
      max: number,
      unit: string
    ) => {
      const field = doc.createElement('label');
      field.className = 'section';
      field.style.display = 'block';
      const caption = doc.createElement('span');
      caption.className = 'label';
      const value = doc.createElement('span');
      value.className = 'value';
      caption.append(label, value);
      const input = doc.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      input.setAttribute('aria-label', label);
      const render = (level: number) => {
        value.textContent = `${level}${unit}`;
        input.setAttribute('aria-valuetext', `${level}${unit}`);
        const progress = ((level - min) / (max - min)) * 100;
        input.style.setProperty(
          '--track',
          `linear-gradient(to right,#fff ${progress}%,#ffffff55 ${progress}%)`
        );
      };
      input.addEventListener('input', () => {
        this.editingSlider = input;
        render(input.valueAsNumber);
        this.status.textContent = '';
        this.actions.onPreview({ [key]: input.valueAsNumber });
      });
      input.addEventListener('change', () => {
        this.editingSlider = null;
        void this.save({ [key]: input.valueAsNumber });
      });
      field.append(caption, input);
      this.content.append(field);
      renders.push(() => {
        if (this.editingSlider === input) return;
        input.value = String(this.settings?.[key]);
        render(input.valueAsNumber);
      });
    };
    const toggle = (
      label: string,
      key: 'youtubeAutoBoost' | 'youtubeScreenshotIncludeFilters'
    ) => {
      const field = doc.createElement('label');
      field.className = 'switch';
      const input = doc.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('role', 'switch');
      input.setAttribute('aria-label', label);
      input.addEventListener('change', () => {
        void this.save({ [key]: input.checked });
      });
      field.append(label, input);
      this.content.append(field);
      renders.push(() => {
        input.checked = Boolean(this.settings?.[key]);
      });
    };
    if (kind === 'boost') {
      range('Volume boost', 'youtubeBoost', 2, 10, '×');
      toggle('Automatically boost new videos', 'youtubeAutoBoost');
    } else if (kind === 'cinema') {
      range('Page dimming', 'dimming', 0, 100, '%');
      const field = doc.createElement('fieldset');
      const legend = doc.createElement('legend');
      const selected = doc.createElement('span');
      let hoveredColor: string | null = null;
      selected.className = 'muted';
      legend.append('Color ', selected);
      const row = doc.createElement('div');
      row.className = 'colors';
      const colorLabel = () => {
        const preset = cinemaPresets.find(
          (p) => p.color === this.settings?.cinemaColor
        );
        return this.settings?.cinemaColorCustom || !preset
          ? `Custom: ${this.settings?.cinemaColor}`
          : preset.name;
      };
      for (const preset of cinemaPresets) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'color';
        button.style.background = preset.color;
        button.setAttribute('aria-label', `${preset.name} Cinema Mode preset`);
        button.addEventListener('click', () => {
          void this.save({
            cinemaColor: preset.color,
            cinemaColorCustom: false,
          });
        });
        button.addEventListener('mouseenter', () => {
          hoveredColor = preset.name;
          selected.textContent = `(${preset.name})`;
        });
        button.addEventListener('mouseleave', () => {
          hoveredColor = null;
          selected.textContent = `(${colorLabel()})`;
        });
        renders.push(() =>
          button.setAttribute(
            'aria-pressed',
            String(
              !this.settings?.cinemaColorCustom &&
                this.settings?.cinemaColor === preset.color
            )
          )
        );
        row.append(button);
      }
      const custom = doc.createElement('label');
      custom.className = 'color custom';
      const glyph = doc.createElement('span');
      glyph.textContent = '+';
      const picker = doc.createElement('input');
      picker.type = 'color';
      picker.setAttribute('aria-label', 'Custom Cinema Mode color');
      custom.addEventListener('mouseenter', () => {
        hoveredColor = `Custom: ${this.settings?.cinemaColor}`;
        selected.textContent = `(${hoveredColor})`;
      });
      custom.addEventListener('mouseleave', () => {
        hoveredColor = null;
        selected.textContent = `(${colorLabel()})`;
      });
      picker.addEventListener('click', () => {
        void this.save({ cinemaColorCustom: true });
      });
      picker.addEventListener('input', () => {
        void this.save({ cinemaColor: picker.value, cinemaColorCustom: true });
      });
      custom.append(glyph, picker);
      row.append(custom);
      field.append(legend, row);
      this.content.append(field);
      renders.push(() => {
        const isCustom =
          this.settings?.cinemaColorCustom ||
          !cinemaPresets.some((p) => p.color === this.settings?.cinemaColor);
        custom.setAttribute('aria-pressed', String(isCustom));
        custom.style.background = isCustom
          ? (this.settings?.cinemaColor ?? '')
          : '';
        picker.value = this.settings?.cinemaColor ?? '#000000';
        selected.textContent = `(${hoveredColor ?? colorLabel()})`;
      });
    } else toggle('Include video filters', 'youtubeScreenshotIncludeFilters');
    if (kind !== 'screenshot') {
      const reset = doc.createElement('button');
      reset.type = 'button';
      reset.className = 'reset';
      reset.textContent =
        kind === 'boost' ? 'Reset volume boost' : 'Reset page dimming';
      reset.addEventListener('click', () => {
        void this.save(
          kind === 'boost' ? { youtubeBoost: 2 } : { dimming: 80 }
        );
      });
      this.content.append(reset);
    }
    this.renderValues = () => {
      for (const render of renders) render();
    };
    this.renderValues();
    this.host.hidden = false;
    this.owner.classList.add('mfs-advanced-open');
    this.position();
    this.actions.onOpenChange();
    this.root
      .querySelector<HTMLInputElement>('input')
      ?.focus({ preventScroll: true });
  }

  private async save(
    patch: Partial<YouTubeAdvancedPreferences>
  ): Promise<void> {
    if (this.disposed || !this.kind || !this.available) return;
    const generation = this.generation;
    this.status.textContent = '';
    try {
      await this.actions.onSave(patch);
      if (!this.disposed && generation === this.generation)
        this.status.textContent = 'Saved.';
    } catch {
      if (!this.disposed && generation === this.generation) {
        this.status.textContent = 'Could not save preferences. Try again.';
        this.renderValues();
      }
    }
  }

  private position(): void {
    if (!this.owner || !this.anchor) return;
    const rect = this.owner.getBoundingClientRect();
    const width = this.owner.clientWidth || rect.width;
    const height = this.owner.clientHeight || rect.height;
    const menuWidth = Math.max(0, Math.min(300, width - 24));
    const anchor = this.anchor.getBoundingClientRect();
    const center = rect.width
      ? ((anchor.left + anchor.width / 2 - rect.left) * width) / rect.width
      : width / 2;
    const bottom =
      (this.owner.querySelector<HTMLElement>('.ytp-chrome-bottom')
        ?.offsetHeight || 48) + 12;
    this.host.style.width = `${menuWidth}px`;
    this.host.style.left = `${Math.max(12, Math.min(width - menuWidth - 12, center - menuWidth / 2))}px`;
    this.host.style.bottom = `${bottom}px`;
    this.host.style.maxHeight = `${Math.max(0, height - bottom - 12)}px`;
  }

  close(restoreFocus = false): void {
    if (!this.kind) return;
    this.kind = null;
    this.editingSlider = null;
    this.generation++;
    this.host.hidden = true;
    this.owner?.classList.remove('mfs-advanced-open');
    this.anchor?.setAttribute('aria-expanded', 'false');
    this.actions.onOpenChange();
    if (restoreFocus) this.anchor?.focus({ preventScroll: true });
  }

  cleanup(): void {
    this.close();
    this.disposed = true;
    for (const clean of this.cleanups) clean();
    this.host.remove();
  }
}

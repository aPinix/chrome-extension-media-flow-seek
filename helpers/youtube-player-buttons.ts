import {
  createYouTubeControlIcon,
  YOUTUBE_CONTROL_LABELS,
  type YouTubeControl,
} from './youtube-control-icons';

export interface YouTubePlayerButtonState {
  loop: {
    enabled: boolean;
    available: boolean;
    expanded: boolean;
    active: boolean;
    hasSections: boolean;
  };
  boost: { level: number; active: boolean; available: boolean };
  cinema: { enabled: boolean; active: boolean; available: boolean };
  infoCards: { enabled: boolean; visible: boolean; available: boolean };
}

const groupStyle =
  'position:relative;display:inline-flex;align-items:center;height:100%;vertical-align:top;';
const buttonStyle =
  'display:inline-flex;align-items:center;justify-content:center;width:40px;height:100%;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;';
const controlStyles = `
  .mfs-player-button.ytp-button::before,.mfs-player-button.ytp-button::after{display:none!important}
  .mfs-player-button.ytp-button,.mfs-player-button.ytp-button:hover,.mfs-player-button.ytp-button:focus-visible{background:transparent!important;box-shadow:none!important;border-radius:0!important}
  .mfs-player-button[aria-pressed=true] .mfs-loop-frame{fill:#fff;stroke:#fff}
  .mfs-player-button[aria-pressed=true] .mfs-loop-arrows{stroke:#222}
  .mfs-loop-icon{display:flex;align-items:center;justify-content:center;width:40px;height:32px;border-radius:9999px;transition:background-color 120ms ease}
  .mfs-player-button:hover .mfs-loop-icon,.mfs-player-button:focus-visible .mfs-loop-icon{background:rgba(255,255,255,.2)}
  .mfs-youtube-buttons[data-split=true]::before{content:"";position:absolute;left:0;right:0;top:50%;height:32px;transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.1);pointer-events:none}
  .mfs-youtube-buttons[data-split=true] .mfs-player-button:not(.mfs-loop-edit-button) .mfs-loop-icon{border-radius:999px 0 0 999px}
  .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button{width:32px!important}
  .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button .mfs-loop-icon{width:32px;border-radius:0 999px 999px 0;position:relative}
  .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button .mfs-loop-icon::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:1px;background:rgba(255,255,255,.25)}
  .mfs-loop-tooltip{position:absolute;bottom:calc(100% + 24px);left:50%;transform:translateX(-50%);padding:5px 8px;border-radius:10px;background:rgba(0,0,0,.3);color:#fff;font:13px/18px Arial,sans-serif;text-shadow:0 0 2px #000;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity 100ms ease}
  .mfs-player-button:hover + .mfs-loop-tooltip,.mfs-player-button:focus-visible + .mfs-loop-tooltip{opacity:1;visibility:visible}
`;

/** Owns all extension controls inserted into YouTube's native right toolbar. */
export class YouTubePlayerButtons {
  readonly toolbar: HTMLSpanElement;
  readonly container: HTMLSpanElement;
  readonly loopButton: HTMLButtonElement;
  readonly editButton: HTMLButtonElement;
  readonly boostButton: HTMLButtonElement;
  readonly cinemaButton: HTMLButtonElement;
  readonly infoCardsButton: HTMLButtonElement;
  private boostContainer: HTMLSpanElement;
  private cinemaContainer: HTMLSpanElement;
  private infoCardsContainer: HTMLSpanElement;
  private tips = new Map<HTMLButtonElement, HTMLSpanElement>();
  private disposed = false;

  constructor(
    private video: HTMLVideoElement,
    actions: {
      onLoop: () => void;
      onEdit: () => void;
      onBoost: () => void;
      onCinema: () => void;
      onInfoCards: () => void;
    }
  ) {
    const doc = video.ownerDocument;
    this.toolbar = doc.createElement('span');
    this.toolbar.className = 'mfs-youtube-controls';
    this.toolbar.setAttribute('role', 'group');
    this.toolbar.setAttribute('aria-label', 'Better Video Controls');
    this.toolbar.style.cssText = groupStyle;
    const style = doc.createElement('style');
    style.textContent = controlStyles;
    this.toolbar.append(style);
    this.boostContainer = this.group('mfs-youtube-boost');
    this.cinemaContainer = this.group('mfs-youtube-cinema');
    this.container = this.group('mfs-youtube-buttons');
    this.infoCardsContainer = this.group('mfs-youtube-info-cards');
    this.boostButton = this.control(
      'boost',
      this.boostContainer,
      actions.onBoost
    );
    this.cinemaButton = this.control(
      'cinema',
      this.cinemaContainer,
      actions.onCinema
    );
    this.loopButton = this.control('loop', this.container, actions.onLoop);
    this.editButton = this.control('edit', this.container, actions.onEdit);
    this.editButton.classList.add('mfs-loop-edit-button');
    this.infoCardsButton = this.control(
      'infoCards',
      this.infoCardsContainer,
      actions.onInfoCards
    );
    for (const type of ['pointerdown', 'mousedown', 'dblclick'])
      this.toolbar.addEventListener(type, (event) => event.stopPropagation());
  }

  private group(className: string) {
    const group = this.video.ownerDocument.createElement('span');
    group.className = className;
    group.style.cssText = groupStyle;
    return group;
  }

  private control(
    kind: YouTubeControl | 'edit',
    group: HTMLSpanElement,
    action: () => void
  ) {
    const doc = this.video.ownerDocument;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `ytp-button mfs-player-button mfs-${kind === 'infoCards' ? 'info-cards' : kind}-button`;
    button.setAttribute(
      'aria-label',
      kind === 'edit' ? 'Edit loop sections' : YOUTUBE_CONTROL_LABELS[kind]
    );
    button.style.cssText = buttonStyle;
    const icon = doc.createElement('span');
    icon.className = 'mfs-loop-icon';
    icon.append(createYouTubeControlIcon(doc, kind));
    button.append(icon);
    const tip = doc.createElement('span');
    tip.className = 'mfs-loop-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = button.getAttribute('aria-label');
    this.tips.set(button, tip);
    group.append(button, tip);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.disposed && !button.disabled) action();
    });
    const syncTooltip = () => {
      const player = this.video.closest('#movie_player, .html5-video-player');
      const win = doc.defaultView;
      const nativeWrapper = player?.querySelector<HTMLElement>(
        '.ytp-tooltip-text-wrapper'
      );
      const nativeText =
        player?.querySelector<HTMLElement>('.ytp-tooltip-text');
      if (win && nativeWrapper && nativeText) {
        const wrapperStyle = win.getComputedStyle(nativeWrapper);
        const textStyle = win.getComputedStyle(nativeText);
        tip.style.boxShadow = wrapperStyle.boxShadow;
        for (const property of [
          'font-family',
          'font-size',
          'font-weight',
          'line-height',
          'color',
          'text-shadow',
        ])
          tip.style.setProperty(property, textStyle.getPropertyValue(property));
      }
      const groupRect = group.getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      tip.style.left = `${rect.left - groupRect.left + rect.width / 2}px`;
      const native = player?.querySelector<HTMLElement>('.ytp-tooltip');
      const nativeTop = native && Number.parseFloat(native.style.top);
      const playerRect = player?.getBoundingClientRect();
      if (playerRect && nativeTop && nativeTop > 0) {
        tip.style.bottom = 'auto';
        tip.style.top = `${playerRect.top + nativeTop - groupRect.top}px`;
      } else {
        tip.style.top = 'auto';
        tip.style.bottom = 'calc(100% + 24px)';
      }
    };
    button.addEventListener('pointerenter', syncTooltip);
    button.addEventListener('focus', syncTooltip);
    return button;
  }

  private state(
    button: HTMLButtonElement,
    active: boolean,
    available: boolean,
    tooltip: string
  ) {
    button.disabled = !available;
    button.setAttribute('aria-pressed', String(active));
    button.style.opacity = !available ? '.3' : active ? '1' : '.5';
    button.style.transition = 'opacity 180ms ease';
    const tip = this.tips.get(button);
    if (tip) tip.textContent = tooltip;
  }

  update({ loop, boost, cinema, infoCards }: YouTubePlayerButtonState): void {
    if (this.disposed) return;
    const player = this.video.closest('#movie_player, .html5-video-player');
    const mainVideo =
      player?.querySelector('video.html5-main-video') ??
      player?.querySelector('video');
    const controls = player?.querySelector('.ytp-right-controls');
    const groups = [
      [this.boostContainer, boost.level > 0],
      [this.cinemaContainer, cinema.enabled],
      [this.container, loop.enabled],
      [this.infoCardsContainer, infoCards.enabled],
    ] as const;
    if (
      !controls ||
      mainVideo !== this.video ||
      !groups.some(([, enabled]) => enabled)
    ) {
      this.toolbar.remove();
      return;
    }
    // Move only when order changes so focus and native hover state survive updates.
    let previous: Element = this.toolbar.firstElementChild as Element;
    for (const [group, enabled] of groups) {
      if (!enabled) {
        group.remove();
        continue;
      }
      if (previous.nextElementSibling !== group) previous.after(group);
      previous = group;
    }
    let anchor = controls.querySelector(
      '.ytp-autonav-toggle, .ytp-autonav-toggle-button, .ytp-subtitles-button'
    );
    while (anchor && anchor.parentElement !== controls)
      anchor = anchor.parentElement;
    anchor ??=
      [...controls.children].find((node) => node !== this.toolbar) ?? null;
    if (
      this.toolbar.parentElement !== controls ||
      this.toolbar.nextElementSibling !== anchor
    )
      controls.insertBefore(this.toolbar, anchor);
    this.state(
      this.boostButton,
      boost.active,
      boost.available,
      boost.available
        ? `Boost Volume · ${boost.level}×`
        : 'Boost Volume unavailable for this video'
    );
    this.state(
      this.cinemaButton,
      cinema.active,
      cinema.available,
      cinema.available
        ? `${cinema.active ? 'Turn off' : 'Turn on'} Cinema Mode`
        : 'Cinema Mode unavailable for this video'
    );
    this.state(
      this.infoCardsButton,
      infoCards.visible,
      infoCards.available,
      infoCards.available
        ? `${infoCards.visible ? 'Hide' : 'Show'} Info Cards`
        : 'Info Cards unavailable during ads'
    );
    this.state(
      this.loopButton,
      loop.active,
      loop.available,
      loop.available
        ? 'Loop Sections'
        : 'Loop Sections unavailable during ads or live streams'
    );
    this.loopButton.style.opacity = loop.available ? '1' : '.4';
    this.container.dataset.split = String(loop.hasSections);
    this.editButton.hidden = !loop.hasSections;
    this.editButton.style.display = loop.hasSections ? 'inline-flex' : 'none';
    this.editButton.disabled = !loop.available;
    this.editButton.setAttribute('aria-expanded', String(loop.expanded));
  }

  cleanup(): void {
    this.disposed = true;
    this.toolbar.remove();
  }
}

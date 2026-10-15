import {
  createYouTubeControlIcon,
  YOUTUBE_CONTROL_LABELS,
  YOUTUBE_CONTROL_SHORTCUTS,
  type YouTubeAdvancedControl,
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
  screenshot: { enabled: boolean; available: boolean };
  filters: { enabled: boolean; available: boolean; expanded: boolean };
  pip: { enabled: boolean; available: boolean };
  bookmarks: { enabled: boolean; available: boolean; expanded: boolean };
}

const groupStyle =
  'position:relative;display:inline-flex;align-items:center;height:100%;vertical-align:top;flex-shrink:0;';
const buttonStyle =
  'position:relative;align-items:center;justify-content:center;width:48px;height:100%;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;';
const controlStyles = `
  .mfs-youtube-controls[data-stacked=true]{position:absolute!important;height:auto!important;flex-wrap:wrap;justify-content:flex-end;box-sizing:border-box;padding:4px;border-radius:20px;background:rgba(0,0,0,.45);backdrop-filter:blur(16px);white-space:normal;z-index:1}
  .mfs-youtube-controls[data-stacked=true] > span,.mfs-youtube-controls[data-stacked=true] .mfs-player-button{height:32px!important;flex-shrink:0}
  .mfs-player-button.ytp-button::after{display:none!important}
  .mfs-player-button.ytp-button{display:inline-flex}
  .mfs-player-button.ytp-button,.mfs-player-button.ytp-button:hover,.mfs-player-button.ytp-button:focus-visible{background:transparent!important;box-shadow:none!important;border-radius:0!important}
  .mfs-player-button[aria-pressed=true] .mfs-loop-frame{fill:#fff;stroke:#fff}
  .mfs-player-button[aria-pressed=true] .mfs-loop-arrows{stroke:#222}
  .mfs-player-button[aria-pressed=true] .mfs-toggle-fill{fill:currentColor}
  .mfs-player-button[aria-pressed=true] .mfs-toggle-detail{stroke:#222;fill:#222}
  .mfs-info-cards-button[aria-pressed=true] .mfs-toggle-fill{fill:none}
  .mfs-info-cards-button[aria-pressed=true] .mfs-toggle-detail{stroke:currentColor;fill:currentColor}
  .mfs-loop-icon{display:flex;align-items:center;justify-content:center;width:100%;height:100%;position:relative;pointer-events:none}
  .html5-video-player:not(.ytp-delhi-modern) .mfs-player-button::before{content:"";display:block;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100%;height:32px;border-radius:40px;pointer-events:none}
  .html5-video-player:not(.ytp-delhi-modern) .mfs-player-button:hover::before{background:rgba(255,255,255,.1)}
  .mfs-player-button:focus-visible{outline:none}
  .mfs-player-button:focus-visible::before{outline:2px solid #fff;outline-offset:-1px;background:var(--yt-sys-color-baseline--overlay-button-secondary,rgba(255,255,255,.1))}
  .mfs-youtube-buttons[data-split=true]::before{content:"";position:absolute;left:0;right:0;top:50%;height:32px;transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.1);pointer-events:none}
  .mfs-loop-tooltip{position:absolute;z-index:1003;bottom:calc(100% + 12px);left:50%;transform:translateX(-50%);display:flex;align-items:center;padding:5px 9px;border-radius:8px;backdrop-filter:var(--yt-frosted-glass-backdrop-filter-override,blur(16px));background:var(--yt-sys-color-baseline--overlay-background-medium-light,rgba(0,0,0,.3));color:#fff;font-size:118%;font-weight:500;line-height:15px;text-shadow:0 0 2px #000;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity 100ms ease}
  .mfs-loop-tooltip .ytp-tooltip-keyboard-shortcut{display:flex;justify-content:center;align-items:center;border:1px solid rgba(255,255,255,.3);min-width:11px;border-radius:4px;margin-left:4px;color:#fff;padding:0 2px;font:inherit}
  .mfs-loop-tooltip[data-advanced=true]{flex-direction:column;gap:4px;padding:7px 9px}
  .mfs-tooltip-heading{display:flex;align-items:center}
  .mfs-tooltip-hint{font-size:85%;font-weight:400;line-height:1.25;color:rgba(255,255,255,.65)}
  .mfs-loop-tooltip[hidden]{display:none!important}
  .mfs-player-button:hover + .mfs-loop-tooltip,.mfs-player-button:focus-visible + .mfs-loop-tooltip{opacity:1;visibility:visible}
  .mfs-player-button[aria-expanded=true] + .mfs-loop-tooltip{opacity:0;visibility:hidden}
  .mfs-screenshot-status{bottom:calc(100% + 24px);left:auto;right:0;transform:none;opacity:1;visibility:visible;max-width:260px;white-space:normal}
  .mfs-bookmark-status{width:max-content;font-size:12px}
  .mfs-filters-open,.mfs-advanced-open{cursor:auto!important}.mfs-filters-open .ytp-chrome-bottom,.mfs-advanced-open .ytp-chrome-bottom{opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important}
`;

/** Owns all extension controls inserted into YouTube's native right toolbar. */
export class YouTubePlayerButtons {
  readonly toolbar: HTMLSpanElement;
  readonly container: HTMLSpanElement;
  readonly loopButton: HTMLButtonElement;
  readonly boostButton: HTMLButtonElement;
  readonly cinemaButton: HTMLButtonElement;
  readonly infoCardsButton: HTMLButtonElement;
  readonly screenshotButton: HTMLButtonElement;
  readonly filtersButton: HTMLButtonElement;
  readonly pipButton: HTMLButtonElement;
  readonly bookmarksButton: HTMLButtonElement;
  private boostContainer: HTMLSpanElement;
  private cinemaContainer: HTMLSpanElement;
  private infoCardsContainer: HTMLSpanElement;
  private screenshotContainer: HTMLSpanElement;
  private filtersContainer: HTMLSpanElement;
  private pipContainer: HTMLSpanElement;
  private bookmarksContainer: HTMLSpanElement;
  private bookmarkStatus: HTMLSpanElement;
  private bookmarkStatusTimer: ReturnType<typeof setTimeout> | undefined;
  private screenshotStatus: HTMLSpanElement;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  private tips = new Map<HTMLButtonElement, HTMLSpanElement>();
  private disposed = false;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private cleanups: Array<() => void> = [];
  private resizeObserver: ResizeObserver | undefined;
  private controlsObserver: MutationObserver | undefined;
  private observedControls: HTMLElement | undefined;

  constructor(
    private video: HTMLVideoElement,
    actions: {
      onLoop: () => void;
      onEdit: () => void;
      onBoost: () => void;
      onCinema: () => void;
      onInfoCards: () => void;
      onScreenshot: () => void;
      onFilters: () => void;
      onPip: () => void;
      onBookmarks: () => void;
      onEditBookmarks: () => void;
      onAdvanced?: (kind: YouTubeAdvancedControl) => void;
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
    this.bookmarksContainer = this.group('mfs-youtube-bookmarks');
    this.infoCardsContainer = this.group('mfs-youtube-info-cards');
    this.screenshotContainer = this.group('mfs-youtube-screenshot');
    this.filtersContainer = this.group('mfs-youtube-filters');
    this.pipContainer = this.group('mfs-youtube-pip');
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
    this.bookmarksButton = this.control(
      'bookmarks',
      this.bookmarksContainer,
      actions.onBookmarks
    );
    this.bookmarkStatus = doc.createElement('span');
    this.bookmarkStatus.className =
      'mfs-loop-tooltip mfs-screenshot-status mfs-bookmark-status';
    this.bookmarkStatus.setAttribute('role', 'status');
    this.bookmarkStatus.hidden = true;
    this.bookmarksContainer.append(this.bookmarkStatus);
    this.infoCardsButton = this.control(
      'infoCards',
      this.infoCardsContainer,
      actions.onInfoCards
    );
    this.screenshotButton = this.control(
      'screenshot',
      this.screenshotContainer,
      actions.onScreenshot
    );
    this.screenshotStatus = doc.createElement('span');
    this.screenshotStatus.className = 'mfs-loop-tooltip mfs-screenshot-status';
    this.screenshotStatus.setAttribute('role', 'status');
    this.screenshotStatus.hidden = true;
    this.screenshotContainer.append(this.screenshotStatus);
    this.filtersButton = this.control(
      'filters',
      this.filtersContainer,
      actions.onFilters
    );
    this.filtersButton.setAttribute('aria-haspopup', 'dialog');
    this.pipButton = this.control('pip', this.pipContainer, actions.onPip);
    for (const [kind, button] of [
      ['boost', this.boostButton],
      ['cinema', this.cinemaButton],
      ['loop', this.loopButton],
      ['screenshot', this.screenshotButton],
      ['bookmarks', this.bookmarksButton],
    ] as const) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      let held = false;
      let origin: { x: number; y: number } | null = null;
      const cancel = () => {
        clearTimeout(this.holdTimer);
        origin = null;
      };
      button.addEventListener('pointerdown', (event) => {
        cancel();
        held = false;
        if (event.button !== 0 || button.disabled || this.disposed) return;
        origin = { x: event.clientX, y: event.clientY };
        this.holdTimer = setTimeout(() => {
          if (!this.disposed && !button.disabled && button.isConnected) {
            held = true;
            if (kind === 'bookmarks') actions.onEditBookmarks();
            else if (kind === 'loop') actions.onEdit();
            else actions.onAdvanced?.(kind);
          }
        }, 600);
      });
      button.addEventListener('pointermove', (event) => {
        if (
          origin &&
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10
        )
          cancel();
      });
      button.addEventListener('pointerleave', cancel);
      // Opening an editor can reposition the toolbar underneath the pointer.
      // Consume the rest of that hold even if its release now targets the video.
      const finishHoldClick = (event: Event) => {
        if (!held) return;
        held = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      doc.addEventListener('click', finishHoldClick, true);
      this.cleanups.push(() =>
        doc.removeEventListener('click', finishHoldClick, true)
      );
      // Shift+Enter also makes advanced options reachable when tabbing through controls.
      button.addEventListener('keydown', (event) => {
        if (
          !this.disposed &&
          event.shiftKey &&
          event.key === 'Enter' &&
          !event.repeat &&
          !button.disabled
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (kind === 'bookmarks') actions.onEditBookmarks();
          else if (kind === 'loop') actions.onEdit();
          else actions.onAdvanced?.(kind);
        }
      });
      const finishHold = (event: Event) => {
        cancel();
        if (event.type === 'pointercancel') held = false;
        if (!held) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      for (const type of ['pointerup', 'pointercancel', 'mouseup']) {
        doc.addEventListener(type, finishHold, true);
        this.cleanups.push(() =>
          doc.removeEventListener(type, finishHold, true)
        );
      }
    }
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
    if (kind !== 'edit') {
      const key = YOUTUBE_CONTROL_SHORTCUTS[kind].toUpperCase();
      const advanced = [
        'boost',
        'cinema',
        'loop',
        'screenshot',
        'bookmarks',
      ].includes(kind);
      button.setAttribute(
        'aria-keyshortcuts',
        advanced ? `${key} Shift+${key} Shift+Enter` : key
      );
      button.dataset.shortcut = YOUTUBE_CONTROL_SHORTCUTS[kind];
      if (advanced) button.dataset.advanced = 'true';
      if (kind === 'bookmarks')
        button.dataset.advancedHint = 'Hold to edit bookmarks';
      if (kind === 'loop')
        button.dataset.advancedHint = 'Hold to edit loop sections';
      if (advanced)
        button.setAttribute(
          'aria-description',
          `Hold for options, or press Shift+${key}.`
        );
    }
    const icon = doc.createElement('span');
    icon.className = 'mfs-loop-icon';
    icon.append(createYouTubeControlIcon(doc, kind));
    button.append(icon);
    const tip = doc.createElement('span');
    tip.className = 'mfs-loop-tooltip';
    tip.setAttribute('role', 'tooltip');
    this.tips.set(button, tip);
    this.tooltip(button, button.getAttribute('aria-label') ?? '');
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
      // Use the button's local layout coordinates; native tooltip positions can
      // be stale, and viewport coordinates would apply player scaling twice.
      tip.style.left = `${button.offsetLeft + button.offsetWidth / 2}px`;
      tip.style.bottom = `calc(100% + ${12 - button.offsetTop}px)`;
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
    button.style.opacity = !available ? '.3' : '1';
    button.style.transition = 'opacity 180ms ease';
    const tip = this.tips.get(button);
    if (tip) this.tooltip(button, tooltip);
  }

  private watchLayout(controls: HTMLElement): void {
    if (this.observedControls === controls) return;
    this.resizeObserver?.disconnect();
    this.controlsObserver?.disconnect();
    this.observedControls = controls;
    const win = this.video.ownerDocument.defaultView;
    if (win?.ResizeObserver) {
      this.resizeObserver = new win.ResizeObserver(() => this.layout());
      const chrome = controls.closest<HTMLElement>('.ytp-chrome-bottom');
      const left = chrome?.querySelector<HTMLElement>('.ytp-left-controls');
      for (const element of [controls, chrome, left, ...controls.children]) {
        if (element) this.resizeObserver.observe(element);
      }
    }
    if (win?.MutationObserver) {
      this.controlsObserver = new win.MutationObserver((records) => {
        if (records.some(({ target }) => !this.toolbar.contains(target)))
          this.layout();
      });
      const chrome = controls.closest('.ytp-chrome-bottom') ?? controls;
      this.controlsObserver.observe(chrome, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden'],
      });
    }
  }

  private layout(): void {
    const controls = this.observedControls;
    if (this.disposed || !controls || this.toolbar.parentElement !== controls)
      return;
    const chrome = controls.closest<HTMLElement>('.ytp-chrome-bottom');
    if (!chrome || chrome.clientWidth <= 0) return;
    const win = this.video.ownerDocument.defaultView;
    if (!win) return;
    const chromeRect = chrome.getBoundingClientRect();
    const scale = chromeRect.width / chrome.clientWidth || 1;
    const horizontalSpacing = (style: CSSStyleDeclaration): number =>
      (Number.parseFloat(style.paddingLeft) || 0) +
      (Number.parseFloat(style.paddingRight) || 0);
    const children = (element: HTMLElement): HTMLElement[] =>
      [...element.children].filter(
        (child): child is HTMLElement => child instanceof win.HTMLElement
      );
    const width = (element: HTMLElement): number => {
      const style = win.getComputedStyle(element);
      if (element.hidden || style.display === 'none') return 0;
      const renderedWidth = element.getBoundingClientRect().width / scale;
      return (
        (renderedWidth ||
          element.offsetWidth ||
          Number.parseFloat(style.width) ||
          0) +
        (Number.parseFloat(style.marginLeft) || 0) +
        (Number.parseFloat(style.marginRight) || 0)
      );
    };
    const contentWidth = (element: HTMLElement): number => {
      const style = win.getComputedStyle(element);
      if (element.hidden || style.display === 'none') return 0;
      const visible = children(element).filter(
        (child) =>
          !child.hidden && win.getComputedStyle(child).display !== 'none'
      );
      if (!style.display.includes('flex') || !visible.length)
        return width(element);
      return (
        visible.reduce((total, child) => total + contentWidth(child), 0) +
        (Number.parseFloat(style.columnGap) || 0) * (visible.length - 1) +
        horizontalSpacing(style) +
        (Number.parseFloat(style.marginLeft) || 0) +
        (Number.parseFloat(style.marginRight) || 0)
      );
    };
    const left = chrome.querySelector<HTMLElement>('.ytp-left-controls');
    const native = [...controls.children].filter(
      (element): element is HTMLElement =>
        element instanceof win.HTMLElement && element !== this.toolbar
    );
    const nativeWidth = native.reduce(
      (total, element) =>
        total + Math.max(width(element), contentWidth(element)),
      0
    );
    const customWidth = [...this.tips.keys()]
      .filter((button) => this.toolbar.contains(button))
      .reduce((total, button) => total + width(button), 0);
    const controlsStyle = win.getComputedStyle(controls);
    const chromeStyle = win.getComputedStyle(chrome);
    const gap = Number.parseFloat(controlsStyle.columnGap) || 0;
    const leftStyle = left && win.getComputedStyle(left);
    // Modern YouTube stretches/shrinks the left container to fill the remaining
    // space. Measure its controls, not that allocated width. Chapter titles are
    // intentionally allowed to truncate before moving our buttons to a new row.
    const leftChildren =
      left &&
      children(left).filter(
        (child) =>
          !child.classList.contains('ytp-chapter-container') &&
          !child.hidden &&
          win.getComputedStyle(child).display !== 'none'
      );
    const leftWidth =
      left &&
      leftStyle &&
      leftChildren?.length &&
      leftStyle.display.includes('flex')
        ? leftChildren.reduce(
            (total, child) =>
              total + Math.max(width(child), contentWidth(child)),
            0
          ) +
          horizontalSpacing(leftStyle) +
          (Number.parseFloat(leftStyle.columnGap) || 0) *
            (leftChildren.length - 1) +
          (Number.parseFloat(leftStyle.marginLeft) || 0) +
          (Number.parseFloat(leftStyle.marginRight) || 0)
        : left
          ? width(left)
          : 0;
    // Keep the original inline layout up to its actual fit boundary. An extra
    // safety margin would move the buttons above the native row prematurely.
    const stacked =
      customWidth +
        nativeWidth +
        leftWidth +
        gap * native.length +
        horizontalSpacing(controlsStyle) >
      chrome.clientWidth - horizontalSpacing(chromeStyle);
    this.toolbar.dataset.stacked = String(stacked);
    if (!stacked) {
      this.toolbar.style.removeProperty('bottom');
      this.toolbar.style.removeProperty('right');
      this.toolbar.style.removeProperty('max-width');
      this.toolbar.style.removeProperty('width');
      return;
    }
    // Position above the whole native chrome, including the progress bar.
    // Convert viewport coordinates back to player-local units for scaled players.
    const parent = (this.toolbar.offsetParent as HTMLElement | null) ?? chrome;
    const parentRect = parent.getBoundingClientRect();
    this.toolbar.style.bottom = `${Math.max(0, (parentRect.bottom - chromeRect.top) / scale) + 8}px`;
    this.toolbar.style.right = `${Math.max(0, (parentRect.right - chromeRect.right) / scale)}px`;
    this.toolbar.style.maxWidth = `${chrome.clientWidth}px`;
    this.toolbar.style.width = `${Math.min(customWidth + 8, chrome.clientWidth)}px`;
  }

  private tooltip(button: HTMLButtonElement, label: string): void {
    const tip = this.tips.get(button);
    if (!tip) return;
    let text = tip.querySelector('.mfs-tooltip-label');
    if (!text) {
      const heading = this.video.ownerDocument.createElement('span');
      heading.className = 'mfs-tooltip-heading';
      text = this.video.ownerDocument.createElement('span');
      text.className = 'mfs-tooltip-label';
      heading.append(text);
      tip.append(heading);
      if (button.dataset.shortcut) {
        const key = this.video.ownerDocument.createElement('span');
        key.className = 'ytp-tooltip-keyboard-shortcut';
        key.textContent = button.dataset.shortcut.toUpperCase();
        heading.append(key);
      }
      if (button.dataset.advanced === 'true') {
        tip.dataset.advanced = 'true';
        const hint = this.video.ownerDocument.createElement('span');
        hint.className = 'mfs-tooltip-hint';
        hint.textContent = button.dataset.advancedHint ?? 'Hold for options';
        tip.append(hint);
      }
    }
    text.textContent = label;
  }

  update({
    loop,
    boost,
    cinema,
    infoCards,
    screenshot,
    filters,
    pip,
    bookmarks,
  }: YouTubePlayerButtonState): void {
    if (this.disposed) return;
    const player = this.video.closest('#movie_player, .html5-video-player');
    const mainVideo =
      player?.querySelector('video.html5-main-video') ??
      player?.querySelector('video');
    const controls = player?.querySelector<HTMLElement>('.ytp-right-controls');
    const groups = [
      [this.boostContainer, boost.level > 0],
      [this.cinemaContainer, cinema.enabled],
      [this.container, loop.enabled],
      [this.bookmarksContainer, bookmarks.enabled],
      [this.infoCardsContainer, infoCards.enabled],
      [this.screenshotContainer, screenshot.enabled],
      [this.filtersContainer, filters.enabled],
      [this.pipContainer, pip.enabled],
    ] as const;
    if (
      !controls ||
      mainVideo !== this.video ||
      !groups.some(([, enabled]) => enabled)
    ) {
      this.toolbar.remove();
      this.resizeObserver?.disconnect();
      this.controlsObserver?.disconnect();
      this.observedControls = undefined;
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
    const native = controls.querySelector<HTMLButtonElement>(
      '.ytp-settings-button, .ytp-subtitles-button'
    );
    if (native) {
      const nativeStyle =
        this.video.ownerDocument.defaultView?.getComputedStyle(native);
      if (nativeStyle && Number.parseFloat(nativeStyle.width) > 0) {
        for (const button of this.tips.keys()) {
          button.style.width = nativeStyle.width;
          button.style.height = nativeStyle.height;
        }
      }
    }
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
    this.screenshotButton.disabled = !screenshot.available;
    this.screenshotButton.style.opacity = screenshot.available ? '1' : '.3';
    this.filtersButton.disabled = !filters.available;
    this.filtersButton.setAttribute('aria-expanded', String(filters.expanded));
    this.filtersButton.style.opacity = filters.available ? '1' : '.3';
    this.pipButton.disabled = !pip.available;
    this.bookmarksButton.disabled = !bookmarks.available;
    this.bookmarksButton.style.opacity = bookmarks.available ? '1' : '.3';
    this.bookmarksButton.setAttribute(
      'aria-expanded',
      String(bookmarks.expanded)
    );
    if (bookmarks.expanded) this.bookmarkStatus.hidden = true;
    this.tooltip(
      this.bookmarksButton,
      bookmarks.available
        ? 'Bookmark this moment'
        : 'Bookmarks unavailable during ads or live streams'
    );
    this.pipButton.style.opacity = pip.available ? '1' : '.3';
    this.tooltip(
      this.pipButton,
      pip.available
        ? 'Open Picture-in-Picture'
        : 'Picture-in-Picture unavailable for this video'
    );
    const screenshotTip = this.tips.get(this.screenshotButton);
    if (screenshotTip)
      this.tooltip(
        this.screenshotButton,
        screenshot.available
          ? 'Save video frame as PNG'
          : 'Screenshot unavailable for this video'
      );
    const filtersTip = this.tips.get(this.filtersButton);
    if (filtersTip) this.tooltip(this.filtersButton, 'Video Filters');
    this.loopButton.style.opacity = loop.available ? '1' : '.4';
    this.loopButton.setAttribute('aria-expanded', String(loop.expanded));
    this.watchLayout(controls);
    this.layout();
  }

  reportScreenshot(message: string): void {
    if (this.disposed) return;
    clearTimeout(this.statusTimer);
    this.screenshotStatus.textContent = message;
    this.screenshotStatus.hidden = false;
    this.statusTimer = setTimeout(() => {
      this.screenshotStatus.hidden = true;
    }, 5000);
  }

  reportBookmark(message: string): void {
    if (this.disposed) return;
    clearTimeout(this.bookmarkStatusTimer);
    this.bookmarkStatus.textContent = message;
    this.bookmarkStatus.hidden = false;
    this.bookmarkStatusTimer = setTimeout(() => {
      this.bookmarkStatus.hidden = true;
    }, 3000);
  }

  cleanup(): void {
    this.disposed = true;
    clearTimeout(this.statusTimer);
    clearTimeout(this.bookmarkStatusTimer);
    clearTimeout(this.holdTimer);
    for (const cleanup of this.cleanups) cleanup();
    this.resizeObserver?.disconnect();
    this.controlsObserver?.disconnect();
    this.toolbar.remove();
  }
}

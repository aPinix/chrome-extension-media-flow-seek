/** Shared home for extension buttons in YouTube's native right-hand controls. */
export class YouTubePlayerButtons {
  readonly container: HTMLSpanElement;
  readonly loopButton: HTMLButtonElement;
  readonly editButton: HTMLButtonElement;
  readonly boostButton: HTMLButtonElement;
  private boostContainer: HTMLSpanElement;
  constructor(
    private video: HTMLVideoElement,
    onLoop: () => void,
    onEdit: () => void,
    onBoost: () => void = () => {}
  ) {
    const doc = video.ownerDocument;
    this.container = doc.createElement('span');
    this.container.className = 'mfs-youtube-buttons';
    this.container.setAttribute('role', 'group');
    this.container.setAttribute('aria-label', 'Better Video Controls');
    this.container.style.cssText =
      'position:relative;display:inline-flex;align-items:center;height:100%;vertical-align:top;';
    this.loopButton = doc.createElement('button');
    this.loopButton.className = 'ytp-button mfs-loop-button';
    this.loopButton.type = 'button';
    this.loopButton.setAttribute('aria-label', 'Loop Sections');
    
    this.loopButton.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;width:40px;height:100%;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;';
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 20');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '20');
    svg.style.cssText = 'width:24px!important;height:20px!important;min-width:24px!important;max-width:none!important;flex:none!important;transform:none!important;';
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute(
      'd',
      'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3'
    );
    const frame = doc.createElementNS(svg.namespaceURI, 'rect');
    frame.setAttribute('x', '1'); frame.setAttribute('y', '1');
    frame.setAttribute('width', '22'); frame.setAttribute('height', '18');
    frame.setAttribute('rx', '3');
    frame.setAttribute('stroke-width', '2');
    frame.setAttribute('class', 'mfs-loop-frame');
    path.setAttribute('transform', 'translate(4.5 2.5) scale(.625)');
    path.setAttribute('class', 'mfs-loop-arrows');
    svg.append(frame, path);
    const icon = doc.createElement('span');
    icon.className = 'mfs-loop-icon';
    icon.append(svg);
    const tooltip = doc.createElement('span');
    tooltip.className = 'mfs-loop-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = 'Loop Sections';
    const style = doc.createElement('style');
    style.textContent = `
      .mfs-loop-button.ytp-button::before,.mfs-loop-button.ytp-button::after{display:none!important}
      .mfs-loop-button.ytp-button,.mfs-loop-button.ytp-button:hover,.mfs-loop-button.ytp-button:focus-visible{background:transparent!important;box-shadow:none!important;border-radius:0!important}
      .mfs-loop-button[aria-pressed=true] .mfs-loop-frame{fill:#fff;stroke:#fff}
      .mfs-loop-button[aria-pressed=true] .mfs-loop-arrows{stroke:#222}
      .mfs-loop-icon{display:flex;align-items:center;justify-content:center;width:40px;height:32px;border-radius:9999px;transition:background-color 120ms ease}
      .mfs-loop-button:hover .mfs-loop-icon,.mfs-loop-button:focus-visible .mfs-loop-icon{background:rgba(255,255,255,.2)}
      .mfs-youtube-buttons[data-split=true]::before{content:"";position:absolute;left:0;right:0;top:50%;height:32px;transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.1);pointer-events:none}
      .mfs-youtube-buttons[data-split=true] .mfs-loop-button:not(.mfs-loop-edit-button) .mfs-loop-icon{border-radius:999px 0 0 999px}
      .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button{width:32px!important}
      .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button .mfs-loop-icon{width:32px;border-radius:0 999px 999px 0;position:relative}
      .mfs-youtube-buttons[data-split=true] .mfs-loop-edit-button .mfs-loop-icon::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:1px;background:rgba(255,255,255,.25)}
      .mfs-loop-tooltip{position:absolute;bottom:calc(100% + 12px);left:50%;transform:translateX(-50%);padding:5px 8px;border-radius:10px;background:rgba(0,0,0,.3);color:#fff;font:13px/18px Arial,sans-serif;text-shadow:0 0 2px #000;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity 100ms ease}
      .mfs-loop-button:hover + .mfs-loop-tooltip,.mfs-loop-button:focus-visible + .mfs-loop-tooltip{opacity:1;visibility:visible}
    `;
    this.loopButton.append(icon);
    this.container.append(style);
    this.container.append(this.loopButton, tooltip);

    this.editButton = this.loopButton.cloneNode(true) as HTMLButtonElement;
    this.editButton.classList.add('mfs-loop-edit-button');
    this.editButton.setAttribute('aria-label', 'Edit loop sections');
    this.editButton.querySelector('svg')!.innerHTML = '<path d="m5 16-1 4 4-1L20 7l-3-3Z" stroke-width="2.4" stroke="currentColor" fill="none"/>';
    this.editButton.hidden = true;
    const editTooltip = tooltip.cloneNode(true) as HTMLSpanElement;
    editTooltip.textContent = 'Edit loop sections';
    this.container.append(this.editButton, editTooltip);
    this.boostContainer = doc.createElement('span');
    this.boostContainer.className = 'mfs-youtube-boost';
    this.boostContainer.style.cssText = this.container.style.cssText;
    this.boostButton = this.loopButton.cloneNode(true) as HTMLButtonElement;
    this.boostButton.classList.remove('mfs-loop-button');
    this.boostButton.classList.add('mfs-loop-button', 'mfs-boost-button');
    this.boostButton.setAttribute('aria-label', 'Boost Volume');
    this.boostButton.querySelector('svg')!.innerHTML = '<path d="M3 8h4l5-4v16l-5-4H3Z M16 7a7 7 0 0 1 0 10 M19 4a11 11 0 0 1 0 16" transform="translate(1 -1) scale(.9)" stroke-width="2" stroke="currentColor" fill="none"/>';
    const boostTooltip = tooltip.cloneNode(true) as HTMLSpanElement;
    this.boostContainer.append(style.cloneNode(true), this.boostButton, boostTooltip);
    this.boostButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onBoost(); });
    for (const type of ['pointerdown', 'mousedown', 'dblclick'])
      this.boostContainer.addEventListener(type, event => event.stopPropagation());
    for (const [control, tip] of [[this.loopButton, tooltip], [this.editButton, editTooltip], [this.boostButton, boostTooltip]] as const) {
      const syncTooltip = () => {
        const player = this.video.closest('#movie_player, .html5-video-player');
        const win = doc.defaultView;
        const nativeWrapper = player?.querySelector<HTMLElement>('.ytp-tooltip-text-wrapper');
        const nativeText = player?.querySelector<HTMLElement>('.ytp-tooltip-text');
        if (win && nativeWrapper && nativeText) {
          const wrapperStyle = win.getComputedStyle(nativeWrapper);
          const textStyle = win.getComputedStyle(nativeText);
          for (const property of ['box-shadow'])
            tip.style.setProperty(property, wrapperStyle.getPropertyValue(property));
          for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-shadow'])
            tip.style.setProperty(property, textStyle.getPropertyValue(property));
        }
        const parentRect = tip.parentElement!.getBoundingClientRect();
        const buttonRect = control.getBoundingClientRect();
        tip.style.left = `${buttonRect.left - parentRect.left + buttonRect.width / 2}px`;
        const native = player?.querySelector<HTMLElement>('.ytp-tooltip');
        const nativeTop = native && Number.parseFloat(native.style.top);
        const playerRect = player?.getBoundingClientRect();
        if (playerRect && nativeTop && nativeTop > 0) {
          tip.style.bottom = 'auto';
          tip.style.top = `${playerRect.top + nativeTop - parentRect.top}px`;
        } else {
          tip.style.top = 'auto';
          tip.style.bottom = 'calc(100% + 24px)';
        }
      };
      control.addEventListener('pointerenter', syncTooltip);
      control.addEventListener('focus', syncTooltip);
    }
    this.editButton.addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation(); onEdit();
    });
    this.loopButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onLoop();
    });
    for (const type of ['pointerdown', 'mousedown', 'dblclick'])
      this.container.addEventListener(type, (event) => event.stopPropagation());
  }
  update(
    enabled: boolean,
    available: boolean,
    expanded: boolean,
    active: boolean,
    hasSections = false,
    boostLevel = 0,
    boostActive = false,
    boostAvailable = true
  ): void {
    const player = this.video.closest('#movie_player, .html5-video-player');
    const mainVideo =
      player?.querySelector('video.html5-main-video') ??
      player?.querySelector('video');
    const controls = player?.querySelector('.ytp-right-controls');
    if ((!enabled && !boostLevel) || !controls || mainVideo !== this.video) {
      this.container.remove();
      this.boostContainer.remove();
      return;
    }
    let anchor = controls.querySelector(
      '.ytp-autonav-toggle, .ytp-autonav-toggle-button, .ytp-subtitles-button'
    );
    while (anchor && anchor.parentElement !== controls)
      anchor = anchor.parentElement;
    anchor ??=
      [...controls.children].find((node) => node !== this.container && node !== this.boostContainer) ?? null;
    if (
      this.container.parentElement !== controls ||
      this.container.nextElementSibling !== anchor
    )
      controls.insertBefore(this.container, anchor);
    if (boostLevel) {
      if (this.boostContainer.parentElement !== controls || this.boostContainer.nextElementSibling !== this.container)
        controls.insertBefore(this.boostContainer, this.container);
      this.boostButton.disabled = !boostAvailable;
      this.boostButton.setAttribute('aria-pressed', String(boostActive));
      this.boostButton.style.color = boostActive ? '#F3CD45' : 'inherit';
      this.boostButton.style.opacity = boostAvailable ? '1' : '.4';
      this.boostContainer.querySelector('.mfs-loop-tooltip')!.textContent =
        boostAvailable ? `Boost Volume · ${boostLevel}×` : 'Boost Volume unavailable for this video';
    } else this.boostContainer.remove();
    if (!enabled) this.container.remove();
    this.loopButton.disabled = !available;
    this.container.querySelector('.mfs-loop-tooltip')!.textContent = available
      ? 'Loop Sections'
      : 'Loop Sections unavailable during ads or live streams';
    this.container.dataset.split = String(hasSections);
    this.editButton.hidden = !hasSections;
    this.editButton.style.display = hasSections ? 'inline-flex' : 'none';
    this.editButton.disabled = !available;
    this.editButton.setAttribute('aria-expanded', String(expanded));
    this.loopButton.setAttribute('aria-pressed', String(active));
    this.loopButton.style.opacity = available ? '1' : '0.4';
    this.loopButton.style.color = 'inherit';
  }
  cleanup(): void {
    this.container.remove();
    this.boostContainer.remove();
  }
}

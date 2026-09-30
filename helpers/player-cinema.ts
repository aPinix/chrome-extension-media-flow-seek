const SVG_NS = 'http://www.w3.org/2000/svg';
const FADE_MS = 240;
type Radius = [number, number];

/** One painted backdrop with a rounded, click-through hole for the real video. */
export class CinemaBackdrop {
  private shade: SVGSVGElement | null = null;
  private path: SVGPathElement | null = null;
  private removeTimer: number | undefined;

  constructor(
    private video: HTMLVideoElement,
    private root: ShadowRoot,
    private onDismiss: () => void
  ) {}

  update(active: boolean, rect: DOMRect, opacity: number, color: string): void {
    const doc = this.video.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    if (!active) {
      if (!this.shade || this.removeTimer !== undefined) return;
      this.shade.style.opacity = '0';
      this.path?.setAttribute('pointer-events', 'none');
      this.removeTimer = win.setTimeout(() => this.remove(), FADE_MS);
      return;
    }
    win.clearTimeout(this.removeTimer);
    this.removeTimer = undefined;
    if (!this.shade) {
      this.shade = doc.createElementNS(SVG_NS, 'svg');
      this.shade.classList.add('shade');
      this.shade.setAttribute('aria-hidden', 'true');
      this.shade.style.opacity = '0';
      this.path = doc.createElementNS(SVG_NS, 'path');
      this.path.setAttribute('fill-rule', 'evenodd');
      this.path.addEventListener('click', this.onDismiss);
      this.shade.append(this.path);
      this.root.prepend(this.shade);
      // Commit the transparent frame so the first activation also fades in.
      win.getComputedStyle(this.shade).opacity;
    }
    this.shade.setAttribute(
      'viewBox',
      `0 0 ${win.innerWidth} ${win.innerHeight}`
    );
    this.path?.setAttribute(
      'd',
      `M0 0H${win.innerWidth}V${win.innerHeight}H0Z ${this.hole(rect)}`
    );
    this.path?.setAttribute('fill', color);
    this.path?.setAttribute('pointer-events', 'visiblePainted');
    this.shade.style.opacity = String(opacity);
  }

  private hole(rect: DOMRect): string {
    const win = this.video.ownerDocument.defaultView;
    const names = [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
    ] as const;
    const radii: Radius[] = names.map(() => [0, 0]);
    for (
      let node: HTMLElement | null = this.video;
      node;
      node = node.parentElement
    ) {
      const bounds = node === this.video ? rect : node.getBoundingClientRect();
      if (
        Math.abs(bounds.left - rect.left) > 2 ||
        Math.abs(bounds.top - rect.top) > 2 ||
        Math.abs(bounds.width - rect.width) > 2 ||
        Math.abs(bounds.height - rect.height) > 2
      )
        continue;
      const style = win?.getComputedStyle(node);
      names.forEach((name, index) => {
        const parts = (style?.[name] || '0').split(' ');
        const size = (value: string, dimension: number) =>
          Math.max(0, Number.parseFloat(value) || 0) *
          (value.endsWith('%') ? dimension / 100 : 1);
        radii[index] = [
          Math.min(
            rect.width / 2,
            Math.max(radii[index]?.[0] ?? 0, size(parts[0] ?? '0', rect.width))
          ),
          Math.min(
            rect.height / 2,
            Math.max(
              radii[index]?.[1] ?? 0,
              size(parts[1] ?? parts[0] ?? '0', rect.height)
            )
          ),
        ];
      });
    }
    const [tl, tr, br, bl] = radii as [Radius, Radius, Radius, Radius];
    const { left: l, top: t, right: r, bottom: b } = rect;
    return `M${l + tl[0]} ${t}H${r - tr[0]}A${tr[0]} ${tr[1]} 0 0 1 ${r} ${t + tr[1]}V${b - br[1]}A${br[0]} ${br[1]} 0 0 1 ${r - br[0]} ${b}H${l + bl[0]}A${bl[0]} ${bl[1]} 0 0 1 ${l} ${b - bl[1]}V${t + tl[1]}A${tl[0]} ${tl[1]} 0 0 1 ${l + tl[0]} ${t}Z`;
  }

  private remove(): void {
    this.shade?.remove();
    this.shade = null;
    this.path = null;
    this.removeTimer = undefined;
  }

  cleanup(): void {
    this.video.ownerDocument.defaultView?.clearTimeout(this.removeTimer);
    this.remove();
  }
}

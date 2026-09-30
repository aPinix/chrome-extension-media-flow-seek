export type YouTubeControl =
  | 'boost'
  | 'cinema'
  | 'loop'
  | 'infoCards'
  | 'screenshot'
  | 'filters';

export const YOUTUBE_CONTROL_ORDER: YouTubeControl[] = [
  'boost',
  'cinema',
  'loop',
  'infoCards',
  'screenshot',
  'filters',
];

export const YOUTUBE_CONTROL_LABELS: Record<YouTubeControl, string> = {
  boost: 'Boost Volume',
  cinema: 'Cinema Mode',
  loop: 'Loop Sections',
  infoCards: 'Info Cards',
  screenshot: 'Screenshot',
  filters: 'Video Filters',
};

export const YOUTUBE_CONTROL_SHORTCUTS: Record<YouTubeControl, string> = {
  boost: 'b',
  cinema: 'd',
  loop: 'r',
  infoCards: 'e',
  screenshot: 's',
  filters: 'v',
};
export type YouTubeAdvancedControl = 'boost' | 'cinema' | 'screenshot';

type IconShape = { tag: 'path' | 'rect'; attributes: Record<string, string> };
export const YOUTUBE_CONTROL_ICONS: Record<
  YouTubeControl | 'edit',
  IconShape[]
> = {
  boost: [
    {
      tag: 'path',
      attributes: {
        d: 'm13 3-5 8h4l-1 6 5-8h-4Z',
        strokeWidth: '1.5',
        className: 'mfs-toggle-fill',
      },
    },
    {
      tag: 'path',
      attributes: {
        d: 'M6 5a9 9 0 0 0 0 10M3 2a14 14 0 0 0 0 16M18 5a9 9 0 0 1 0 10M21 2a14 14 0 0 1 0 16',
        strokeWidth: '1.8',
      },
    },
  ],
  cinema: [
    {
      tag: 'path',
      attributes: {
        d: 'M8.5 12.5a6 6 0 1 1 7 0C14.5 13.3 14 14 14 16h-4c0-2-.5-2.7-1.5-3.5Z',
        strokeWidth: '2',
        className: 'mfs-toggle-fill',
      },
    },
    { tag: 'path', attributes: { d: 'M9 16h6M10 19h4', strokeWidth: '2' } },
  ],
  loop: [
    {
      tag: 'rect',
      attributes: {
        x: '1',
        y: '1',
        width: '22',
        height: '18',
        rx: '3',
        strokeWidth: '2',
        className: 'mfs-loop-frame',
      },
    },
    {
      tag: 'path',
      attributes: {
        d: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
        transform: 'translate(4.5 2.5) scale(.625)',
        className: 'mfs-loop-arrows',
      },
    },
  ],
  infoCards: [
    {
      tag: 'rect',
      attributes: {
        x: '2',
        y: '2',
        width: '20',
        height: '16',
        rx: '2',
        strokeWidth: '2',
        className: 'mfs-toggle-fill',
      },
    },
    {
      tag: 'rect',
      attributes: {
        x: '5',
        y: '6',
        width: '5',
        height: '8',
        rx: '1',
        strokeWidth: '1.6',
        className: 'mfs-toggle-detail',
      },
    },
    {
      tag: 'rect',
      attributes: {
        x: '14',
        y: '6',
        width: '5',
        height: '8',
        rx: '1',
        strokeWidth: '1.6',
        className: 'mfs-toggle-detail',
      },
    },
  ],
  screenshot: [
    {
      tag: 'path',
      attributes: {
        d: 'M3 5h4l2-3h6l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
        strokeWidth: '2',
      },
    },
    {
      tag: 'path',
      attributes: {
        d: 'M16 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
        strokeWidth: '2',
      },
    },
  ],
  filters: [
    {
      tag: 'path',
      attributes: {
        d: 'M1 4h5m4 0h13M1 10h13m4 0h5M1 16h5m4 0h13M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM18 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
        strokeWidth: '2',
      },
    },
  ],
  edit: [
    {
      tag: 'path',
      attributes: { d: 'm5 16-1 4 4-1L20 7l-3-3Z', strokeWidth: '2.4' },
    },
  ],
};

export function createYouTubeControlIcon(
  doc: Document,
  control: YouTubeControl | 'edit'
) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 20',
    width: '24',
    height: '20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.6',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }))
    svg.setAttribute(key, value);
  svg.style.cssText =
    'width:24px!important;height:20px!important;min-width:24px!important;max-width:none!important;flex:none!important;transform:none!important;';
  for (const shape of YOUTUBE_CONTROL_ICONS[control]) {
    const node = doc.createElementNS(svg.namespaceURI, shape.tag);
    for (const [key, value] of Object.entries(shape.attributes))
      node.setAttribute(
        key === 'className'
          ? 'class'
          : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        value
      );
    svg.append(node);
  }
  return svg;
}

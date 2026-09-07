// Shared SVG geometry for the player and its preview.
export const VOLUME_ICON_PATHS = [
  {
    className: 'mfs-volume-icon-speaker',
    d: 'M3 10v4a1 1 0 0 0 1 1h2.6l3.7 3.7A1 1 0 0 0 12 18V6a1 1 0 0 0-1.7-.7L6.6 9H4a1 1 0 0 0-1 1Z',
  },
  {
    className: 'mfs-volume-icon-wave mfs-volume-icon-wave-one',
    d: 'M14 9.5c2 1.5 2 3.5 0 5',
  },
  {
    className: 'mfs-volume-icon-wave mfs-volume-icon-wave-two',
    d: 'M16.5 7.5c3.5 2.5 3.5 6.5 0 9',
  },
  {
    className: 'mfs-volume-icon-wave mfs-volume-icon-wave-three',
    d: 'M18.5 5.5c5 3.5 5 9.5 0 13',
  },
  { className: 'mfs-volume-icon-muted', d: 'M4.5 4.5 19.5 19.5' },
] as const;

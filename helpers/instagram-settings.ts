export const INSTAGRAM_SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 2];

export const normalizeInstagramSpeed = (value: unknown): number =>
  typeof value === 'number' && INSTAGRAM_SPEEDS.includes(value) ? value : 1;

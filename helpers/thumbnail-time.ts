export type ThumbnailTimeDisplay = 'none' | 'time' | 'remaining' | 'both';

export function normalizeThumbnailTimeDisplay(
  value: unknown
): ThumbnailTimeDisplay {
  return value === 'none' || value === 'remaining' || value === 'both'
    ? value
    : 'time';
}

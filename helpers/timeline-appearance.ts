export const YOUTUBE_CHAPTER_GAP_PX = 4;
// One source of truth for the injected seekbar and its UI previews.
export const DEFAULT_TIMELINE_BACKGROUND = 'rgb(255 255 255 / 0.2)';
export const DEFAULT_TIMELINE_PROGRESS_BACKGROUND = 'rgb(255 255 255 / 0.3)';
export const TIMELINE_BACKDROP_FILTER = 'blur(8px) saturate(140%)';

export const TIMELINE_TRACK_STYLE = {
  background: DEFAULT_TIMELINE_BACKGROUND,
  backdropFilter: TIMELINE_BACKDROP_FILTER,
  WebkitBackdropFilter: TIMELINE_BACKDROP_FILTER,
};

export const TIMELINE_PROGRESS_STYLE = {
  ...TIMELINE_TRACK_STYLE,
  background: DEFAULT_TIMELINE_PROGRESS_BACKGROUND,
};

export const getColorizedTimelineBackground = (color: string): string => {
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgb(${rgbMatch[1]} ${rgbMatch[2]} ${rgbMatch[3]} / 0.8)`;
  }

  const hexMatch = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hexMatch) {
    return `rgb(${Number.parseInt(hexMatch[1] ?? '', 16)} ${Number.parseInt(hexMatch[2] ?? '', 16)} ${Number.parseInt(hexMatch[3] ?? '', 16)} / 0.8)`;
  }

  return color;
};

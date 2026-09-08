export type VideoFilters = {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
};
export const DEFAULT_FILTERS: VideoFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
};
export type PlayerToolsSettings = {
  version: 1;
  backward: number;
  forward: number;
  backwardShortcut: string;
  forwardShortcut: string;
  youtubeSpeed: number;
  youtubeLoop: boolean;
  youtubeBoost: number;
  youtubeBoostEnabled: boolean;
  youtubeAutoBoost: boolean;
  rememberYoutubeLoops: boolean;
  rememberYoutubeSpeed: boolean;
  hideCards: boolean;
  hideEndScreens: boolean;
  miniPlayer: boolean;
  autoChapters: boolean;
  dimming: number;
  siteFilters: Record<string, VideoFilters>;
};
export const PLAYER_TOOLS_KEY = 'playerTools';
export const DEFAULT_PLAYER_TOOLS: PlayerToolsSettings = {
  version: 1,
  backward: 5,
  forward: 5,
  backwardShortcut: '',
  forwardShortcut: '',
  youtubeSpeed: 1,
  youtubeLoop: false,
  youtubeBoost: 2,
  youtubeBoostEnabled: false,
  youtubeAutoBoost: false,
  rememberYoutubeLoops: false,
  rememberYoutubeSpeed: false,
  hideCards: false,
  hideEndScreens: false,
  miniPlayer: false,
  autoChapters: false,
  dimming: 80,
  siteFilters: {},
};
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const numeric = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
export function normalizeFilters(value: unknown): VideoFilters {
  const v = (
    value && typeof value === 'object' ? value : {}
  ) as Partial<VideoFilters>;
  return {
    brightness: numeric(v.brightness, 100, 0, 200),
    contrast: numeric(v.contrast, 100, 0, 200),
    saturation: numeric(v.saturation, 100, 0, 200),
    grayscale: numeric(v.grayscale, 0, 0, 100),
  };
}
export function normalizePlayerTools(value: unknown): PlayerToolsSettings {
  const v = (
    value && typeof value === 'object' ? value : {}
  ) as Partial<PlayerToolsSettings>;
  const siteFilters: Record<string, VideoFilters> = {};
  if (v.siteFilters && typeof v.siteFilters === 'object') {
    for (const [host, filters] of Object.entries(v.siteFilters).slice(0, 40)) {
      if (/^[a-z0-9.-]+$/i.test(host))
        siteFilters[host] = normalizeFilters(filters);
    }
  }
  const normalizedInterval = numeric(v.backward, 5, 1, 86400);
  const seekInterval = Number.isInteger(normalizedInterval)
    ? normalizedInterval
    : 5;
  return {
    version: 1,
    youtubeLoop: v.youtubeLoop === true,
    youtubeAutoBoost: v.youtubeAutoBoost === true,
    youtubeBoostEnabled: typeof v.youtubeBoostEnabled === 'boolean' ? v.youtubeBoostEnabled : Number.isInteger(v.youtubeBoost) && v.youtubeBoost! >= 2 && v.youtubeBoost! <= 10,
    youtubeBoost: Number.isInteger(v.youtubeBoost) && v.youtubeBoost! >= 2 && v.youtubeBoost! <= 10 ? v.youtubeBoost! : 2,
    rememberYoutubeLoops: v.rememberYoutubeLoops === true,
    backward: seekInterval,
    // Migrate independent intervals to the existing rewind value for both keys.
    forward: seekInterval,
    backwardShortcut: normalizeShortcut(v.backwardShortcut),
    forwardShortcut: normalizeShortcut(v.forwardShortcut),
    rememberYoutubeSpeed: v.rememberYoutubeSpeed === true,
    youtubeSpeed: Math.round(numeric(v.youtubeSpeed, 1, 0.25, 4) * 20) / 20,
    hideCards: v.hideCards === true,
    hideEndScreens: v.hideEndScreens === true,
    miniPlayer: v.miniPlayer === true,
    autoChapters: v.autoChapters === true,
    dimming: numeric(v.dimming, 80, 0, 100),
    siteFilters,
  };
}
export function normalizeShortcut(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parts = value
    .trim()
    .split('+')
    .map((part) => part.trim().toLowerCase());
  const key = parts.pop() ?? '';
  if (
    !/^(?:[a-z0-9]|arrowleft|arrowright|[,.])$/.test(key) ||
    parts.some((part) => !['ctrl', 'alt', 'shift', 'meta'].includes(part))
  )
    return '';
  return [
    ...['ctrl', 'alt', 'shift', 'meta'].filter((part) => parts.includes(part)),
    key,
  ].join('+');
}
export function shortcutMatches(
  event: KeyboardEvent,
  shortcut: string
): boolean {
  if (!shortcut || event.repeat || event.isComposing) return false;
  return (
    [
      event.ctrlKey && 'ctrl',
      event.altKey && 'alt',
      event.shiftKey && 'shift',
      event.metaKey && 'meta',
      event.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join('+') === shortcut
  );
}
export async function loadPlayerTools(): Promise<PlayerToolsSettings> {
  const result = await chrome.storage.sync.get(PLAYER_TOOLS_KEY);
  return normalizePlayerTools(result[PLAYER_TOOLS_KEY]);
}
export async function savePlayerTools(
  settings: PlayerToolsSettings
): Promise<void> {
  await chrome.storage.sync.set({
    [PLAYER_TOOLS_KEY]: normalizePlayerTools(settings),
  });
}

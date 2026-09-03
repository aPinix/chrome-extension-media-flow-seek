import { getYouTubeVideoId } from '@/helpers/youtube-chapters';

const STORYBOARD_REQUEST_EVENT = 'media-flow-seek:youtube-storyboard-metadata';
const STORYBOARD_METADATA_ATTRIBUTE = 'data-media-flow-seek-youtube-storyboard';

export type YouTubeStoryboardMetadataT = {
  spec: string;
  videoId: string;
};

export type YouTubeStoryboardFrameT = {
  backgroundPosition: string;
  backgroundSize: string;
  frameIndex: number;
  height: number;
  url: string;
  width: number;
};

type StoryboardRendererT = {
  fineScrubbingRecommendedLevel?: number;
  highResolutionRecommendedLevel?: number;
  recommendedLevel?: number;
  spec?: string;
};

type PlayerResponseT = {
  storyboards?: {
    playerStoryboardSpecRenderer?: StoryboardRendererT;
  };
  videoDetails?: {
    videoId?: string;
  };
};

type StoryboardLevelT = {
  columns: number;
  frameCount: number;
  height: number;
  index: number;
  intervalMs: number;
  nameTemplate: string;
  rows: number;
  signature: string;
  width: number;
};

const getStoryboardVideoId = (pageUrl: string): string | null => {
  const standardVideoId = getYouTubeVideoId(pageUrl);
  if (standardVideoId) return standardVideoId;

  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.toLowerCase();
    const isYouTube =
      hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
    if (!isYouTube) return null;
    const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    return shortsMatch?.[1] ? decodeURIComponent(shortsMatch[1]) : null;
  } catch {
    return null;
  }
};

const asPlayerResponse = (value: unknown): PlayerResponseT | null => {
  if (!value || typeof value !== 'object') return null;
  return value as PlayerResponseT;
};

const getMetadataFromResponse = (
  response: unknown,
  expectedVideoId?: string | null
): YouTubeStoryboardMetadataT | null => {
  const parsedResponse = asPlayerResponse(response);
  const videoId = parsedResponse?.videoDetails?.videoId;
  const spec = parsedResponse?.storyboards?.playerStoryboardSpecRenderer?.spec;
  if (!videoId || !spec || (expectedVideoId && videoId !== expectedVideoId)) {
    return null;
  }

  return { spec, videoId };
};

const parseInlinePlayerResponse = (
  ownerDocument: Document
): PlayerResponseT | null => {
  const assignment = 'var ytInitialPlayerResponse = ';
  const script = Array.from(ownerDocument.scripts).find((candidate) =>
    candidate.textContent?.includes(assignment)
  );
  const text = script?.textContent;
  if (!text) return null;

  const start = text.indexOf(assignment);
  if (start < 0) return null;
  const jsonStart = start + assignment.length;
  if (text[jsonStart] !== '{') return null;

  let depth = 0;
  let escaped = false;
  let inString = false;
  let jsonEnd = -1;
  for (let index = jsonStart; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        jsonEnd = index + 1;
        break;
      }
    }
  }
  if (jsonEnd <= jsonStart) return null;

  try {
    return asPlayerResponse(JSON.parse(text.slice(jsonStart, jsonEnd)));
  } catch {
    return null;
  }
};

const parsePositiveInteger = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseLevels = (parts: string[]): StoryboardLevelT[] =>
  parts.flatMap((part, index) => {
    const fields = part.split('#');
    const width = parsePositiveInteger(fields[0]);
    const height = parsePositiveInteger(fields[1]);
    const frameCount = parsePositiveInteger(fields[2]);
    const columns = parsePositiveInteger(fields[3]);
    const rows = parsePositiveInteger(fields[4]);
    const intervalMs = parsePositiveInteger(fields[5]);
    const nameTemplate = fields[6];
    const signature = fields[7];

    if (
      width === null ||
      height === null ||
      frameCount === null ||
      columns === null ||
      rows === null ||
      intervalMs === null ||
      !nameTemplate ||
      !signature
    ) {
      return [];
    }

    return [
      {
        columns,
        frameCount,
        height,
        index,
        intervalMs,
        nameTemplate,
        rows,
        signature,
        width,
      },
    ];
  });

const selectLevel = (
  levels: StoryboardLevelT[],
  desiredWidth: number
): StoryboardLevelT | null => {
  if (levels.length === 0) return null;
  const sortedLevels = [...levels].sort((a, b) => a.width - b.width);
  return (
    sortedLevels.find((level) => level.width >= desiredWidth) ??
    sortedLevels.at(-1) ??
    null
  );
};

export const getYouTubeStoryboardFrame = (
  metadata: YouTubeStoryboardMetadataT,
  time: number,
  desiredWidth = 220,
  devicePixelRatio = 1
): YouTubeStoryboardFrameT | null => {
  if (!metadata.spec || !Number.isFinite(time) || time < 0) return null;
  const [urlTemplate, ...levelParts] = metadata.spec.split('|');
  if (!urlTemplate?.includes('$L')) return null;

  const level = selectLevel(
    parseLevels(levelParts),
    Math.max(1, desiredWidth * Math.max(1, devicePixelRatio))
  );
  if (!level) return null;

  const frameIndex = Math.min(
    level.frameCount - 1,
    Math.floor((time * 1000) / level.intervalMs)
  );
  const cellsPerSheet = level.columns * level.rows;
  const sheetIndex = Math.floor(frameIndex / cellsPerSheet);
  const frameOnSheet = frameIndex % cellsPerSheet;
  const column = frameOnSheet % level.columns;
  const row = Math.floor(frameOnSheet / level.columns);
  const sheetName = level.nameTemplate.replaceAll('$M', String(sheetIndex));
  const resolvedUrl = urlTemplate
    .replaceAll('$L', String(level.index))
    .replaceAll('$N', sheetName);

  let url: URL;
  try {
    url = new URL(resolvedUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  url.searchParams.set('sigh', level.signature);

  const positionX =
    level.columns === 1 ? 0 : (column / (level.columns - 1)) * 100;
  const positionY = level.rows === 1 ? 0 : (row / (level.rows - 1)) * 100;

  return {
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundSize: `${level.columns * 100}% ${level.rows * 100}%`,
    frameIndex,
    height: level.height,
    url: url.href,
    width: level.width,
  };
};

export const requestYouTubeStoryboardMetadata = (
  video: HTMLVideoElement
): YouTubeStoryboardMetadataT | null => {
  const { ownerDocument } = video;
  const ownerWindow = ownerDocument.defaultView;
  const expectedVideoId = getStoryboardVideoId(ownerDocument.location.href);
  if (!ownerWindow || !expectedVideoId) return null;

  video.removeAttribute(STORYBOARD_METADATA_ATTRIBUTE);
  video.dispatchEvent(
    new ownerWindow.Event(STORYBOARD_REQUEST_EVENT, {
      bubbles: true,
      composed: true,
    })
  );

  const bridgedValue = video.getAttribute(STORYBOARD_METADATA_ATTRIBUTE);
  video.removeAttribute(STORYBOARD_METADATA_ATTRIBUTE);
  if (bridgedValue) {
    try {
      const parsed = JSON.parse(bridgedValue) as YouTubeStoryboardMetadataT;
      if (
        parsed.videoId === expectedVideoId &&
        typeof parsed.spec === 'string' &&
        parsed.spec.length > 0
      ) {
        return parsed;
      }
    } catch {
      // Fall through to the initial inline response.
    }
  }

  return getMetadataFromResponse(
    parseInlinePlayerResponse(ownerDocument),
    expectedVideoId
  );
};

export const installYouTubeStoryboardBridge = (
  ownerDocument: Document = document
): (() => void) => {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) return () => undefined;

  const handleRequest = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof ownerWindow.HTMLVideoElement)) return;

    const player = target.closest<HTMLElement>(
      '#movie_player, #shorts-player, .html5-video-player'
    ) as
      | (HTMLElement & {
          getPlayerResponse?: () => unknown;
        })
      | null;
    const pageWindow = ownerWindow as typeof ownerWindow & {
      ytInitialPlayerResponse?: unknown;
    };
    const expectedVideoId = getStoryboardVideoId(ownerDocument.location.href);
    let playerResponse: unknown;
    try {
      playerResponse = player?.getPlayerResponse?.();
    } catch {
      playerResponse = undefined;
    }
    const metadata =
      getMetadataFromResponse(playerResponse, expectedVideoId) ??
      getMetadataFromResponse(
        pageWindow.ytInitialPlayerResponse,
        expectedVideoId
      ) ??
      getMetadataFromResponse(
        parseInlinePlayerResponse(ownerDocument),
        expectedVideoId
      );
    if (!metadata) return;

    target.setAttribute(
      STORYBOARD_METADATA_ATTRIBUTE,
      JSON.stringify(metadata)
    );
  };

  ownerDocument.addEventListener(STORYBOARD_REQUEST_EVENT, handleRequest, true);
  return () => {
    ownerDocument.removeEventListener(
      STORYBOARD_REQUEST_EVENT,
      handleRequest,
      true
    );
  };
};

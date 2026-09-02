export type YouTubeChapterT = {
  end: number;
  start: number;
  title?: string;
};

export type YouTubeChapterModelT = {
  chapters: YouTubeChapterT[];
  source: 'markers' | 'segments';
};

const CHAPTER_MARKER_SELECTOR = 'ytd-macro-markers-list-item-renderer';
const CLASSIC_CHAPTER_SEGMENT_SELECTOR =
  '.ytp-chapters-container > .ytp-chapter-hover-container';
const MODERN_CHAPTER_SEGMENT_SELECTOR =
  'yt-chaptered-progress-bar-line > .ytChapteredProgressBarChapteredPlayerBarChapter';
const CHAPTER_SEGMENT_SELECTOR = `${CLASSIC_CHAPTER_SEGMENT_SELECTOR}, ${MODERN_CHAPTER_SEGMENT_SELECTOR}`;

const isYouTubeHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === 'youtube.com' ||
    normalizedHostname.endsWith('.youtube.com') ||
    normalizedHostname === 'youtube-nocookie.com' ||
    normalizedHostname.endsWith('.youtube-nocookie.com')
  );
};

export const getYouTubeVideoId = (pageUrl: string): string | null => {
  try {
    const url = new URL(pageUrl);
    if (!isYouTubeHostname(url.hostname)) return null;

    if (url.pathname === '/watch') return url.searchParams.get('v');

    const embedMatch = url.pathname.match(/^\/embed\/([^/?#]+)/);
    return embedMatch?.[1] ? decodeURIComponent(embedMatch[1]) : null;
  } catch {
    return null;
  }
};

export const isYouTubeChapterPage = (pageUrl: string): boolean =>
  getYouTubeVideoId(pageUrl) !== null;

export const parseYouTubeTimestamp = (value: string): number | null => {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) return null;

  if (/^\d+(?:\.\d+)?$/.test(trimmedValue)) {
    const seconds = Number(trimmedValue);
    return Number.isFinite(seconds) ? seconds : null;
  }

  if (/^(?:\d+:){1,2}\d{1,2}$/.test(trimmedValue)) {
    const parts = trimmedValue.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;

    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const unitPattern =
    /(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?/;
  const unitMatch = trimmedValue.match(unitPattern);
  if (!unitMatch || unitMatch[0] !== trimmedValue) return null;

  const hours = Number(unitMatch[1] ?? 0);
  const minutes = Number(unitMatch[2] ?? 0);
  const seconds = Number(unitMatch[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total >= 0 ? total : null;
};

const getMarkerStart = (
  marker: Element,
  pageUrl: string,
  videoId: string
): number | null => {
  const endpoint = marker.querySelector<HTMLAnchorElement>('a#endpoint[href]');
  const href = endpoint?.getAttribute('href');

  if (!href) return null;

  try {
    const endpointUrl = new URL(href, pageUrl);
    const endpointVideoId =
      endpointUrl.searchParams.get('v') ??
      getYouTubeVideoId(endpointUrl.toString());
    if (endpointVideoId !== videoId) return null;

    const timestamp = endpointUrl.searchParams.get('t');
    if (timestamp) return parseYouTubeTimestamp(timestamp);
  } catch {
    return null;
  }

  const timeText = marker.querySelector<HTMLElement>('#time')?.textContent;
  return timeText ? parseYouTubeTimestamp(timeText) : null;
};

const getMarkerTitle = (marker: Element): string | null => {
  const titledHeading = Array.from(
    marker.querySelectorAll<HTMLElement>(
      '#title[title], h3[title], h4[title], [role="heading"][title]'
    )
  ).find((heading) => !heading.hidden);
  const title =
    titledHeading?.getAttribute('title') ??
    marker
      .querySelector<HTMLElement>(
        '#title[title], h3[title], h4[title], [role="heading"][title]'
      )
      ?.getAttribute('title') ??
    marker.querySelector<HTMLElement>('#title')?.textContent ??
    '';
  return title.trim() || null;
};

const extractMarkerChapters = (
  ownerDocument: Document,
  pageUrl: string,
  videoId: string,
  duration: number
): YouTubeChapterModelT | null => {
  const chaptersByStart = new Map<number, string>();

  ownerDocument.querySelectorAll(CHAPTER_MARKER_SELECTOR).forEach((marker) => {
    const start = getMarkerStart(marker, pageUrl, videoId);
    const title = getMarkerTitle(marker);
    if (start === null || !title || chaptersByStart.has(start)) return;
    chaptersByStart.set(start, title);
  });

  const markers = Array.from(chaptersByStart, ([start, title]) => ({
    start,
    title,
  })).sort((a, b) => a.start - b.start);

  if (
    markers.length < 2 ||
    markers[0]?.start !== 0 ||
    markers.some(({ start }) => start < 0 || start >= duration)
  ) {
    return null;
  }

  const chapters = markers.map(({ start, title }, index) => ({
    end: markers[index + 1]?.start ?? duration,
    start,
    title,
  }));

  if (chapters.some(({ end, start }) => end <= start)) return null;
  return { chapters, source: 'markers' };
};

const hasOnlyStaleMarkers = (
  ownerDocument: Document,
  pageUrl: string,
  videoId: string
): boolean => {
  const markerVideoIds = Array.from(
    ownerDocument.querySelectorAll<HTMLAnchorElement>(
      `${CHAPTER_MARKER_SELECTOR} a#endpoint[href]`
    )
  ).flatMap((endpoint) => {
    try {
      const endpointUrl = new URL(endpoint.getAttribute('href') ?? '', pageUrl);
      const endpointVideoId =
        endpointUrl.searchParams.get('v') ??
        getYouTubeVideoId(endpointUrl.toString());
      return endpointVideoId ? [endpointVideoId] : [];
    } catch {
      return [];
    }
  });

  return (
    markerVideoIds.length > 0 &&
    !markerVideoIds.some((markerVideoId) => markerVideoId === videoId)
  );
};

const getSegmentWidth = (segment: HTMLElement): number => {
  const renderedWidth = segment.getBoundingClientRect().width;
  if (renderedWidth > 0) return renderedWidth;

  const inlineWidth = Number.parseFloat(segment.style.width);
  return Number.isFinite(inlineWidth) && inlineWidth > 0 ? inlineWidth : 0;
};

const getInlinePercentageWidth = (element: Element): number | null => {
  if (!('style' in element)) return null;

  const match = (element as HTMLElement).style.width
    .trim()
    .match(/^(\d+(?:\.\d+)?)%$/);
  if (!match?.[1]) return null;

  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : null;
};

const getProportionalChildren = (container: Element): HTMLElement[] => {
  const children = Array.from(container.children).filter(
    (child): child is HTMLElement => 'style' in child
  );
  if (children.length < 2 || children.length > 200) return [];

  const widths = children.map(getInlinePercentageWidth);
  if (widths.some((width) => width === null)) return [];

  const totalWidth = widths.reduce<number>(
    (total, width) => total + (width ?? 0),
    0
  );
  return totalWidth >= 95 && totalWidth <= 105 ? children : [];
};

const containsProportionalSiblings = (root: Element): boolean =>
  [root, ...root.querySelectorAll('*')].some(
    (container) => getProportionalChildren(container).length >= 2
  );

/**
 * YouTube's embedded player has changed its generated chapter class names more
 * than once. The accessible horizontal seek slider and the proportional widths
 * of its chapter siblings are the more durable signals, so prefer those over
 * named implementation details.
 */
const findStructuralChapterSegments = (player: HTMLElement): HTMLElement[] => {
  let bestMatch: HTMLElement[] = [];

  player.querySelectorAll<HTMLElement>('[role="slider"]').forEach((slider) => {
    if (
      slider.tagName === 'INPUT' ||
      slider.getAttribute('aria-orientation') === 'vertical'
    ) {
      return;
    }

    const containers = [slider, ...slider.querySelectorAll<HTMLElement>('*')];
    for (const container of containers) {
      const children = getProportionalChildren(container);

      if (children.length > bestMatch.length) bestMatch = children;
    }
  });

  return bestMatch;
};

const extractNativeSegments = (
  player: HTMLElement,
  duration: number
): YouTubeChapterModelT | null => {
  const structuralSegments = findStructuralChapterSegments(player);
  const getWidths = (selector: string) =>
    Array.from(
      player.querySelectorAll<HTMLElement>(selector),
      getSegmentWidth
    ).filter((width) => width > 0);
  const structuralWidths = structuralSegments
    .map(getSegmentWidth)
    .filter((width) => width > 0);
  const modernWidths =
    structuralWidths.length >= 2
      ? []
      : getWidths(MODERN_CHAPTER_SEGMENT_SELECTOR);
  const widths =
    structuralWidths.length >= 2
      ? structuralWidths
      : modernWidths.length >= 2
        ? modernWidths
        : getWidths(CLASSIC_CHAPTER_SEGMENT_SELECTOR);

  if (widths.length < 2) return null;

  const totalWidth = widths.reduce((total, width) => total + width, 0);
  if (!(totalWidth > 0)) return null;

  let elapsed = 0;
  const chapters = widths.map((width, index) => {
    const start = (elapsed / totalWidth) * duration;
    elapsed += width;
    return {
      end:
        index === widths.length - 1
          ? duration
          : (elapsed / totalWidth) * duration,
      start,
    };
  });

  return { chapters, source: 'segments' };
};

const findYouTubePlayer = (video: HTMLVideoElement): HTMLElement | null => {
  const knownPlayer = video.closest<HTMLElement>(
    '#movie_player, .html5-video-player'
  );
  if (knownPlayer) return knownPlayer;

  let ancestor = video.parentElement;
  while (ancestor && ancestor !== video.ownerDocument.body) {
    if (ancestor.querySelector('[role="slider"]')) return ancestor;
    ancestor = ancestor.parentElement;
  }

  return null;
};

export const extractYouTubeChapterModel = ({
  ownerDocument,
  pageUrl = ownerDocument.location.href,
  video,
}: {
  ownerDocument: Document;
  pageUrl?: string;
  video: HTMLVideoElement;
}): YouTubeChapterModelT | null => {
  const videoId = getYouTubeVideoId(pageUrl);
  const duration = video.duration;
  if (!videoId || !Number.isFinite(duration) || duration <= 0) return null;

  const player = findYouTubePlayer(video);
  if (!player) return null;
  if (player.matches('.ad-showing, .ad-interrupting')) return null;

  const primaryVideo =
    player.querySelector<HTMLVideoElement>('video.html5-main-video') ??
    player.querySelector<HTMLVideoElement>('video');
  if (primaryVideo && primaryVideo !== video) return null;

  const watchRootVideoId = ownerDocument
    .querySelector<HTMLElement>('ytd-watch-flexy[video-id]')
    ?.getAttribute('video-id');
  if (watchRootVideoId && watchRootVideoId !== videoId) return null;

  const markerModel = extractMarkerChapters(
    ownerDocument,
    pageUrl,
    videoId,
    duration
  );
  if (markerModel) return markerModel;
  if (hasOnlyStaleMarkers(ownerDocument, pageUrl, videoId)) return null;

  return extractNativeSegments(player, duration);
};

export const youtubeChapterMutationMayAffectModel = (
  mutation: MutationRecord
): boolean => {
  const target = mutation.target;
  const targetElement = target.nodeType === 1 ? (target as Element) : null;

  if (mutation.type === 'attributes') {
    if (targetElement?.matches('[role="slider"]')) {
      return true;
    }

    const proportionalSiblings = targetElement?.parentElement
      ? getProportionalChildren(targetElement.parentElement)
      : [];
    if (
      targetElement?.closest('[role="slider"]') &&
      proportionalSiblings.includes(targetElement as HTMLElement)
    ) {
      return true;
    }

    return Boolean(
      targetElement?.matches(
        '#movie_player, .html5-video-player, .ytp-chapter-hover-container, .ytChapteredProgressBarChapteredPlayerBarChapter, ytd-macro-markers-list-item-renderer a#endpoint, ytd-macro-markers-list-item-renderer #title, ytd-macro-markers-list-item-renderer h3[title], ytd-macro-markers-list-item-renderer h4[title], ytd-macro-markers-list-item-renderer #time'
      )
    );
  }

  if (
    targetElement?.closest(
      '.ytp-chapters-container, yt-chaptered-progress-bar-line, ytd-macro-markers-list-item-renderer'
    )
  ) {
    return true;
  }

  if (
    targetElement?.closest('[role="slider"]') &&
    containsProportionalSiblings(targetElement)
  ) {
    return true;
  }

  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
    if (node.nodeType !== 1) return false;
    const element = node as Element;
    return (
      element.matches('[role="slider"]') ||
      element.querySelector('[role="slider"]') !== null ||
      containsProportionalSiblings(element) ||
      element.matches(
        `${CHAPTER_MARKER_SELECTOR}, ${CHAPTER_SEGMENT_SELECTOR}`
      ) ||
      element.querySelector(
        `${CHAPTER_MARKER_SELECTOR}, .ytp-chapter-hover-container, .ytChapteredProgressBarChapteredPlayerBarChapter`
      ) !== null
    );
  });
};

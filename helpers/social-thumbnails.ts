// Read media metadata belonging to the hovered player in the page world. Feed
// players often attach a MediaSource blob that cannot be opened by a second video.
const REQUEST_EVENT = 'media-flow-seek:social-thumbnail-source';
const RESPONSE_ATTRIBUTE = 'data-mfs-social-thumbnail-source';

export type SocialThumbnailMetadata = {
  source?: string;
  sprites?: {
    urls: string[];
    columns: number;
    count: number;
    interval: number;
  };
};

export const isSocialThumbnailHost = (hostname: string): boolean =>
  ['instagram.com', 'tiktok.com'].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

const httpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    /* Missing or temporary media source. */
  }
};

const firstUrl = (value: unknown): string | undefined => {
  const object = record(value);
  const list = object?.urlList ?? object?.url_list;
  return (
    httpUrl(value) ??
    (Array.isArray(list) ? list.map(httpUrl).find(Boolean) : undefined)
  );
};

export const getManifestPreviewSource = (
  value: unknown
): string | undefined => {
  if (
    typeof value !== 'string' ||
    value.length > 1_000_000 ||
    !value.includes('<MPD')
  )
    return;
  const manifest = new DOMParser().parseFromString(value, 'application/xml');
  if (
    manifest.querySelector(
      'parsererror, ContentProtection, SegmentTemplate, SegmentList'
    )
  )
    return;
  // Instagram's on-demand representations are complete, range-seekable MP4s.
  // A small video-only representation is sufficient for a muted preview.
  const representations = Array.from(
    manifest.querySelectorAll('Representation')
  )
    .filter(
      (item) =>
        (item.getAttribute('mimeType') ??
          item.parentElement?.getAttribute('mimeType')) === 'video/mp4'
    )
    .sort(
      (a, b) =>
        Number(a.getAttribute('bandwidth')) -
        Number(b.getAttribute('bandwidth'))
    );
  return representations
    .map((item) => httpUrl(item.querySelector('BaseURL')?.textContent))
    .find(Boolean);
};

export const parseSocialThumbnailMetadata = (
  value: unknown
): SocialThumbnailMetadata | null => {
  const item = record(value);
  if (!item) return null;
  const video = record(item.video) ?? item;
  const versions = item.video_versions;
  const version = Array.isArray(versions)
    ? versions.map((entry) => httpUrl(record(entry)?.url)).find(Boolean)
    : undefined;
  const source =
    firstUrl(video.playAddr) ??
    firstUrl(video.play_addr) ??
    httpUrl(item.video_url) ??
    httpUrl(item.progressive_url) ??
    version ??
    getManifestPreviewSource(item.manifest ?? item.video_dash_manifest);
  const candidates = record(
    record(item.image_versions2)?.scrubber_spritesheet_info_candidates
  );
  const sprite = record(candidates?.default);
  const urls = sprite?.sprite_urls;
  const columns = sprite?.thumbnails_per_row;
  const count = sprite?.max_thumbnails_per_sprite;
  const interval = sprite?.thumbnail_duration;
  const validSprites =
    Array.isArray(urls) &&
    urls.length > 0 &&
    urls.length <= 100 &&
    urls.every((url) => Boolean(httpUrl(url))) &&
    typeof columns === 'number' &&
    Number.isInteger(columns) &&
    columns > 0 &&
    columns <= 100 &&
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count > 0 &&
    count <= 10000 &&
    typeof interval === 'number' &&
    Number.isFinite(interval) &&
    interval > 0;
  if (!source && !validSprites) return null;
  return {
    source,
    ...(validSprites
      ? { sprites: { urls: urls as string[], columns, count, interval } }
      : {}),
  };
};

// Stay within the closest player's props; never traverse React parents/siblings
// through object graphs, which could return another reel's source.
export const findSocialThumbnailMetadata = (
  value: unknown
): SocialThumbnailMetadata | null => {
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new Set<object>();
  const found: SocialThumbnailMetadata[] = [];
  for (let index = 0; index < queue.length && index < 1500; index += 1) {
    const entry = queue[index];
    if (!entry) continue;
    const item = record(entry.value);
    if (!item || seen.has(item) || entry.depth > 9) continue;
    seen.add(item);
    const candidate = parseSocialThumbnailMetadata(item);
    if (candidate) {
      if (
        found.some(
          (previous) =>
            previous.source &&
            candidate.source &&
            previous.source !== candidate.source
        )
      )
        return null;
      found.push(candidate);
      // Media records already contain their video data. Do not inspect related
      // records such as recommendations inside the same object.
      continue;
    }
    for (const [key, child] of Object.entries(item)) {
      if (
        ['children', 'return', 'sibling', '_owner', 'stateNode'].includes(key)
      )
        continue;
      if (child && typeof child === 'object' && !(child instanceof Node)) {
        queue.push({ value: child, depth: entry.depth + 1 });
      }
    }
  }
  return found.length
    ? {
        source: found.find((item) => item.source)?.source,
        sprites: found.find((item) => item.sprites)?.sprites,
      }
    : null;
};

export const installSocialThumbnailBridge = (
  ownerDocument: Document = document
): (() => void) => {
  if (!isSocialThumbnailHost(ownerDocument.location.hostname))
    return () => undefined;
  const handleRequest = (event: Event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLVideoElement) ||
      target.closest('.mfs-seekbar-thumbnail-preview')
    )
      return;
    let element: HTMLElement | null = target;
    for (
      let depth = 0;
      element && depth < 12;
      depth += 1, element = element.parentElement
    ) {
      if (
        element.querySelectorAll('video:not(.mfs-thumbnail-video)').length > 1
      )
        break;
      for (const key of Object.getOwnPropertyNames(element)) {
        if (
          !key.startsWith('__reactProps$') &&
          !key.startsWith('__reactFiber$')
        )
          continue;
        try {
          const value = (element as unknown as Record<string, unknown>)[key];
          let fiber = key.startsWith('__reactFiber$') ? record(value) : null;
          for (let level = 0; level < 40; level += 1) {
            const host = fiber?.stateNode;
            if (
              host instanceof HTMLElement &&
              host.querySelectorAll('video:not(.mfs-thumbnail-video)').length >
                1
            )
              break;
            const metadata = findSocialThumbnailMetadata(
              fiber ? fiber.memoizedProps : value
            );
            if (metadata) {
              target.setAttribute(RESPONSE_ATTRIBUTE, JSON.stringify(metadata));
              return;
            }
            fiber = record(fiber?.return);
            if (!fiber) break;
          }
        } catch {
          /* Site internals may change; direct video previews still work. */
        }
      }
    }
  };
  ownerDocument.addEventListener(REQUEST_EVENT, handleRequest);
  return () => ownerDocument.removeEventListener(REQUEST_EVENT, handleRequest);
};

export const requestSocialThumbnailMetadata = (
  video: HTMLVideoElement
): SocialThumbnailMetadata | null => {
  if (!isSocialThumbnailHost(video.ownerDocument.location.hostname))
    return null;
  video.removeAttribute(RESPONSE_ATTRIBUTE);
  video.dispatchEvent(
    new Event(REQUEST_EVENT, { bubbles: true, composed: true })
  );
  const response = video.getAttribute(RESPONSE_ATTRIBUTE);
  video.removeAttribute(RESPONSE_ATTRIBUTE);
  if (!response || response.length > 100_000) return null;
  try {
    const parsed = JSON.parse(response) as SocialThumbnailMetadata;
    // Revalidate values crossing from the untrusted page world.
    return parseSocialThumbnailMetadata({
      video_url: parsed.source,
      image_versions2: {
        scrubber_spritesheet_info_candidates: {
          default: {
            sprite_urls: parsed.sprites?.urls,
            thumbnails_per_row: parsed.sprites?.columns,
            max_thumbnails_per_sprite: parsed.sprites?.count,
            thumbnail_duration: parsed.sprites?.interval,
          },
        },
      },
    });
  } catch {
    return null;
  }
};

export const getSocialThumbnailFrame = (
  metadata: SocialThumbnailMetadata | null,
  time: number,
  aspectRatio: number
) => {
  const sprites = metadata?.sprites;
  if (!sprites || !Number.isFinite(time)) return null;
  const index = Math.min(
    sprites.urls.length * sprites.count - 1,
    Math.max(0, Math.floor(time / sprites.interval))
  );
  const cell = index % sprites.count;
  const rows = Math.ceil(sprites.count / sprites.columns);
  const height = 124;
  const url = sprites.urls[Math.floor(index / sprites.count)];
  if (!url) return null;
  const width =
    height *
    (Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16);
  return {
    url,
    width,
    height,
    backgroundSize: `${sprites.columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${sprites.columns === 1 ? 0 : ((cell % sprites.columns) / (sprites.columns - 1)) * 100}% ${rows === 1 ? 0 : (Math.floor(cell / sprites.columns) / (rows - 1)) * 100}%`,
  };
};

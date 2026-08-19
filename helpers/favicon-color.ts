export const DEFAULT_PROGRESS_COLOR = '#f8fafc';

const MIN_PROGRESS_COLOR_LUMINANCE = 0.1;
const MIN_PROGRESS_COLOR_SATURATION = 0.35;
const MAX_SAMPLE_SIZE = 64;
const HUE_BUCKET_SIZE = 60;
const FAVICON_DATA_URL_REQUEST = 'GET_FAVICON_DATA_URL';

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

type ColorBucket = RgbColor & {
  count: number;
};

type FaviconDataUrlResponse = {
  dataUrl?: string;
};

const faviconColorCache = new Map<string, string>();
const faviconColorPromises = new Map<string, Promise<string>>();

const toLinearChannel = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const getRelativeLuminance = ({ red, green, blue }: RgbColor): number =>
  0.2126 * toLinearChannel(red) +
  0.7152 * toLinearChannel(green) +
  0.0722 * toLinearChannel(blue);

const getSaturation = ({ red, green, blue }: RgbColor): number => {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
};

const getHue = ({ red, green, blue }: RgbColor): number => {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return 0;

  let hue: number;
  if (maximum === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (maximum === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return (hue * 60 + 360) % 360;
};

/**
 * Find the most common visible hue family and average its original pixels.
 * Transparent, dark, and nearly neutral pixels are ignored so a favicon's
 * usable accent wins over padding, dark backgrounds, and white artwork.
 */
export const getPredominantColorFromPixels = (
  pixels: Uint8ClampedArray
): string => {
  const buckets = new Map<string, ColorBucket>();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha < 128) continue;

    const color: RgbColor = {
      red: pixels[index] ?? 0,
      green: pixels[index + 1] ?? 0,
      blue: pixels[index + 2] ?? 0,
    };
    if (
      getRelativeLuminance(color) < MIN_PROGRESS_COLOR_LUMINANCE ||
      getSaturation(color) < MIN_PROGRESS_COLOR_SATURATION
    ) {
      continue;
    }

    const key = String(Math.floor(getHue(color) / HUE_BUCKET_SIZE));
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      count: 0,
    };

    bucket.red += color.red;
    bucket.green += color.green;
    bucket.blue += color.blue;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  let predominant: ColorBucket | undefined;
  for (const bucket of buckets.values()) {
    if (!predominant || bucket.count > predominant.count) {
      predominant = bucket;
    }
  }

  if (!predominant) return DEFAULT_PROGRESS_COLOR;

  const color = {
    red: Math.round(predominant.red / predominant.count),
    green: Math.round(predominant.green / predominant.count),
    blue: Math.round(predominant.blue / predominant.count),
  };

  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
};

const getDeclaredIconSize = (link: HTMLLinkElement): number => {
  if (link.sizes.value === 'any') return Number.MAX_SAFE_INTEGER;

  return Math.max(
    0,
    ...link.sizes.value.split(/\s+/).map((size) => {
      const [width = '0', height = '0'] = size.split('x');
      return Math.max(Number.parseInt(width, 10), Number.parseInt(height, 10));
    })
  );
};

const getFaviconUrl = (sourceDocument: Document): string | null => {
  const iconLinks = Array.from(
    sourceDocument.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
    )
  )
    .filter((link) => Boolean(link.href))
    .sort(
      (left, right) => getDeclaredIconSize(right) - getDeclaredIconSize(left)
    );

  if (iconLinks[0]?.href) return iconLinks[0].href;

  const pageUrl = sourceDocument.location.hostname
    ? sourceDocument.location.href
    : sourceDocument.referrer;

  try {
    return pageUrl ? new URL('/favicon.ico', pageUrl).href : null;
  } catch {
    return null;
  }
};

const getHostname = (sourceDocument: Document): string => {
  if (sourceDocument.location.hostname) {
    return sourceDocument.location.hostname.toLowerCase();
  }

  try {
    return new URL(sourceDocument.referrer).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const requestReadableFavicon = async (fallbackUrl: string): Promise<string> => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return fallbackUrl;

  try {
    const response = (await chrome.runtime.sendMessage({
      type: FAVICON_DATA_URL_REQUEST,
      fallbackUrl,
    })) as FaviconDataUrlResponse | undefined;

    return response?.dataUrl ?? fallbackUrl;
  } catch {
    return fallbackUrl;
  }
};

const getColorFromImage = async (
  imageUrl: string,
  sourceDocument: Document
): Promise<string> => {
  const ImageConstructor = sourceDocument.defaultView?.Image;
  if (!ImageConstructor) return DEFAULT_PROGRESS_COLOR;

  return new Promise((resolve) => {
    const image = new ImageConstructor();
    let settled = false;

    const finish = (color: string): void => {
      if (settled) return;
      settled = true;
      resolve(color);
    };

    image.onload = () => {
      try {
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        if (!(naturalWidth && naturalHeight)) {
          finish(DEFAULT_PROGRESS_COLOR);
          return;
        }

        const scale = Math.min(
          1,
          MAX_SAMPLE_SIZE / Math.max(naturalWidth, naturalHeight)
        );
        const canvas = sourceDocument.createElement('canvas');
        canvas.width = Math.max(1, Math.round(naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(naturalHeight * scale));

        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });
        if (!context) {
          finish(DEFAULT_PROGRESS_COLOR);
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(
          getPredominantColorFromPixels(
            context.getImageData(0, 0, canvas.width, canvas.height).data
          )
        );
      } catch {
        // A remote favicon without CORS headers can taint the canvas. The
        // background script normally converts it to a safe data URL first.
        finish(DEFAULT_PROGRESS_COLOR);
      }
    };
    image.onerror = () => finish(DEFAULT_PROGRESS_COLOR);
    image.src = imageUrl;
  });
};

const resolveProgressColor = async (
  sourceDocument: Document
): Promise<string> => {
  const faviconUrl = getFaviconUrl(sourceDocument);
  if (!faviconUrl) return DEFAULT_PROGRESS_COLOR;

  const readableFavicon = await requestReadableFavicon(faviconUrl);
  return getColorFromImage(readableFavicon, sourceDocument);
};

export const getProgressColor = (sourceDocument: Document): Promise<string> => {
  const hostname = getHostname(sourceDocument);
  const cacheKey = hostname || getFaviconUrl(sourceDocument) || 'default';
  const cachedColor = faviconColorCache.get(cacheKey);
  if (cachedColor) return Promise.resolve(cachedColor);

  const pendingColor = faviconColorPromises.get(cacheKey);
  if (pendingColor) return pendingColor;

  const colorPromise = resolveProgressColor(sourceDocument)
    .then((color) => {
      faviconColorCache.set(cacheKey, color);
      return color;
    })
    .finally(() => faviconColorPromises.delete(cacheKey));

  faviconColorPromises.set(cacheKey, colorPromise);
  return colorPromise;
};

export const getProgressColorSync = (hostname: string): string =>
  faviconColorCache.get(hostname.toLowerCase()) ?? DEFAULT_PROGRESS_COLOR;

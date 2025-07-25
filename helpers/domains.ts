import { DOMAIN_CONFIGS } from '@/config/domains.config';

export const getDefaultDomainRules = () =>
  DOMAIN_CONFIGS.map((config) => ({
    domain: config.domain,
    type: config.type,
    enabled: config.enabled,
  }));

// Cache for favicon dominant colors to avoid repeated processing
const faviconColorCache = new Map<string, string>();

// Function to find the favicon URL for the current page
const getFaviconUrl = (): string | null => {
  // Check for various favicon link elements
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  for (const selector of selectors) {
    const link = document.querySelector(selector) as HTMLLinkElement;
    if (link && link.href) {
      console.log(`🔍 Found favicon via ${selector}:`, link.href);
      return link.href;
    }
  }

  // Fallback to default favicon.ico
  const fallbackUrl = `${window.location.protocol}//${window.location.hostname}/favicon.ico`;
  console.log(`🔍 Using fallback favicon:`, fallbackUrl);
  return fallbackUrl;
};

// Function to extract dominant color from an image
const getDominantColorFromImage = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();

    // Try with CORS first, fallback without CORS if it fails
    let corsAttempted = false;

    const tryLoad = (useCORS: boolean) => {
      if (useCORS) {
        img.crossOrigin = 'anonymous';
        corsAttempted = true;
      } else {
        img.removeAttribute('crossOrigin');
      }

      // Add timestamp to bypass cache issues
      const separator = imageUrl.includes('?') ? '&' : '?';
      img.src = imageUrl + separator + 't=' + Date.now();
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve('white');
          return;
        }

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Count color frequencies
        const colorCount: { [key: string]: number } = {};

        // Sample every 4th pixel for performance (adjust as needed)
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Group similar colors by rounding to nearest 32
          const roundedR = Math.round(r / 32) * 32;
          const roundedG = Math.round(g / 32) * 32;
          const roundedB = Math.round(b / 32) * 32;

          const colorKey = `${roundedR},${roundedG},${roundedB}`;
          colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;
        }

        // Find the most frequent color
        let dominantColor = 'white';
        let maxCount = 0;

        for (const [color, count] of Object.entries(colorCount)) {
          if (count > maxCount) {
            maxCount = count;
            const [r, g, b] = color.split(',').map(Number);
            dominantColor = `rgb(${r}, ${g}, ${b})`;
          }
        }

        resolve(dominantColor);
      } catch (error) {
        console.warn('Error extracting dominant color from favicon:', error);
        resolve('white');
      }
    };

    img.onerror = () => {
      // If CORS failed, try without CORS
      if (corsAttempted) {
        console.log(`🔄 CORS failed for ${imageUrl}, retrying without CORS`);
        tryLoad(false);
      } else {
        console.warn(`❌ Failed to load favicon: ${imageUrl}`);
        resolve('white');
      }
    };

    // Start with CORS attempt
    tryLoad(true);
  });
};

export const getProgressColor = async (hostname: string): Promise<string> => {
  const lowerHostname = hostname.toLowerCase();

  // First check if we have a specific config color for this domain
  const config = DOMAIN_CONFIGS.find((config) => {
    if (config.domain === '*') return false;

    const configDomain = config.domain.toLowerCase();

    // Exact match
    if (lowerHostname === configDomain) return true;

    // Subdomain match (e.g., sub.example.com matches example.com)
    if (lowerHostname.endsWith('.' + configDomain)) return true;

    return false;
  });

  if (config?.color) {
    return config.color;
  }

  // Check cache first
  if (faviconColorCache.has(lowerHostname)) {
    return faviconColorCache.get(lowerHostname)!;
  }

  try {
    // Get favicon URL and extract dominant color
    const faviconUrl = getFaviconUrl();

    if (faviconUrl) {
      console.log(
        `🎨 Extracting color from favicon for ${lowerHostname}:`,
        faviconUrl
      );
      const dominantColor = await getDominantColorFromImage(faviconUrl);

      // Cache the result
      faviconColorCache.set(lowerHostname, dominantColor);
      console.log(`✅ Cached color for ${lowerHostname}:`, dominantColor);

      return dominantColor;
    } else {
      console.warn(`❌ No favicon URL found for ${lowerHostname}`);
    }
  } catch (error) {
    console.warn(
      `❌ Failed to get dominant color from favicon for ${lowerHostname}:`,
      error
    );
  }

  // Fallback to white
  return 'white';
};

// Synchronous version that returns cached color or white immediately
export const getProgressColorSync = (hostname: string): string => {
  const lowerHostname = hostname.toLowerCase();

  // First check if we have a specific config color for this domain
  const config = DOMAIN_CONFIGS.find((config) => {
    if (config.domain === '*') return false;

    const configDomain = config.domain.toLowerCase();

    // Exact match
    if (lowerHostname === configDomain) return true;

    // Subdomain match (e.g., sub.example.com matches example.com)
    if (lowerHostname.endsWith('.' + configDomain)) return true;

    return false;
  });

  if (config?.color) {
    return config.color;
  }

  // Return cached color if available
  if (faviconColorCache.has(lowerHostname)) {
    return faviconColorCache.get(lowerHostname)!;
  }

  // Trigger async color extraction in background
  getProgressColor(hostname)
    .then((color) => {
      console.log(`🎨 Favicon color extracted for ${hostname}:`, color);
      // Color is already cached inside getProgressColor
    })
    .catch((error) => {
      console.warn(
        `❌ Failed to extract favicon color for ${hostname}:`,
        error
      );
    });

  // Return white immediately as fallback
  return 'white';
};

// Debug function to test favicon extraction (can be called from console)
(window as any).testFaviconExtraction = async () => {
  const hostname = window.location.hostname;
  console.log(`🧪 Testing favicon extraction for ${hostname}...`);

  try {
    const color = await getProgressColor(hostname);
    console.log(`🎨 Result: ${color}`);
    return color;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return 'white';
  }
};

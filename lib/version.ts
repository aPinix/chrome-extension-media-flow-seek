// Extract version from wxt.config.ts manifest
export const getExtensionVersion = (): string | null => {
  // In a Chrome extension context, we can get the version from the manifest
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.getManifest
  ) {
    return chrome.runtime.getManifest().version;
  }

  return null;
};

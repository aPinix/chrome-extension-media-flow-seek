const PORTAL_CLASS = 'mfs-viewport-portal';

export function getDocumentOverlayHost(video: HTMLVideoElement): HTMLElement {
  const doc = video.ownerDocument;
  const host = doc.location.hostname.toLowerCase();
  if (host !== 'tiktok.com' && !host.endsWith('.tiktok.com')) {
    return doc.documentElement;
  }

  return getViewportOverlayHost(doc);
}

export function getViewportOverlayHost(doc: Document): HTMLElement {
  let portal = doc.querySelector<HTMLElement>(`.${PORTAL_CLASS}`);
  if (!portal) {
    portal = doc.createElement('div');
    portal.className = PORTAL_CLASS;
    // TikTok scrolls its feed inside the viewport. Portaling an upcoming
    // video's controls to <html> lets their offscreen coordinates enlarge
    // the document, even when opacity/visibility hides those controls.
    // Clip only our own UI; never change the site's scrolling or overflow.
    portal.style.cssText = `
      all: initial;
      position: fixed;
      inset: 0;
      overflow: hidden;
      contain: strict;
      pointer-events: none;
      z-index: 2147483647;
    `;
    doc.documentElement.appendChild(portal);
  }
  return portal;
}

export function removeEmptyOverlayHost(doc: Document): void {
  const portal = doc.querySelector(`.${PORTAL_CLASS}`);
  if (portal && !portal.hasChildNodes()) portal.remove();
}

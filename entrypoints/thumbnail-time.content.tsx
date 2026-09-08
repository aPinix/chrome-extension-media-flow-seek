import { installThumbnailPreviewTimeRenderer } from '@/helpers/thumbnail-preview-time';

export default defineContentScript({
  matches: ['<all_urls>'],
  // NumberFlow registers a custom element. Chromium exposes its registry in
  // the page world, while the extension's isolated registry may be null.
  // This renderer handles text-only DOM events and uses no extension APIs.
  world: 'MAIN',
  allFrames: true,
  // A Document PiP window is about:blank; its isolated customElements registry
  // may be null. Thumbnail renderers belong to the source document, not PiP.
  matchAboutBlank: false,
  matchOriginAsFallback: false,
  main() {
    installThumbnailPreviewTimeRenderer(document);
  },
});

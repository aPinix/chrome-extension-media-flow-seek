import { installThumbnailPreviewTimeRenderer } from '@/helpers/thumbnail-preview-time';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  main() {
    installThumbnailPreviewTimeRenderer(document);
  },
});

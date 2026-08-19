import { installNativePlayerSeekBridge } from '@/helpers/media';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installNativePlayerSeekBridge(document);
  },
});

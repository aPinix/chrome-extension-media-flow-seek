import { installNativePlayerSeekBridge } from '@/helpers/media';
import { installYouTubeStoryboardBridge } from '@/helpers/youtube-storyboards';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installNativePlayerSeekBridge(document);
    installYouTubeStoryboardBridge(document);
  },
});

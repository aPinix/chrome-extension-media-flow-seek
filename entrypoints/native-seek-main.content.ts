import { installNativePlayerSeekBridge } from '@/helpers/media';
import { installSocialThumbnailBridge } from '@/helpers/social-thumbnails';
import { installYouTubePipBridge } from '@/helpers/youtube-pip';
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
    installSocialThumbnailBridge(document);
    installYouTubePipBridge(document);
  },
});

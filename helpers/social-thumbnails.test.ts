// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.instagram.com/reels/example/"}
import { afterEach, expect, it } from 'vitest';
import {
  findSocialThumbnailMetadata,
  getManifestPreviewSource,
  getSocialThumbnailFrame,
  installSocialThumbnailBridge,
  parseSocialThumbnailMetadata,
  requestSocialThumbnailMetadata,
} from './social-thumbnails';

afterEach(() => document.body.replaceChildren());

it('resolves Instagram video versions and TikTok play addresses', () => {
  expect(
    parseSocialThumbnailMetadata({
      video_versions: [{ url: 'https://cdn.example/reel.mp4' }],
    })?.source
  ).toBe('https://cdn.example/reel.mp4');
  expect(
    parseSocialThumbnailMetadata({
      video: { playAddr: { urlList: ['https://cdn.example/tiktok.mp4'] } },
    })?.source
  ).toBe('https://cdn.example/tiktok.mp4');
  expect(
    parseSocialThumbnailMetadata({ video_url: 'javascript:alert(1)' })
  ).toBeNull();
  expect(
    findSocialThumbnailMetadata({
      items: [
        { video_url: 'https://cdn.example/1' },
        { video_url: 'https://cdn.example/2' },
      ],
    })
  ).toBeNull();
});

it('selects the smallest seekable video representation without audio or protected segments', () => {
  const xml =
    '<MPD><Period><AdaptationSet><Representation mimeType="audio/mp4" bandwidth="1"><BaseURL>https://cdn.example/audio</BaseURL></Representation><Representation mimeType="video/mp4" bandwidth="500"><BaseURL>https://cdn.example/large</BaseURL></Representation><Representation mimeType="video/mp4" bandwidth="100"><BaseURL>https://cdn.example/small?a=1&amp;b=2</BaseURL></Representation></AdaptationSet></Period></MPD>';
  expect(getManifestPreviewSource(xml)).toBe(
    'https://cdn.example/small?a=1&b=2'
  );
  expect(
    getManifestPreviewSource(
      xml.replace('<Period>', '<Period><ContentProtection/>')
    )
  ).toBeUndefined();
  expect(
    getManifestPreviewSource(
      xml.replace('<Period>', '<Period><SegmentTemplate/>')
    )
  ).toBeUndefined();
});

it('maps spritesheet boundaries and rejects invalid geometry', () => {
  const sprite = {
    sprite_urls: ['https://cdn.example/0.jpg', 'https://cdn.example/1.jpg'],
    thumbnails_per_row: 2,
    max_thumbnails_per_sprite: 4,
    thumbnail_duration: 2,
  };
  const metadata = parseSocialThumbnailMetadata({
    image_versions2: {
      scrubber_spritesheet_info_candidates: { default: sprite },
    },
  });
  expect(getSocialThumbnailFrame(metadata, 7, 9 / 16)).toMatchObject({
    url: sprite.sprite_urls[0],
    backgroundPosition: '100% 100%',
  });
  expect(getSocialThumbnailFrame(metadata, 8, 9 / 16)).toMatchObject({
    url: sprite.sprite_urls[1],
    backgroundPosition: '0% 0%',
  });
  expect(
    getSocialThumbnailFrame(metadata, 1000, 9 / 16)?.backgroundPosition
  ).toBe('100% 100%');
  expect(
    parseSocialThumbnailMetadata({
      image_versions2: {
        scrubber_spritesheet_info_candidates: {
          default: { ...sprite, thumbnail_duration: 0 },
        },
      },
    })
  ).toBeNull();
});

it('resolves only the requested player and refreshes when a feed recycles its React props', () => {
  const uninstall = installSocialThumbnailBridge(document);
  const video = document.createElement('video');
  const otherVideo = document.createElement('video');
  document.body.append(video, otherVideo);
  const props = { video_url: 'https://cdn.example/first.mp4' };
  Object.assign(video, {
    __reactFiber$fixture: {
      memoizedProps: {},
      return: { memoizedProps: props },
    },
  });
  Object.assign(otherVideo, {
    __reactProps$fixture: { video_url: 'https://cdn.example/other.mp4' },
  });
  expect(requestSocialThumbnailMetadata(video)?.source).toBe(props.video_url);
  props.video_url = 'https://cdn.example/next.mp4';
  expect(requestSocialThumbnailMetadata(video)?.source).toBe(props.video_url);
  expect(video.hasAttribute('data-mfs-social-thumbnail-source')).toBe(false);
  uninstall();
  expect(requestSocialThumbnailMetadata(video)).toBeNull();
});

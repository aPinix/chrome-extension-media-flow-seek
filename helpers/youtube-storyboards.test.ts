// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=abc"}

import { afterEach, describe, expect, it } from 'vitest';

import {
  getYouTubeStoryboardFrame,
  installYouTubeStoryboardBridge,
  requestYouTubeStoryboardMetadata,
} from '@/helpers/youtube-storyboards';

const STORYBOARD_SPEC = [
  'https://i.ytimg.com/sb/abc/storyboard3_L$L/$N.jpg?sqp=test',
  '80#45#50#5#5#2000#M$M#sig0',
  '160#90#100#5#5#2000#M$M#sig1',
].join('|');

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/watch?v=abc');
});

describe('YouTube storyboard frame resolution', () => {
  it('chooses an adequate level and resolves its sprite cell', () => {
    const frame = getYouTubeStoryboardFrame(
      { spec: STORYBOARD_SPEC, videoId: 'abc' },
      52,
      120,
      1
    );

    expect(frame).toMatchObject({
      backgroundPosition: '25% 0%',
      backgroundSize: '500% 500%',
      frameIndex: 26,
      height: 90,
      width: 160,
    });
    expect(frame?.url).toBe(
      'https://i.ytimg.com/sb/abc/storyboard3_L1/M1.jpg?sqp=test&sigh=sig1'
    );
  });

  it('clamps to the final frame and rejects unsafe URLs', () => {
    const frame = getYouTubeStoryboardFrame(
      { spec: STORYBOARD_SPEC, videoId: 'abc' },
      9_999
    );

    expect(frame?.frameIndex).toBe(99);
    expect(
      getYouTubeStoryboardFrame(
        {
          spec: STORYBOARD_SPEC.replace('https:', 'http:'),
          videoId: 'abc',
        },
        10
      )
    ).toBeNull();
  });
});

describe('YouTube storyboard metadata bridge', () => {
  it('reads the current player response without exposing page globals', () => {
    const player = document.createElement('div') as HTMLDivElement & {
      getPlayerResponse: () => unknown;
    };
    player.id = 'movie_player';
    player.getPlayerResponse = () => ({
      storyboards: {
        playerStoryboardSpecRenderer: { spec: STORYBOARD_SPEC },
      },
      videoDetails: { videoId: 'abc' },
    });
    const video = document.createElement('video');
    player.appendChild(video);
    document.body.appendChild(player);
    const cleanup = installYouTubeStoryboardBridge(document);

    expect(requestYouTubeStoryboardMetadata(video)).toEqual({
      spec: STORYBOARD_SPEC,
      videoId: 'abc',
    });
    expect(video.hasAttribute('data-media-flow-seek-youtube-storyboard')).toBe(
      false
    );

    cleanup();
  });

  it('rejects stale metadata from the previous YouTube video', () => {
    const player = document.createElement('div') as HTMLDivElement & {
      getPlayerResponse: () => unknown;
    };
    player.id = 'movie_player';
    player.getPlayerResponse = () => ({
      storyboards: {
        playerStoryboardSpecRenderer: { spec: STORYBOARD_SPEC },
      },
      videoDetails: { videoId: 'old-video' },
    });
    const video = document.createElement('video');
    player.appendChild(video);
    document.body.appendChild(player);
    const cleanup = installYouTubeStoryboardBridge(document);

    expect(requestYouTubeStoryboardMetadata(video)).toBeNull();

    cleanup();
  });

  it('supports YouTube Shorts player responses', () => {
    window.history.replaceState({}, '', '/shorts/abc');
    const player = document.createElement('div') as HTMLDivElement & {
      getPlayerResponse: () => unknown;
    };
    player.id = 'shorts-player';
    player.getPlayerResponse = () => ({
      storyboards: {
        playerStoryboardSpecRenderer: { spec: STORYBOARD_SPEC },
      },
      videoDetails: { videoId: 'abc' },
    });
    const video = document.createElement('video');
    player.appendChild(video);
    document.body.appendChild(player);
    const cleanup = installYouTubeStoryboardBridge(document);

    expect(requestYouTubeStoryboardMetadata(video)?.videoId).toBe('abc');

    cleanup();
  });

  it('extracts a balanced inline response when more script follows it', () => {
    const script = document.createElement('script');
    script.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({
      storyboards: {
        playerStoryboardSpecRenderer: { spec: STORYBOARD_SPEC },
      },
      videoDetails: { videoId: 'abc' },
    })}; var anotherValue = { nested: true };`;
    document.head.appendChild(script);
    const video = document.createElement('video');
    document.body.appendChild(video);

    expect(requestYouTubeStoryboardMetadata(video)).toEqual({
      spec: STORYBOARD_SPEC,
      videoId: 'abc',
    });

    script.remove();
  });
});

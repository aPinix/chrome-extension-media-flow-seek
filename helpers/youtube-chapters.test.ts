// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  extractYouTubeChapterModel,
  getYouTubeVideoId,
  isYouTubeChapterPage,
  parseYouTubeTimestamp,
} from '@/helpers/youtube-chapters';

const createVideo = (duration = 100): HTMLVideoElement => {
  const player = document.createElement('div');
  player.id = 'movie_player';
  player.className = 'html5-video-player';
  const video = document.createElement('video');
  Object.defineProperty(video, 'duration', {
    configurable: true,
    value: duration,
  });
  player.appendChild(video);
  document.body.appendChild(player);
  return video;
};

const addMarker = (title: string, time: string, href: string): void => {
  const marker = document.createElement('ytd-macro-markers-list-item-renderer');
  marker.innerHTML = `
    <a id="endpoint" href="${href}">
      <h3 title="${title}">${title}</h3>
      <div id="time">${time}</div>
    </a>
  `;
  document.body.appendChild(marker);
};

const addNativeSegments = (...widths: number[]): void => {
  const container = document.createElement('div');
  container.className = 'ytp-chapters-container';
  for (const width of widths) {
    const segment = document.createElement('div');
    segment.className = 'ytp-chapter-hover-container';
    segment.style.width = `${width}px`;
    container.appendChild(segment);
  }
  document.querySelector('#movie_player')?.appendChild(container);
};

const addModernNativeSegments = (...widths: number[]): void => {
  const container = document.createElement('yt-chaptered-progress-bar-line');
  for (const width of widths) {
    const segment = document.createElement('div');
    segment.className = 'ytChapteredProgressBarChapteredPlayerBarChapter';
    segment.style.width = `${width}%`;
    container.appendChild(segment);
  }
  document.querySelector('#movie_player')?.appendChild(container);
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('YouTube chapter page detection', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'abc'],
    ['https://m.youtube.com/watch?v=abc', 'abc'],
    ['https://www.youtube.com/embed/abc', 'abc'],
    ['https://www.youtube-nocookie.com/embed/abc', 'abc'],
  ])('extracts the video id from %s', (url, expected) => {
    expect(getYouTubeVideoId(url)).toBe(expected);
    expect(isYouTubeChapterPage(url)).toBe(true);
  });

  it.each([
    'https://www.youtube.com/',
    'https://www.youtube.com/shorts/abc',
    'https://example.com/watch?v=abc',
    'not a URL',
  ])('rejects unsupported page %s', (url) => {
    expect(getYouTubeVideoId(url)).toBeNull();
    expect(isYouTubeChapterPage(url)).toBe(false);
  });
});

describe('parseYouTubeTimestamp', () => {
  it.each([
    ['13', 13],
    ['13s', 13],
    ['1m8s', 68],
    ['1:08', 68],
    ['1:02:03', 3723],
  ])('parses %s', (value, expected) => {
    expect(parseYouTubeTimestamp(value)).toBe(expected);
  });

  it.each(['', 'soon', '1:two'])('rejects %s', (value) => {
    expect(parseYouTubeTimestamp(value)).toBeNull();
  });
});

describe('extractYouTubeChapterModel', () => {
  it('deduplicates current-video markers and builds chapter ranges', () => {
    const video = createVideo(100);
    addMarker('Intro', '0:00', '/watch?v=abc');
    addMarker('Middle', '0:20', '/watch?v=abc&t=20s');
    addMarker('Middle', '0:20', '/watch?v=abc&t=20s');
    addMarker('End', '1:00', '/watch?v=abc&t=1m');
    addMarker('Other video', '0:10', '/watch?v=other&t=10s');

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video,
      })
    ).toEqual({
      chapters: [
        { end: 20, start: 0, title: 'Intro' },
        { end: 60, start: 20, title: 'Middle' },
        { end: 100, start: 60, title: 'End' },
      ],
      source: 'markers',
    });
  });

  it('rejects stale marker data that extends beyond the current media', () => {
    const video = createVideo(30);
    addMarker('Intro', '0:00', '/watch?v=abc');
    addMarker('Old chapter', '1:00', '/watch?v=abc&t=60s');

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video,
      })
    ).toBeNull();
  });

  it('does not use stale SPA markers or segments from the previous video', () => {
    const video = createVideo(100);
    addMarker('Old intro', '0:00', '/watch?v=old');
    addMarker('Old chapter', '0:20', '/watch?v=old&t=20s');
    addNativeSegments(50, 50);

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=current',
        video,
      })
    ).toBeNull();
  });

  it('falls back to proportional native segments without titles', () => {
    const video = createVideo(100);
    addNativeSegments(20, 30, 50);

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/embed/abc',
        video,
      })
    ).toEqual({
      chapters: [
        { end: 20, start: 0 },
        { end: 50, start: 20 },
        { end: 100, start: 50 },
      ],
      source: 'segments',
    });
  });

  it('reads chapter geometry from YouTube’s modern embedded player', () => {
    const video = createVideo(200);
    addModernNativeSegments(10, 30, 60);

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/embed/abc?enablejsapi=1',
        video,
      })
    ).toEqual({
      chapters: [
        { end: 20, start: 0 },
        { end: 80, start: 20 },
        { end: 200, start: 80 },
      ],
      source: 'segments',
    });
  });

  it('detects embedded chapters without relying on YouTube class names', () => {
    const video = createVideo(200);
    video.parentElement?.removeAttribute('id');
    video.parentElement?.removeAttribute('class');
    const slider = document.createElement('div');
    slider.className = 'generated-player-control-name';
    slider.setAttribute('aria-valuemax', '100');
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('role', 'slider');
    const chapterLine = document.createElement('section');
    chapterLine.className = 'generated-chapter-host-name';

    for (const width of [10, 30, 60]) {
      const segment = document.createElement('span');
      segment.className = 'generated-segment-name';
      segment.style.width = `${width}%`;
      chapterLine.appendChild(segment);
    }

    slider.appendChild(chapterLine);
    video.parentElement?.appendChild(slider);

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/embed/abc?enablejsapi=1',
        video,
      })
    ).toEqual({
      chapters: [
        { end: 20, start: 0 },
        { end: 80, start: 20 },
        { end: 200, start: 80 },
      ],
      source: 'segments',
    });
  });

  it('returns no model for a single segment, infinite media, or no player', () => {
    const video = createVideo(100);
    addNativeSegments(100);
    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video,
      })
    ).toBeNull();

    Object.defineProperty(video, 'duration', {
      value: Number.POSITIVE_INFINITY,
    });
    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video,
      })
    ).toBeNull();

    const detachedVideo = document.createElement('video');
    Object.defineProperty(detachedVideo, 'duration', { value: 100 });
    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video: detachedVideo,
      })
    ).toBeNull();
  });

  it('returns no model while the primary YouTube player is showing an ad', () => {
    const video = createVideo(100);
    addMarker('Intro', '0:00', '/watch?v=abc');
    addMarker('Chapter', '0:20', '/watch?v=abc&t=20s');
    document.querySelector('#movie_player')?.classList.add('ad-showing');

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/watch?v=abc',
        video,
      })
    ).toBeNull();
  });

  it('ignores non-primary videos inside the player', () => {
    const primaryVideo = createVideo(100);
    primaryVideo.className = 'html5-main-video';
    const secondaryVideo = document.createElement('video');
    Object.defineProperty(secondaryVideo, 'duration', { value: 100 });
    primaryVideo.parentElement?.appendChild(secondaryVideo);
    addNativeSegments(50, 50);

    expect(
      extractYouTubeChapterModel({
        ownerDocument: document,
        pageUrl: 'https://www.youtube.com/embed/abc',
        video: secondaryVideo,
      })
    ).toBeNull();
  });
});

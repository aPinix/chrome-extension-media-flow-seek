// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  mediaIdentity,
  mergeLibraries,
  parseLibrary,
  type SavedMoment,
} from './saved-media';

const item: SavedMoment = {
  id: 'one',
  mediaKey: 'youtube:abc',
  url: 'https://www.youtube.com/watch?v=abc',
  title: 'Lesson',
  name: 'Intro',
  start: 10,
  end: 20,
  createdAt: 123,
};
describe('saved media library', () => {
  it('uses the same YouTube identity across watch and embed pages', () => {
    const video = document.createElement('video');
    expect(
      mediaIdentity(video, 'https://www.youtube.com/watch?v=abc&t=10').key
    ).toBe('youtube:abc');
    expect(mediaIdentity(video, 'https://www.youtube.com/embed/abc').key).toBe(
      'youtube:abc'
    );
  });
  it('keeps blob and signed feed sources session-only', () => {
    const video = document.createElement('video');
    video.src = 'blob:https://example.com/abc';
    expect(mediaIdentity(video, 'https://example.com/feed').persistent).toBe(
      false
    );
    video.src = 'https://example.com/video.mp4?token=secret';
    expect(mediaIdentity(video, 'https://example.com/feed').persistent).toBe(
      false
    );
    video.src = 'https://example.com/video.mp4';
    expect(mediaIdentity(video, 'https://example.com/watch')).toEqual({
      key: 'media:https://example.com/video.mp4',
      persistent: true,
    });
  });
  it('rejects malformed, unsafe, mismatched and future-version imports', () => {
    for (const value of [
      { version: 2, items: [] },
      { version: 1, items: [{ ...item, url: 'javascript:alert(1)' }] },
      { version: 1, items: [{ ...item, start: -1 }] },
      { version: 1, items: [{ ...item, end: 5 }] },
      { version: 1, items: [{ ...item, mediaKey: 'youtube:other' }] },
    ])
      expect(() => parseLibrary(value)).toThrow();
  });
  it('keeps existing edits when importing duplicate IDs and adds new items', () => {
    const library = mergeLibraries(
      { version: 1, items: [item] },
      {
        version: 1,
        items: [
          { ...item, name: 'Old name' },
          { ...item, id: 'two' },
        ],
      }
    );
    expect(library.items).toHaveLength(2);
    expect(library.items[0]?.name).toBe('Intro');
    expect(
      parseLibrary({ version: 1, items: [item, item] }).items
    ).toHaveLength(1);
  });
});

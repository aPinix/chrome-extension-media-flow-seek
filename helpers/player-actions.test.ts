// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  boostVideo,
  canBoostVideo,
  moveLoop,
  normalizeLoop,
  remainingSeconds,
  screenshotVideo,
  skipVideo,
} from './player-actions';
import { normalizePlayerTools, shortcutMatches } from './player-tools-settings';

describe('player actions', () => {
  it('clamps skip intervals to video boundaries', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', { value: 100 });
    video.currentTime = 98;
    skipVideo(video, 30);
    expect(video.currentTime).toBe(100);
    skipVideo(video, -200);
    expect(video.currentTime).toBe(0);
  });
  it('reports real viewing time and excludes live or invalid durations', () => {
    expect(remainingSeconds(120, 30, 1.5)).toBe(60);
    expect(remainingSeconds(120, 130, 2)).toBe(0);
    expect(remainingSeconds(Infinity, 30, 1)).toBeNull();
    expect(remainingSeconds(120, 30, 0)).toBeNull();
  });
  it('normalizes reversed loop selections and rejects empty/live ranges', () => {
    expect(normalizeLoop(30, 10, 100)).toEqual({ start: 10, end: 30 });
    expect(normalizeLoop(-10, 110, 100)).toEqual({ start: 0, end: 100 });
    expect(normalizeLoop(10, 10, 100)).toBeNull();
    expect(normalizeLoop(10, 20, Infinity)).toBeNull();
  });
  it('moves the entire loop without changing length at either boundary', () => {
    expect(moveLoop({ start: 20, end: 40 }, -50, 100)).toEqual({
      start: 0,
      end: 20,
    });
    expect(moveLoop({ start: 20, end: 40 }, 100, 100)).toEqual({
      start: 80,
      end: 100,
    });
  });
  it('migrates missing preferences conservatively and normalizes invalid values', () => {
    expect(normalizePlayerTools({ backward: 3.5 })).toMatchObject({
      backward: 5,
      forward: 5,
    });
    expect(normalizePlayerTools({ backward: 3, forward: 10 })).toMatchObject({
      backward: 3,
      forward: 3,
    });
    expect(normalizePlayerTools(undefined)).toMatchObject({
      backward: 5,
      forward: 5,
      youtubeSpeed: 1,
      miniPlayer: false,
      autoChapters: false,
      hideCards: false,
    });
    expect(
      normalizePlayerTools({
        backward: NaN,
        forward: -5,
        youtubeSpeed: 7,
        dimming: 200,
      })
    ).toMatchObject({
      backward: 5,
      forward: 5,
      youtubeSpeed: 4,
      dimming: 100,
    });
  });
  it('requires an exact shortcut modifier match', () => {
    expect(
      shortcutMatches(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }),
        'alt+arrowleft'
      )
    ).toBe(true);
    expect(
      shortcutMatches(
        new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          shiftKey: true,
        }),
        'alt+arrowleft'
      )
    ).toBe(false);
    expect(
      shortcutMatches(
        new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          repeat: true,
        }),
        'alt+arrowleft'
      )
    ).toBe(false);
  });
  it('does not create an audio source when a frame is origin-tainted', async () => {
    const video = document.createElement('video');
    Object.defineProperties(video, {
      readyState: { value: 4 },
      videoWidth: { value: 640 },
    });
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: () => {},
        getImageData: () => {
          throw new DOMException('Tainted', 'SecurityError');
        },
      } as unknown as CanvasRenderingContext2D);
    const audio = vi.fn();
    vi.stubGlobal('AudioContext', audio);
    expect(canBoostVideo(video)).toBe(false);
    await expect(boostVideo(video, 200)).rejects.toThrow(
      'Normal volume is unchanged'
    );
    expect(audio).not.toHaveBeenCalled();
    expect(video.volume).toBe(1);
    context.mockRestore();
    vi.unstubAllGlobals();
  });
  it('reports screenshots as unavailable before decoded frames exist', async () => {
    await expect(
      screenshotVideo(document.createElement('video'))
    ).rejects.toThrow('unavailable');
  });
});

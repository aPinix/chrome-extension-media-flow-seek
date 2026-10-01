import { expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_TOOLS,
  normalizePlayerTools,
} from './player-tools-settings';
it('enables Boost Volume and Loop Sections by default without starting automatic boost', () => {
  for (const settings of [
    DEFAULT_PLAYER_TOOLS,
    normalizePlayerTools(undefined),
    normalizePlayerTools({ dimming: 65 }),
  ]) {
    expect(settings.youtubeBoostEnabled).toBe(true);
    expect(settings.youtubeLoop).toBe(true);
    expect(settings.youtubeAutoBoost).toBe(false);
    expect(settings.miniPlayer).toBe(true);
    expect(settings.youtubeScreenshotEnabled).toBe(true);
    expect(settings.youtubeFiltersEnabled).toBe(true);
    expect(settings.youtubeScreenshotIncludeFilters).toBe(false);
  }
});

it('preserves saved button choices and dimming', () => {
  const settings = normalizePlayerTools({
    youtubeBoostEnabled: false,
    youtubeLoop: false,
    dimming: 65,
    hideEndScreens: true,
    miniPlayer: false,
    youtubeScreenshotEnabled: false,
    youtubeFiltersEnabled: false,
    youtubeScreenshotIncludeFilters: true,
  });
  expect(settings.youtubeBoostEnabled).toBe(false);
  expect(settings.youtubeLoop).toBe(false);
  expect(settings.dimming).toBe(65);
  expect(settings.hideEndScreens).toBe(true);
  expect(settings.miniPlayer).toBe(false);
  expect(settings.youtubeScreenshotEnabled).toBe(false);
  expect(settings.youtubeFiltersEnabled).toBe(false);
  expect(settings.youtubeScreenshotIncludeFilters).toBe(true);
});

it('defaults the Cinema color to black, preserves valid saved colors and rejects invalid values', () => {
  expect(normalizePlayerTools(undefined).cinemaColor).toBe('#000000');
  expect(
    normalizePlayerTools({ cinemaColor: '#ABCDEF', dimming: 65 }).cinemaColor
  ).toBe('#abcdef');
  for (const cinemaColor of ['red', '#fff', 'url(example.com)', null, 42])
    expect(normalizePlayerTools({ cinemaColor }).cinemaColor).toBe('#000000');
});

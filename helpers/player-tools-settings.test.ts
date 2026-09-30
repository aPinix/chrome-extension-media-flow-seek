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
  }
});

it('preserves saved button choices and dimming', () => {
  const settings = normalizePlayerTools({
    youtubeBoostEnabled: false,
    youtubeLoop: false,
    dimming: 65,
    hideEndScreens: true,
    miniPlayer: false,
  });
  expect(settings.youtubeBoostEnabled).toBe(false);
  expect(settings.youtubeLoop).toBe(false);
  expect(settings.dimming).toBe(65);
  expect(settings.hideEndScreens).toBe(true);
  expect(settings.miniPlayer).toBe(false);
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MINI_PLAYER_GEOMETRY,
  normalizeMiniPlayerGeometry,
} from './mini-player-settings';
import { clampMiniGeometry } from './player-floating';

describe('mini player geometry', () => {
  it('falls back to defaults for missing or invalid saved geometry', () => {
    for (const geometry of [
      undefined,
      null,
      {},
      { x: NaN, y: 72, width: 360 },
      { x: 16, y: 72, width: -1 },
    ]) {
      expect(normalizeMiniPlayerGeometry(geometry)).toEqual(
        DEFAULT_MINI_PLAYER_GEOMETRY
      );
    }
  });
  it('restores off-screen saved positions within the current viewport', () => {
    const geometry = clampMiniGeometry(
      { x: 2000, y: 1500, width: 400 },
      1000,
      700,
      16 / 9
    );
    expect(geometry.x + geometry.width).toBeLessThanOrEqual(992);
    expect(geometry.y + geometry.width / (16 / 9)).toBeLessThanOrEqual(692);
  });
  it('shrinks oversized players in a small viewport while preserving aspect ratio', () => {
    const geometry = clampMiniGeometry(
      { x: -1, y: -1, width: 1200 },
      320,
      400,
      16 / 9
    );
    expect(geometry.width).toBeLessThanOrEqual(304);
    expect(geometry.x).toBe(8);
    expect(geometry.y).toBe(72);
  });
});

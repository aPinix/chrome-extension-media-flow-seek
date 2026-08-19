import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROGRESS_COLOR,
  getPredominantColorFromPixels,
  getRelativeLuminance,
} from '@/helpers/favicon-color';

const pixels = (
  colors: Array<[red: number, green: number, blue: number, alpha?: number]>
): Uint8ClampedArray =>
  new Uint8ClampedArray(
    colors.flatMap(([red, green, blue, alpha = 255]) => [
      red,
      green,
      blue,
      alpha,
    ])
  );

describe('favicon progress colors', () => {
  it('uses the predominant opaque favicon color', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [242, 65, 70],
          [245, 68, 73],
          [241, 63, 69],
          [50, 140, 240],
        ])
      )
    ).toBe('rgb(243, 65, 71)');
  });

  it('ignores transparent favicon padding', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [0, 0, 0, 0],
          [0, 0, 0, 20],
          [34, 197, 94],
          [34, 197, 94],
        ])
      )
    ).toBe('rgb(34, 197, 94)');
  });

  it('falls back to white-ish when the predominant color is too dark', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [18, 24, 32],
          [20, 26, 34],
          [22, 28, 36],
        ])
      )
    ).toBe(DEFAULT_PROGRESS_COLOR);
  });

  it('skips a dark predominant color and uses the next visible accent', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [9, 26, 61],
          [9, 26, 61],
          [9, 26, 61],
          [9, 26, 61],
          [21, 109, 159],
          [21, 109, 159],
        ])
      )
    ).toBe('rgb(21, 109, 159)');
  });

  it('groups a gradient into its predominant colorful hue', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [255, 226, 254],
          [255, 226, 254],
          [255, 226, 254],
          [255, 226, 254],
          [255, 226, 254],
          [255, 226, 254],
          [254, 195, 2],
          [254, 195, 2],
          [254, 195, 2],
          [251, 3, 105],
          [227, 4, 194],
          [249, 36, 125],
          [227, 30, 131],
        ])
      )
    ).toBe('rgb(239, 18, 139)');
  });

  it('falls back when the favicon has no opaque pixels', () => {
    expect(
      getPredominantColorFromPixels(
        pixels([
          [255, 0, 0, 0],
          [0, 255, 0, 100],
        ])
      )
    ).toBe(DEFAULT_PROGRESS_COLOR);
  });

  it('calculates luminance on the sRGB curve', () => {
    expect(getRelativeLuminance({ red: 0, green: 0, blue: 0 })).toBe(0);
    expect(getRelativeLuminance({ red: 255, green: 255, blue: 255 })).toBe(1);
  });
});

import { expect, it } from 'vitest';
import {
  fitPipRect,
  interpolatePipRect,
  limitPipDrag,
  pipDisplayForRect,
  pipEaseOutProgress,
  pipFlickCorner,
} from './pip-window-geometry';

const bounds = { left: 0, top: 0, width: 1920, height: 1080 };
const macWorkArea = { left: 0, top: 25, width: 1920, height: 995 };
const rect = { left: 100, top: 100, width: 360, height: 237 };
it('leaves 10px beyond the macOS menu bar and Dock', () => {
  expect(
    fitPipRect({ ...rect, left: -30, top: -40 }, macWorkArea, 16 / 9, 0, 34)
  ).toEqual({ ...rect, left: 10, top: 35 });
  expect(
    fitPipRect({ ...rect, left: 1900, top: 1100 }, macWorkArea, 16 / 9, 0, 34)
  ).toEqual({ ...rect, left: 1550, top: 773 });
});
it.each([
  { left: 0, top: 0, width: 1920, height: 1032 },
  { left: 48, top: 0, width: 1872, height: 1080 },
])('accounts for a Windows taskbar on the bottom or side: %j', (workArea) => {
  const result = fitPipRect(
    { ...rect, left: -100, top: 1100 },
    workArea,
    16 / 9,
    0,
    34
  );
  expect(result.left).toBe(workArea.left + 10);
  expect(result.top + result.height).toBe(workArea.top + workArea.height - 10);
});
it('preserves video aspect ratio and shrinks oversized windows to the usable area', () => {
  const result = fitPipRect(
    { ...rect, width: 3000, height: 2000 },
    macWorkArea,
    9 / 16,
    0,
    34
  );
  expect(Math.abs(result.width / (result.height - 34) - 9 / 16)).toBeLessThan(
    0.001
  );
  expect(result.height).toBeLessThanOrEqual(macWorkArea.height - 20);
  expect(result.top).toBe(35);
});
it('selects a monitor with negative coordinates or the nearest remaining monitor', () => {
  const secondary = {
    bounds: { ...bounds, left: -1920 },
    workArea: { ...macWorkArea, left: -1920 },
  };
  const primary = { bounds, workArea: macWorkArea };
  expect(
    pipDisplayForRect({ ...rect, left: -1200 }, [primary, secondary])
  ).toBe(secondary);
  expect(pipDisplayForRect({ ...rect, left: -1200 }, [primary])).toBe(primary);
});
it('keeps most of the window visible while dragging beyond a display edge', () => {
  expect(limitPipDrag({ ...rect, left: -10000, top: 10000 }, bounds)).toEqual({
    ...rect,
    left: -90,
    top: 902,
  });
});
it.each([
  [-2, -2, 10, 35],
  [2, -2, 1550, 35],
  [-2, 2, 10, 773],
  [2, 2, 1550, 773],
])('flick (%s, %s) lands in its directional corner', (vx, vy, left, top) => {
  expect(pipFlickCorner(rect, macWorkArea, vx, vy)).toEqual({
    ...rect,
    left,
    top,
  });
});
it('a horizontal flick uses the nearer vertical corner', () => {
  expect(pipFlickCorner(rect, macWorkArea, 2, 0)).toEqual({
    ...rect,
    left: 1550,
    top: 35,
  });
});
it('eases out monotonically and lands exactly without overshooting or changing size', () => {
  expect(pipEaseOutProgress(0)).toBe(0);
  expect(pipEaseOutProgress(160)).toBe(0.875);
  expect(pipEaseOutProgress(320)).toBe(1);
  expect(pipEaseOutProgress(650)).toBe(1);
  expect(interpolatePipRect(rect, { ...rect, left: 1550 }, 1)).toEqual({
    ...rect,
    left: 1550,
  });
});

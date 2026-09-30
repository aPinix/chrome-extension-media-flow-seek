// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CinemaBackdrop } from './player-cinema';
import { TOOLS_STYLES } from './player-tools-ui';

let video: HTMLVideoElement;
let root: ShadowRoot;
let backdrop: CinemaBackdrop;
const dismiss = vi.fn();
const rect = new DOMRect(20, 40, 640, 360);
beforeEach(() => {
  vi.useFakeTimers();
  dismiss.mockReset();
  document.body.innerHTML =
    '<div id="player" style="overflow:hidden"><video></video></div><div id="tools"></div>';
  video = document.querySelector('video') as HTMLVideoElement;
  video.getBoundingClientRect = () => rect;
  root = (document.querySelector('#tools') as HTMLElement).attachShadow({
    mode: 'open',
  });
  backdrop = new CinemaBackdrop(video, root, dismiss);
});
afterEach(() => {
  backdrop.cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('covers the clipped corner areas while leaving the real video unchanged', () => {
  const player = video.parentElement as HTMLElement;
  player.style.borderTopLeftRadius = '12px';
  player.style.borderTopRightRadius = '12px';
  player.style.borderBottomLeftRadius = '12px';
  player.style.borderBottomRightRadius = '12px';
  player.getBoundingClientRect = () => rect;
  const original = player.innerHTML;
  backdrop.update(true, rect, 0.8, '#000000');
  const path = root.querySelector('path');
  expect(path?.getAttribute('fill-rule')).toBe('evenodd');
  expect(path?.getAttribute('d')).toContain('M32 40H648A12 12 0 0 1 660 52');
  expect(path?.getAttribute('d')).toContain('A12 12 0 0 1 32 40Z');
  expect(player.innerHTML).toBe(original);
  expect(root.querySelectorAll('.shade')).toHaveLength(1);
  path?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(dismiss).toHaveBeenCalledOnce();
});
it('fades out without intercepting clicks and cancels removal if reactivated', async () => {
  backdrop.update(true, rect, 0.8, '#000000');
  const shade = root.querySelector('.shade') as SVGSVGElement;
  backdrop.update(false, rect, 0.8, '#000000');
  expect(shade.style.opacity).toBe('0');
  expect(shade.querySelector('path')?.getAttribute('pointer-events')).toBe(
    'none'
  );
  await vi.advanceTimersByTimeAsync(120);
  backdrop.update(true, rect, 0.65, '#172554');
  await vi.advanceTimersByTimeAsync(240);
  expect(root.querySelector('.shade')).toBe(shade);
  expect(shade.style.opacity).toBe('0.65');
  expect(shade.querySelector('path')?.getAttribute('fill')).toBe('#172554');
  backdrop.update(false, rect, 0.65, '#172554');
  await vi.advanceTimersByTimeAsync(240);
  expect(root.querySelector('.shade')).toBeNull();
  expect(TOOLS_STYLES).toContain('transition:opacity 240ms ease');
  expect(TOOLS_STYLES).toContain('prefers-reduced-motion:reduce');
});
it('tracks video movement and viewport changes and clamps percentage corner radii', () => {
  video.style.borderTopLeftRadius = '100%';
  backdrop.update(true, rect, 0.8, '#000000');
  expect(root.querySelector('path')?.getAttribute('d')).toContain('M340 40');
  const moved = new DOMRect(100, -20, 320, 180);
  backdrop.update(true, moved, 0.8, '#000000');
  expect(root.querySelector('path')?.getAttribute('d')).toContain('M260 -20');
  expect(root.querySelector('svg')?.getAttribute('viewBox')).toBe(
    `0 0 ${window.innerWidth} ${window.innerHeight}`
  );
});
it('removes immediately during shutdown, including a pending fade', async () => {
  backdrop.update(true, rect, 0.8, '#000000');
  backdrop.update(false, rect, 0.8, '#000000');
  backdrop.cleanup();
  expect(root.querySelector('.shade')).toBeNull();
  await vi.advanceTimersByTimeAsync(300);
  expect(root.querySelector('.shade')).toBeNull();
});

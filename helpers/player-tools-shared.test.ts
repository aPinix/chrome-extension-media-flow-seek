// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { PlayerTools } from './player-tools';

it('never exposes Loop on other websites even when the YouTube preference is enabled', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', {
    storage: {
      sync: { get: async () => ({ playerTools: { youtubeLoop: true } }) },
      local: { get: async () => ({}) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      sendMessage: async () => ({ library: { version: 1, items: [] } }),
    },
  });
  document.body.innerHTML =
    '<div id="movie_player"><video></video><div id="timeline"></div><div class="ytp-right-controls"></div></div>';
  const video = document.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', { value: 100 });
  const tools = new PlayerTools(
    video,
    document.querySelector('#timeline') as HTMLElement
  );
  try {
    await vi.advanceTimersByTimeAsync(350);
    const root = document.querySelector('.mfs-player-tools')?.shadowRoot;
    if (!root) throw new Error('Missing player tools');
    expect(document.querySelector('.mfs-loop-button')).toBeNull();
    expect(
      root.querySelector('[aria-label="Video tools"].panel')?.textContent
    ).not.toContain('loop');
    expect((root.querySelector('[role="dialog"]') as HTMLElement).hidden).toBe(
      true
    );
    const edit = [...(root.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Edit loop'
    );
    expect(edit?.disabled).toBe(true);
  } finally {
    tools.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  }
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=test-video"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerTools } from './player-tools';
import { DEFAULT_PLAYER_TOOLS } from './player-tools-settings';

let tools: PlayerTools | undefined;
let video: HTMLVideoElement;
let root: ShadowRoot;
const send = vi.fn();
const changed = { addListener: vi.fn(), removeListener: vi.fn() };
const findButton = (text: string) => {
  const button = [...root.querySelectorAll('button')].find(
    (node) => node.textContent === text
  );
  if (!button) throw new Error(`Button missing: ${text}`);
  return button;
};
const inputFor = (text: string) => {
  const label = [...root.querySelectorAll('label')].find(
    (node) => node.textContent === text
  );
  const input = label?.querySelector('input');
  if (!input) throw new Error(`Input missing: ${text}`);
  return input;
};
beforeEach(async () => {
  vi.useFakeTimers();
  send.mockImplementation(async ({ command }) =>
    command.op === 'list' ? { library: { version: 1, items: [] } } : {}
  );
  vi.stubGlobal('chrome', {
    storage: {
      sync: {
        get: vi.fn(async () => ({
          playerTools: {
            ...DEFAULT_PLAYER_TOOLS,
            backward: 10,
            forward: 10,
            youtubeLoop: true,
            rememberYoutubeLoops: true,
          },
        })),
        set: vi.fn(async () => {}),
      },
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      onChanged: changed,
    },
    runtime: { sendMessage: send },
  });
  document.body.innerHTML =
    '<div id="movie_player"><video class="html5-main-video" src="https://example.com/lesson.mp4"></video><div id="timeline"></div><div class="ytp-right-controls"><button class="ytp-autonav-toggle"></button><button class="ytp-subtitles-button"></button></div></div>';
  video = document.querySelector('video') as HTMLVideoElement;
  Object.defineProperties(video, {
    duration: { value: 100, configurable: true },
    readyState: { value: 4 },
    paused: { value: true, configurable: true },
  });
  video.currentTime = 25;
  video.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 360,
    width: 640,
    height: 360,
    toJSON() {},
  });
  const timeline = document.querySelector('#timeline') as HTMLElement;
  timeline.getBoundingClientRect = () => ({
    x: 0,
    y: 350,
    top: 350,
    left: 0,
    right: 640,
    bottom: 360,
    width: 640,
    height: 10,
    toJSON() {},
  });
  tools = new PlayerTools(video, timeline);
  root = (document.querySelector('.mfs-player-tools') as HTMLElement)
    .shadowRoot as ShadowRoot;
  await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => {
  tools?.cleanup();
  tools = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('player tools integration', () => {
  it('opens Loop from the native control container and removes it when disabled', async () => {
    const native = document.querySelector(
      '.mfs-loop-button'
    ) as HTMLButtonElement;
    expect(native).not.toBeNull();
    expect(native.parentElement?.nextElementSibling?.className).toBe(
      'ytp-autonav-toggle'
    );
    expect(
      root.querySelector('[aria-label="Video tools"].panel')?.textContent
    ).not.toContain('Edit loop');
    native.click();
    expect((root.querySelector('[role="dialog"]') as HTMLElement).hidden).toBe(
      true
    );
    expect(document.querySelector('#timeline')?.getAttribute('data-mfs-loop-editing')).toBe('true');
    expect(document.querySelector('.mfs-loop-tooltip')?.textContent).toBe('Loop Sections');
    findButton('Enable loop').click();
    const storage = changed.addListener.mock.calls.at(-1)?.[0];
    storage(
      {
        playerTools: {
          newValue: { ...DEFAULT_PLAYER_TOOLS, youtubeLoop: false },
        },
      },
      'sync'
    );
    expect(document.querySelector('.mfs-youtube-buttons')).toBeNull();
    expect(
      root.querySelector('[role="dialog"]')?.getAttribute('aria-hidden')
    ).toBe('true');
    expect(findButton('Enable loop').disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    expect(document.querySelector('.mfs-youtube-buttons')).toBeNull();
  });
  it('separates playback from editing and retains collapsed sections', async () => {
    const native = document.querySelector('.mfs-loop-button') as HTMLButtonElement;
    native.click();
    expect(document.querySelector('#timeline')?.getAttribute('data-mfs-loop-editing')).toBe('true');
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    track.getBoundingClientRect = video.getBoundingClientRect;
    for (const [type, x] of [['pointerdown', 64], ['pointermove', 192], ['pointerup', 192]] as const) {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      track.dispatchEvent(event);
    }
    expect(native.getAttribute('aria-pressed')).toBe('true');
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(track.classList.contains('editing')).toBe(true);
    (track.querySelector('.close-loop-editor') as HTMLButtonElement).click();
    expect(track.classList.contains('editing')).toBe(false);
    expect(track.hidden).toBe(false);
    video.currentTime = 20;
    (track.querySelector('.range') as HTMLElement).click();
    expect(video.currentTime).toBe(10);
    expect(native.getAttribute('aria-pressed')).toBe('true');
    native.click();
    expect(native.getAttribute('aria-pressed')).toBe('false');
    expect(track.dataset.loopEnabled).toBe('false');
    (document.querySelector('.mfs-loop-edit-button') as HTMLButtonElement).click();
    expect(track.classList.contains('editing')).toBe(true);
    expect(native.getAttribute('aria-pressed')).toBe('false');
    (track.querySelector('.close-loop-editor') as HTMLButtonElement).click();
    native.click();
    expect(native.getAttribute('aria-pressed')).toBe('true');
    expect(track.classList.contains('editing')).toBe(false);
    (document.querySelector('.mfs-loop-edit-button') as HTMLButtonElement).click();
    (track.querySelector('.clear-loop-sections') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(track.classList.contains('editing')).toBe(true);
    expect((track.querySelector('.range') as HTMLElement).hidden).toBe(true);
    expect(track.querySelectorAll('.saved-range')).toHaveLength(0);
    expect(native.getAttribute('aria-pressed')).toBe('false');
    (track.querySelector('.undo-loop-sections') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect((track.querySelector('.range') as HTMLElement).hidden).toBe(false);
    expect(inputFor('A (seconds)').value).toBe('10.0');
    (track.querySelector('.redo-loop-sections') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect((track.querySelector('.range') as HTMLElement).hidden).toBe(true);
  });
  it('shows Close until edited and discards changes back to the opening sections', async () => {
    (document.querySelector('.mfs-loop-button') as HTMLButtonElement).click();
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    const done = track.querySelector('.close-loop-editor') as HTMLButtonElement;
    const discard = track.querySelector('.discard-loop-edits') as HTMLButtonElement;
    expect(done.textContent).toBe('Close');
    expect(discard.disabled).toBe(true);
    findButton('Enable loop').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(done.textContent).toBe('✓ Done editing');
    expect(discard.disabled).toBe(false);
    discard.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(track.classList.contains('editing')).toBe(false);
    expect((track.querySelector('.range') as HTMLElement).hidden).toBe(true);
    expect(send.mock.calls.some(([message]) => message.command.op === 'delete')).toBe(true);
  });
  it('places configured volume boost before Loop and supports boost without Loop', () => {
    const storage = changed.addListener.mock.calls.at(-1)?.[0];
    storage({ playerTools: { newValue: { ...DEFAULT_PLAYER_TOOLS, youtubeLoop: true, youtubeBoostEnabled: true, youtubeBoost: 4 } } }, 'sync');
    const boost = document.querySelector('.mfs-youtube-boost') as HTMLElement;
    expect(boost.nextElementSibling?.className).toBe('mfs-youtube-buttons');
    expect(boost.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
    expect(boost.textContent).toContain('4×');
    expect(root.textContent).not.toContain('Extra volume (%)');
    storage({ playerTools: { newValue: { ...DEFAULT_PLAYER_TOOLS, youtubeLoop: false, youtubeBoostEnabled: true, youtubeBoost: 10 } } }, 'sync');
    expect(document.querySelector('.mfs-youtube-buttons')).toBeNull();
    expect(document.querySelector('.mfs-youtube-boost')?.textContent).toContain('10×');
    storage({ playerTools: { newValue: DEFAULT_PLAYER_TOOLS } }, 'sync');
    expect(document.querySelector('.mfs-youtube-boost')).toBeNull();
  });
  it('reattaches a single button container after YouTube replaces its controls', async () => {
    const controls = document.querySelector(
      '.ytp-right-controls'
    ) as HTMLElement;
    controls.innerHTML = '<button class="ytp-subtitles-button"></button>';
    await vi.advanceTimersByTimeAsync(350);
    expect(controls.querySelectorAll('.mfs-youtube-buttons')).toHaveLength(1);
    expect(controls.firstElementChild?.className).toBe('mfs-youtube-buttons');
    tools?.cleanup();
    expect(controls.querySelector('.mfs-youtube-buttons')).toBeNull();
  });
  it('prevents a native key handler from seeking a second time and preserves modifier keys', () => {
    const native = vi.fn();
    video.addEventListener('keydown', native);
    video.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(video.currentTime).toBe(35);
    expect(native).not.toHaveBeenCalled();
    video.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(video.currentTime).toBe(35);
    expect(native).toHaveBeenCalledOnce();
  });
  it('disables loop editing for live DVR players with a finite duration', async () => {
    video.parentElement?.classList.add('ytp-live');
    await vi.advanceTimersByTimeAsync(350);
    expect(findButton('Edit loop').disabled).toBe(true);
    expect(findButton('Enable loop').disabled).toBe(true);
  });
  it('updates a saved section after editing its range instead of creating duplicates', async () => {
    findButton('Enable loop').click();
    findButton('Save changes').click();
    await vi.advanceTimersByTimeAsync(0);
    const end = inputFor('B (seconds)');
    end.value = '40';
    end.dispatchEvent(new Event('change'));
    findButton('Save changes').click();
    await vi.advanceTimersByTimeAsync(0);
    const saved = send.mock.calls
      .filter(([message]) => message.command.op === 'put')
      .map(([message]) => message.command.item);
    expect(saved.length).toBeGreaterThanOrEqual(2);
    expect(new Set(saved.map((item) => item.id)).size).toBe(1);
    expect(saved.at(-1).end).toBe(40);
  });
  it('uses custom skip values and displays remaining time at actual speed', () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(video.currentTime).toBe(15);
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(video.currentTime).toBe(25);
    expect(root.textContent).not.toContain('Skip intervals');
    expect(
      [...root.querySelectorAll('button')].some(
        (button) => button.textContent === 'Rewind'
      )
    ).toBe(false);
    video.playbackRate = 2;
    video.dispatchEvent(new Event('ratechange'));
    expect(root.textContent).toContain('0:37 remaining at 2×');
  });
  it('leaves normal timeline gestures alone and cycles created sections in order', async () => {
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    track.getBoundingClientRect = video.getBoundingClientRect;
    const pointer = (type: string, x: number, shiftKey = false) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, button: 0, shiftKey });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      track.dispatchEvent(e);
    };
    pointer('pointerdown', 64);
    pointer('pointermove', 192);
    pointer('pointerup', 192);
    expect(inputFor('A (seconds)').value).toBe('0');
    findButton('Edit loop').click();
    pointer('pointerdown', 64);
    pointer('pointermove', 192);
    pointer('pointerup', 192);
    expect(inputFor('A (seconds)').value).toBe('10.0');
    expect(inputFor('B (seconds)').value).toBe('30.0');
    expect(video.currentTime).toBe(25);
    pointer('pointerdown', 320, true);
    pointer('pointermove', 448, true);
    pointer('pointerup', 448, true);
    expect(track.querySelectorAll('.saved-range')).toHaveLength(1);
    expect(track.querySelectorAll('.time-pill')).toHaveLength(4);
    expect(inputFor('A (seconds)').value).toBe('50.0');
    expect(inputFor('B (seconds)').value).toBe('70.0');
    pointer('pointerdown', 384, true);
    pointer('pointermove', 500, true);
    pointer('pointerup', 500, true);
    expect(inputFor('B (seconds)').value).toBe('70.0');
    expect(track.querySelectorAll('.saved-range')).toHaveLength(1);

    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.currentTime = 25;
    const savedHandle = track.querySelector('.saved-range .handle.end') as HTMLElement;
    const grab = new MouseEvent('pointerdown', { bubbles: true, clientX: 192, button: 0 });
    Object.defineProperty(grab, 'pointerId', { value: 1 });
    savedHandle.dispatchEvent(grab);
    expect(video.currentTime).toBe(25);
    pointer('pointermove', 192);
    pointer('pointerup', 192);
    expect(video.currentTime).toBe(25);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(track.classList.contains('editing')).toBe(false);
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.currentTime = 30;
    video.dispatchEvent(new Event('timeupdate'));
    await vi.advanceTimersByTimeAsync(20);
    expect(video.currentTime).toBe(50);
    video.currentTime = 70;
    video.dispatchEvent(new Event('timeupdate'));
    await vi.advanceTimersByTimeAsync(20);
    expect(video.currentTime).toBe(10);

  });
  it('keeps playing within dragged boundaries as each handle crosses the playhead', () => {
    findButton('Enable loop').click();
    (document.querySelector('.mfs-loop-edit-button') as HTMLButtonElement).click();
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    track.getBoundingClientRect = video.getBoundingClientRect;
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.currentTime = 27;
    const pointer = (target: Element, type: string, time: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: time * 6.4, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      target.dispatchEvent(event);
    };
    pointer(track.querySelector('.range .handle.start')!, 'pointerdown', 25);
    pointer(track, 'pointermove', 26);
    expect(video.currentTime).toBe(27);
    pointer(track, 'pointermove', 28);
    expect(video.currentTime).toBeCloseTo(28);
    pointer(track, 'pointermove', 29);
    expect(video.currentTime).toBeCloseTo(29);
    pointer(track, 'pointerup', 29);
    video.currentTime = 29.8;
    pointer(track.querySelector('.range .handle.end')!, 'pointerdown', 30);
    pointer(track, 'pointermove', 29.5);
    expect(video.currentTime).toBeCloseTo(29);
    expect(video.paused).toBe(false);
    pointer(track, 'pointermove', 10);
    expect(Number(inputFor('B (seconds)').value)).toBeGreaterThan(Number(inputFor('A (seconds)').value));
    pointer(track, 'pointerup', 10);
    (track.querySelector('.range .delete-loop-section') as HTMLButtonElement).click();
    expect((track.querySelector('.range') as HTMLElement).hidden).toBe(true);
  });
  it.each([true, false])('restores pre-drag playback on editing exit (playing: %s)', async (wasPlaying) => {
    findButton('Enable loop').click();
    (document.querySelector('.mfs-loop-edit-button') as HTMLButtonElement).click();
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    track.getBoundingClientRect = video.getBoundingClientRect;
    video.play = vi.fn(async () => { Object.defineProperty(video, 'paused', { value: false, configurable: true }); });
    video.pause = vi.fn(() => { Object.defineProperty(video, 'paused', { value: true, configurable: true }); });
    Object.defineProperty(video, 'paused', { value: !wasPlaying, configurable: true });
    (track.querySelector('.fine-tune-loop') as HTMLButtonElement).click();
    const pointer = (target: Element, type: string, time: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: time * 6.4, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      target.dispatchEvent(event);
    };
    pointer(track.querySelector('.range .handle.end')!, 'pointerdown', 30);
    expect(video.paused).toBe(false);
    pointer(track, 'pointermove', 40);
    expect(video.currentTime).toBe(40);
    expect(video.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(180);
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(40);
    pointer(track, 'pointerup', 40);
    expect(video.pause).toHaveBeenCalled();
    expect(video.currentTime).toBe(25);
    expect(video.paused).toBe(true);
    (track.querySelector('.close-loop-editor') as HTMLButtonElement).click();
    expect(video.paused).toBe(!wasPlaying);
  });
  it('moves playing video into a relocated section only when outside it', () => {
    findButton('Enable loop').click();
    (document.querySelector('.mfs-loop-edit-button') as HTMLButtonElement).click();
    const track = document.querySelector('.mfs-loop-surface')!.shadowRoot!.querySelector('.timeline') as HTMLElement;
    track.getBoundingClientRect = video.getBoundingClientRect;
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.currentTime = 27;
    const pointer = (target: Element, type: string, time: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: time * 6.4, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      target.dispatchEvent(event);
    };
    pointer(track.querySelector('.range')!, 'pointerdown', 27);
    pointer(track, 'pointermove', 28);
    expect(video.currentTime).toBe(27);
    pointer(track, 'pointermove', 42);
    expect(video.currentTime).toBeCloseTo(40);
    pointer(track, 'pointermove', 12);
    expect(video.currentTime).toBeCloseTo(10);
    pointer(track, 'pointerup', 12);
    expect(video.paused).toBe(false);
  });
  it('ignores skip shortcuts while entering names', () => {
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 100, clientY: 100 })
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      })
    );
    expect(video.currentTime).toBe(15);
    inputFor('Name').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        composed: true,
      })
    );
    expect(video.currentTime).toBe(15);
  });
  it('stores named bookmarks and clears an active loop after a source change', async () => {
    inputFor('Name').value = 'Explanation';
    findButton('Bookmark this moment').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          op: 'put',
          item: expect.objectContaining({ name: 'Explanation', start: 25 }),
        }),
      })
    );
    findButton('Enable loop').click();
    expect(root.textContent).toContain('Disable loop');
    video.dispatchEvent(new Event('emptied'));
    expect(root.textContent).toContain('Enable loop');
  });
  it('restores filters and removes owned DOM/listeners on cleanup', () => {
    const brightness = inputFor('Brightness');
    brightness.value = '150';
    brightness.dispatchEvent(new Event('input'));
    expect(video.style.filter).toContain('brightness(150%)');
    tools?.cleanup();
    expect(video.style.filter).toBe('');
    expect(document.querySelector('.mfs-player-tools')).toBeNull();
    expect(changed.removeListener).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not enable persistent loop editing for a live stream', () => {
    Object.defineProperty(video, 'duration', { value: Infinity });
    video.dispatchEvent(new Event('durationchange'));
    expect(findButton('Edit loop').disabled).toBe(true);
    expect(findButton('Enable loop').disabled).toBe(true);
  });
});

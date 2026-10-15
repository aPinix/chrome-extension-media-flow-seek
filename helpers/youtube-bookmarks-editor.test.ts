// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SavedMoment } from './saved-media';
import { YouTubeBookmarksEditor } from './youtube-bookmarks-editor';

let editor: YouTubeBookmarksEditor;
let root: ShadowRoot;
let video: HTMLVideoElement;
let items: SavedMoment[];
const saved = vi.fn();
const deleted = vi.fn();
const restored = vi.fn();
const added = vi.fn();
const seek = vi.fn();
const changed = vi.fn();
const moment = (id: string, start: number): SavedMoment => ({
  id,
  start,
  name: `Moment ${id}`,
  mediaKey: 'youtube:test',
  url: 'https://www.youtube.com/watch?v=test',
  title: 'Test',
  createdAt: 1,
});
const point = () =>
  root.querySelector<HTMLButtonElement>('.point') as HTMLButtonElement;
const input = (name: string) =>
  root.querySelector<HTMLInputElement>(
    `input[aria-label="${name}"]`
  ) as HTMLInputElement;
const control = (text: string) => {
  const node = [...root.querySelectorAll('button')].find(
    (button) =>
      button.textContent === text || button.getAttribute('aria-label') === text
  );
  if (!node) throw new Error(`Missing control: ${text}`);
  return node;
};
const pointer = (target: EventTarget, type: string, x: number) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    button: 0,
    clientX: x,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  document.body.innerHTML =
    '<video></video><div id="timeline"></div><button id="anchor"></button>';
  video = document.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', { value: 100 });
  video.currentTime = 40;
  const timeline = document.querySelector('#timeline') as HTMLElement;
  timeline.getBoundingClientRect = () => ({ width: 500, left: 0 }) as DOMRect;
  items = [moment('a', 25), moment('b', 75)];
  saved.mockImplementation(async (item) => {
    items = items.map((entry) => (entry.id === item.id ? item : entry));
    editor.update(items, true, true);
  });
  deleted.mockImplementation(async (id) => {
    items = items.filter((item) => item.id !== id);
    editor.update(items, true, true);
  });
  restored.mockImplementation(async (next) => {
    items = next.map((item: SavedMoment) => ({ ...item }));
    editor.update(items, true, true);
  });
  added.mockImplementation(async (time) => {
    items = [...items, moment('new', time)];
    editor.update(items, true, true);
  });
  editor = new YouTubeBookmarksEditor(video, timeline, {
    onSave: saved,
    onDelete: deleted,
    onAdd: added,
    onRestore: restored,
    onSeek: seek,
    onOpenChange: changed,
  });
  root = editor.host.shadowRoot as ShadowRoot;
  editor.update(items, true, true);
  editor.open(document.querySelector('#anchor') as HTMLButtonElement);
});
afterEach(() => {
  editor.cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('edits existing names and times without changing identity, creation date, or playback', async () => {
  const name = input('Bookmark name');
  name.value = 'Introduction';
  name.dispatchEvent(new Event('change'));
  await vi.advanceTimersByTimeAsync(0);
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'a',
      name: 'Introduction',
      start: 25,
      createdAt: 1,
    })
  );
  const time = input('Bookmark time in seconds');
  time.value = '35.125';
  time.dispatchEvent(new Event('change'));
  await vi.advanceTimersByTimeAsync(0);
  expect(items[0]).toMatchObject({
    id: 'a',
    name: 'Introduction',
    start: 35.125,
  });
  expect(video.currentTime).toBe(40);
  expect(seek).not.toHaveBeenCalled();
});
it('adds at the clicked timeline position and supports undo, redo, clear, and discard', async () => {
  const original = items.map((item) => ({ ...item }));
  root
    .querySelector('.lane')
    ?.dispatchEvent(new MouseEvent('click', { clientX: 300, bubbles: true }));
  await vi.advanceTimersByTimeAsync(0);
  expect(added).toHaveBeenCalledWith(60);
  expect(video.currentTime).toBe(40);
  expect(root.querySelector('.point svg')).toBeNull();
  control('Undo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual(original);
  control('Redo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toHaveLength(3);
  control('Clear bookmarks').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual([]);
  control('Undo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toHaveLength(3);
  control('Discard changes').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual(original);
  expect(editor.isOpen).toBe(false);
});
it('creates a draft on press, keeps it through updates, and saves its dragged position on release', async () => {
  const lane = root.querySelector('.lane') as HTMLElement;
  pointer(lane, 'pointerdown', 100);
  expect(root.querySelectorAll('.point')).toHaveLength(3);
  expect(added).not.toHaveBeenCalled();
  pointer(document, 'pointermove', 300);
  editor.update(items, true, true);
  expect(root.querySelector('[data-draft-time="60"]')).not.toBeNull();
  input('Bookmark time in seconds').value = '';
  pointer(document, 'pointerup', 300);
  pointer(video, 'mouseup', 300);
  video.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(added).toHaveBeenCalledExactlyOnceWith(60);
  expect(editor.isOpen).toBe(true);
  expect(video.currentTime).toBe(40);
  control('Undo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items.map((item) => item.id)).toEqual(['a', 'b']);
});
it('adds once without movement and cancels an unfinished draft without saving', async () => {
  const lane = root.querySelector('.lane') as HTMLElement;
  pointer(lane, 'pointerdown', 100);
  pointer(document, 'pointerup', 100);
  lane.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(added).toHaveBeenCalledExactlyOnceWith(20);
  pointer(lane, 'pointerdown', 400);
  expect(root.querySelectorAll('.point')).toHaveLength(4);
  pointer(document, 'pointercancel', 400);
  expect(root.querySelectorAll('.point')).toHaveLength(3);
  expect(added).toHaveBeenCalledOnce();
});
it('creates and drags on the native YouTube seek bar without native seeking or dismissal', async () => {
  const player = document.createElement('div');
  player.id = 'movie_player';
  document.body.append(player);
  player.append(video);
  const bar = document.createElement('div');
  bar.className = 'ytp-progress-bar';
  bar.getBoundingClientRect = () => new DOMRect(50, 0, 400, 10);
  bar.innerHTML = '<div class="ytp-play-progress"></div>';
  player.append(bar);
  const nativeSeek = vi.fn();
  bar.addEventListener('pointerdown', nativeSeek);
  bar.addEventListener('click', nativeSeek);
  const child = bar.firstElementChild as HTMLElement;
  pointer(child, 'pointerdown', 150);
  expect(root.querySelectorAll('.point')).toHaveLength(3);
  pointer(document, 'pointermove', 350);
  pointer(child, 'pointerup', 350);
  child.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(added).toHaveBeenCalledExactlyOnceWith(75);
  expect(nativeSeek).not.toHaveBeenCalled();
  expect(editor.isOpen).toBe(true);
  expect(video.currentTime).toBe(40);
});
it('saves the drag position independently of the inspector input', async () => {
  pointer(point(), 'pointerdown', 125);
  pointer(document, 'pointermove', 225);
  input('Bookmark time in seconds').value = '';
  pointer(document, 'pointerup', 225);
  await vi.advanceTimersByTimeAsync(0);
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'a', start: 45 })
  );
});
it('keeps history and saved bookmarks intact when clear or undo fails', async () => {
  const original = items.map((item) => ({ ...item }));
  restored.mockRejectedValueOnce(new Error('Storage unavailable'));
  control('Clear bookmarks').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual(original);
  expect(control('Undo').disabled).toBe(true);
  control('Clear bookmarks').click();
  await vi.advanceTimersByTimeAsync(0);
  restored.mockRejectedValueOnce(new Error('Storage unavailable'));
  control('Undo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual([]);
  expect(control('Undo').disabled).toBe(false);
  control('Undo').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(items).toEqual(original);
  control('Close').click();
  editor.open(document.querySelector('#anchor') as HTMLButtonElement);
  expect(control('Undo').disabled).toBe(true);
  expect(control('Discard changes').disabled).toBe(true);
});
it('keeps the editor above stacked buttons and accounts for player scaling', () => {
  const player = document.createElement('div');
  player.className = 'html5-video-player';
  const toolbar = document.createElement('div');
  toolbar.className = 'mfs-youtube-controls';
  toolbar.dataset.stacked = 'true';
  document.body.append(player);
  player.append(video, toolbar);
  const timeline = document.querySelector('#timeline') as HTMLElement;
  Object.defineProperty(timeline, 'clientWidth', { value: 250 });
  timeline.getBoundingClientRect = () => ({ width: 500, top: 300 }) as DOMRect;
  toolbar.getBoundingClientRect = () => ({ top: 240 }) as DOMRect;
  editor.layout();
  expect(editor.host.style.getPropertyValue('--toolbar-clearance')).toBe(
    '30px'
  );
  expect(editor.host.style.getPropertyValue('--inspector-max-height')).toBe(
    '48px'
  );
  toolbar.dataset.stacked = 'false';
  editor.layout();
  expect(editor.host.style.getPropertyValue('--toolbar-clearance')).toBe('0px');
});
it('moves a marker during a drag and saves only when the adjustment finishes', async () => {
  pointer(point(), 'pointerdown', 125);
  pointer(document, 'pointermove', 225);
  expect(point().style.left).toBe('45%');
  expect(saved).not.toHaveBeenCalled();
  pointer(document, 'pointerup', 225);
  await vi.advanceTimersByTimeAsync(0);
  expect(saved).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ id: 'a', start: 45 })
  );
  expect(editor.isOpen).toBe(true);
  expect(video.currentTime).toBe(40);
});
it('supports arrow-key adjustments, clamps at the video limits, and preserves marker focus', async () => {
  point().focus();
  point().dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
    })
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(items[0]?.start).toBe(26);
  expect(root.activeElement).toBe(point());
  point().dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(items[0]?.start).toBe(25.9);
  pointer(point(), 'pointerdown', 125);
  pointer(document, 'pointermove', -1000);
  pointer(document, 'pointerup', -1000);
  await vi.advanceTimersByTimeAsync(0);
  expect(items[0]?.start).toBe(0);
});
it('does not commit cancelled drags or lose the last saved value on storage errors', async () => {
  pointer(point(), 'pointerdown', 125);
  pointer(document, 'pointermove', 225);
  pointer(document, 'pointercancel', 225);
  expect(saved).not.toHaveBeenCalled();
  expect(point().style.left).toBe('25%');
  saved.mockRejectedValueOnce(new Error('Could not save bookmark. Try again.'));
  input('Bookmark name').value = 'Failed edit';
  input('Bookmark name').dispatchEvent(new Event('change'));
  await vi.advanceTimersByTimeAsync(0);
  expect(input('Bookmark name').value).toBe('Moment a');
  expect(root.querySelector('[role=status]')?.textContent).toContain(
    'Could not save'
  );
});
it('closes smoothly on Escape and dismisses outside clicks without activating the video', async () => {
  const clicked = vi.fn();
  video.addEventListener('click', clicked);
  pointer(video, 'pointerdown', 0);
  video.click();
  expect(clicked).not.toHaveBeenCalled();
  expect(editor.isOpen).toBe(false);
  expect(editor.host.hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(240);
  expect(editor.host.hidden).toBe(true);
  editor.open(document.querySelector('#anchor') as HTMLButtonElement);
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(editor.isOpen).toBe(false);
  expect(editor.host.dataset.closing).toBe('true');
  await vi.advanceTimersByTimeAsync(240);
  expect(editor.host.hidden).toBe(true);
});
it('deletes the selected bookmark and closes immediately when disabled or reset', async () => {
  [...root.querySelectorAll('button')]
    .find((node) => node.textContent === 'Delete')
    ?.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(deleted).toHaveBeenCalledWith('a');
  expect(items).toHaveLength(1);
  editor.update(items, false, true);
  expect(editor.isOpen).toBe(false);
  expect(editor.host.hidden).toBe(true);
  editor.update(items, true, true);
  editor.open(document.querySelector('#anchor') as HTMLButtonElement);
  editor.reset();
  expect(editor.isOpen).toBe(false);
  expect(editor.host.hidden).toBe(true);
});

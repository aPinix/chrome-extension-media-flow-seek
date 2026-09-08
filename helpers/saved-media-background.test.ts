import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIBRARY_MESSAGE,
  type LibraryCommand,
  registerLibraryBackground,
  type SavedMoment,
} from './saved-media';

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0];
let local: Record<string, unknown>;
let session: Record<string, unknown>;
const updateTab = vi.fn();
const item: SavedMoment = {
  id: 'one',
  mediaKey: 'youtube:abc',
  url: 'https://www.youtube.com/watch?v=abc',
  name: 'First part',
  title: 'Lesson',
  start: 10,
  createdAt: 123,
};
const request = (command: LibraryCommand, tabId = 1) =>
  new Promise<Record<string, unknown>>((resolve) => {
    listener(
      { type: LIBRARY_MESSAGE, command },
      { id: 'extension', tab: { id: tabId } as chrome.tabs.Tab },
      resolve
    );
  });
beforeEach(() => {
  local = {};
  session = {};
  updateTab.mockReset();
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'extension',
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    storage: {
      local: {
        get: async () => structuredClone(local),
        set: async (value: object) => {
          Object.assign(local, value);
        },
      },
      session: {
        get: async () => structuredClone(session),
        set: async (value: object) => {
          Object.assign(session, value);
        },
        remove: async (key: string) => {
          delete session[key];
        },
      },
    },
    tabs: {
      create: async () => ({ id: 99 }),
      update: updateTab,
      onRemoved: { addListener: vi.fn() },
    },
  });
  registerLibraryBackground();
});
afterEach(() => vi.unstubAllGlobals());
describe('saved library background coordination', () => {
  it('serializes simultaneous saves from different tabs without dropping items', async () => {
    await Promise.all([
      request({ op: 'put', item }),
      request({ op: 'put', item: { ...item, id: 'two' } }, 2),
    ]);
    const result = await request({ op: 'list' });
    expect(result.library).toMatchObject({
      items: [{ id: 'one' }, { id: 'two' }],
    });
  });
  it('opens saved items and only lets the matching video in the target tab claim them', async () => {
    await request({ op: 'put', item });
    await request({ op: 'open', id: item.id });
    expect(updateTab).toHaveBeenCalledWith(99, { url: item.url });
    expect(
      await request({ op: 'claim', mediaKey: 'youtube:wrong' }, 99)
    ).toEqual({});
    expect(await request({ op: 'claim', mediaKey: item.mediaKey }, 1)).toEqual(
      {}
    );
    expect(await request({ op: 'claim', mediaKey: item.mediaKey }, 99)).toEqual(
      { item }
    );
    expect(await request({ op: 'claim', mediaKey: item.mediaKey }, 99)).toEqual(
      {}
    );
  });
  it('reports invalid mutations without changing the saved library', async () => {
    await request({ op: 'put', item });
    expect(
      await request({ op: 'put', item: { ...item, start: -1 } })
    ).toHaveProperty('error');
    expect((await request({ op: 'list' })).library).toMatchObject({
      items: [item],
    });
  });
});

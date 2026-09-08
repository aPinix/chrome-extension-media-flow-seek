import { getYouTubeVideoId } from './youtube-chapters';

export type SavedMoment = {
  id: string;
  mediaKey: string;
  url: string;
  title: string;
  name: string;
  start: number;
  end?: number;
  createdAt: number;
};
export type MediaLibrary = { version: 1; items: SavedMoment[] };
export const LIBRARY_KEY = 'savedMediaLibrary';
export const LIBRARY_MESSAGE = 'MFS_LIBRARY';
export type LibraryCommand =
  | { op: 'list' }
  | { op: 'put'; item: SavedMoment }
  | { op: 'delete'; id: string }
  | { op: 'import'; library: MediaLibrary }
  | { op: 'open'; id: string }
  | { op: 'claim'; mediaKey: string };

export function mediaIdentity(
  video: HTMLVideoElement,
  pageUrl: string
): { key: string; persistent: boolean } {
  const youtubeId = getYouTubeVideoId(pageUrl);
  if (youtubeId) return { key: `youtube:${youtubeId}`, persistent: true };
  // Temporary/blob sources and multi-item feed URLs cannot reliably identify a video.
  const source = video.currentSrc || video.getAttribute('src') || '';
  try {
    const url = new URL(source, pageUrl);
    if (
      source &&
      /^https?:$/.test(url.protocol) &&
      !url.search &&
      /\.(mp4|webm|ogv|ogg|mov)$/i.test(url.pathname)
    ) {
      return { key: `media:${url.href}`, persistent: true };
    }
  } catch {
    /* session-only */
  }
  return { key: `session:${pageUrl}:${source}`, persistent: false };
}
export function validMoment(value: unknown): value is SavedMoment {
  if (!value || typeof value !== 'object') return false;
  const v = value as SavedMoment;
  if (
    !['id', 'mediaKey', 'url', 'title', 'name'].every(
      (key) =>
        typeof v[key as keyof SavedMoment] === 'string' &&
        (v[key as keyof SavedMoment] as string).length <= 4096
    )
  )
    return false;
  if (
    !v.id ||
    !v.name.trim() ||
    v.name.length > 160 ||
    !Number.isFinite(v.start) ||
    v.start < 0 ||
    !Number.isFinite(v.createdAt)
  )
    return false;
  if (
    v.end !== undefined &&
    (!Number.isFinite(v.end) || v.end - v.start + 1e-9 < 0.1)
  )
    return false;
  try {
    const url = new URL(v.url);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (v.mediaKey.startsWith('youtube:'))
      return v.mediaKey === `youtube:${getYouTubeVideoId(v.url)}`;
    if (v.mediaKey.startsWith('media:')) {
      const media = new URL(v.mediaKey.slice(6));
      return (
        /^https?:$/.test(media.protocol) &&
        !media.search &&
        /\.(mp4|webm|ogv|ogg|mov)$/i.test(media.pathname)
      );
    }
  } catch {
    return false;
  }
  return false;
}
export function parseLibrary(value: unknown): MediaLibrary {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid library file.');
  const v = value as MediaLibrary;
  if (
    v.version !== 1 ||
    !Array.isArray(v.items) ||
    v.items.length > 10000 ||
    !v.items.every(validMoment)
  )
    throw new Error('Unsupported or invalid library file.');
  return {
    version: 1,
    items: [...new Map(v.items.map((item) => [item.id, item])).values()],
  };
}
export function mergeLibraries(
  current: MediaLibrary,
  incoming: MediaLibrary
): MediaLibrary {
  const merged = new Map(current.items.map((item) => [item.id, item]));
  // Existing edits win when importing a backup containing the same ID.
  for (const item of incoming.items)
    if (!merged.has(item.id)) merged.set(item.id, item);
  if (merged.size > 10000)
    throw new Error('The library supports up to 10,000 items.');
  return { version: 1, items: [...merged.values()] };
}
export async function libraryRequest(
  command: LibraryCommand
): Promise<{ library?: MediaLibrary; item?: SavedMoment }> {
  const result = await chrome.runtime.sendMessage({
    type: LIBRARY_MESSAGE,
    command,
  });
  if (!result || result.error)
    throw new Error(
      result?.error ?? 'Library unavailable. Try reloading this page.'
    );
  return result;
}

// The background worker serializes mutations from all frames/tabs to avoid lost saves.
export function registerLibraryBackground(): void {
  let queue = Promise.resolve();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== LIBRARY_MESSAGE || sender.id !== chrome.runtime.id)
      return;
    const run = async () => {
      const command = message.command as LibraryCommand;
      const stored = await chrome.storage.local.get(LIBRARY_KEY);
      let library = stored[LIBRARY_KEY]
        ? parseLibrary(stored[LIBRARY_KEY])
        : { version: 1 as const, items: [] };
      if (command.op === 'claim') {
        if (sender.tab?.id === undefined) return {};
        const key = `mfsPending:${sender.tab.id}`;
        const pending = (await chrome.storage.session.get(key))[key] as
          | { item: SavedMoment; expires: number }
          | undefined;
        if (pending && pending.expires < Date.now()) {
          await chrome.storage.session.remove(key);
          return {};
        }
        if (pending?.item.mediaKey === command.mediaKey) {
          await chrome.storage.session.remove(key);
          return { item: pending.item };
        }
        return {};
      }
      if (command.op === 'open') {
        const item = library.items.find((entry) => entry.id === command.id);
        if (!item) throw new Error('Saved item was not found.');
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        if (tab.id === undefined) throw new Error('Could not open a tab.');
        await chrome.storage.session.set({
          [`mfsPending:${tab.id}`]: { item, expires: Date.now() + 120000 },
        });
        await chrome.tabs.update(tab.id, { url: item.url });
        return {};
      }
      if (command.op === 'put') {
        if (!validMoment(command.item)) throw new Error('Invalid saved item.');
        library.items = library.items.filter(
          (entry) => entry.id !== command.item.id
        );
        library.items.push(command.item);
        library = parseLibrary(library);
      } else if (command.op === 'delete')
        library.items = library.items.filter(
          (entry) => entry.id !== command.id
        );
      else if (command.op === 'import')
        library = mergeLibraries(library, parseLibrary(command.library));
      else if (command.op !== 'list')
        throw new Error('Unknown library command.');
      if (command.op !== 'list')
        await chrome.storage.local.set({ [LIBRARY_KEY]: library });
      return { library };
    };
    queue = queue.then(async () => {
      try {
        respond(await run());
      } catch (error) {
        respond({
          error:
            error instanceof Error
              ? error.message
              : 'Library operation failed.',
        });
      }
    });
    return true;
  });
  chrome.tabs.onRemoved.addListener((id) => {
    void chrome.storage.session.remove(`mfsPending:${id}`);
  });
}

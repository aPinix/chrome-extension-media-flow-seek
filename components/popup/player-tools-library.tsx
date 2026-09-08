import { useEffect, useState } from 'react';
import { downloadBlob, formatTime } from '@/helpers/player-actions';
import {
  LIBRARY_KEY,
  libraryRequest,
  parseLibrary,
  type SavedMoment,
} from '@/helpers/saved-media';

const control =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function SavedItem({
  item,
  refresh,
  report,
}: {
  item: SavedMoment;
  refresh: () => Promise<void>;
  report: (message: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [editing, setEditing] = useState(false);
  const run = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (error) {
      report(
        error instanceof Error ? error.message : 'Could not update saved item.'
      );
    }
  };
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <button
        className="text-left font-medium text-slate-900 text-sm dark:text-slate-100"
        onClick={() =>
          void run(() => libraryRequest({ op: 'open', id: item.id }))
        }
        type="button"
      >
        {item.end === undefined ? '◆' : '↻'} {item.name}
      </button>
      <p className="break-words text-slate-500 text-xs dark:text-slate-400">
        {item.title} · {formatTime(item.start)}
        {item.end === undefined ? '' : `–${formatTime(item.end)}`}
      </p>
      <div className="flex gap-2">
        <button
          className={control}
          onClick={() => setEditing(!editing)}
          type="button"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        <button
          className={control}
          onClick={() =>
            void run(() => libraryRequest({ op: 'delete', id: item.id }))
          }
          type="button"
        >
          Delete
        </button>
        {item.mediaKey.startsWith('youtube:') && (
          <button
            className={control}
            onClick={() =>
              void navigator.clipboard
                .writeText(
                  `https://www.youtube.com/watch?v=${encodeURIComponent(item.mediaKey.slice(8))}&t=${Math.floor(item.start)}s`
                )
                .then(() => report('Timestamp link copied.'))
                .catch(() => report('Clipboard unavailable.'))
            }
            type="button"
          >
            Copy link
          </button>
        )}
      </div>
      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await libraryRequest({
                op: 'put',
                item: {
                  ...item,
                  name: name.trim(),
                  start,
                  ...(end === undefined ? {} : { end }),
                },
              });
              setEditing(false);
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs">
            Name
            <input
              className={control}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Timestamp (seconds)
            <input
              className={control}
              min={0}
              onChange={(e) => setStart(e.target.valueAsNumber)}
              required
              step={0.1}
              type="number"
              value={start}
            />
          </label>
          {end !== undefined && (
            <label className="flex flex-col gap-1 text-xs">
              End (seconds)
              <input
                className={control}
                min={start + 0.1}
                onChange={(e) => setEnd(e.target.valueAsNumber)}
                required
                step={0.1}
                type="number"
                value={end}
              />
            </label>
          )}
          <button className={control} type="submit">
            Save changes
          </button>
        </form>
      )}
    </article>
  );
}

export function PlayerToolsLibrary() {
  const [items, setItems] = useState<SavedMoment[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const refresh = async () => {
    const { library } = await libraryRequest({ op: 'list' });
    setItems(library?.items ?? []);
  };
  useEffect(() => {
    let active = true;
    const load = () => {
      void libraryRequest({ op: 'list' })
        .then(({ library }) => {
          if (active) setItems(library?.items ?? []);
        })
        .catch(() => {
          if (active)
            setStatus('Open the installed extension to use the saved library.');
        });
    };
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes[LIBRARY_KEY]) load();
    };
    load();
    chrome.storage.onChanged.addListener(changed);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  return (
    <details className="mx-3 rounded-xl border border-slate-200 bg-white/40 p-3 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100">
      <summary className="cursor-pointer font-semibold text-sm">
        Saved moments & loops{' '}
        <span className="text-slate-500">({items.length})</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-slate-500 text-xs dark:text-slate-400">
          Save moments from the Tools menu over a video. Your library stays in
          this browser.
        </p>
        <input
          aria-label="Search saved moments"
          className={control}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names or video titles"
          value={query}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className={control}
            onClick={() =>
              downloadBlob(
                document,
                new Blob([JSON.stringify({ version: 1, items }, null, 2)], {
                  type: 'application/json',
                }),
                'better-video-controls-library.json'
              )
            }
            type="button"
          >
            Export JSON
          </button>
          <label className={`${control} cursor-pointer`}>
            Import JSON
            <input
              accept=".json,application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  if (file.size > 10 * 1024 * 1024)
                    throw new Error(
                      'Choose a library file smaller than 10 MB.'
                    );
                  const library = parseLibrary(JSON.parse(await file.text()));
                  await libraryRequest({ op: 'import', library });
                  await refresh();
                  setStatus(
                    'Imported. Existing items with matching IDs were kept.'
                  );
                } catch (error) {
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : 'Could not import this library.'
                  );
                }
              }}
              type="file"
            />
          </label>
        </div>
        <p className="text-xs" role="status">
          {status}
        </p>
        {items
          .filter((item) =>
            `${item.name} ${item.title}`
              .toLowerCase()
              .includes(query.toLowerCase())
          )
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((item) => (
            <SavedItem
              item={item}
              key={`${item.id}:${item.name}:${item.start}:${item.end}`}
              refresh={refresh}
              report={setStatus}
            />
          ))}
        {!items.length && (
          <p className="text-slate-500 text-xs">No saved moments yet.</p>
        )}
      </div>
    </details>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PLAYER_TOOLS,
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  type PlayerToolsSettings,
  savePlayerTools,
} from '@/helpers/player-tools-settings';

let saveQueue = Promise.resolve();

export function usePlayerToolsPreferences(feature: string) {
  const [settings, setSettings] = useState(DEFAULT_PLAYER_TOOLS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const update = (value: unknown) => {
      if (!mounted.current) return;
      setSettings(normalizePlayerTools(value));
      setReady(true);
    };
    void loadPlayerTools()
      .then(update)
      .catch(() => {
        if (mounted.current) setError(`Could not load ${feature} settings.`);
      });
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY])
        update(changes[PLAYER_TOOLS_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      mounted.current = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, [feature]);

  const save = (patch: Partial<PlayerToolsSettings>) => {
    setSaving(true);
    setError('');
    const operation = saveQueue.then(async () => {
      const current = await loadPlayerTools();
      const next = normalizePlayerTools({ ...current, ...patch });
      await savePlayerTools(next);
      if (mounted.current) setSettings(next);
    });
    saveQueue = operation.catch(() => {});
    void operation
      .catch(async () => {
        if (mounted.current) setError(`Could not save ${feature} settings.`);
        try {
          const current = await loadPlayerTools();
          if (mounted.current) setSettings(current);
        } catch {
          /* Preserve the last state when storage is unavailable. */
        }
      })
      .finally(() => {
        if (mounted.current) setSaving(false);
      });
  };

  const preview = (patch: Partial<PlayerToolsSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  return { settings, ready, saving, error, save, preview };
}

import { KeyboardIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { AppKbd } from '@/components/app/app-kbd';
import { AppNumberInput } from '@/components/app/app-number-input';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { CardListItem } from '@/components/popup/card-list-item';
import {
  DEFAULT_PLAYER_TOOLS,
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  savePlayerTools,
} from '@/helpers/player-tools-settings';

export function ArrowSeekSettings({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState('5');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(Promise.resolve());
  const writes = useRef(0);
  useEffect(() => {
    let mounted = true;
    const update = (value: unknown) => {
      const settings = normalizePlayerTools(value);
      if (mounted && writes.current === 0) {
        setValue(String(settings.backward));
        setReady(true);
      }
    };
    void loadPlayerTools()
      .then(update)
      .catch(() => setError('Could not load arrow key settings.'));
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY])
        update(changes[PLAYER_TOOLS_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  const save = (value: string) => {
    let seconds = Number(value);
    if (
      !value.trim() ||
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      seconds > 86400
    ) {
      seconds = DEFAULT_PLAYER_TOOLS.backward;
      setValue(String(seconds));
    }
    setError('');
    writes.current++;
    pending.current = pending.current
      .then(async () => {
        const settings = await loadPlayerTools();
        await savePlayerTools({
          ...settings,
          backward: seconds,
          forward: seconds,
        });
      })
      .catch(() => setError('Could not save arrow key settings.'))
      .finally(() => {
        writes.current--;
      });
  };
  return (
    <CardListItem
      components={{
        RightSlot: (
          <div className="w-22">
            <AppNumberInput
              disabled={!ready || disabled}
              id={id}
              label="Seek interval (secs)"
              max={86400}
              min={1}
              onCommit={save}
              onValueChange={setValue}
              value={value}
            />
          </div>
        ),
        BottomSlot: error ? (
          <p className="text-red-600 text-xs" role="alert">
            {error}
          </p>
        ) : undefined,
      }}
      description={
        <span className="inline-flex flex-wrap items-center gap-1">
          Seek interval for <AppKbd>←</AppKbd> <AppKbd>→</AppKbd> (secs)
        </span>
      }
      icon={KeyboardIcon}
      title={
        <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-normal">
          <label htmlFor={id}>Arrow Key Seeking</label>
          <SliderResetButton
            disabled={!ready || disabled || Number(value) === 5}
            label="Reset seek interval to 5 seconds"
            onClick={() => {
              setValue('5');
              save('5');
            }}
          />
        </span>
      }
    />
  );
}

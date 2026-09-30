import { KeyboardIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { AppKbd } from '@/components/app/app-kbd';
import { AppNumberInput } from '@/components/app/app-number-input';
import { AppSwitch } from '@/components/app/app-switch';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { CardListItem } from '@/components/popup/card-list-item';
import {
  DEFAULT_PLAYER_TOOLS,
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  type PlayerToolsSettings,
  savePlayerTools,
} from '@/helpers/player-tools-settings';

export function ArrowSeekSettings({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState('5');
  const [enabled, setEnabled] = useState(true);
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
        setEnabled(settings.arrowKeySeekingEnabled);
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
  const persist = (updates: Partial<PlayerToolsSettings>) => {
    setError('');
    writes.current++;
    pending.current = pending.current
      .then(async () => {
        const settings = await loadPlayerTools();
        await savePlayerTools({ ...settings, ...updates });
      })
      .catch(() => setError('Could not save arrow key settings.'))
      .finally(() => {
        writes.current--;
      });
  };
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
    persist({ backward: seconds, forward: seconds });
  };
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Enable Arrow Key Seeking"
            checked={enabled}
            disabled={!ready || disabled}
            onCheckedChange={(nextEnabled) => {
              setEnabled(nextEnabled);
              persist({ arrowKeySeekingEnabled: nextEnabled });
            }}
          />
        ),
        BottomSlot: (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <label
                  className="text-slate-500 text-xs dark:text-slate-400"
                  htmlFor={id}
                >
                  Seek interval (secs)
                </label>
                <SliderResetButton
                  disabled={
                    !ready || disabled || !enabled || Number(value) === 5
                  }
                  label="Reset seek interval to 5 seconds"
                  onClick={() => {
                    setValue('5');
                    save('5');
                  }}
                />
              </div>
              <div className="w-22">
                <AppNumberInput
                  disabled={!ready || disabled || !enabled}
                  id={id}
                  label="Seek interval (secs)"
                  max={86400}
                  min={1}
                  onCommit={save}
                  onValueChange={setValue}
                  value={value}
                />
              </div>
            </div>
            {error ? (
              <p className="text-red-600 text-xs" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ),
      }}
      description={
        <span className="inline-flex flex-wrap items-center gap-1">
          Seek with <AppKbd>←</AppKbd> <AppKbd>→</AppKbd>
        </span>
      }
      icon={KeyboardIcon}
      iconIsToggled={enabled}
      title="Arrow Key Seeking"
    />
  );
}

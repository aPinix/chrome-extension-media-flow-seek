import { PanelsTopLeftIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import {
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  savePlayerTools,
} from '@/helpers/player-tools-settings';

export function YouTubeInfoCardsSetting({ disabled = false }: { disabled?: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadPlayerTools()
      .then((settings) => {
        if (!mounted) return;
        setEnabled(!settings.hideEndScreens);
        setReady(true);
      })
      .catch(() => {
        if (mounted) setError('Could not load Info Cards settings.');
      });
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY]) {
        setEnabled(!normalizePlayerTools(changes[PLAYER_TOOLS_KEY].newValue).hideEndScreens);
      }
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);

  return (
    <CardListItem
      title="Toggle Info Cards"
      description="Show recommendation cards at the end of YouTube videos"
      icon={PanelsTopLeftIcon}
      iconIsToggled={enabled}
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Toggle Info Cards on YouTube"
            checked={enabled}
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => {
              setSaving(true);
              setError('');
              void loadPlayerTools()
                .then((settings) => savePlayerTools({ ...settings, hideEndScreens: !next }))
                .then(() => setEnabled(next))
                .catch(() => setError('Could not save Info Cards settings.'))
                .finally(() => setSaving(false));
            }}
          />
        ),
        BottomSlot: error ? <p role="alert" className="text-xs text-red-600">{error}</p> : undefined,
      }}
    />
  );
}

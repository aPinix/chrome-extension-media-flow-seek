import { Volume2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { AppSlider } from '@/components/app/app-slider';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { loadPlayerTools, normalizePlayerTools, PLAYER_TOOLS_KEY, savePlayerTools, type PlayerToolsSettings } from '@/helpers/player-tools-settings';

export function YouTubeBoostSetting({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState(2);
  const [enabled, setEnabled] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    void loadPlayerTools().then(settings => {
      if (mounted) { setValue(settings.youtubeBoost); setEnabled(settings.youtubeBoostEnabled); setAutomatic(settings.youtubeAutoBoost); setReady(true); }
    }).catch(() => { if (mounted) setError('Could not load volume boost settings.'); });
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY]) {
        const settings = normalizePlayerTools(changes[PLAYER_TOOLS_KEY].newValue);
        setValue(settings.youtubeBoost); setEnabled(settings.youtubeBoostEnabled); setAutomatic(settings.youtubeAutoBoost);
      }
    };
    chrome.storage.onChanged.addListener(changed);
    return () => { mounted = false; chrome.storage.onChanged.removeListener(changed); };
  }, []);
  const save = (patch: Partial<PlayerToolsSettings>) => {
    setSaving(true); setError('');
    void loadPlayerTools().then(settings => savePlayerTools({ ...settings, ...patch }))
      .then(() => {
        if (patch.youtubeBoostEnabled !== undefined) setEnabled(patch.youtubeBoostEnabled);
        if (patch.youtubeAutoBoost !== undefined) setAutomatic(patch.youtubeAutoBoost);
        if (patch.youtubeBoost !== undefined) setValue(patch.youtubeBoost);
      })
      .catch(() => setError('Could not save volume boost settings.'))
      .finally(() => setSaving(false));
  };
  return <CardListItem
    title="Boost Volume"
    description="Add a volume boost button to YouTube’s player controls"
    icon={Volume2Icon}
    components={{
      RightSlot: <AppSwitch aria-label="Enable Boost Volume" checked={enabled} disabled={disabled || !ready || saving} onCheckedChange={next => save({ youtubeBoostEnabled: next })} />,
      BottomSlot: enabled || error ? <>
        {enabled && <div className="ml-8 border-t border-slate-100 pt-3 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-700 text-sm dark:text-slate-300">Boost level</span>
              <SliderResetButton label="Reset boost level to default" disabled={disabled || saving || value === 2} onClick={() => save({ youtubeBoost: 2 })} />
            </div>
            <span className="min-w-10 text-right font-semibold text-brand text-sm tabular-nums dark:text-brand-300">{value}×</span>
          </div>
          <AppSlider className="mt-1 rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35" thumbClassName="after:opacity-0" trackClassName="h-3" aria-label="Volume boost multiplier" min={2} max={10} step={1} value={value} disabled={disabled || !ready || saving}
            onValueChange={next => setValue(Array.isArray(next) ? next[0]! : next)}
            onValueCommitted={next => save({ youtubeBoost: Array.isArray(next) ? next[0]! : next })} />
          <div className="-mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500"><span>2×</span><span>10×</span></div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-medium text-slate-700 text-xs dark:text-slate-300">Automatically boost the volume</span>
            <AppSwitch aria-label="Automatically boost the volume" checked={automatic} disabled={disabled || !ready || saving} onCheckedChange={next => save({ youtubeAutoBoost: next })} />
          </div>
        </div>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </> : undefined,
    }} />;
}

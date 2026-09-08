import { RepeatIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppSwitch } from '@/components/app/app-switch';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import { CardListItem } from '@/components/popup/card-list-item';
import {
  loadPlayerTools,
  normalizePlayerTools,
  PLAYER_TOOLS_KEY,
  savePlayerTools,
} from '@/helpers/player-tools-settings';

export function YouTubeLoopSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [remember, setRemember] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    void loadPlayerTools()
      .then((settings) => {
        if (mounted) {
          setEnabled(settings.youtubeLoop);
          setRemember(settings.rememberYoutubeLoops);
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) setError('Could not load Loop Sections settings.');
      });
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'sync' && changes[PLAYER_TOOLS_KEY]) {
        const settings = normalizePlayerTools(
          changes[PLAYER_TOOLS_KEY].newValue
        );
        setEnabled(settings.youtubeLoop);
        setRemember(settings.rememberYoutubeLoops);
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
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Enable Loop Sections on YouTube"
            checked={enabled}
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => {
              setSaving(true);
              setError('');
              void loadPlayerTools()
                .then((settings) =>
                  savePlayerTools({ ...settings, youtubeLoop: next })
                )
                .then(() => setEnabled(next))
                .catch(() => setError('Could not save Loop Sections settings.'))
                .finally(() => setSaving(false));
            }}
          />
        ),
        BottomSlot:
          enabled || error ? (
            <>
              {enabled && (
                <div className="ml-8 flex items-center justify-between gap-3 border-slate-100 border-t pt-3 dark:border-white/5">
                  <div>
                    <div className="font-medium text-slate-700 text-xs dark:text-slate-300">
                      Remember loops in videos
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Save sections for your next visit.
                    </p>
                  </div>
                  <AppSwitch
                    aria-label="Remember loops in videos"
                    checked={remember}
                    disabled={disabled || !ready || saving}
                    onCheckedChange={(next) => {
                      setSaving(true);
                      setError('');
                      void loadPlayerTools()
                        .then((settings) =>
                          savePlayerTools({
                            ...settings,
                            rememberYoutubeLoops: next,
                          })
                        )
                        .then(() => setRemember(next))
                        .catch(() => setError('Could not save Loop Sections settings.'))
                        .finally(() => setSaving(false));
                    }}
                  />
                </div>
              )}
              {error && (
                <p className="text-red-600 text-xs" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : undefined,
      }}
      description="Add Loop Sections to YouTube’s player controls"
      icon={RepeatIcon}
      title={
        <span className="inline-flex items-center gap-1.5">
          Loop Sections
          <ExtraFeaturePreviewTooltip featureName="Loop Sections" />
        </span>
      }
    />
  );
}

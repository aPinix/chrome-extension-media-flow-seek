import { LightbulbIcon } from 'lucide-react';
import { AppSlider } from '@/components/app/app-slider';
import { AppSwitch } from '@/components/app/app-switch';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { CardListItem } from '@/components/popup/card-list-item';
import { DEFAULT_PLAYER_TOOLS } from '@/helpers/player-tools-settings';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeCinemaSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save, preview } =
    usePlayerToolsPreferences('Cinema Mode');
  const unavailable = disabled || !ready || saving;
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Cinema Mode button on YouTube"
            checked={settings.youtubeCinemaEnabled}
            data-youtube-control="cinema"
            disabled={unavailable}
            onCheckedChange={(next) => save({ youtubeCinemaEnabled: next })}
          />
        ),
        BottomSlot:
          settings.youtubeCinemaEnabled || error ? (
            <div className="space-y-3">
              {settings.youtubeCinemaEnabled && (
                <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-700 text-xs dark:text-slate-300">
                        Page dimming
                      </span>
                      <SliderResetButton
                        disabled={
                          unavailable ||
                          settings.dimming === DEFAULT_PLAYER_TOOLS.dimming
                        }
                        label="Reset cinema dimming to 80 percent"
                        onClick={() =>
                          save({ dimming: DEFAULT_PLAYER_TOOLS.dimming })
                        }
                      />
                    </div>
                    <span className="font-semibold text-brand text-xs tabular-nums dark:text-brand-300">
                      {settings.dimming}%
                    </span>
                  </div>
                  <AppSlider
                    aria-label="Cinema page dimming"
                    className="rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35"
                    disabled={unavailable}
                    max={100}
                    min={0}
                    onValueChange={(next) =>
                      preview({
                        dimming: Array.isArray(next) ? (next[0] ?? 80) : next,
                      })
                    }
                    onValueCommitted={(next) =>
                      save({
                        dimming: Array.isArray(next) ? (next[0] ?? 80) : next,
                      })
                    }
                    step={1}
                    thumbClassName="after:opacity-0"
                    trackClassName="h-3"
                    value={settings.dimming}
                  />
                  <div className="-mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
              {error && (
                <p className="text-red-600 text-xs" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : undefined,
      }}
      description="Add a button to dim the page around the video"
      icon={LightbulbIcon}
      iconIsToggled={settings.youtubeCinemaEnabled}
      title="Cinema Mode"
    />
  );
}

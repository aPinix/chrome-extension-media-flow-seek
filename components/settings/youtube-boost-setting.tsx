import { Volume2Icon } from 'lucide-react';
import { AppSlider } from '@/components/app/app-slider';
import { AppSwitch } from '@/components/app/app-switch';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { CardListItem } from '@/components/popup/card-list-item';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeBoostSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save, preview } =
    usePlayerToolsPreferences('volume boost');
  const controlsDisabled = disabled || !ready || saving;
  const value = settings.youtubeBoost;
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Boost Volume button on YouTube"
            checked={settings.youtubeBoostEnabled}
            data-youtube-control="boost"
            disabled={controlsDisabled}
            onCheckedChange={(next) => save({ youtubeBoostEnabled: next })}
          />
        ),
        BottomSlot:
          settings.youtubeBoostEnabled || error ? (
            <>
              {settings.youtubeBoostEnabled && (
                <div className="ml-8 border-slate-100 border-t pt-3 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-700 text-sm dark:text-slate-300">
                        Boost level
                      </span>
                      <SliderResetButton
                        disabled={controlsDisabled || value === 2}
                        label="Reset boost level to default"
                        onClick={() => save({ youtubeBoost: 2 })}
                      />
                    </div>
                    <span className="min-w-10 text-right font-semibold text-brand text-sm tabular-nums dark:text-brand-300">
                      {value}×
                    </span>
                  </div>
                  <AppSlider
                    aria-label="Volume boost multiplier"
                    className="mt-1 rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35"
                    disabled={controlsDisabled}
                    max={10}
                    min={2}
                    onValueChange={(next) =>
                      preview({
                        youtubeBoost: Array.isArray(next)
                          ? (next[0] ?? 2)
                          : next,
                      })
                    }
                    onValueCommitted={(next) =>
                      save({
                        youtubeBoost: Array.isArray(next)
                          ? (next[0] ?? 2)
                          : next,
                      })
                    }
                    step={1}
                    thumbClassName="after:opacity-0"
                    trackClassName="h-3"
                    value={value}
                  />
                  <div className="-mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span>2×</span>
                    <span>10×</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700 text-xs dark:text-slate-300">
                      Automatically boost the volume
                    </span>
                    <AppSwitch
                      aria-label="Automatically boost the volume"
                      checked={settings.youtubeAutoBoost}
                      disabled={controlsDisabled}
                      onCheckedChange={(next) =>
                        save({ youtubeAutoBoost: next })
                      }
                    />
                  </div>
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
      description="Add a button to boost the video’s volume"
      icon={Volume2Icon}
      iconIsToggled={settings.youtubeBoostEnabled}
      title="Boost Volume"
    />
  );
}

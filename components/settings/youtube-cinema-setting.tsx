import { LightbulbIcon, PipetteIcon } from 'lucide-react';
import { useState } from 'react';
import { AppSlider } from '@/components/app/app-slider';
import { AppSwitch } from '@/components/app/app-switch';
import { SliderResetButton } from '@/components/app/slider-reset-button';
import { CardListItem } from '@/components/popup/card-list-item';
import { cinemaPresets } from '@/helpers/player-cinema-presets';
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
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const selectedPreset = cinemaPresets.find(
    ({ color }) => color === settings.cinemaColor
  );
  const customSelected = settings.cinemaColorCustom || !selectedPreset;
  const customLabel = `Custom: ${settings.cinemaColor}`;
  const selectionLabel =
    hoveredPreset ?? (customSelected ? customLabel : selectedPreset?.name);
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
                  <fieldset className="mt-3 space-y-2 border-0 p-0">
                    <legend className="font-medium text-slate-700 text-xs dark:text-slate-300">
                      Color
                      <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                        ({selectionLabel})
                      </span>
                    </legend>
                    <div className="flex items-center gap-2">
                      {cinemaPresets.map(({ name, color }) => (
                        <button
                          aria-label={`${name} Cinema Mode preset`}
                          aria-pressed={
                            !customSelected && settings.cinemaColor === color
                          }
                          className="size-7 shrink-0 rounded-full border border-black/15 outline-none ring-offset-2 ring-offset-slate-50 hover:ring-2 hover:ring-brand/40 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-brand dark:border-white/20 dark:ring-offset-slate-900"
                          disabled={unavailable}
                          key={color}
                          onClick={() =>
                            save({
                              cinemaColor: color,
                              cinemaColorCustom: false,
                            })
                          }
                          onMouseEnter={() => setHoveredPreset(name)}
                          onMouseLeave={() => setHoveredPreset(null)}
                          style={{ backgroundColor: color }}
                          title={name}
                          type="button"
                        />
                      ))}
                      <label
                        className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border border-black/15 text-white ring-offset-2 ring-offset-slate-50 focus-within:ring-2 focus-within:ring-brand dark:border-white/20 dark:ring-offset-slate-900 ${customSelected ? 'ring-2 ring-brand' : ''}`}
                        data-selected={customSelected ? '' : undefined}
                        onMouseEnter={() => setHoveredPreset(customLabel)}
                        onMouseLeave={() => setHoveredPreset(null)}
                        style={{
                          background: customSelected
                            ? settings.cinemaColor
                            : 'conic-gradient(#f87171,#fbbf24,#4ade80,#38bdf8,#a78bfa,#f87171)',
                        }}
                        title="Custom color"
                      >
                        <PipetteIcon
                          aria-hidden="true"
                          className="size-3.5 drop-shadow"
                        />
                        <input
                          aria-label="Custom Cinema Mode color"
                          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
                          disabled={disabled || !ready}
                          onChange={(event) =>
                            save({
                              cinemaColor: event.target.value,
                              cinemaColorCustom: true,
                            })
                          }
                          onClick={() => save({ cinemaColorCustom: true })}
                          type="color"
                          value={settings.cinemaColor}
                        />
                      </label>
                    </div>
                  </fieldset>
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

import { useId } from 'react';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { YouTubeScreenshotIcon } from '@/components/youtube-screenshot-icon';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeScreenshotSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Screenshot');
  const effectsId = useId();
  const unavailable = disabled || !ready || saving;
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Screenshot button on YouTube"
            checked={settings.youtubeScreenshotEnabled}
            data-youtube-control="screenshot"
            disabled={unavailable}
            onCheckedChange={(next) => save({ youtubeScreenshotEnabled: next })}
          />
        ),
        BottomSlot:
          settings.youtubeScreenshotEnabled || error ? (
            <div className="space-y-3">
              {settings.youtubeScreenshotEnabled && (
                <label
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-slate-600 text-xs dark:bg-slate-900/40 dark:text-slate-300"
                  htmlFor={effectsId}
                >
                  <span aria-hidden="true">Include video filter effects</span>
                  <AppSwitch
                    aria-label="Include video filter effects in screenshots"
                    checked={settings.youtubeScreenshotIncludeFilters}
                    disabled={unavailable}
                    id={effectsId}
                    onCheckedChange={(next) =>
                      save({ youtubeScreenshotIncludeFilters: next })
                    }
                    size="sm"
                  />
                </label>
              )}
              {error && (
                <p className="text-red-600 text-xs" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : undefined,
      }}
      description="Add a button to save the current video frame as a PNG"
      icon={YouTubeScreenshotIcon}
      iconIsToggled={settings.youtubeScreenshotEnabled}
      title="Screenshot"
    />
  );
}

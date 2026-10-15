import { RepeatIcon } from 'lucide-react';
import { useId } from 'react';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeLoopSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Loop Sections');
  const rememberId = useId();
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Loop Sections button on YouTube"
            checked={settings.youtubeLoop}
            data-youtube-control="loop"
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => save({ youtubeLoop: next })}
          />
        ),
        BottomSlot:
          settings.youtubeLoop || error ? (
            <div className="space-y-3">
              {settings.youtubeLoop && (
                <label
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-slate-600 text-xs dark:bg-slate-900/40 dark:text-slate-300"
                  htmlFor={rememberId}
                >
                  <span aria-hidden="true">
                    <span className="block">Remember loops in videos</span>
                    <span className="mt-1 block text-muted-foreground text-xs">
                      Save sections for your next visit.
                    </span>
                  </span>
                  <AppSwitch
                    aria-label="Remember loops in videos"
                    checked={settings.rememberYoutubeLoops}
                    disabled={disabled || !ready || saving}
                    id={rememberId}
                    onCheckedChange={(next) =>
                      save({ rememberYoutubeLoops: next })
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
      description="Add a button to repeat sections of the video"
      icon={RepeatIcon}
      iconIsToggled={settings.youtubeLoop}
      title={
        <span className="inline-flex items-center gap-1.5">
          Loop Sections
          <ExtraFeaturePreviewTooltip featureName="Loop Sections" />
        </span>
      }
    />
  );
}

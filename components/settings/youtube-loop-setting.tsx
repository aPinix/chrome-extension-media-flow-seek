import { RepeatIcon } from 'lucide-react';
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
            <>
              {settings.youtubeLoop && (
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
                    checked={settings.rememberYoutubeLoops}
                    disabled={disabled || !ready || saving}
                    onCheckedChange={(next) =>
                      save({ rememberYoutubeLoops: next })
                    }
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

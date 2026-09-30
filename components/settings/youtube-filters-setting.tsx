import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { YouTubeFiltersIcon } from '@/components/youtube-filters-icon';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeFiltersSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Video Filters');
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Video Filters button on YouTube"
            checked={settings.youtubeFiltersEnabled}
            data-youtube-control="filters"
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => save({ youtubeFiltersEnabled: next })}
          />
        ),
        BottomSlot: error ? (
          <p className="text-red-600 text-xs" role="alert">
            {error}
          </p>
        ) : undefined,
      }}
      description="Add a button to adjust the video’s brightness, contrast and color"
      icon={YouTubeFiltersIcon}
      iconIsToggled={settings.youtubeFiltersEnabled}
      title="Video Filters"
    />
  );
}

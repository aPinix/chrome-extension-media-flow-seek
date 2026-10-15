import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { YouTubeBookmarksIcon } from '@/components/youtube-bookmarks-icon';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeBookmarksSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Bookmarks');
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Bookmarks button on YouTube"
            checked={settings.youtubeBookmarksEnabled}
            data-youtube-control="bookmarks"
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => save({ youtubeBookmarksEnabled: next })}
          />
        ),
        BottomSlot: error ? (
          <p className="text-red-600 text-xs" role="alert">
            {error}
          </p>
        ) : undefined,
      }}
      description="Click to bookmark a moment. Hold to move or rename bookmarks."
      icon={YouTubeBookmarksIcon}
      iconIsToggled={settings.youtubeBookmarksEnabled}
      title="Bookmarks"
    />
  );
}

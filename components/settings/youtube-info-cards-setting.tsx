import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { YouTubeInfoCardsIcon } from '@/components/youtube-info-cards-icon';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeInfoCardsSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Info Cards');
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show Info Cards button on YouTube"
            checked={settings.youtubeInfoCardsEnabled}
            data-youtube-control="infoCards"
            disabled={disabled || !ready || saving}
            onCheckedChange={(next) => save({ youtubeInfoCardsEnabled: next })}
          />
        ),
        BottomSlot: error ? (
          <p className="text-red-600 text-xs" role="alert">
            {error}
          </p>
        ) : undefined,
      }}
      description="Add a button to show or hide end-of-video recommendations"
      icon={YouTubeInfoCardsIcon}
      iconIsToggled={settings.youtubeInfoCardsEnabled}
      title="Info Cards"
    />
  );
}

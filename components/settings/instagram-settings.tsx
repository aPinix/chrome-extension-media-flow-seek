import { GaugeIcon, SkipForwardIcon } from 'lucide-react';
import { AppSelect } from '@/components/app/app-select';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { CardListItemWrapper } from '@/components/popup/card-list-item-wrapper';
import { INSTAGRAM_SPEEDS } from '@/helpers/instagram-settings';

export function InstagramSettings({
  extensionEnabled,
  playbackSpeed,
  autoSkip,
  onPlaybackSpeedChange,
  onAutoSkipChange,
  showPlaybackSpeed,
  showAutoSkip,
  onShowPlaybackSpeedChange,
  onShowAutoSkipChange,
}: {
  showPlaybackSpeed: boolean;
  showAutoSkip: boolean;
  onShowPlaybackSpeedChange: (enabled: boolean) => void;
  onShowAutoSkipChange: (enabled: boolean) => void;
  extensionEnabled: boolean;
  playbackSpeed: number;
  autoSkip: boolean;
  onPlaybackSpeedChange: (speed: number) => void;
  onAutoSkipChange: (enabled: boolean) => void;
}) {
  return (
    <fieldset
      className={!extensionEnabled ? 'pointer-events-none opacity-50' : ''}
      disabled={!extensionEnabled}
    >
      <CardListItemWrapper>
        <CardListItem
          components={{
            BottomSlot: (
              <div className="ml-8 flex items-center justify-between gap-3 border-slate-200/70 border-t pt-3 text-slate-500 text-xs dark:border-slate-600/60 dark:text-slate-400">
                <span>Show on page</span>
                <AppSwitch
                  aria-label="Show Instagram playback speed on page"
                  checked={showPlaybackSpeed}
                  disabled={!extensionEnabled}
                  onCheckedChange={onShowPlaybackSpeedChange}
                />
              </div>
            ),
            RightSlot: (
              <AppSelect
                items={INSTAGRAM_SPEEDS.map((speed) => ({
                  label: `${speed}×`,
                  value: String(speed),
                }))}
                label="Instagram playback speed"
                onValueChange={(value) => onPlaybackSpeedChange(Number(value))}
                value={String(playbackSpeed)}
              />
            ),
          }}
          description="Remember the speed for Instagram videos"
          icon={GaugeIcon}
          iconIsToggled={playbackSpeed !== 1}
          title="Playback Speed"
        />
        <CardListItem
          components={{
            BottomSlot: (
              <div className="ml-8 flex items-center justify-between gap-3 border-slate-200/70 border-t pt-3 text-slate-500 text-xs dark:border-slate-600/60 dark:text-slate-400">
                <span>Show on page</span>
                <AppSwitch
                  aria-label="Show Instagram auto-skip on page"
                  checked={showAutoSkip}
                  disabled={!extensionEnabled}
                  onCheckedChange={onShowAutoSkipChange}
                />
              </div>
            ),
            RightSlot: (
              <AppSwitch
                aria-label="Instagram auto-skip"
                checked={autoSkip}
                disabled={!extensionEnabled}
                onCheckedChange={onAutoSkipChange}
              />
            ),
          }}
          description="Play the next reel when the current one ends"
          icon={SkipForwardIcon}
          iconIsToggled={autoSkip}
          title="Auto-Skip"
        />
      </CardListItemWrapper>
    </fieldset>
  );
}

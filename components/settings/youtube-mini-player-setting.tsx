import { PictureInPicture2Icon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { AppButton } from '@/components/app/app-button';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import {
  DEFAULT_MINI_PLAYER_GEOMETRY,
  MINI_PLAYER_GEOMETRY_KEY,
} from '@/helpers/mini-player-settings';
import { usePlayerToolsPreferences } from './use-player-tools-preferences';

export function YouTubeMiniPlayerSetting({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { settings, ready, saving, error, save } =
    usePlayerToolsPreferences('Mini Player');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const unavailable = disabled || !ready || saving || resetting;
  const reset = async () => {
    setResetting(true);
    setResetError('');
    try {
      await chrome.storage.local.set({
        [MINI_PLAYER_GEOMETRY_KEY]: { ...DEFAULT_MINI_PLAYER_GEOMETRY },
      });
    } catch {
      setResetError('Could not reset Mini Player position and size.');
    } finally {
      setResetting(false);
    }
  };
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Use Mini Player on YouTube"
            checked={settings.miniPlayer}
            disabled={unavailable}
            onCheckedChange={(next) => save({ miniPlayer: next })}
          />
        ),
        BottomSlot:
          settings.miniPlayer || error || resetError ? (
            <div className="space-y-2">
              {settings.miniPlayer && (
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="mb-2 text-slate-500 text-xs dark:text-slate-400">
                    Drag to move and resize from the corner. Your layout is
                    saved on this device.
                  </p>
                  <AppButton
                    disabled={unavailable}
                    onClick={() => void reset()}
                    size="sm"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Reset position and size
                  </AppButton>
                </div>
              )}
              {(error || resetError) && (
                <p className="text-red-600 text-xs" role="alert">
                  {error || resetError}
                </p>
              )}
            </div>
          ) : undefined,
      }}
      description="Keep playing videos visible when you scroll down."
      icon={PictureInPicture2Icon}
      iconIsToggled={settings.miniPlayer}
      title="Mini Player"
    />
  );
}

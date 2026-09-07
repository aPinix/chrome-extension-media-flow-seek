import { EyeIcon, LockKeyholeIcon } from 'lucide-react';

import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ShowOnHoverSettingPropsI {
  checked: boolean;
  isSeekbarSeekingEnabled: boolean;
  isSeekbarThumbnailPreviewEnabled: boolean;
  onCheckedChange: (enabled: boolean) => void;
}

export function ShowOnHoverSetting({
  checked,
  isSeekbarSeekingEnabled,
  isSeekbarThumbnailPreviewEnabled,
  onCheckedChange,
}: ShowOnHoverSettingPropsI) {
  const lockedBy = isSeekbarSeekingEnabled ? 'Click & Drag Seekbar' : null;
  const effectiveChecked = checked || lockedBy !== null;

  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label="Show timeline on hover"
            checked={effectiveChecked}
            disabled={lockedBy !== null}
            onCheckedChange={onCheckedChange}
          />
        ),
      }}
      description={
        lockedBy
          ? `Locked on while ${lockedBy} is enabled`
          : isSeekbarThumbnailPreviewEnabled
            ? 'Hover Thumbnails keeps the timeline visible on hover on YouTube'
            : 'Reveal progress when the pointer is over a video'
      }
      icon={EyeIcon}
      iconIsToggled={effectiveChecked}
      title={
        <span className="inline-flex items-center gap-1.5">
          Timeline Show on Hover
          <ExtraFeaturePreviewTooltip featureName="Timeline Show on Hover" />
          {lockedBy ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label="Why Timeline Show on Hover is locked"
                      className="cursor-help rounded-sm text-amber-500 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-400"
                      type="button"
                    >
                      <LockKeyholeIcon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipContent>
                  <strong>Click & Drag Seekbar</strong> needs the timeline
                  visible so it can be used.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </span>
      }
    />
  );
}

import { ImagesIcon } from 'lucide-react';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';

export function SocialThumbnailSetting({
  site,
  enabled,
  disabled,
  onChange,
}: {
  site: 'Instagram' | 'TikTok';
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <CardListItem
      components={{
        RightSlot: (
          <AppSwitch
            aria-label={`Hover Thumbnails on ${site}`}
            checked={enabled}
            disabled={disabled}
            onCheckedChange={onChange}
          />
        ),
      }}
      description={`Preview the frame and time on ${site}`}
      icon={ImagesIcon}
      iconIsToggled={enabled}
      title={
        <span className="inline-flex items-center gap-1.5">
          Hover Thumbnails
          <ExtraFeaturePreviewTooltip featureName="Hover Thumbnails" />
        </span>
      }
    />
  );
}

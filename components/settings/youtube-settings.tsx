import { ImagesIcon, ListVideoIcon } from 'lucide-react';

import { AppBetaBadge } from '@/components/app/app-beta-badge';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { CardListItemWrapper } from '@/components/popup/card-list-item-wrapper';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import { cn } from '@/lib/utils';

export function YouTubeSettings({
  chapteredTimelineEnabled,
  extensionEnabled,
  onChapteredTimelineEnabledChange,
  thumbnailPreviewEnabled,
  onThumbnailPreviewEnabledChange,
}: {
  thumbnailPreviewEnabled: boolean;
  onThumbnailPreviewEnabledChange: (enabled: boolean) => void;
  chapteredTimelineEnabled: boolean;
  extensionEnabled: boolean;
  onChapteredTimelineEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <CardListItemWrapper
      className={cn(!extensionEnabled && 'pointer-events-none opacity-50')}
    >
      <CardListItem
        components={{
          RightSlot: (
            <AppSwitch
              aria-label="Use chaptered timeline on YouTube"
              checked={chapteredTimelineEnabled}
              disabled={!extensionEnabled}
              onCheckedChange={onChapteredTimelineEnabledChange}
            />
          ),
        }}
        description="Show YouTube chapter divisions and names"
        icon={ListVideoIcon}
        iconIsToggled={chapteredTimelineEnabled}
        title={
          <span className="inline-flex items-center gap-2">
            Chaptered Timeline
            <AppBetaBadge
              featureName="Chaptered Timeline"
              tooltip={
                <>
                  <strong>Chaptered Timeline</strong> is in beta and may need
                  adjustments as YouTube updates its players.
                </>
              }
            />
          </span>
        }
      />
      <CardListItem
        components={{
          RightSlot: (
            <AppSwitch
              aria-label="Show hover thumbnails on YouTube"
              checked={thumbnailPreviewEnabled}
              disabled={!extensionEnabled}
              onCheckedChange={onThumbnailPreviewEnabledChange}
            />
          ),
        }}
        description="Preview the frame, time, and chapter on YouTube"
        icon={ImagesIcon}
        iconIsToggled={thumbnailPreviewEnabled}
        title={
          <span className="inline-flex items-center gap-1.5">
            Hover Thumbnails
            <ExtraFeaturePreviewTooltip featureName="Hover Thumbnails" />
            <AppBetaBadge
              featureName="Hover Thumbnails"
              tooltip={
                <>
                  <strong>Frame previews</strong> are best effort and depend on
                  preview availability for the YouTube video.
                </>
              }
            />
          </span>
        }
      />
    </CardListItemWrapper>
  );
}

import { ListVideoIcon } from 'lucide-react';

import { AppBetaBadge } from '@/components/app/app-beta-badge';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { CardListItemWrapper } from '@/components/popup/card-list-item-wrapper';
import { cn } from '@/lib/utils';

export function YouTubeSettings({
  chapteredTimelineEnabled,
  extensionEnabled,
  onChapteredTimelineEnabledChange,
}: {
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
              tooltip="Chaptered Timeline is in beta and may need adjustments as YouTube updates its players."
            />
          </span>
        }
      />
    </CardListItemWrapper>
  );
}

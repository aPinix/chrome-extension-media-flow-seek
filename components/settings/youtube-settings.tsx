import { ListVideoIcon } from 'lucide-react';
import { useState } from 'react';

import { AppBetaBadge } from '@/components/app/app-beta-badge';
import { AppSwitch } from '@/components/app/app-switch';
import { CardListItem } from '@/components/popup/card-list-item';
import { CardListItemWrapper } from '@/components/popup/card-list-item-wrapper';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import {
  YOUTUBE_CONTROL_ORDER,
  type YouTubeControl,
} from '@/helpers/youtube-control-icons';
import { cn } from '@/lib/utils';
import { YouTubeBoostSetting } from './youtube-boost-setting';
import { YouTubeCinemaSetting } from './youtube-cinema-setting';
import { YouTubeInfoCardsSetting } from './youtube-info-cards-setting';
import { YouTubeLoopSetting } from './youtube-loop-setting';
import { YouTubeMiniPlayerSetting } from './youtube-mini-player-setting';
import { YouTubePlayerButtonPreview } from './youtube-player-button-preview';

export function YouTubeSettings({
  chapteredTimelineEnabled,
  extensionEnabled,
  onChapteredTimelineEnabledChange,
}: {
  chapteredTimelineEnabled: boolean;
  extensionEnabled: boolean;
  onChapteredTimelineEnabledChange: (enabled: boolean) => void;
}) {
  const [activePreview, setActivePreview] = useState<YouTubeControl | null>(
    null
  );
  const highlightRow = (target: EventTarget | null) => {
    const feature =
      target instanceof Element
        ? target
            .closest('.card-list-item')
            ?.querySelector('[data-youtube-control]')
            ?.getAttribute('data-youtube-control')
        : null;
    setActivePreview(
      YOUTUBE_CONTROL_ORDER.find((control) => control === feature) ?? null
    );
  };
  return (
    <section
      aria-label="YouTube player settings"
      className={cn(
        'relative rounded-xl bg-white dark:bg-slate-800/70',
        !extensionEnabled && 'pointer-events-none opacity-50'
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setActivePreview(null);
      }}
      onFocus={(event) => highlightRow(event.target)}
      onMouseLeave={(event) =>
        highlightRow(event.currentTarget.ownerDocument.activeElement)
      }
      onMouseOver={(event) => highlightRow(event.target)}
    >
      <div className="sticky top-16 z-20">
        <YouTubePlayerButtonPreview feature={activePreview} />
      </div>
      <CardListItemWrapper className="[&>.card-list-item:first-child]:rounded-t-none">
        <YouTubeBoostSetting disabled={!extensionEnabled} />
        <YouTubeCinemaSetting disabled={!extensionEnabled} />
        <YouTubeLoopSetting disabled={!extensionEnabled} />
        <YouTubeInfoCardsSetting disabled={!extensionEnabled} />
        <YouTubeMiniPlayerSetting disabled={!extensionEnabled} />
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
          description="Timeline feature: show YouTube chapter divisions and names"
          icon={ListVideoIcon}
          iconIsToggled={chapteredTimelineEnabled}
          title={
            <span className="inline-flex items-center gap-2">
              Chaptered Timeline
              <ExtraFeaturePreviewTooltip featureName="Chaptered Timeline" />
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
      </CardListItemWrapper>
    </section>
  );
}

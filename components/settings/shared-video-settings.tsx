import { GaugeIcon, ImagesIcon, SkipForwardIcon } from 'lucide-react';
import { type ElementType, useId } from 'react';
import { AppSlider } from '@/components/app/app-slider';
import { AppSwitch } from '@/components/app/app-switch';
import {
  InstagramBrandIcon,
  TikTokBrandIcon,
  YouTubeBrandIcon,
} from '@/components/icons/icons';
import { CardListItem } from '@/components/popup/card-list-item';
import { CardListItemWrapper } from '@/components/popup/card-list-item-wrapper';
import { ExtraFeaturePreviewTooltip } from '@/components/popup/extra-feature-preview-tooltip';
import { INSTAGRAM_SPEEDS } from '@/helpers/instagram-settings';

export interface SocialVideoPreferences {
  thumbnailPreviewEnabled: boolean;
  onThumbnailPreviewEnabledChange: (enabled: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  autoSkip: boolean;
  onAutoSkipChange: (enabled: boolean) => void;
  showPlaybackSpeed: boolean;
  onShowPlaybackSpeedChange: (enabled: boolean) => void;
  showAutoSkip: boolean;
  onShowAutoSkipChange: (enabled: boolean) => void;
}

function PlatformLabel({
  name,
  icon: Icon,
}: {
  name: string;
  icon: ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-slate-700 text-xs dark:text-slate-200">
      <Icon className="size-4 shrink-0" />
      {name}
    </span>
  );
}

const controlsClassName =
  'divide-y divide-slate-200/70 rounded-lg bg-slate-50 px-3 text-xs dark:divide-slate-700 dark:bg-slate-900/40';
const visibilityClassName =
  'flex cursor-pointer items-center justify-between gap-3 pr-2 pl-6 text-slate-500 dark:text-slate-400';

export function SharedVideoSettings({
  extensionEnabled,
  youtube,
  instagram,
  tiktok,
}: {
  extensionEnabled: boolean;
  youtube: Pick<
    SocialVideoPreferences,
    'thumbnailPreviewEnabled' | 'onThumbnailPreviewEnabledChange'
  >;
  instagram: SocialVideoPreferences;
  tiktok: SocialVideoPreferences;
}) {
  const settingsId = useId();
  const socialPlatforms = [
    { name: 'Instagram', icon: InstagramBrandIcon, preferences: instagram },
    { name: 'TikTok', icon: TikTokBrandIcon, preferences: tiktok },
  ];
  const thumbnailPlatforms = [
    { name: 'YouTube', icon: YouTubeBrandIcon, preferences: youtube },
    ...socialPlatforms,
  ];

  return (
    <fieldset
      className={!extensionEnabled ? 'pointer-events-none opacity-50' : ''}
      disabled={!extensionEnabled}
    >
      <CardListItemWrapper className="overflow-hidden rounded-xl [&_.card-list-item]:rounded-none [&_.card-list-item]:border-0">
        <section aria-label="Hover Thumbnails">
          <CardListItem
            components={{
              BottomSlot: (
                <div className={controlsClassName}>
                  {thumbnailPlatforms.map(({ name, icon, preferences }) => (
                    <label
                      className="flex cursor-pointer items-center justify-between gap-3 py-3"
                      htmlFor={`${settingsId}-thumbnails-${name}`}
                      key={name}
                    >
                      <span aria-hidden="true">
                        <PlatformLabel icon={icon} name={name} />
                      </span>
                      <AppSwitch
                        aria-label={`Hover Thumbnails on ${name}`}
                        checked={preferences.thumbnailPreviewEnabled}
                        disabled={!extensionEnabled}
                        id={`${settingsId}-thumbnails-${name}`}
                        onCheckedChange={
                          preferences.onThumbnailPreviewEnabledChange
                        }
                      />
                    </label>
                  ))}
                </div>
              ),
            }}
            description="Hover over the timeline to preview a frame and its time. Enable for each site."
            icon={ImagesIcon}
            title={
              <span className="inline-flex items-center gap-1.5">
                Hover Thumbnails
                <ExtraFeaturePreviewTooltip featureName="Hover Thumbnails" />
              </span>
            }
          />
        </section>
        <section aria-label="Playback Speed">
          <CardListItem
            components={{
              BottomSlot: (
                <div className={controlsClassName}>
                  {socialPlatforms.map(({ name, icon, preferences }) => (
                    <fieldset
                      aria-label={`${name} playback speed settings`}
                      className="space-y-3 py-3"
                      disabled={!extensionEnabled}
                      key={name}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <PlatformLabel icon={icon} name={name} />
                        <span className="font-semibold text-brand tabular-nums dark:text-brand-300">
                          {preferences.playbackSpeed}×
                        </span>
                      </div>
                      <AppSlider
                        aria-label={`${name} playback speed`}
                        aria-valuetext={`${preferences.playbackSpeed}×`}
                        className="rounded-full has-focus-visible:ring-2 has-focus-visible:ring-brand/35"
                        disabled={!extensionEnabled}
                        max={INSTAGRAM_SPEEDS.length - 1}
                        min={0}
                        onValueChange={(next) => {
                          const index = Array.isArray(next)
                            ? (next[0] ?? 2)
                            : next;
                          preferences.onPlaybackSpeedChange(
                            INSTAGRAM_SPEEDS[index] ?? 1
                          );
                        }}
                        step={1}
                        thumbClassName="after:opacity-0"
                        trackClassName="h-3"
                        value={INSTAGRAM_SPEEDS.indexOf(
                          preferences.playbackSpeed
                        )}
                      />
                      <div className="-mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                        <span>0.25×</span>
                        <span>2×</span>
                      </div>
                      <label
                        className={visibilityClassName}
                        htmlFor={`${settingsId}-speed-button-${name}`}
                      >
                        <span aria-hidden="true">Show on videos</span>
                        <AppSwitch
                          aria-label={`Show ${name} playback speed on page`}
                          checked={preferences.showPlaybackSpeed}
                          disabled={!extensionEnabled}
                          id={`${settingsId}-speed-button-${name}`}
                          onCheckedChange={
                            preferences.onShowPlaybackSpeedChange
                          }
                          size="sm"
                        />
                      </label>
                    </fieldset>
                  ))}
                </div>
              ),
            }}
            description="Start videos at your preferred speed for each site. 1× is normal playback."
            icon={GaugeIcon}
            title="Playback Speed"
          />
        </section>
        <section aria-label="Auto-Skip">
          <CardListItem
            components={{
              BottomSlot: (
                <div className={controlsClassName}>
                  {socialPlatforms.map(({ name, icon, preferences }) => (
                    <fieldset
                      aria-label={`${name} auto-skip settings`}
                      className="space-y-3 py-3"
                      disabled={!extensionEnabled}
                      key={name}
                    >
                      <label
                        className="flex cursor-pointer items-center justify-between gap-3"
                        htmlFor={`${settingsId}-auto-skip-${name}`}
                      >
                        <span aria-hidden="true">
                          <PlatformLabel icon={icon} name={name} />
                        </span>
                        <AppSwitch
                          aria-label={`${name} auto-skip`}
                          checked={preferences.autoSkip}
                          disabled={!extensionEnabled}
                          id={`${settingsId}-auto-skip-${name}`}
                          onCheckedChange={preferences.onAutoSkipChange}
                        />
                      </label>
                      <label
                        className={visibilityClassName}
                        htmlFor={`${settingsId}-auto-skip-button-${name}`}
                      >
                        <span aria-hidden="true">Show on videos</span>
                        <AppSwitch
                          aria-label={`Show ${name} auto-skip on page`}
                          checked={preferences.showAutoSkip}
                          disabled={!extensionEnabled}
                          id={`${settingsId}-auto-skip-button-${name}`}
                          onCheckedChange={preferences.onShowAutoSkipChange}
                          size="sm"
                        />
                      </label>
                    </fieldset>
                  ))}
                </div>
              ),
            }}
            description="Play the next video when the current one ends"
            icon={SkipForwardIcon}
            title="Auto-Skip"
          />
        </section>
      </CardListItemWrapper>
    </fieldset>
  );
}

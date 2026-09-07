import { InfoIcon } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const EXTRA_FEATURE_PREVIEW_SOURCES = {
  'Timeline Show on Hover':
    '/images/extra-feature/extra-feature-timeline-hover.jpg',
  'Hover Thumbnails':
    '/images/extra-feature/extra-feature-hover-thumbnails.jpg',
  'Minimal Player': '/images/extra-feature/extra-feature-minimal-player.jpg',
  'Match Site Color': '/images/extra-feature/extra-feature-match-color.jpg',
} as const;

export type ExtraFeaturePreviewNameT =
  keyof typeof EXTRA_FEATURE_PREVIEW_SOURCES;

interface ExtraFeaturePreviewTooltipPropsI {
  featureName: ExtraFeaturePreviewNameT;
}

export function ExtraFeaturePreviewTooltip({
  featureName,
}: ExtraFeaturePreviewTooltipPropsI) {
  const imageSrc = EXTRA_FEATURE_PREVIEW_SOURCES[featureName];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              aria-label={`Preview ${featureName}`}
              className="cursor-help rounded-full text-slate-400 outline-none transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/35 dark:text-slate-500 dark:hover:text-brand-300"
              type="button"
            >
              <InfoIcon className="size-3.5" />
            </button>
          }
        />
        <TooltipContent
          aria-label={`${featureName} image preview`}
          className="pointer-events-none overflow-hidden rounded-xl p-0 shadow-2xl shadow-black/60"
          hideArrow
          side="top"
          sideOffset={8}
        >
          <img
            alt={`${featureName} feature preview`}
            className="aspect-video w-60 rounded-xl object-cover"
            height={135}
            loading="lazy"
            src={imageSrc}
            width={240}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

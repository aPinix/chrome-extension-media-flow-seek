import { InfoIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExtraFeaturePreview } from './extra-feature-preview';
import { LoopSectionsPreview } from './loop-sections-preview';

export const EXTRA_FEATURE_PREVIEW_NAMES = [
  'Timeline Show on Hover',
  'Hover Thumbnails',
  'Loop Sections',
  'Chaptered Timeline',
  'Minimal Player',
  'Match Site Color',
] as const;

export type ExtraFeaturePreviewNameT =
  (typeof EXTRA_FEATURE_PREVIEW_NAMES)[number];

interface ExtraFeaturePreviewTooltipPropsI {
  featureName: ExtraFeaturePreviewNameT;
}

export function ExtraFeaturePreviewTooltip({
  featureName,
}: ExtraFeaturePreviewTooltipPropsI) {
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
          aria-label={`${featureName} preview`}
          className="pointer-events-none overflow-hidden rounded-xl p-0 shadow-2xl shadow-black/60"
          hideArrow
          side="top"
          sideOffset={8}
        >
          {featureName === 'Loop Sections' ? <LoopSectionsPreview /> : <ExtraFeaturePreview featureName={featureName} />}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

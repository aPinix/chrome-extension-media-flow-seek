import type { ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AppBetaBadgePropsI {
  featureName: string;
  tooltip: ReactNode;
}

export function AppBetaBadge({ featureName, tooltip }: AppBetaBadgePropsI) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              aria-label={`${featureName} beta information`}
              className="shrink-0 cursor-help rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-[9px] text-amber-700 leading-none ring-1 ring-amber-200 transition-colors hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25 dark:hover:bg-amber-500/25"
              type="button"
            >
              Beta
            </button>
          }
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

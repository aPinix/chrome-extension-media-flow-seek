import { CrosshairIcon, GlobeIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppSwitch } from '@/components/app/app-switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getDomainMode,
  isGlobalDefaultOn,
  restoreSiteRule,
  setDomainMode,
  setGlobalDefault,
} from '@/helpers/domains';
import type { DomainConfigT, DomainModeT, DomainSortT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

import { CardListItemWrapper } from './card-list-item-wrapper';
import { DomainFavicon } from './domain-favicon';
import { DomainModeControl } from './domain-mode-control';
import { DomainName } from './domain-name';
import { DomainRulesList } from './domain-rules-list';
import { ItemRowText } from './item-row-text';
import { ViewTitle } from './view-title';

interface DeletionHistoryEntryI {
  rule: DomainConfigT;
  siteIndex: number;
}

const ROW_REMOVAL_DURATION_MS = 250;

interface SiteAccessViewPropsI {
  currentDomain: string;
  domainRules: DomainConfigT[];
  domainSort: DomainSortT;
  isActive: boolean;
  onDomainRulesChange: (rules: DomainConfigT[]) => void;
  onDomainSortChange: (sort: DomainSortT) => void;
}

export function SiteAccessView({
  currentDomain,
  domainRules,
  domainSort,
  isActive,
  onDomainRulesChange,
  onDomainSortChange,
}: SiteAccessViewPropsI) {
  const [undoDeletions, setUndoDeletions] = useState<DeletionHistoryEntryI[]>(
    []
  );
  const [redoDeletions, setRedoDeletions] = useState<DeletionHistoryEntryI[]>(
    []
  );
  const [removingDomain, setRemovingDomain] = useState('');
  const domainRulesRef = useRef(domainRules);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const removalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    domainRulesRef.current = domainRules;
  }, [domainRules]);

  useEffect(
    () => () => {
      if (removalTimerRef.current) clearTimeout(removalTimerRef.current);
    },
    []
  );

  const handleRemove = useCallback(
    (domain: string) => {
      if (removingDomain) return;

      const siteRules = domainRulesRef.current.filter(
        (rule) => rule.domain !== '*'
      );
      const siteIndex = siteRules.findIndex((rule) => rule.domain === domain);
      const removedRule = siteRules[siteIndex];
      if (!removedRule) return;

      const historyEntry = { rule: removedRule, siteIndex };
      setRemovingDomain(domain);
      removalTimerRef.current = setTimeout(() => {
        const nextRules = domainRulesRef.current.filter(
          (rule) => rule.domain !== domain
        );
        domainRulesRef.current = nextRules;
        onDomainRulesChange(nextRules);
        setUndoDeletions((current) => [...current, historyEntry]);
        setRedoDeletions([]);
        setRemovingDomain('');
        removalTimerRef.current = null;
      }, ROW_REMOVAL_DURATION_MS);
    },
    [onDomainRulesChange, removingDomain]
  );

  const handleUndo = useCallback(() => {
    const historyEntry = undoDeletions.at(-1);
    if (!historyEntry || removingDomain) return;

    const nextRules = restoreSiteRule(
      domainRulesRef.current,
      historyEntry.rule,
      historyEntry.siteIndex
    );
    domainRulesRef.current = nextRules;
    onDomainRulesChange(nextRules);
    setUndoDeletions((current) => current.slice(0, -1));
    setRedoDeletions((current) => [...current, historyEntry]);
  }, [onDomainRulesChange, removingDomain, undoDeletions]);

  const handleRedo = useCallback(() => {
    const historyEntry = redoDeletions.at(-1);
    if (!historyEntry || removingDomain) return;

    const domain = historyEntry.rule.domain;
    setRemovingDomain(domain);
    removalTimerRef.current = setTimeout(() => {
      const nextRules = domainRulesRef.current.filter(
        (rule) => rule.domain !== domain
      );
      domainRulesRef.current = nextRules;
      onDomainRulesChange(nextRules);
      setRedoDeletions((current) => current.slice(0, -1));
      setUndoDeletions((current) => [...current, historyEntry]);
      setRemovingDomain('');
      removalTimerRef.current = null;
    }, ROW_REMOVAL_DURATION_MS);
  }, [onDomainRulesChange, redoDeletions, removingDomain]);

  const handleSiteModeChange = useCallback(
    (domain: string, mode: DomainModeT) => {
      onDomainRulesChange(setDomainMode(domainRules, domain, mode));
    },
    [domainRules, onDomainRulesChange]
  );

  const handleCurrentModeChange = useCallback(
    (mode: DomainModeT) => {
      if (!currentDomain) return;
      const isSaved = domainRules.some(
        ({ domain }) => domain === currentDomain
      );
      if (!isSaved && mode === DomainModeE.Default) return;

      onDomainRulesChange(
        setDomainMode(domainRules, currentDomain, mode, {
          addAtTop: true,
          addMissing: true,
          createdAt: Date.now(),
        })
      );
    },
    [currentDomain, domainRules, onDomainRulesChange]
  );

  const currentRule = domainRules.find(
    ({ domain }) => domain === currentDomain
  );
  const globalDefaultOn = isGlobalDefaultOn(domainRules);
  const showCurrentDomainRule = useCallback(() => {
    const row = Array.from(
      scrollAreaRef.current?.querySelectorAll<HTMLElement>('[data-domain]') ??
        []
    ).find((element) => element.dataset.domain === currentDomain);

    row?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    });
  }, [currentDomain]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-100 dark:bg-slate-900">
      <ScrollArea
        className="min-h-0 flex-1 overflow-hidden overscroll-y-contain **:data-[slot='scroll-area-viewport']:relative **:data-[slot='scroll-area-viewport']:overscroll-y-contain"
        data-testid="site-access-scroll-container"
        ref={scrollAreaRef}
      >
        <div className="flex min-h-full flex-col px-6 pb-32">
          <div
            className="flex flex-col gap-6 pt-22"
            data-testid="site-access-intro"
          >
            <ViewTitle
              description="Choose where Better Video Controls runs"
              title="Domains"
            />

            <CardListItemWrapper>
              <div className="card-list-item flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all dark:border-slate-600 dark:bg-slate-800/70">
                <div
                  className={`relative flex size-5 shrink-0 items-center justify-center transition-colors duration-200 ${
                    globalDefaultOn
                      ? 'text-lime-600 dark:text-lime-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                  data-testid="global-default-icon"
                >
                  <GlobeIcon className="size-5" />
                </div>
                <ItemRowText
                  className="flex-1"
                  description={
                    <>
                      Better Video Controls is{' '}
                      <span
                        className={`font-bold transition-colors duration-200 ${
                          globalDefaultOn
                            ? 'text-lime-600 dark:text-lime-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                        data-testid="global-default-state"
                      >
                        {globalDefaultOn ? 'Enabled' : 'Disabled'}
                      </span>{' '}
                      by default on websites without a custom setting.
                    </>
                  }
                  title="Run by Default"
                />
                <AppSwitch
                  aria-label="Run Better Video Controls by default on websites"
                  checked={globalDefaultOn}
                  className="data-checked:border-lime-500 data-unchecked:border-rose-500 data-checked:bg-lime-500 data-unchecked:bg-rose-500 group-has-[:focus-visible]/field-label:data-checked:border-lime-500 group-has-[:focus-visible]/field-label:data-unchecked:border-rose-500 dark:data-unchecked:border-rose-400 dark:data-unchecked:bg-rose-400"
                  onCheckedChange={(checked) =>
                    onDomainRulesChange(setGlobalDefault(domainRules, checked))
                  }
                  thumbIcon={
                    <GlobeIcon
                      aria-hidden="true"
                      className={`size-3 transition-colors duration-200 ${
                        globalDefaultOn ? 'text-lime-600' : 'text-rose-600'
                      }`}
                    />
                  }
                />
              </div>

              {currentDomain ? (
                <div className="card-list-item flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all dark:border-slate-600 dark:bg-slate-800/70">
                  <DomainFavicon className="size-5" domain={currentDomain} />
                  <ItemRowText
                    className="flex-1"
                    description="Current website"
                    title={<DomainName domain={currentDomain} />}
                    titleTooltip={currentDomain}
                  />
                  <DomainModeControl
                    globalDefaultOn={globalDefaultOn}
                    label={`Access for current website ${currentDomain}`}
                    onChange={handleCurrentModeChange}
                    value={getDomainMode(currentRule)}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={
                              currentRule
                                ? `Show ${currentDomain} in website settings`
                                : `Add ${currentDomain} to website settings`
                            }
                            className="size-7 shrink-0 rounded-full bg-emerald-500/15 p-0 text-emerald-700 transition-[color,background-color,transform,opacity] hover:scale-105 hover:bg-emerald-500/25 hover:text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25 dark:hover:text-emerald-200"
                            onClick={() => {
                              if (currentRule) {
                                showCurrentDomainRule();
                                return;
                              }

                              onDomainRulesChange(
                                setDomainMode(
                                  domainRules,
                                  currentDomain,
                                  DomainModeE.Default,
                                  {
                                    addAtTop: true,
                                    addMissing: true,
                                    createdAt: Date.now(),
                                  }
                                )
                              );
                            }}
                            type="button"
                            variant="ghost"
                          >
                            {currentRule ? (
                              <CrosshairIcon className="size-4" />
                            ) : (
                              <PlusIcon className="size-5" />
                            )}
                          </Button>
                        }
                      />
                      <TooltipContent>
                        {currentRule
                          ? 'Already exists'
                          : 'Add to website settings'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : null}
            </CardListItemWrapper>
          </div>

          <DomainRulesList
            canRedo={redoDeletions.length > 0}
            canUndo={undoDeletions.length > 0}
            domainRules={domainRules}
            globalDefaultOn={globalDefaultOn}
            isActive={isActive}
            onAdd={(domain, mode) =>
              onDomainRulesChange(
                setDomainMode(domainRules, domain, mode, {
                  addAtTop: true,
                  addMissing: true,
                  createdAt: Date.now(),
                })
              )
            }
            onModeChange={handleSiteModeChange}
            onOrderChange={(siteRules) =>
              onDomainRulesChange([
                ...domainRules.filter(({ domain }) => domain === '*'),
                ...siteRules,
              ])
            }
            onRedo={handleRedo}
            onRemove={handleRemove}
            onSortChange={onDomainSortChange}
            onUndo={handleUndo}
            removingDomain={removingDomain}
            sort={domainSort}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

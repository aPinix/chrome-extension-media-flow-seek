import { GlobeIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppSwitch } from '@/components/app/app-switch';
import { Button } from '@/components/ui/button';
import {
  getDomainMode,
  isGlobalDefaultOn,
  restoreSiteRule,
  setDomainMode,
  setGlobalDefault,
} from '@/helpers/domains';
import type { DomainConfigT, DomainModeT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

import { CardListItemWrapper } from './card-list-item-wrapper';
import { DomainFavicon } from './domain-favicon';
import { DomainModeControl } from './domain-mode-control';
import { DomainRulesList } from './domain-rules-list';
import { ItemRowText } from './item-row-text';

interface DeletionHistoryEntryI {
  rule: DomainConfigT;
  siteIndex: number;
}

const ROW_REMOVAL_DURATION_MS = 250;

interface SiteAccessViewPropsI {
  currentDomain: string;
  domainRules: DomainConfigT[];
  onDomainRulesChange: (rules: DomainConfigT[]) => void;
}

export function SiteAccessView({
  currentDomain,
  domainRules,
  onDomainRulesChange,
}: SiteAccessViewPropsI) {
  const [undoDeletions, setUndoDeletions] = useState<DeletionHistoryEntryI[]>(
    []
  );
  const [redoDeletions, setRedoDeletions] = useState<DeletionHistoryEntryI[]>(
    []
  );
  const [removingDomain, setRemovingDomain] = useState('');
  const domainRulesRef = useRef(domainRules);
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
        })
      );
    },
    [currentDomain, domainRules, onDomainRulesChange]
  );

  const currentRule = domainRules.find(
    ({ domain }) => domain === currentDomain
  );
  const globalDefaultOn = isGlobalDefaultOn(domainRules);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-100 dark:bg-slate-700">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-6 pb-20"
        data-testid="site-access-scroll-container"
      >
        <div className="pt-34" data-testid="site-access-intro">
          <CardListItemWrapper>
            <div className="card-list-item flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all dark:border-slate-600 dark:bg-slate-800/70">
              <div
                className={`relative flex size-5 shrink-0 items-center justify-center ${
                  globalDefaultOn
                    ? 'text-sky-500 dark:text-sky-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
                data-testid="global-default-icon"
              >
                <GlobeIcon className="size-5" />
              </div>
              <ItemRowText
                className="flex-1"
                description="Default for sites without a custom setting"
                title="Run on all websites"
              />
              <AppSwitch
                aria-label="Run on all websites by default"
                checked={globalDefaultOn}
                className="data-checked:border-sky-500 data-checked:bg-sky-500 group-has-[:focus-visible]/field-label:data-checked:border-sky-500"
                onCheckedChange={(checked) =>
                  onDomainRulesChange(setGlobalDefault(domainRules, checked))
                }
                thumbIcon={
                  <GlobeIcon
                    aria-hidden="true"
                    className={`size-3 ${
                      globalDefaultOn ? 'text-sky-500' : 'text-slate-400'
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
                  title={currentDomain}
                  titleTooltip={currentDomain}
                />
                <DomainModeControl
                  label={`Access for current website ${currentDomain}`}
                  onChange={handleCurrentModeChange}
                  value={getDomainMode(currentRule)}
                />
                <Button
                  aria-label={
                    currentRule
                      ? `${currentDomain} is already in website settings`
                      : `Add ${currentDomain} to website settings`
                  }
                  className="size-7 shrink-0 rounded-full bg-emerald-500/15 p-0 text-emerald-700 transition-[color,background-color,transform,opacity] hover:scale-105 hover:bg-emerald-500/25 hover:text-emerald-800 disabled:opacity-30 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25 dark:hover:text-emerald-200"
                  disabled={Boolean(currentRule)}
                  onClick={() =>
                    onDomainRulesChange(
                      setDomainMode(
                        domainRules,
                        currentDomain,
                        DomainModeE.Default,
                        {
                          addAtTop: true,
                          addMissing: true,
                        }
                      )
                    )
                  }
                  title={
                    currentRule
                      ? 'Already added to website settings'
                      : 'Add to website settings'
                  }
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon className="size-5" />
                </Button>
              </div>
            ) : null}
          </CardListItemWrapper>
        </div>

        <DomainRulesList
          canRedo={redoDeletions.length > 0}
          canUndo={undoDeletions.length > 0}
          domainRules={domainRules}
          onAdd={(domain, mode) =>
            onDomainRulesChange(
              setDomainMode(domainRules, domain, mode, {
                addAtTop: true,
                addMissing: true,
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
          onUndo={handleUndo}
          removingDomain={removingDomain}
        />
      </div>
    </div>
  );
}

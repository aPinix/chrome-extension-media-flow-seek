import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  ListRestartIcon,
  ListSortAscendingIcon,
  PlusIcon,
  Redo2Icon,
  SearchIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createPortal } from 'react-dom';

import { AppButton } from '@/components/app/app-button';
import { AppInputText } from '@/components/app/app-input-text';
import {
  AppSortPicker,
  type AppSortPickerOptionI,
} from '@/components/app/app-sort-picker';
import { SectionTitle } from '@/components/popup/section-title';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getSiteRuleHostname,
  normalizeSiteInput,
  reorderSiteRules,
} from '@/helpers/domains';
import type { DomainConfigT, DomainModeT, DomainSortT } from '@/types/domains';
import { DomainModeE, DomainSortE } from '@/types/domains';

import { DomainFavicon } from './domain-favicon';
import { DomainListItem } from './domain-list-item';

interface DomainRulesListPropsI {
  canRedo: boolean;
  canUndo: boolean;
  domainRules: DomainConfigT[];
  globalDefaultOn: boolean;
  isActive: boolean;
  onAdd: (domain: string, mode: DomainModeT) => void;
  onModeChange: (domain: string, mode: DomainModeT) => void;
  onOrderChange: (siteRules: DomainConfigT[]) => void;
  onRedo: () => void;
  onRemove: (domain: string) => void;
  onSortChange: (sort: DomainSortT) => void;
  onUndo: () => void;
  removingDomain?: string;
  sort: DomainSortT;
}

const domainSortLabel: Record<DomainSortT, string> = {
  [DomainSortE.Custom]: 'Custom order',
  [DomainSortE.DateAscending]: 'Date added · Ascending',
  [DomainSortE.DateDescending]: 'Date added · Descending',
  [DomainSortE.DomainAscending]: 'Website · Ascending',
  [DomainSortE.DomainDescending]: 'Website · Descending',
};

const domainSortOptions: readonly AppSortPickerOptionI<DomainSortT>[] = [
  {
    icon: ArrowDownAZIcon,
    label: domainSortLabel[DomainSortE.DomainAscending],
    value: DomainSortE.DomainAscending,
  },
  {
    icon: ArrowUpAZIcon,
    label: domainSortLabel[DomainSortE.DomainDescending],
    value: DomainSortE.DomainDescending,
  },
  {
    icon: ListSortAscendingIcon,
    label: domainSortLabel[DomainSortE.DateAscending],
    value: DomainSortE.DateAscending,
  },
  {
    icon: ArrowUpAZIcon,
    label: domainSortLabel[DomainSortE.DateDescending],
    value: DomainSortE.DateDescending,
  },
  {
    icon: ListRestartIcon,
    label: domainSortLabel[DomainSortE.Custom],
    value: DomainSortE.Custom,
  },
];

const getSortedSiteRules = (
  siteRules: DomainConfigT[],
  sort: DomainSortT,
  creationOrder: Map<string, number>
): DomainConfigT[] => {
  if (sort === DomainSortE.Custom) return siteRules;

  const direction =
    sort === DomainSortE.DateDescending || sort === DomainSortE.DomainDescending
      ? -1
      : 1;
  const isDomainSort =
    sort === DomainSortE.DomainAscending ||
    sort === DomainSortE.DomainDescending;

  return [...siteRules].sort((first, second) => {
    if (isDomainSort) {
      const comparison = first.domain.localeCompare(second.domain, undefined, {
        sensitivity: 'base',
      });
      if (comparison) return comparison * direction;
    } else {
      const firstHasDate = first.createdAt !== undefined;
      const secondHasDate = second.createdAt !== undefined;
      if (
        firstHasDate &&
        secondHasDate &&
        first.createdAt !== second.createdAt
      ) {
        return ((first.createdAt ?? 0) - (second.createdAt ?? 0)) * direction;
      }
      if (firstHasDate !== secondHasDate) {
        return (firstHasDate ? 1 : -1) * direction;
      }
    }

    return (
      ((creationOrder.get(first.domain) ?? 0) -
        (creationOrder.get(second.domain) ?? 0)) *
      direction
    );
  });
};

function SortableDomainRulesList({
  canRedo,
  canUndo,
  domainRules,
  globalDefaultOn,
  isActive,
  onAdd,
  onModeChange,
  onOrderChange,
  onRedo,
  onRemove,
  onSortChange,
  onUndo,
  removingDomain,
  sort,
}: DomainRulesListPropsI) {
  const externalSiteRules = useMemo(
    () => domainRules.filter(({ domain }) => domain !== '*'),
    [domainRules]
  );
  const [siteRules, setSiteRules] = useState(externalSiteRules);
  const [enteringDomains, setEnteringDomains] = useState(
    () => new Set<string>()
  );
  const [searchValue, setSearchValue] = useState('');
  const [highlightedDomain, setHighlightedDomain] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const siteRulesRef = useRef(siteRules);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const creationOrderRef = useRef(
    new Map(externalSiteRules.map(({ domain }, index) => [domain, index]))
  );
  const dragSnapshotRef = useRef(siteRules);
  const draggedDomainRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const reorderPositionsRef = useRef<Map<string, number> | null>(null);
  const rowAnimationsRef = useRef(new Map<string, Animation>());
  const pendingAdditionRef = useRef<string | null>(null);
  const revealAddedDomainRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowEntryFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return;
    searchInputRef.current?.focus({ preventScroll: true });
  }, [isActive]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const currentDomains = new Set(
      siteRulesRef.current.map(({ domain }) => domain)
    );
    const addedDomains = externalSiteRules
      .filter(({ domain }) => !currentDomains.has(domain))
      .map(({ domain }) => domain);

    let nextCreationOrder =
      Math.max(-1, ...creationOrderRef.current.values()) + 1;
    for (const { domain } of externalSiteRules) {
      if (!creationOrderRef.current.has(domain)) {
        creationOrderRef.current.set(domain, nextCreationOrder);
        nextCreationOrder += 1;
      }
    }

    const pendingAddition = pendingAdditionRef.current;
    if (pendingAddition && addedDomains.includes(pendingAddition)) {
      pendingAdditionRef.current = null;
      revealAddedDomainRef.current = pendingAddition;
    }
    siteRulesRef.current = externalSiteRules;
    setSiteRules(externalSiteRules);

    if (
      addedDomains.length &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setEnteringDomains(new Set(addedDomains));
    } else {
      setEnteringDomains(new Set());
    }
  }, [externalSiteRules]);

  useEffect(() => {
    if (!enteringDomains.size) return;

    if (rowEntryFrameRef.current !== null) {
      cancelAnimationFrame(rowEntryFrameRef.current);
    }
    rowEntryFrameRef.current = requestAnimationFrame(() => {
      setEnteringDomains(new Set());
      rowEntryFrameRef.current = null;
    });
  }, [enteringDomains]);

  useLayoutEffect(() => {
    const domain = revealAddedDomainRef.current;
    if (!domain || enteringDomains.size) return;

    const row = rowRefs.current.get(domain);
    if (!row) return;

    revealAddedDomainRef.current = null;
    setHighlightedDomain(domain);
    setAnnouncement(`${domain} added to website settings.`);
    row.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    });
    searchInputRef.current?.focus({ preventScroll: true });

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(
      () => setHighlightedDomain(''),
      1400
    );
  }, [enteringDomains]);

  useLayoutEffect(() => {
    setToolbarTarget(document.getElementById('domain-toolbar-root'));
  }, []);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (rowEntryFrameRef.current !== null) {
        cancelAnimationFrame(rowEntryFrameRef.current);
      }
      for (const animation of rowAnimationsRef.current.values()) {
        animation.cancel();
      }
    },
    []
  );

  useLayoutEffect(() => {
    const previousPositions = reorderPositionsRef.current;
    if (!previousPositions) return;

    const pendingAddition = pendingAdditionRef.current;
    if (pendingAddition && !rowRefs.current.has(pendingAddition)) return;
    reorderPositionsRef.current = null;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    for (const [domain, element] of rowRefs.current) {
      if (domain === draggedDomainRef.current) continue;

      const previousTop = previousPositions.get(domain);
      if (previousTop === undefined) continue;

      const deltaY = previousTop - element.getBoundingClientRect().top;
      if (Math.abs(deltaY) < 1) continue;

      rowAnimationsRef.current.get(domain)?.cancel();
      if (typeof element.animate !== 'function') continue;

      const animation = element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' },
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }
      );
      rowAnimationsRef.current.set(domain, animation);
      animation.onfinish = () => {
        if (rowAnimationsRef.current.get(domain) === animation) {
          rowAnimationsRef.current.delete(domain);
        }
      };
    }
  });

  const highlightExisting = useCallback((domain: string) => {
    setHighlightedDomain(domain);
    rowRefs.current.get(domain)?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'nearest',
    });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(
      () => setHighlightedDomain(''),
      1400
    );
  }, []);

  const handleHoverMove = useCallback((domain: string, targetIndex: number) => {
    const currentRules = siteRulesRef.current;
    const dragIndex = currentRules.findIndex((rule) => rule.domain === domain);
    if (dragIndex < 0 || dragIndex === targetIndex) return;

    reorderPositionsRef.current = new Map(
      Array.from(rowRefs.current, ([rowDomain, element]) => [
        rowDomain,
        element.getBoundingClientRect().top,
      ])
    );

    setSiteRules((currentRules) => {
      const currentDragIndex = currentRules.findIndex(
        (rule) => rule.domain === domain
      );
      const nextRules = reorderSiteRules(
        currentRules,
        currentDragIndex,
        targetIndex
      );
      siteRulesRef.current = nextRules;
      return nextRules;
    });
  }, []);

  const handleDragStart = useCallback(
    (domain: string) => {
      if (isDraggingRef.current || sort !== DomainSortE.Custom) return;

      isDraggingRef.current = true;
      draggedDomainRef.current = domain;
      dragSnapshotRef.current = siteRulesRef.current;
    },
    [sort]
  );

  const handleDragEnd = useCallback(
    (didDrop: boolean) => {
      isDraggingRef.current = false;
      draggedDomainRef.current = null;
      if (didDrop) {
        onOrderChange(siteRulesRef.current);
        return;
      }

      siteRulesRef.current = dragSnapshotRef.current;
      setSiteRules(dragSnapshotRef.current);
    },
    [onOrderChange]
  );

  const handleKeyboardMove = useCallback(
    (index: number, direction: -1 | 1) => {
      if (sort !== DomainSortE.Custom) return;

      const currentRules = siteRulesRef.current;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= currentRules.length) return;

      const nextRules = reorderSiteRules(currentRules, index, targetIndex);
      const movedRule = nextRules[targetIndex];
      siteRulesRef.current = nextRules;
      setSiteRules(nextRules);
      onOrderChange(nextRules);
      if (movedRule) {
        setAnnouncement(
          `${movedRule.domain} moved to position ${targetIndex + 1} of ${nextRules.length}.`
        );
      }
    },
    [onOrderChange, sort]
  );

  const handleRename = useCallback(
    (domain: string, input: string): boolean => {
      const normalizedDomain = normalizeSiteInput(input);
      if (!normalizedDomain) return false;
      if (normalizedDomain === domain) return true;

      if (
        siteRulesRef.current.some(
          (rule) => rule.domain !== domain && rule.domain === normalizedDomain
        )
      ) {
        requestAnimationFrame(() => highlightExisting(normalizedDomain));
        return false;
      }

      const creationOrder = creationOrderRef.current.get(domain);
      creationOrderRef.current.delete(domain);
      if (creationOrder !== undefined) {
        creationOrderRef.current.set(normalizedDomain, creationOrder);
      }

      const nextRules = siteRulesRef.current.map((rule) =>
        rule.domain === domain ? { ...rule, domain: normalizedDomain } : rule
      );
      siteRulesRef.current = nextRules;
      setSiteRules(nextRules);
      onOrderChange(nextRules);
      setAnnouncement(`${domain} renamed to ${normalizedDomain}.`);
      return true;
    },
    [highlightExisting, onOrderChange]
  );

  const trimmedSearchValue = searchValue.trim();
  const searchDomain = normalizeSiteInput(trimmedSearchValue);
  const isSearchDomainSaved = Boolean(
    searchDomain &&
      siteRules.some(
        ({ domain }) => domain.toLowerCase() === searchDomain.toLowerCase()
      )
  );
  const canAddSearchDomain = Boolean(
    searchDomain && !pendingAdditionRef.current && !isSearchDomainSaved
  );
  const sortedSiteRules = useMemo(
    () => getSortedSiteRules(siteRules, sort, creationOrderRef.current),
    [siteRules, sort]
  );
  const normalizedSearchValue = (
    searchDomain ?? trimmedSearchValue
  ).toLowerCase();
  const searchHostname = searchDomain
    ? getSiteRuleHostname(searchDomain)
    : null;
  const visibleSiteRules = normalizedSearchValue
    ? sortedSiteRules.filter(({ domain }) => {
        const normalizedDomain = domain.toLowerCase();
        const domainHostname = getSiteRuleHostname(domain);
        return (
          normalizedDomain.includes(normalizedSearchValue) ||
          Boolean(
            searchHostname &&
              domainHostname &&
              (searchHostname === domainHostname ||
                searchHostname.endsWith(`.${domainHostname}`))
          )
        );
      })
    : sortedSiteRules;
  const isFiltering = Boolean(trimmedSearchValue);
  const firstSearchDomain = visibleSiteRules[0]?.domain;
  useEffect(() => {
    if (!normalizedSearchValue || !firstSearchDomain) return;
    const timer = setTimeout(() => {
      rowRefs.current.get(firstSearchDomain)?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 160);
    return () => clearTimeout(timer);
  }, [normalizedSearchValue, firstSearchDomain]);

  const captureRowPositions = useCallback(() => {
    reorderPositionsRef.current = new Map(
      Array.from(rowRefs.current, ([domain, element]) => [
        domain,
        element.getBoundingClientRect().top,
      ])
    );
  }, []);

  const handleSortChange = useCallback(
    (nextSort: DomainSortT) => {
      captureRowPositions();
      onSortChange(nextSort);
      setAnnouncement(
        `Website settings sorted by ${domainSortLabel[nextSort]}.`
      );
    },
    [captureRowPositions, onSortChange]
  );

  const submitSearchDomain = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      if (!searchDomain) return;

      if (isSearchDomainSaved) {
        highlightExisting(searchDomain);
        return;
      }
      if (pendingAdditionRef.current) return;

      captureRowPositions();
      pendingAdditionRef.current = searchDomain;
      setSearchValue('');
      onAdd(searchDomain, DomainModeE.Default);
    },
    [
      captureRowPositions,
      highlightExisting,
      isSearchDomainSaved,
      onAdd,
      searchDomain,
    ]
  );

  const historyControls = (
    <div
      aria-label="Website settings history"
      className="flex items-center gap-1"
      role="toolbar"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <fieldset
                aria-label={
                  !canUndo || removingDomain
                    ? 'Undo last website removal'
                    : undefined
                }
                className="m-0 inline-flex min-w-0 rounded-full border-0 p-0"
                tabIndex={!canUndo || removingDomain ? 0 : undefined}
              >
                <Button
                  aria-label="Undo website removal"
                  className="size-5 shrink-0 rounded-full bg-amber-500/15 p-0 text-amber-600 transition-colors hover:bg-amber-500/25 hover:text-amber-700 disabled:bg-slate-300 disabled:text-slate-500 dark:bg-amber-400/15 dark:text-amber-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:hover:bg-amber-400/25 dark:hover:text-amber-200"
                  disabled={!canUndo || Boolean(removingDomain)}
                  onClick={onUndo}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Undo2Icon className="size-3" />
                </Button>
              </fieldset>
            }
          />
          <TooltipContent>
            <strong>Undo</strong> last website removal
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <fieldset
                aria-label={
                  !canRedo || removingDomain
                    ? 'Redo last website removal'
                    : undefined
                }
                className="m-0 inline-flex min-w-0 rounded-full border-0 p-0"
                tabIndex={!canRedo || removingDomain ? 0 : undefined}
              >
                <Button
                  aria-label="Redo website removal"
                  className="size-5 shrink-0 rounded-full bg-amber-500/15 p-0 text-amber-600 transition-colors hover:bg-amber-500/25 hover:text-amber-700 disabled:bg-slate-300 disabled:text-slate-500 dark:bg-amber-400/15 dark:text-amber-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:hover:bg-amber-400/25 dark:hover:text-amber-200"
                  disabled={!canRedo || Boolean(removingDomain)}
                  onClick={onRedo}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Redo2Icon className="size-3" />
                </Button>
              </fieldset>
            }
          />
          <TooltipContent>
            <strong>Redo</strong> last website removal
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  const toolbar = (
    <div
      aria-label="Website settings tools"
      className="flex h-12 items-center"
      data-testid="domain-bottom-toolbar"
      role="toolbar"
    >
      <form className="relative min-w-0 flex-1" onSubmit={submitSearchDomain}>
        {searchDomain ? (
          <DomainFavicon
            className="pointer-events-none absolute top-1/2 left-2.5 size-5 -translate-y-1/2"
            domain={searchDomain}
          />
        ) : (
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
        )}
        <AppInputText
          aria-label="Search website settings"
          className="h-10 rounded-full pr-18 pl-8 text-sm"
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search domains or URLs"
          ref={searchInputRef}
          role="searchbox"
          type="text"
          value={searchValue}
        />
        {searchValue ? (
          <Button
            aria-label="Clear website search"
            className="absolute top-1/2 right-11 size-5 -translate-y-1/2 rounded-full p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            onClick={() => setSearchValue('')}
            title="Clear search"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <AppButton
                  aria-label="Add website"
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-full bg-lime-400 p-0 text-lime-950 shadow-sm ring-1 ring-lime-500/40 transition-[background-color,box-shadow,transform] hover:bg-lime-300 hover:text-lime-950 hover:shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:ring-transparent dark:bg-lime-400 dark:text-lime-950 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:hover:bg-lime-300"
                  disabled={!canAddSearchDomain}
                  size="sm"
                  type="submit"
                >
                  <PlusIcon className="size-4 stroke-[2.5]" />
                </AppButton>
              }
            />
            <TooltipContent>
              {isSearchDomainSaved
                ? 'Domain already exists'
                : searchDomain
                  ? `Add domain: ${searchDomain}`
                  : 'Enter a valid domain'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>
    </div>
  );

  const sortControl = (
    <AppSortPicker
      label="Sort website settings"
      onValueChange={handleSortChange}
      options={domainSortOptions}
      value={sort}
    />
  );

  return (
    <>
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : null}
      <section
        aria-labelledby="website-settings-title"
        className="flex flex-none flex-col pt-6"
      >
        <SectionTitle
          className="justify-start gap-1.5"
          id="website-settings-title"
          title="Website Settings"
        >
          {historyControls}
          {isFiltering && <span role="status" className="ml-1 whitespace-nowrap text-xs font-normal normal-case text-muted-foreground">{visibleSiteRules.length} found</span>}
          {sortControl}
        </SectionTitle>

        {visibleSiteRules.length ? (
          <ul
            aria-label="Saved website settings"
            className="list-none overflow-hidden rounded-xl bg-white dark:bg-slate-800/70"
          >
            {visibleSiteRules.map((rule, index) => (
              <DomainListItem
                globalDefaultOn={globalDefaultOn}
                highlighted={isFiltering || highlightedDomain === rule.domain}
                searchQuery={normalizedSearchValue}
                index={index}
                isEntering={enteringDomains.has(rule.domain)}
                isRemoving={removingDomain === rule.domain}
                key={rule.domain}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onHoverMove={handleHoverMove}
                onKeyboardMove={handleKeyboardMove}
                onModeChange={onModeChange}
                onRegisterRow={(domain, element) => {
                  if (element) rowRefs.current.set(domain, element);
                  else rowRefs.current.delete(domain);
                }}
                onRemove={onRemove}
                onRename={handleRename}
                rule={rule}
                showDivider={index < visibleSiteRules.length - 1}
                showDragHandle={sort === DomainSortE.Custom}
                sortingDisabled={isFiltering || sort !== DomainSortE.Custom}
              />
            ))}
          </ul>
        ) : (
          <div className="flex min-h-24 flex-col items-center justify-center rounded-xl bg-white px-6 text-center dark:bg-slate-800/70">
            <p className="font-medium text-slate-700 text-xs dark:text-slate-200">
              {siteRules.length ? 'No matching websites' : 'No custom websites'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {siteRules.length
                ? 'Try another domain or URL.'
                : 'All websites follow the default above.'}
            </p>
          </div>
        )}

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </section>
    </>
  );
}

export function DomainRulesList(props: DomainRulesListPropsI) {
  return (
    <DndProvider backend={HTML5Backend}>
      <SortableDomainRulesList {...props} />
    </DndProvider>
  );
}

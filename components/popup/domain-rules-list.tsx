import {
  CheckIcon,
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

import { AppButton } from '@/components/app/app-button';
import { AppInputText } from '@/components/app/app-input-text';
import { SectionTitle } from '@/components/popup/section-title';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { normalizeSiteInput, reorderSiteRules } from '@/helpers/domains';
import { cn } from '@/lib/utils';
import type { DomainConfigT, DomainModeT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

import { DomainFavicon } from './domain-favicon';
import { DomainListItem } from './domain-list-item';
import { DomainModeControl } from './domain-mode-control';

interface DomainRulesListPropsI {
  canRedo: boolean;
  canUndo: boolean;
  domainRules: DomainConfigT[];
  onAdd: (domain: string, mode: DomainModeT) => void;
  onModeChange: (domain: string, mode: DomainModeT) => void;
  onOrderChange: (siteRules: DomainConfigT[]) => void;
  onRedo: () => void;
  onRemove: (domain: string) => void;
  onUndo: () => void;
  removingDomain?: string;
}

const EDITOR_TRANSITION_DURATION_MS = 200;

function SortableDomainRulesList({
  canRedo,
  canUndo,
  domainRules,
  onAdd,
  onModeChange,
  onOrderChange,
  onRedo,
  onRemove,
  onUndo,
  removingDomain,
}: DomainRulesListPropsI) {
  const externalSiteRules = useMemo(
    () => domainRules.filter(({ domain }) => domain !== '*'),
    [domainRules]
  );
  const [siteRules, setSiteRules] = useState(externalSiteRules);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [enteringDomains, setEnteringDomains] = useState(
    () => new Set<string>()
  );
  const [editorValue, setEditorValue] = useState('');
  const [editorMode, setEditorMode] = useState<DomainModeT>(
    DomainModeE.Default
  );
  const [editorError, setEditorError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [highlightedDomain, setHighlightedDomain] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isSticky, setIsSticky] = useState(false);
  const siteRulesRef = useRef(siteRules);
  const editorInputRef = useRef<HTMLInputElement>(null);
  const stickyControlsRef = useRef<HTMLDivElement>(null);
  const dragSnapshotRef = useRef(siteRules);
  const draggedDomainRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const reorderPositionsRef = useRef<Map<string, number> | null>(null);
  const rowAnimationsRef = useRef(new Map<string, Animation>());
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const editorEntryFrameRef = useRef<number | null>(null);
  const rowEntryFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const currentDomains = new Set(
      siteRulesRef.current.map(({ domain }) => domain)
    );
    const addedDomains = externalSiteRules
      .filter(({ domain }) => !currentDomains.has(domain))
      .map(({ domain }) => domain);
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

  useEffect(() => {
    if (isEditorVisible) {
      editorInputRef.current?.focus({ preventScroll: true });
    }
  }, [isEditorVisible]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (editorTransitionTimerRef.current) {
        clearTimeout(editorTransitionTimerRef.current);
      }
      if (editorEntryFrameRef.current !== null) {
        cancelAnimationFrame(editorEntryFrameRef.current);
      }
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
    reorderPositionsRef.current = null;
    if (!previousPositions || !isDraggingRef.current) return;
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

  useEffect(() => {
    const controls = stickyControlsRef.current;
    const scrollContainer = controls?.closest<HTMLElement>(
      '[data-testid="site-access-scroll-container"]'
    );
    if (!controls || !scrollContainer) return;

    const updateStickyState = () => {
      const stickyTop = Number.parseFloat(getComputedStyle(controls).top);
      const nextIsSticky =
        scrollContainer.scrollTop > 0 &&
        controls.getBoundingClientRect().top <=
          scrollContainer.getBoundingClientRect().top + stickyTop + 0.5;
      setIsSticky((current) =>
        current === nextIsSticky ? current : nextIsSticky
      );
    };

    updateStickyState();
    scrollContainer.addEventListener('scroll', updateStickyState, {
      passive: true,
    });
    window.addEventListener('resize', updateStickyState);

    return () => {
      scrollContainer.removeEventListener('scroll', updateStickyState);
      window.removeEventListener('resize', updateStickyState);
    };
  }, []);

  const openEditor = useCallback(() => {
    if (editorTransitionTimerRef.current) {
      clearTimeout(editorTransitionTimerRef.current);
      editorTransitionTimerRef.current = null;
    }
    if (editorEntryFrameRef.current !== null) {
      cancelAnimationFrame(editorEntryFrameRef.current);
    }

    setIsAdding(true);
    setIsEditorVisible(false);
    setEditorValue('');
    setEditorMode(DomainModeE.Default);
    setEditorError('');
    editorEntryFrameRef.current = requestAnimationFrame(() => {
      setIsEditorVisible(true);
      editorEntryFrameRef.current = null;
    });
  }, []);

  const closeEditor = useCallback(() => {
    if (editorEntryFrameRef.current !== null) {
      cancelAnimationFrame(editorEntryFrameRef.current);
      editorEntryFrameRef.current = null;
    }
    if (editorTransitionTimerRef.current) {
      clearTimeout(editorTransitionTimerRef.current);
    }

    setIsEditorVisible(false);
    editorTransitionTimerRef.current = setTimeout(() => {
      setIsAdding(false);
      setEditorValue('');
      setEditorMode(DomainModeE.Default);
      setEditorError('');
      editorTransitionTimerRef.current = null;
    }, EDITOR_TRANSITION_DURATION_MS);
  }, []);

  const highlightExisting = useCallback((domain: string) => {
    setHighlightedDomain(domain);
    rowRefs.current.get(domain)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(
      () => setHighlightedDomain(''),
      1400
    );
  }, []);

  const submitEditor = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const normalizedDomain = normalizeSiteInput(editorValue);
      if (!normalizedDomain) {
        setEditorError('Enter a valid website or HTTP(S) URL.');
        return;
      }

      if (
        siteRulesRef.current.some(
          ({ domain }) => domain.toLowerCase() === normalizedDomain
        )
      ) {
        closeEditor();
        requestAnimationFrame(() => highlightExisting(normalizedDomain));
        return;
      }

      onAdd(normalizedDomain, editorMode);
      closeEditor();
    },
    [closeEditor, editorMode, editorValue, highlightExisting, onAdd]
  );

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

  const handleDragStart = useCallback((domain: string) => {
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    draggedDomainRef.current = domain;
    dragSnapshotRef.current = siteRulesRef.current;
  }, []);

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
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= siteRulesRef.current.length) return;

      const nextRules = reorderSiteRules(
        siteRulesRef.current,
        index,
        targetIndex
      );
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
    [onOrderChange]
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

  const normalizedEditorDomain = normalizeSiteInput(editorValue) ?? undefined;
  const trimmedSearchValue = searchValue.trim();
  const normalizedSearchValue = (
    normalizeSiteInput(trimmedSearchValue) ?? trimmedSearchValue
  ).toLowerCase();
  const visibleSiteRules = normalizedSearchValue
    ? siteRules.filter(({ domain }) =>
        domain.toLowerCase().includes(normalizedSearchValue)
      )
    : siteRules;
  const isFiltering = Boolean(trimmedSearchValue);

  return (
    <section
      aria-labelledby="website-settings-title"
      className="flex flex-none flex-col"
    >
      <div
        className={cn(
          'sticky top-[95px] z-20 -mx-2 rounded-b-xl bg-slate-100/75 px-2 pt-6 pb-2 backdrop-blur-xl backdrop-saturate-150 dark:bg-slate-700/75',
          isSticky && 'border-slate-200/80 border-b dark:border-slate-600/80'
        )}
        data-sticky={isSticky}
        data-testid="website-settings-sticky-controls"
        ref={stickyControlsRef}
      >
        <SectionTitle id="website-settings-title" title="Website settings">
          <div className="flex items-center gap-1">
            <Button
              aria-label="Undo website removal"
              className="size-5 shrink-0 rounded-full bg-amber-500/15 p-0 text-amber-600 transition-colors hover:bg-amber-500/25 hover:text-amber-700 disabled:bg-amber-500/10 disabled:text-amber-500/45 dark:bg-amber-400/15 dark:text-amber-300 dark:disabled:bg-amber-400/10 dark:disabled:text-amber-300/40 dark:hover:bg-amber-400/25 dark:hover:text-amber-200"
              disabled={!canUndo || Boolean(removingDomain)}
              onClick={onUndo}
              size="icon-xs"
              title="Undo last website removal"
              type="button"
              variant="ghost"
            >
              <Undo2Icon className="size-3.5" />
            </Button>
            <Button
              aria-label="Redo website removal"
              className="size-5 shrink-0 rounded-full bg-amber-500/15 p-0 text-amber-600 transition-colors hover:bg-amber-500/25 hover:text-amber-700 disabled:bg-amber-500/10 disabled:text-amber-500/45 dark:bg-amber-400/15 dark:text-amber-300 dark:disabled:bg-amber-400/10 dark:disabled:text-amber-300/40 dark:hover:bg-amber-400/25 dark:hover:text-amber-200"
              disabled={!canRedo || Boolean(removingDomain)}
              onClick={onRedo}
              size="icon-xs"
              title="Redo website removal"
              type="button"
              variant="ghost"
            >
              <Redo2Icon className="size-3.5" />
            </Button>
            <AppButton
              aria-label="Add website"
              disabled={isAdding}
              onClick={openEditor}
              size="sm"
              type="button"
            >
              Add +
            </AppButton>
          </div>
        </SectionTitle>

        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <AppInputText
            aria-label="Search website settings"
            className="h-8 pr-8 pl-8 text-xs"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search domains or URLs"
            role="searchbox"
            type="text"
            value={searchValue}
          />
          {searchValue ? (
            <Button
              aria-label="Clear website search"
              className="absolute top-1/2 right-1.5 size-5 -translate-y-1/2 rounded-md p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              onClick={() => setSearchValue('')}
              title="Clear search"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {isAdding ? (
        <form
          aria-hidden={!isEditorVisible || undefined}
          className={cn(
            'relative grid h-13 min-h-0 origin-top grid-cols-[20px_24px_minmax(0,1fr)_80px_28px] items-center gap-1 overflow-hidden rounded-t-xl bg-white pr-2 pl-2 opacity-100 transition-[height,opacity,transform] duration-200 ease-out motion-reduce:transition-none dark:bg-slate-800/70',
            siteRules.length &&
              "after:absolute after:right-3 after:bottom-0 after:left-3 after:h-px after:bg-slate-100/70 after:content-[''] dark:after:bg-white/5",
            editorError && 'h-18 pb-3',
            !isEditorVisible && 'h-0 -translate-y-2 scale-y-95 opacity-0'
          )}
          inert={!isEditorVisible || undefined}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeEditor();
            }
          }}
          onSubmit={submitEditor}
        >
          <span aria-hidden="true" className="w-5" />
          <div className="flex h-full items-center justify-center">
            <DomainFavicon domain={normalizedEditorDomain} />
          </div>
          <div className="min-w-0">
            <AppInputText
              aria-describedby={editorError ? 'site-editor-error' : undefined}
              aria-invalid={Boolean(editorError)}
              className="h-7 rounded-md px-2 text-xs"
              onChange={(event) => {
                setEditorValue(event.target.value);
                if (editorError) setEditorError('');
              }}
              placeholder="example.com"
              ref={editorInputRef}
              value={editorValue}
            />
          </div>
          <DomainModeControl
            label="Access for new website"
            onChange={setEditorMode}
            value={editorMode}
          />
          <TooltipProvider>
            <div className="flex h-full w-7 flex-col items-center justify-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Discard website"
                      className="size-5 shrink-0 rounded-md bg-red-500/15 p-0 text-red-600 transition-[color,background-color,transform] hover:scale-105 hover:bg-red-500/25 hover:text-red-700 dark:bg-red-400/15 dark:text-red-300 dark:hover:bg-red-400/25 dark:hover:text-red-200"
                      onClick={closeEditor}
                      type="button"
                      variant="ghost"
                    >
                      <XIcon className="size-3" />
                    </Button>
                  }
                />
                <TooltipContent side="left">Discard (Esc)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Create website"
                      className="size-5 shrink-0 rounded-md bg-emerald-500/15 p-0 text-emerald-700 transition-[color,background-color,transform] hover:scale-105 hover:bg-emerald-500/25 hover:text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25 dark:hover:text-emerald-200"
                      type="submit"
                      variant="ghost"
                    >
                      <CheckIcon className="size-3" />
                    </Button>
                  }
                />
                <TooltipContent side="left">Create (Enter)</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          {editorError ? (
            <span
              className="absolute bottom-0.5 left-14 text-[9px] text-red-600 dark:text-red-300"
              id="site-editor-error"
              role="alert"
            >
              {editorError}
            </span>
          ) : null}
        </form>
      ) : null}

      {visibleSiteRules.length ? (
        <ul
          aria-label="Saved website settings"
          className={cn(
            'list-none overflow-hidden rounded-xl bg-white dark:bg-slate-800/70',
            isAdding && 'rounded-t-none'
          )}
        >
          {visibleSiteRules.map((rule, index) => (
            <DomainListItem
              highlighted={highlightedDomain === rule.domain}
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
              sortingDisabled={isAdding || isFiltering}
            />
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            'flex min-h-24 flex-col items-center justify-center rounded-xl bg-white px-6 text-center dark:bg-slate-800/70',
            isAdding && 'rounded-t-none'
          )}
        >
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
  );
}

export function DomainRulesList(props: DomainRulesListPropsI) {
  return (
    <DndProvider backend={HTML5Backend}>
      <SortableDomainRulesList {...props} />
    </DndProvider>
  );
}

import { SearchIcon, XIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { AppInputText } from '@/components/app/app-input-text';

export function SettingsSearch({ contentRef, active }: { contentRef: RefObject<HTMLDivElement | null>; active: boolean }) {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const term = query.trim().toLocaleLowerCase();
    let timer: ReturnType<typeof setTimeout>;
    let firstScrolled: Element | null = null;
    const css = (window.CSS ?? {}) as typeof CSS & { highlights?: Map<string, unknown> };
    const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    const update = () => {
      const ranges: Range[] = [];
      let first: HTMLElement | null = null;
      let matches = 0;
      for (const row of root.querySelectorAll<HTMLElement>('.card-list-item')) {
        const match = Boolean(term && row.textContent?.toLocaleLowerCase().includes(term));
        row.toggleAttribute('data-search-match', match);
        if (!match) continue;
        matches++;
        first ??= row;
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.parentElement?.closest('style,script,[aria-hidden="true"]')) continue;
          const text = node.textContent?.toLocaleLowerCase() ?? '';
          let index = text.indexOf(term);
          while (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index); range.setEnd(node, index + term.length);
            ranges.push(range); index = text.indexOf(term, index + term.length);
          }
        }
      }
      setCount(matches);
      css.highlights?.delete('settings-search');
      if (HighlightCtor && ranges.length) css.highlights?.set('settings-search', new HighlightCtor(...ranges));
      if (active && first && first !== firstScrolled) {
        first.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        firstScrolled = first;
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 160); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer); observer.disconnect(); css.highlights?.delete('settings-search');
      root.querySelectorAll('[data-search-match]').forEach(row => row.removeAttribute('data-search-match'));
    };
  }, [query, active, contentRef]);
  return <div className="relative flex h-12 items-center" role="search" aria-label="Settings search">
    <style>{`[data-search-match]{box-shadow:inset 0 0 0 2px #f3cd45!important;scroll-margin-block:100px}::highlight(settings-search){background:#F3CD45;color:#29200a}`}</style>
    <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 size-3.5 text-slate-400" />
    <AppInputText ref={inputRef} role="searchbox" aria-label="Search settings" placeholder="Search settings" className="h-10 rounded-full pr-24 pl-8 text-sm" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />
    {query && <><span role="status" className="pointer-events-none absolute right-9 text-xs text-muted-foreground">{count ? `${count} found` : 'No matches'}</span><button type="button" aria-label="Clear settings search" className="absolute right-3 cursor-pointer text-slate-400 hover:text-slate-700" onClick={() => { setQuery(''); inputRef.current?.focus(); }}><XIcon className="size-3.5" /></button></>}
  </div>;
}

import { GripVerticalIcon, Trash2Icon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import { Button } from '@/components/ui/button';
import { getDomainMode } from '@/helpers/domains';
import { cn } from '@/lib/utils';
import type { DomainConfigT, DomainModeT } from '@/types/domains';

import { DomainFavicon } from './domain-favicon';
import { DomainModeControl } from './domain-mode-control';
import { ItemRowText } from './item-row-text';

export const DOMAIN_RULE_DRAG_TYPE = 'site-access-rule';

export interface DomainRuleDragItemI {
  domain: string;
  index: number;
}

interface DomainListItemPropsI {
  highlighted?: boolean;
  index: number;
  isEntering?: boolean;
  isRemoving?: boolean;
  onDragEnd: (didDrop: boolean) => void;
  onDragStart: (domain: string) => void;
  onHoverMove: (domain: string, targetIndex: number) => void;
  onKeyboardMove: (index: number, direction: -1 | 1) => void;
  onModeChange: (domain: string, mode: DomainModeT) => void;
  onRegisterRow: (domain: string, element: HTMLLIElement | null) => void;
  onRemove: (domain: string) => void;
  rule: DomainConfigT;
  showDivider?: boolean;
  sortingDisabled?: boolean;
}

export function DomainListItem({
  highlighted,
  index,
  isEntering,
  isRemoving,
  onDragEnd,
  onDragStart,
  onHoverMove,
  onKeyboardMove,
  onModeChange,
  onRegisterRow,
  onRemove,
  rule,
  showDivider,
  sortingDisabled,
}: DomainListItemPropsI) {
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragPreviewRef = useRef<HTMLLIElement>(null);
  const dragPreviewResetFrameRef = useRef<number | null>(null);

  const [{ isDragging }, connectDrag, connectDragPreview] = useDrag(
    () => ({
      canDrag: !sortingDisabled,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      end: (_item, monitor) => onDragEnd(monitor.didDrop()),
      item: () => {
        const row = rowRef.current;
        const preview = dragPreviewRef.current;
        if (row && preview) {
          const bounds = row.getBoundingClientRect();
          Object.assign(preview.style, {
            height: `${bounds.height}px`,
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
          });
          if (dragPreviewResetFrameRef.current !== null) {
            cancelAnimationFrame(dragPreviewResetFrameRef.current);
          }
          dragPreviewResetFrameRef.current = requestAnimationFrame(() => {
            if (dragPreviewRef.current === preview) {
              preview.style.left = '-10000px';
              preview.style.top = '0';
            }
            dragPreviewResetFrameRef.current = null;
          });
        }
        onDragStart(rule.domain);
        return { domain: rule.domain, index } satisfies DomainRuleDragItemI;
      },
      type: DOMAIN_RULE_DRAG_TYPE,
    }),
    [index, onDragEnd, onDragStart, rule.domain, sortingDisabled]
  );
  const [, connectDrop] = useDrop(
    () => ({
      accept: DOMAIN_RULE_DRAG_TYPE,
      canDrop: () => !sortingDisabled,
      drop: () => ({ moved: true }),
      hover: (item: DomainRuleDragItemI, monitor) => {
        if (sortingDisabled || item.index === index) return;

        const row = rowRef.current;
        const pointer = monitor.getClientOffset();
        if (!row || !pointer) return;

        const bounds = row.getBoundingClientRect();
        const pointerY = pointer.y - bounds.top;
        const midpointY = (bounds.bottom - bounds.top) / 2;

        if (item.index < index && pointerY < midpointY) return;
        if (item.index > index && pointerY > midpointY) return;

        onHoverMove(item.domain, index);
        item.index = index;
      },
    }),
    [index, onHoverMove, rule.domain, sortingDisabled]
  );

  connectDrop(rowRef);
  connectDrag(handleRef);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const preview = row.cloneNode(true) as HTMLLIElement;
    const bounds = row.getBoundingClientRect();
    preview.dataset.domainDragPreview = rule.domain;
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    Object.assign(preview.style, {
      borderRadius: '0',
      height: `${bounds.height}px`,
      left: '-10000px',
      margin: '0',
      pointerEvents: 'none',
      position: 'fixed',
      top: '0',
      width: `${bounds.width}px`,
    });
    document.body.append(preview);
    dragPreviewRef.current = preview;
    connectDragPreview(preview);

    return () => {
      if (dragPreviewResetFrameRef.current !== null) {
        cancelAnimationFrame(dragPreviewResetFrameRef.current);
        dragPreviewResetFrameRef.current = null;
      }
      connectDragPreview(null);
      dragPreviewRef.current = null;
      preview.remove();
    };
  }, [connectDragPreview, rule.domain]);

  return (
    <li
      aria-hidden={isRemoving || undefined}
      className={cn(
        'group/domain-row relative grid h-13 min-h-0 grid-cols-[20px_24px_minmax(0,1fr)_80px_28px] items-center gap-1 overflow-hidden rounded-none bg-white pr-2 pl-2 transition-[height,opacity,transform,background-color] duration-250 ease-in-out hover:bg-slate-50/70 motion-reduce:transition-none dark:bg-slate-800/70 dark:hover:bg-slate-700/20',
        showDivider &&
          "after:absolute after:right-3 after:bottom-0 after:left-8 after:h-px after:bg-slate-100/70 after:content-[''] dark:after:bg-white/5",
        highlighted && 'bg-brand-50/80 dark:bg-brand-900/35',
        isDragging && 'opacity-35',
        isEntering && 'h-0 -translate-y-2 opacity-0',
        isRemoving && 'pointer-events-none h-0 -translate-x-2 opacity-0'
      )}
      data-entering={isEntering || undefined}
      data-removing={isRemoving || undefined}
      inert={isRemoving || undefined}
      ref={(element) => {
        rowRef.current = element;
        onRegisterRow(rule.domain, element);
      }}
    >
      <button
        aria-label={`Move ${rule.domain}. Hold Alt and press an arrow key to reorder.`}
        className={cn(
          'flex h-full w-5 cursor-grab touch-none items-center justify-center self-stretch rounded-sm text-slate-400 outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-inset active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300',
          (sortingDisabled || isRemoving) && 'cursor-not-allowed opacity-35'
        )}
        disabled={sortingDisabled || isRemoving}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            onKeyboardMove(index, -1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            onKeyboardMove(index, 1);
          }
        }}
        ref={handleRef}
        type="button"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <DomainFavicon domain={rule.domain} />

      <ItemRowText title={rule.domain} titleTooltip={rule.domain} />

      <DomainModeControl
        label={`Access for ${rule.domain}`}
        onChange={(mode) => onModeChange(rule.domain, mode)}
        value={getDomainMode(rule)}
      />

      <Button
        aria-label={`Delete ${rule.domain}`}
        className="size-7 rounded-md p-0 text-slate-400 opacity-40 transition-[color,background-color,opacity] duration-150 hover:bg-red-50 hover:text-red-600 hover:opacity-100 focus-visible:bg-red-50 focus-visible:text-red-600 focus-visible:opacity-100 dark:text-slate-500 dark:focus-visible:bg-red-950/30 dark:focus-visible:text-red-300 dark:hover:bg-red-950/30 dark:hover:text-red-300"
        disabled={isRemoving}
        onClick={() => onRemove(rule.domain)}
        title={`Delete ${rule.domain}`}
        type="button"
        variant="ghost"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </li>
  );
}

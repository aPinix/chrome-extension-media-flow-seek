import NumberFlow, { NumberFlowGroup } from '@number-flow/react';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import {
  THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT,
  THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE,
  THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT,
  type ThumbnailPreviewTimeUpdateDetailT,
} from '@/helpers/thumbnail-preview-time-events';

type ThumbnailPreviewTimePropsT = {
  value: string;
};

const transformTiming: EffectTiming = {
  duration: 180,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

const opacityTiming: EffectTiming = {
  duration: 120,
  easing: 'ease-out',
};

export function ThumbnailPreviewTime({ value }: ThumbnailPreviewTimePropsT) {
  const tokens = value.match(/\d+|\D+/g) ?? [value];
  const numericTokenIndexes = tokens.flatMap((token, index) =>
    /^\d+$/.test(token) ? [index] : []
  );

  if (numericTokenIndexes.length === 0) return value;

  return (
    <NumberFlowGroup>
      {tokens.map((token, index) => {
        if (!/^\d+$/.test(token)) {
          return (
            <span className="mfs-thumbnail-time-symbol" key={index}>
              {token}
            </span>
          );
        }

        const numericIndex = numericTokenIndexes.indexOf(index);
        return (
          <NumberFlow
            className="mfs-thumbnail-time-number"
            digits={numericIndex > 0 ? { 1: { max: 5 } } : undefined}
            format={{
              minimumIntegerDigits: token.length,
              useGrouping: false,
            }}
            key={index}
            opacityTiming={opacityTiming}
            spinTiming={transformTiming}
            transformTiming={transformTiming}
            value={Number(token)}
            willChange
          />
        );
      })}
    </NumberFlowGroup>
  );
}

const isThumbnailTimeElement = (
  target: EventTarget | null
): target is HTMLElement =>
  target instanceof HTMLElement && target.matches('.mfs-thumbnail-time');

export const installThumbnailPreviewTimeRenderer = (
  ownerDocument: Document
): (() => void) => {
  const roots = new WeakMap<HTMLElement, Root>();

  const renderFallback = (element: HTMLElement, value: string): void => {
    element.removeAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE);
    element.textContent = value;
  };

  const handleUpdate = (event: Event): void => {
    if (!isThumbnailTimeElement(event.target)) return;
    const element = event.target;
    const detail = (event as CustomEvent<ThumbnailPreviewTimeUpdateDetailT>)
      .detail;
    if (typeof detail?.value !== 'string') return;

    let root = roots.get(element);
    try {
      root ??= createRoot(element);
      roots.set(element, root);
      element.setAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE, 'true');
      flushSync(() => {
        root?.render(
          createElement(ThumbnailPreviewTime, {
            value: detail.value,
          })
        );
      });
    } catch {
      try {
        root?.unmount();
      } catch {
        // The plain text fallback below keeps the core seek UI operational.
      }
      roots.delete(element);
      renderFallback(element, detail.value);
    }
  };

  const handleCleanup = (event: Event): void => {
    if (!isThumbnailTimeElement(event.target)) return;
    const element = event.target;
    const root = roots.get(element);
    if (root) {
      try {
        flushSync(() => root.unmount());
      } catch {
        // The host is about to be removed, so cleanup can safely continue.
      }
    }
    roots.delete(element);
    element.removeAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE);
  };

  ownerDocument.addEventListener(
    THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT,
    handleUpdate
  );
  ownerDocument.addEventListener(
    THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT,
    handleCleanup
  );

  return () => {
    ownerDocument.removeEventListener(
      THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT,
      handleUpdate
    );
    ownerDocument.removeEventListener(
      THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT,
      handleCleanup
    );
  };
};

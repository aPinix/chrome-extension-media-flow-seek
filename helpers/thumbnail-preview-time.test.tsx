// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { installThumbnailPreviewTimeRenderer } from '@/helpers/thumbnail-preview-time';
import {
  THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT,
  THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE,
  THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT,
} from '@/helpers/thumbnail-preview-time-events';

describe('thumbnail preview time renderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('upgrades the plain time fallback to NumberFlow and cleans it up', () => {
    const uninstall = installThumbnailPreviewTimeRenderer(document);
    const element = document.createElement('span');
    element.className = 'mfs-thumbnail-time';
    element.textContent = '0:50';
    document.body.append(element);

    element.dispatchEvent(
      new CustomEvent(THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT, {
        bubbles: true,
        detail: { value: '0:50' },
      })
    );

    expect(element.getAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE)).toBe(
      'true'
    );
    expect(element.querySelectorAll('number-flow-react')).toHaveLength(2);

    element.dispatchEvent(
      new CustomEvent(THUMBNAIL_PREVIEW_TIME_UPDATE_EVENT, {
        bubbles: true,
        detail: { value: '0:51' },
      })
    );
    expect(element.dataset.mfsTime).toBeUndefined();
    expect(element.querySelectorAll('number-flow-react')).toHaveLength(2);

    element.dispatchEvent(
      new CustomEvent(THUMBNAIL_PREVIEW_TIME_CLEANUP_EVENT, { bubbles: true })
    );
    expect(element.hasAttribute(THUMBNAIL_PREVIEW_TIME_MOUNTED_ATTRIBUTE)).toBe(
      false
    );
    expect(element.childElementCount).toBe(0);
    uninstall();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('WXT Vitest integration', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('provides an in-memory extension browser API', async () => {
    await browser.storage.local.set({ enabled: true });

    await expect(browser.storage.local.get('enabled')).resolves.toEqual({
      enabled: true,
    });
  });
});

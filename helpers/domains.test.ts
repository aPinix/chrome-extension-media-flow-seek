import { describe, expect, it } from 'vitest';

import {
  createDomainRule,
  getDefaultDomainRules,
  getDomainMode,
  isGlobalDefaultOn,
  mergeAndMigrateDomainRules,
  normalizeSiteInput,
  reorderSiteRules,
  restoreSiteRule,
  setDomainMode,
  setGlobalDefault,
} from '@/helpers/domains';
import { DomainModeE, DomainRuleTypeE } from '@/types/domains';

describe('universal domain defaults', () => {
  it('enables the extension globally by default', () => {
    expect(
      getDefaultDomainRules().find(({ domain }) => domain === '*')
    ).toEqual({
      domain: '*',
      type: DomainRuleTypeE.Whitelist,
      enabled: true,
    });
  });

  it('keeps every initial preset website at Default', () => {
    expect(
      getDefaultDomainRules()
        .filter(({ domain }) => domain !== '*')
        .every(({ enabled }) => !enabled)
    ).toBe(true);
  });

  it.each([DomainRuleTypeE.Whitelist, DomainRuleTypeE.Blacklist])(
    'normalizes untouched legacy defaults with a %s wildcard',
    (globalType) => {
      const legacyRules = getDefaultDomainRules().map((rule) => {
        if (rule.domain === '*') return { ...rule, type: globalType };
        if (rule.domain === 'youtube.com') return { ...rule, enabled: true };
        return rule;
      });

      const migrated = mergeAndMigrateDomainRules(legacyRules);
      expect(isGlobalDefaultOn(migrated)).toBe(true);
      expect(
        migrated
          .filter(({ domain }) => domain !== '*')
          .every(({ enabled }) => !enabled)
      ).toBe(true);
    }
  );

  it('preserves a customized allow-list policy', () => {
    const customRules = getDefaultDomainRules().map((rule) => {
      if (rule.domain === '*') {
        return { ...rule, type: DomainRuleTypeE.Blacklist };
      }
      if (rule.domain === 'vimeo.com') {
        return { ...rule, enabled: true };
      }
      return rule;
    });

    const migrated = mergeAndMigrateDomainRules(customRules);
    expect(migrated.find(({ domain }) => domain === '*')?.type).toBe(
      DomainRuleTypeE.Blacklist
    );
  });

  it('preserves custom blocked sites and row order', () => {
    const customRules = [
      createDomainRule('*', DomainModeE.On),
      createDomainRule('example.com', DomainModeE.Off),
      createDomainRule('youtube.com', DomainModeE.Default),
    ];

    expect(mergeAndMigrateDomainRules(customRules)).toEqual(customRules);
  });

  it('does not restore a deleted preset website', () => {
    const withoutVimeo = getDefaultDomainRules().filter(
      ({ domain }) => domain !== 'vimeo.com'
    );

    expect(
      mergeAndMigrateDomainRules(withoutVimeo).some(
        ({ domain }) => domain === 'vimeo.com'
      )
    ).toBe(false);
  });
});

describe('site access modes', () => {
  it('maps storage rules to Default, On, and Off', () => {
    expect(getDomainMode(undefined)).toBe(DomainModeE.Default);
    expect(getDomainMode(createDomainRule('a.com'))).toBe(DomainModeE.Default);
    expect(getDomainMode(createDomainRule('a.com', DomainModeE.On))).toBe(
      DomainModeE.On
    );
    expect(getDomainMode(createDomainRule('a.com', DomainModeE.Off))).toBe(
      DomainModeE.Off
    );
  });

  it('changes the wildcard without changing explicit choices', () => {
    const rules = [
      createDomainRule('*', DomainModeE.On),
      createDomainRule('on.example', DomainModeE.On),
      createDomainRule('off.example', DomainModeE.Off),
    ];
    const next = setGlobalDefault(rules, false);

    expect(isGlobalDefaultOn(next)).toBe(false);
    expect(next.slice(1)).toEqual(rules.slice(1));
  });

  it('keeps a saved row when changing it to Default', () => {
    const rules = [
      createDomainRule('*', DomainModeE.On),
      createDomainRule('example.com', DomainModeE.On),
    ];
    const next = setDomainMode(rules, 'example.com', DomainModeE.Default);

    expect(next).toHaveLength(2);
    expect(getDomainMode(next[1])).toBe(DomainModeE.Default);
  });

  it('reorders and restores sites without moving the wildcard', () => {
    const removed = createDomainRule('b.com', DomainModeE.Off);
    const rules = [
      createDomainRule('*', DomainModeE.On),
      createDomainRule('a.com'),
      removed,
      createDomainRule('c.com'),
    ];
    const reordered = reorderSiteRules(rules, 2, 0);
    expect(reordered.map(({ domain }) => domain)).toEqual([
      '*',
      'c.com',
      'a.com',
      'b.com',
    ]);

    const restored = restoreSiteRule(
      reordered.filter(({ domain }) => domain !== 'b.com'),
      removed,
      2
    );
    expect(restored.map(({ domain }) => domain)).toEqual([
      '*',
      'c.com',
      'a.com',
      'b.com',
    ]);
  });
});

describe('whole-site normalization', () => {
  it.each([
    ['WWW.Example.COM/path', 'example.com'],
    ['https://news.bbc.co.uk/story', 'bbc.co.uk'],
    ['http://localhost:3000/test', 'localhost'],
    ['127.0.0.1:8080', '127.0.0.1'],
    ['https://[::1]:8080', '::1'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSiteInput(input)).toBe(expected);
  });

  it.each(['', '*', '*.example.com', 'chrome://settings', 'not a host'])(
    'rejects %s',
    (input) => {
      expect(normalizeSiteInput(input)).toBeNull();
    }
  );

  it('normalizes duplicates to the same saved domain', () => {
    expect(normalizeSiteInput('https://www.example.com/video')).toBe(
      normalizeSiteInput('example.com')
    );
  });
});

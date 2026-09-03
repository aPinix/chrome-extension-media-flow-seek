import { parse } from 'tldts';

import { DOMAIN_CONFIGS } from '@/config/domains.config';
import type { DomainConfigT, DomainModeT } from '@/types/domains';
import { DomainModeE, DomainRuleTypeE } from '@/types/domains';

export const getDefaultDomainRules = () =>
  DOMAIN_CONFIGS.map((config) => ({
    domain: config.domain,
    type: config.type,
    enabled: config.enabled,
  }));

const hasExactPresetDomainSet = (rules: DomainConfigT[]): boolean => {
  const knownDomains = new Set(DOMAIN_CONFIGS.map(({ domain }) => domain));
  return (
    rules.length === knownDomains.size &&
    new Set(rules.map(({ domain }) => domain)).size === knownDomains.size &&
    rules.every(({ domain }) => knownDomains.has(domain))
  );
};

const isUntouchedLegacyDefaults = (rules: DomainConfigT[]): boolean => {
  if (!hasExactPresetDomainSet(rules)) return false;

  const globalRule = rules.find(({ domain }) => domain === '*');
  const youtubeRule = rules.find(({ domain }) => domain === 'youtube.com');
  const otherRules = rules.filter(
    ({ domain }) => domain !== '*' && domain !== 'youtube.com'
  );

  return Boolean(
    globalRule?.enabled &&
      (globalRule.type === DomainRuleTypeE.Blacklist ||
        globalRule.type === DomainRuleTypeE.Whitelist) &&
      youtubeRule?.enabled &&
      youtubeRule.type === DomainRuleTypeE.Whitelist &&
      otherRules.every((rule) => {
        const preset = DOMAIN_CONFIGS.find(
          ({ domain }) => domain === rule.domain
        );
        return (
          preset && rule.enabled === preset.enabled && rule.type === preset.type
        );
      })
  );
};

/** Preserve custom rules while upgrading former untouched preset policies. */
export const mergeAndMigrateDomainRules = (
  existingRules: DomainConfigT[]
): DomainConfigT[] => {
  if (isUntouchedLegacyDefaults(existingRules)) {
    return existingRules.map((rule) => {
      const preset = DOMAIN_CONFIGS.find(
        ({ domain }) => domain === rule.domain
      );
      return {
        ...rule,
        enabled: preset?.enabled ?? false,
        type: preset?.type ?? DomainRuleTypeE.Whitelist,
      };
    });
  }

  if (existingRules.some(({ domain }) => domain === '*')) {
    return existingRules;
  }

  const globalDefault = getDefaultDomainRules().find(
    ({ domain }) => domain === '*'
  ) ?? {
    domain: '*',
    enabled: true,
    type: DomainRuleTypeE.Whitelist,
  };
  return [globalDefault, ...existingRules];
};

export const getDomainMode = (rule: DomainConfigT | undefined): DomainModeT => {
  if (!rule?.enabled) return DomainModeE.Default;
  return rule.type === DomainRuleTypeE.Whitelist
    ? DomainModeE.On
    : DomainModeE.Off;
};

export const createDomainRule = (
  domain: string,
  mode: DomainModeT = DomainModeE.Default,
  createdAt?: number
): DomainConfigT => {
  const rule: DomainConfigT = {
    domain,
    enabled: mode !== DomainModeE.Default,
    type:
      mode === DomainModeE.Off
        ? DomainRuleTypeE.Blacklist
        : DomainRuleTypeE.Whitelist,
  };
  if (createdAt !== undefined) rule.createdAt = createdAt;
  return rule;
};

export const setDomainMode = (
  rules: DomainConfigT[],
  domain: string,
  mode: DomainModeT,
  options: {
    addMissing?: boolean;
    addAtTop?: boolean;
    createdAt?: number;
  } = {}
): DomainConfigT[] => {
  const existingIndex = rules.findIndex((rule) => rule.domain === domain);

  if (existingIndex >= 0) {
    return rules.map((rule, index) =>
      index === existingIndex
        ? { ...rule, ...createDomainRule(domain, mode) }
        : rule
    );
  }

  if (!options.addMissing) return rules;

  const nextRule = createDomainRule(domain, mode, options.createdAt);
  if (!options.addAtTop) return [...rules, nextRule];

  const firstSiteIndex = rules.findIndex((rule) => rule.domain !== '*');
  const insertionIndex = firstSiteIndex < 0 ? rules.length : firstSiteIndex;
  return [
    ...rules.slice(0, insertionIndex),
    nextRule,
    ...rules.slice(insertionIndex),
  ];
};

export const isGlobalDefaultOn = (rules: DomainConfigT[]): boolean => {
  const globalRule = rules.find(({ domain }) => domain === '*');
  return globalRule?.type !== DomainRuleTypeE.Blacklist;
};

export const setGlobalDefault = (
  rules: DomainConfigT[],
  isOn: boolean
): DomainConfigT[] => {
  const type = isOn ? DomainRuleTypeE.Whitelist : DomainRuleTypeE.Blacklist;
  const globalRuleIndex = rules.findIndex(({ domain }) => domain === '*');

  if (globalRuleIndex < 0) {
    return [{ domain: '*', enabled: true, type }, ...rules];
  }

  return rules.map((rule, index) =>
    index === globalRuleIndex ? { ...rule, enabled: true, type } : rule
  );
};

export const reorderSiteRules = (
  rules: DomainConfigT[],
  fromIndex: number,
  toIndex: number
): DomainConfigT[] => {
  const globalRules = rules.filter(({ domain }) => domain === '*');
  const siteRules = rules.filter(({ domain }) => domain !== '*');
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= siteRules.length ||
    toIndex >= siteRules.length
  ) {
    return rules;
  }

  const [movedRule] = siteRules.splice(fromIndex, 1);
  if (!movedRule) return rules;
  siteRules.splice(toIndex, 0, movedRule);
  return [...globalRules, ...siteRules];
};

export const restoreSiteRule = (
  rules: DomainConfigT[],
  rule: DomainConfigT,
  siteIndex: number
): DomainConfigT[] => {
  const withoutDuplicate = rules.filter(({ domain }) => domain !== rule.domain);
  const globalRules = withoutDuplicate.filter(({ domain }) => domain === '*');
  const siteRules = withoutDuplicate.filter(({ domain }) => domain !== '*');
  const insertionIndex = Math.max(0, Math.min(siteIndex, siteRules.length));
  siteRules.splice(insertionIndex, 0, rule);
  return [...globalRules, ...siteRules];
};

const hostnamePattern =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

export interface SiteRuleTargetI {
  host: string;
  hostname: string;
  port: string;
  suffix: string;
}

const getUrlSuffix = (url: URL): string =>
  `${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`;

export const parseSiteRuleTarget = (target: string): SiteRuleTargetI | null => {
  if (!target || target === '*') return null;

  try {
    const url = new URL(`https://${target}`);
    return {
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase().replace(/^\[|\]$/g, ''),
      port: url.port,
      suffix: getUrlSuffix(url),
    };
  } catch {
    return null;
  }
};

export const getSiteRuleHostname = (target: string): string | null =>
  parseSiteRuleTarget(target)?.hostname ?? null;

export const doesSiteRuleMatchUrl = (target: string, url: URL): boolean => {
  const parsedTarget = parseSiteRuleTarget(target);
  if (!parsedTarget) return false;

  const currentHostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const hostMatches = parsedTarget.port
    ? url.host.toLowerCase() === parsedTarget.host
    : currentHostname === parsedTarget.hostname ||
      currentHostname.endsWith(`.${parsedTarget.hostname}`);

  return (
    hostMatches &&
    (!parsedTarget.suffix || getUrlSuffix(url) === parsedTarget.suffix)
  );
};

/** Convert a hostname or HTTP(S) URL to a host with an optional page suffix. */
export const normalizeSiteInput = (input: string): string | null => {
  const value = input.trim();
  if (!value || value.includes('*')) return null;

  let url: URL;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!hostname) return null;

  const parsed = parse(hostname);
  if (!parsed.isIp && !hostnamePattern.test(hostname)) return null;

  const formattedHostname = hostname.includes(':') ? `[${hostname}]` : hostname;
  const host = `${formattedHostname}${url.port ? `:${url.port}` : ''}`;
  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');

  return `${host}${pathname}${url.hash}`;
};

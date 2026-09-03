import type { DomainConfigT } from '@/types/domains';
import { DomainRuleTypeE } from '@/types/domains';

export const DOMAIN_CONFIGS: DomainConfigT[] = [
  { domain: '*', type: DomainRuleTypeE.Whitelist, enabled: true },
  {
    domain: 'apinix.com',
    type: DomainRuleTypeE.Blacklist,
    enabled: true,
  },
  {
    domain: 'dailymotion.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'facebook.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'hulu.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'instagram.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'netflix.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'steampowered.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'tiktok.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'twitch.tv',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'vimeo.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'x.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
  {
    domain: 'youtube.com',
    type: DomainRuleTypeE.Whitelist,
    enabled: false,
  },
];

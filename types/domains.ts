export type DomainRuleTypeT = 'whitelist' | 'blacklist';

export type DomainConfigT = {
  domain: string;
  type: DomainRuleTypeT;
  enabled: boolean;
  color?: string;
};

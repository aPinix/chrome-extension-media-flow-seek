export const DomainRuleTypeE = {
  Whitelist: 'whitelist',
  Blacklist: 'blacklist',
} as const;
export type DomainRuleTypeT =
  (typeof DomainRuleTypeE)[keyof typeof DomainRuleTypeE];

export type DomainConfigT = {
  domain: string;
  type: DomainRuleTypeT;
  enabled: boolean;
  color?: string;
};

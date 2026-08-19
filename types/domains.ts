export const DomainRuleTypeE = {
  Whitelist: 'whitelist',
  Blacklist: 'blacklist',
} as const;
export type DomainRuleTypeT =
  (typeof DomainRuleTypeE)[keyof typeof DomainRuleTypeE];

export const DomainModeE = {
  Default: 'default',
  On: 'on',
  Off: 'off',
} as const;
export type DomainModeT = (typeof DomainModeE)[keyof typeof DomainModeE];

export type DomainConfigT = {
  domain: string;
  type: DomainRuleTypeT;
  enabled: boolean;
};

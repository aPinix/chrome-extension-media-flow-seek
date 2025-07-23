import { DOMAIN_CONFIGS } from '@/config/domains.config';

export const getDefaultDomainRules = () =>
  DOMAIN_CONFIGS.map((config) => ({
    domain: config.domain,
    type: config.type,
    enabled: config.enabled,
  }));

export const getProgressColor = (hostname: string): string => {
  const lowerHostname = hostname.toLowerCase();

  // Find matching domain config
  const config = DOMAIN_CONFIGS.find(
    (config) =>
      config.domain !== '*' &&
      lowerHostname.includes(config.domain.toLowerCase())
  );

  return config?.color || 'white';
};

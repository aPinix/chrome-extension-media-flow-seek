import type { DomainConfigT } from '@/types/domains';

export const DOMAIN_CONFIGS: DomainConfigT[] = [
  { domain: '*', type: 'blacklist', enabled: true },
  { domain: 'youtube.com', type: 'whitelist', enabled: true, color: '#ff0000' },
  { domain: 'vimeo.com', type: 'whitelist', enabled: false, color: '#1ab7ea' },
  {
    domain: 'dailymotion.com',
    type: 'whitelist',
    enabled: false,
    color: '#0066cc',
  },
  { domain: 'x.com', type: 'whitelist', enabled: false, color: '#1da1f2' },
  { domain: 'twitch.tv', type: 'whitelist', enabled: false, color: '#9146ff' },
  { domain: 'tiktok.com', type: 'whitelist', enabled: false, color: '#ff0050' },
  {
    domain: 'instagram.com',
    type: 'whitelist',
    enabled: false,
    color: '#e4405f',
  },
  {
    domain: 'facebook.com',
    type: 'whitelist',
    enabled: false,
    color: '#1877f2',
  },
  {
    domain: 'netflix.com',
    type: 'whitelist',
    enabled: false,
    color: '#e50914',
  },
  {
    domain: 'steampowered.com',
    type: 'whitelist',
    enabled: false,
    color: '#6f9fc8',
  },
  { domain: 'hulu.com', type: 'whitelist', enabled: false, color: '#1ce783' },
];

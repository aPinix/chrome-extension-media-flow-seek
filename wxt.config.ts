import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }),
  manifest: () => {
    return {
      name: 'Better Video Controls for YouTube, Instagram, TikTok & More',
      short_name: 'BetterVideo',
      default_locale: 'en',
      description:
        'Control videos on YouTube, Instagram, TikTok, and more. Scroll horizontally to seek instantly—even while another window is active.',
      version: '1.0.9',
      author: 'aPinix',
      icons: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '96': 'icon/96.png',
        '128': 'icon/128.png',
      },
      permissions: [
        // 'activeTab',
        'tabs',
        'storage',
        'scripting',
        // 'notifications',
        // 'contextMenus',
        // 'sidePanel',
      ],
      host_permissions: ['<all_urls>'],
      commands: {
        'toggle-extension': {
          suggested_key: {
            default: 'Ctrl+Shift+S',
            mac: 'MacCtrl+Shift+S',
          },
          description: 'Toggle extension enabled/disabled',
        },
      },
    };
  },
});

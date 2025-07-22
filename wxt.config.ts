import path from 'path';
import { defineConfig } from 'wxt';

import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }),
  manifest: ({ browser, manifestVersion, mode, command }) => {
    return {
      manifestVersion: 3,
      name: 'Media Flow Seek',
      short_name: 'Media Flow Seek',
      default_locale: 'en',
      description:
        'Control (Video, YouTube, Vimeo, ...) media playback with mouse scroll horizontally, even if the media or browser is not in focus.',
      version: '1.0.2',
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
        // 'scripting',
        // 'contextMenus',
        // 'sidePanel',
      ],
      host_permissions: ['<all_urls>'],
    };
  },
});

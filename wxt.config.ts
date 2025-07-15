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
      short_name: 'MediaFlowSeek',
      description:
        'Control (Video, YouTube, Vimeo, etc.) media playback timeline with mouse scroll horizontally, even if the media or browser is not in focus.',
      version: '1.0.0',
      author: 'Pinix',
      homepage_url: 'https://github.com/your-username/media-flow-seek',
      support_url: 'https://github.com/your-username/media-flow-seek/issues',

      // Icons
      icons: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '96': 'icon/96.png',
        '128': 'icon/128.png',
      },

      permissions: [
        'activeTab',
        'scripting',
        'tabs',
        'storage',
        // 'contextMenus',
      ],
    };
  },
});

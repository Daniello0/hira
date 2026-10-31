import type { MetadataRoute } from 'next';
import { THEME_SURFACE } from '../styles/theme-colors';

/** What a phone or desktop browser needs to install Hira as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hira',
    short_name: 'Hira',
    description: 'Find jobs that fit, with an explanation for every match.',
    start_url: '/chat',
    display: 'standalone',
    background_color: THEME_SURFACE.dark,
    theme_color: THEME_SURFACE.dark,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

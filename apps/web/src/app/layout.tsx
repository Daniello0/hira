import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from '../common/components/tooltip';
import { ServiceWorker } from '../features/pwa/service-worker';
import { ThemeController } from '../features/theme/theme-controller';
import { themeBootScript } from '../features/theme/theme-mode';
import { THEME_SURFACE } from '../styles/theme-colors';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hira',
  description: 'Find jobs that fit, with an explanation for every match.',
  applicationName: 'Hira',
  appleWebApp: { capable: true, title: 'Hira', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: THEME_SURFACE.dark,
};

/** Root document. The product UI is English; the theme is set before the first paint. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body className="bg-surface text-ink antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <ThemeController />
        <ServiceWorker />
      </body>
    </html>
  );
}

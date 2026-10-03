import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hira',
};

/** Root document. The product UI is English and dark. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-sky-100 antialiased">{children}</body>
    </html>
  );
}

'use client';

import { useEffect } from 'react';

/** Registers the worker in production. In development it removes any old one, so hot reload stays honest. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((one) => void one.unregister()));
      return;
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}

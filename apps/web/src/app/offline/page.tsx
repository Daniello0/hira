import { WifiOff } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '../../common/components/button';

/** Shown by the service worker when a page cannot be reached. */
export default function OfflinePage() {
  return (
    <main className="motion-enter flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={32} aria-hidden="true" className="text-ink-tertiary" />
      <h1 className="text-2xl font-normal">You are offline</h1>
      <p className="text-sm text-ink-secondary">Hira needs a connection to search and answer. Your chats are safe on the server.</p>
      <Link href="/chat" className={buttonClass('primary')}>Try again</Link>
    </main>
  );
}

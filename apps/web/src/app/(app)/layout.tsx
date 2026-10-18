import type { ReactNode } from 'react';
import { AppShell } from '../../features/shell/app-shell';

/** Signed-in and demo shell. Auth pages stay outside it. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

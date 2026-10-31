import type { ReactNode } from 'react';
import { AppPage } from '../../../features/shell/app-header';
import { PageColumn } from '../../../common/components/page-frame';

/** Settings pages. The sidebar shows their sections instead of the chats. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppPage actions={<span />}>
      <PageColumn>{children}</PageColumn>
    </AppPage>
  );
}

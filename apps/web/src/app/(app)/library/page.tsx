import { AppPage } from '../../../features/shell/app-header';
import { RequireAccount } from '../../../features/account/require-account';
import { LibraryView } from '../../../features/library/library-view';

/** Personal files. A demo session is sent to sign in. */
export default function LibraryPage() {
  return (
    <AppPage>
      <RequireAccount>
        <LibraryView />
      </RequireAccount>
    </AppPage>
  );
}

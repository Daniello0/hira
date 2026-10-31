import { AppPage } from '../../../features/shell/app-header';
import { RequireAccount } from '../../../features/account/require-account';
import { FavoritesView } from '../../../features/favorites/favorites-view';

/** Saved vacancies. There is no separate vacancy catalog. */
export default function FavoritesPage() {
  return (
    <AppPage>
      <RequireAccount>
        <FavoritesView />
      </RequireAccount>
    </AppPage>
  );
}

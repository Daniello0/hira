import { RequireAccount } from '../../../features/account/require-account';
import { ProfileView } from '../../../features/profile/profile-view';

/** Seeker profile and skills. */
export default function ProfilePage() {
  return (
    <RequireAccount>
      <ProfileView />
    </RequireAccount>
  );
}

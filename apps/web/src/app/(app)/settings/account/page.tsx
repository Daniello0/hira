import { RequireAccount } from '../../../../features/account/require-account';
import { AccountSection } from '../../../../features/settings/account-section';

/** Who is signed in, and signing out. */
export default function AccountPage() {
  return (
    <RequireAccount>
      <AccountSection />
    </RequireAccount>
  );
}

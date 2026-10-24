import { RequireAccount } from '../../../features/account/require-account';
import { MemoryView } from '../../../features/memory/memory-view';

/** Facts Hira stored, and the cross-chat switch. */
export default function MemoryPage() {
  return (
    <RequireAccount>
      <MemoryView />
    </RequireAccount>
  );
}

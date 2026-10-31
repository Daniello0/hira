import { RequireAccount } from '../../../../features/account/require-account';
import { MemoryView } from '../../../../features/memory/memory-view';

/** Facts Hira remembers. */
export default function MemoryPage() {
  return (
    <RequireAccount>
      <MemoryView />
    </RequireAccount>
  );
}

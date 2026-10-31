import { redirect } from 'next/navigation';

/** The first section. */
export default function SettingsPage() {
  redirect('/settings/appearance');
}

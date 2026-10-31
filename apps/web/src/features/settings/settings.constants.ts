import { Archive, Brain, CircleUser, CreditCard, Sun, User } from 'lucide-react';

/** Settings pages in sidebar order. */
export const SETTINGS_SECTIONS = [
  { href: '/settings/appearance', label: 'Appearance', Icon: Sun },
  { href: '/settings/profile', label: 'Profile', Icon: User },
  { href: '/settings/memory', label: 'Memory', Icon: Brain },
  { href: '/settings/archived', label: 'Archived chats', Icon: Archive },
  { href: '/settings/billing', label: 'Billing', Icon: CreditCard },
  { href: '/settings/account', label: 'Account', Icon: CircleUser },
] as const;

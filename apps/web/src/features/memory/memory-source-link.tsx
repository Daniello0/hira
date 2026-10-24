import type { MemoryFactDto } from '@hira/contracts';
import Link from 'next/link';
import { formatMemorySource } from './memory-source-format';

/** Navigable provenance when the API resolved chat or call context. */
export function MemorySourceLink({ fact }: { fact: MemoryFactDto }) {
  const source = formatMemorySource(fact);
  if (source.href === null) return <span>{source.label}</span>;
  return (
    <Link className="text-hira-accent underline" href={source.href}>
      {source.label}
    </Link>
  );
}

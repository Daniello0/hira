import { ExternalLink, Globe } from 'lucide-react';
import { CLOSED_VACANCY_LABEL, FOREIGN_REMOTE_LABEL, OPEN_POSTING_LABEL } from './vacancy.constants';

/** Badge for remote work from an employer abroad (Q30). */
export function ForeignRemoteBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-hira-accent/30 px-2 py-0.5 text-xs text-hira-text">
      <Globe size={12} aria-hidden="true" /> {FOREIGN_REMOTE_LABEL}
    </span>
  );
}

/** Link to the source site. A closed vacancy still links there, with the notice as its text. */
export function PostingLink({ url, closed }: { url: string; closed: boolean }) {
  if (url.trim().length === 0) return null;
  return (
    <a
      className={`inline-flex items-center gap-1 text-sm underline ${closed ? 'text-hira-text' : 'text-hira-accent'}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {closed ? CLOSED_VACANCY_LABEL : OPEN_POSTING_LABEL}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

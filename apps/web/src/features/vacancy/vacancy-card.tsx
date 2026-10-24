'use client';

import type { VacancyResult } from '@hira/contracts';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { FavoriteToggle } from './favorite-toggle';
import { FeedbackButtons } from './feedback-buttons';
import { MatchExplanationView } from './match-explanation';
import { toVacancyCardModel, type VacancyCardModel } from './vacancy-card-model';
import { useVacancyDetail } from './vacancy-detail.store';
import { ForeignRemoteBadge, PostingLink } from './vacancy-links';

interface VacancyCardProps {
  result: VacancyResult;
  open: boolean;
  onToggle: () => void;
  /** Assistant message that showed this card. Feedback is offered only with it. */
  messageId?: string | null;
}

/** Collapsed vacancy. The explanation opens in place; the title opens the detail drawer. */
export function VacancyCard({ result, open, onToggle, messageId = null }: VacancyCardProps) {
  const model = toVacancyCardModel(result);
  const account = useSession((state) => state.status) === SessionStatus.Account;
  const openDetail = useVacancyDetail((state) => state.open);
  const vacancyId = result.vacancy.id;
  return (
    <article className="rounded-lg border border-white/10 bg-hira-bg/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          <button type="button" className="text-left hover:underline" onClick={() => openDetail(vacancyId)}>{model.title}</button>
        </h3>
        <span className="rounded bg-hira-accent px-2 py-1 text-sm">{model.score}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <FavoriteToggle vacancyId={vacancyId} />
        {account && messageId !== null ? <FeedbackButtons messageId={messageId} vacancyId={vacancyId} /> : null}
      </div>
      <CardMeta model={model} />
      <button type="button" className="mt-2 text-sm text-hira-accent" aria-expanded={open} onClick={onToggle}>
        {open ? 'Hide explanation' : 'Explain match'}
      </button>
      {open ? <MatchExplanationView result={result} /> : null}
    </article>
  );
}

function CardMeta({ model }: { model: VacancyCardModel }) {
  return (
    <div className="mt-2 space-y-1 text-sm text-hira-muted">
      {model.company.length > 0 ? <p>{model.company}</p> : null}
      {model.location.length > 0 ? <p>{model.location}</p> : null}
      <p>{model.pay}{model.format ? ` · ${model.format}` : ''}</p>
      <ForeignRemoteBadge show={model.foreignRemote} />
      <BadgeList badges={model.badges} />
      <PostingLink url={model.originalUrl} closed={model.closed} />
    </div>
  );
}

function BadgeList({ badges }: { badges: readonly string[] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge} className="rounded-full bg-white/10 px-2 py-1 text-hira-text">
          {badge}
        </li>
      ))}
    </ul>
  );
}

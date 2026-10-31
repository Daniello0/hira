'use client';

import type { VacancyResult } from '@hira/contracts';
import { Badge } from '../../common/components/badge';
import { Card } from '../../common/components/card';
import { Collapsible } from '../../common/components/collapsible';
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

/** Collapsed vacancy. The explanation opens in place; the title opens the detail panel. */
export function VacancyCard({ result, open, onToggle, messageId = null }: VacancyCardProps) {
  const model = toVacancyCardModel(result);
  const account = useSession((state) => state.status) === SessionStatus.Account;
  const openDetail = useVacancyDetail((state) => state.open);
  const vacancyId = result.vacancy.id;
  return (
    <Card>
      <article>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-medium">
            <button type="button" className="text-left transition-colors hover:text-link" onClick={() => openDetail(vacancyId)}>{model.title}</button>
          </h3>
          <Badge tone="solid" className="shrink-0 px-2.5 py-1 text-sm font-medium" title="Match score">{model.score}</Badge>
        </div>
        <CardMeta model={model} />
        <div className="relative mt-3">
          <div className="absolute -top-1.5 -right-1.5 flex items-center">
            {account && messageId !== null ? <FeedbackButtons messageId={messageId} vacancyId={vacancyId} /> : null}
            <FavoriteToggle vacancyId={vacancyId} />
          </div>
          <Collapsible open={open} onToggle={onToggle} summary={open ? 'Hide explanation' : 'Explain match'}>
            <MatchExplanationView result={result} />
          </Collapsible>
        </div>
      </article>
    </Card>
  );
}

function CardMeta({ model }: { model: VacancyCardModel }) {
  return (
    <div className="mt-1 space-y-2 text-sm text-ink-secondary">
      <p>{[model.company, model.location].filter((part) => part.length > 0).join(' · ')}</p>
      <p>{model.pay}{model.format ? ` · ${model.format}` : ''}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ForeignRemoteBadge show={model.foreignRemote} />
        {model.badges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
      </div>
      <PostingLink url={model.originalUrl} closed={model.closed} />
    </div>
  );
}

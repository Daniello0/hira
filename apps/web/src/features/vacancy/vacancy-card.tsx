import type { VacancyResult } from '@hira/contracts';
import { FavoriteToggle } from './favorite-toggle';
import { CLOSED_VACANCY_LABEL } from './vacancy.constants';
import { MatchExplanationView } from './match-explanation';
import { toVacancyCardModel } from './vacancy-card-model';

interface VacancyCardProps {
  result: VacancyResult;
  open: boolean;
  onToggle: () => void;
}

/** Collapsed vacancy. The explanation opens in place. */
export function VacancyCard({ result, open, onToggle }: VacancyCardProps) {
  const model = toVacancyCardModel(result);
  return (
    <article className="rounded-lg border border-white/10 bg-hira-bg/60 p-3">
      <CardSummary model={model} vacancyId={result.vacancy.id} onToggle={onToggle} open={open} />
      {open ? <MatchExplanationView result={result} /> : null}
    </article>
  );
}

function CardSummary({ model, vacancyId, onToggle, open }: { model: ReturnType<typeof toVacancyCardModel>; vacancyId: string; onToggle: () => void; open: boolean }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{model.title}</h3>
        <span className="rounded bg-hira-accent px-2 py-1 text-sm">{model.score}</span>
      </div>
      <FavoriteToggle vacancyId={vacancyId} />
      <CardMeta model={model} />
      <button type="button" className="mt-2 text-sm text-hira-accent" aria-expanded={open} onClick={onToggle}>
        {open ? 'Hide explanation' : 'Explain match'}
      </button>
    </div>
  );
}

function CardMeta({ model }: { model: ReturnType<typeof toVacancyCardModel> }) {
  return (
    <div className="mt-2 space-y-1 text-sm text-hira-muted">
      {model.company.length > 0 ? <p>{model.company}</p> : null}
      {model.location.length > 0 ? <p>{model.location}</p> : null}
      <p>{model.pay}{model.format ? ` · ${model.format}` : ''}</p>
      <BadgeList badges={model.badges} />
      {model.closed ? <ClosedNote url={model.originalUrl} /> : null}
    </div>
  );
}

function BadgeList({ badges }: { badges: readonly string[] }) {
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

function ClosedNote({ url }: { url: string }) {
  return (
    <a className="inline-block text-hira-text underline" href={url}>
      {CLOSED_VACANCY_LABEL}
    </a>
  );
}

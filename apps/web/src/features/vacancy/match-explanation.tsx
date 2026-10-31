import type { RetrievalBranch, VacancyResult } from '@hira/contracts';
import { Badge } from '../../common/components/badge';
import { branchLabel } from '../../common/utils/enum-labels';
import { factorBars, skillGroups } from './vacancy-card-model';

/** Expanded match: factor bars, skill groups, and branch badges. */
export function MatchExplanationView({ result }: { result: VacancyResult }) {
  return (
    <div className="mt-3 w-full space-y-3 pb-1 text-sm">
      <FactorList result={result} />
      {skillGroups(result.explanation).map((group) => (
        <SkillGroupView key={group.title} title={group.title} skills={group.skills} />
      ))}
      <BranchBadges branches={result.retrievedBy} />
    </div>
  );
}

function FactorList({ result }: { result: VacancyResult }) {
  return (
    <ul className="space-y-2">
      {factorBars(result.explanation).map((bar) => (
        <li key={bar.factor}>
          <span className="text-ink-tertiary">{bar.label}</span>
          <div className="mt-1 h-bar overflow-hidden rounded-full bg-hover">
            <div className="motion-bar h-bar rounded-full bg-accent" style={{ width: `${bar.width}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SkillGroupView({ title, skills }: { title: string; skills: { surface: string; path: string | null; evidence: string | null }[] }) {
  if (skills.length === 0) return null;
  return (
    <div>
      <p className="text-ink-tertiary">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={`${title}-${skill.surface}`} title={skill.evidence ?? undefined} className="rounded-full bg-hover px-2 py-1 text-xs">
            {skill.surface}
            {skill.path ? <span className="text-ink-tertiary"> {skill.path}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BranchBadges({ branches }: { branches: readonly RetrievalBranch[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {branches.map((branch) => (
        <li key={branch}><Badge tone="accent">{branchLabel(branch)}</Badge></li>
      ))}
    </ul>
  );
}

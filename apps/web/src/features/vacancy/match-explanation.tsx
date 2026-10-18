import type { VacancyResult } from '@hira/contracts';
import { factorBars, skillGroups } from './vacancy-card-model';

/** Expanded match: factor bars, skill groups, and branch badges. */
export function MatchExplanationView({ result }: { result: VacancyResult }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
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
          <span className="text-hira-muted">{bar.label}</span>
          <div className="mt-1 h-2 rounded bg-hira-bg">
            <div className="h-2 rounded bg-hira-accent" style={{ width: `${bar.width}%` }} />
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
      <p className="text-hira-muted">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={`${title}-${skill.surface}`} title={skill.evidence ?? undefined} className="rounded-full bg-white/10 px-2 py-1">
            {skill.surface}
            {skill.path ? <span className="text-hira-muted"> {skill.path}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BranchBadges({ branches }: { branches: readonly string[] }) {
  return (
    <ul className="flex gap-2">
      {branches.map((branch) => (
        <li key={branch} className="rounded bg-hira-accent/30 px-2 py-1 text-xs">
          {branch}
        </li>
      ))}
    </ul>
  );
}

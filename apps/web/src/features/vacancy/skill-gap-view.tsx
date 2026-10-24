import type { SkillGapDto } from '@hira/contracts';
import { skillImportanceLabel } from '../../common/utils/enum-labels';

/** US-6: which vacancy skills the profile covers, and which owned skills lead to the missing ones. */
export function SkillGapView({ gap, failed }: { gap: SkillGapDto | null; failed: boolean }) {
  if (gap === null) return failed ? <p className="text-sm text-hira-muted">Could not compare with your profile.</p> : null;
  const percent = Math.round(Math.min(1, Math.max(0, gap.coverage)) * 100);
  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-medium">Your fit</h3>
      <div>
        <p className="text-hira-muted">Profile covers {percent}% of required and preferred skills</p>
        <div className="mt-1 h-2 rounded bg-hira-bg">
          <div className="h-2 rounded bg-hira-accent" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <Chips title="You have" names={gap.matched.map((skill) => skill.name)} />
      <MissingList gap={gap} />
    </section>
  );
}

function Chips({ title, names }: { title: string; names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className="text-hira-muted">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {names.map((name) => <li key={name} className="rounded-full bg-white/10 px-2 py-1">{name}</li>)}
      </ul>
    </div>
  );
}

function MissingList({ gap }: { gap: SkillGapDto }) {
  if (gap.missing.length === 0) return <p className="text-hira-muted">Nothing is missing.</p>;
  return (
    <div>
      <p className="text-hira-muted">Missing</p>
      <ul className="mt-1 space-y-2">
        {gap.missing.map((item) => (
          <li key={item.skillId}>
            <span className="font-medium">{item.name}</span>
            <span className="text-hira-muted"> · {skillImportanceLabel(item.importance)}</span>
            {item.relatedOwned.length > 0 ? (
              <p className="text-xs text-hira-muted">Related skills you have: {item.relatedOwned.join(', ')}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

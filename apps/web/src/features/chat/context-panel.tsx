import type { RetrievalDiagnostics, SearchIntent } from '@hira/contracts';
import { constraintLines, intentSkills } from './context-lines';

interface ContextPanelProps {
  intent: SearchIntent | null;
  diagnostics: RetrievalDiagnostics | null;
  skills: readonly string[];
  facts: readonly string[];
  account: boolean;
}

/** Right column: intent, filters, profile skills, and memory. */
export function ContextPanel({ intent, diagnostics, skills, facts, account }: ContextPanelProps) {
  return (
    <aside className="hidden h-screen overflow-y-auto border-l border-white/10 bg-hira-panel/40 p-4 md:block">
      <PanelBody intent={intent} diagnostics={diagnostics} skills={skills} facts={facts} account={account} />
    </aside>
  );
}

/** Same body inside the mobile drawer. */
export function PanelBody({ intent, diagnostics, skills, facts, account }: ContextPanelProps) {
  const lines = constraintLines(intent, diagnostics);
  return (
    <div className="space-y-4 text-sm">
      <Section title="Intent" lines={intent === null ? ['Waiting for a message'] : [intent.rewrittenQuery, ...intentSkills(intent)]} />
      <Section title="Filters" lines={lines.length === 0 ? ['None yet'] : lines} />
      {account ? <Section title="Profile" lines={skills.length === 0 ? ['No skills on your profile yet'] : skills} /> : null}
      {account ? <Section title="Memory" lines={memoryLines(facts)} /> : null}
    </div>
  );
}

function memoryLines(facts: readonly string[]): string[] {
  if (facts.length === 0) return ['No facts yet'];
  return [`${facts.length} facts`, ...facts.slice(0, 5)];
}

function Section({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <section>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-1 space-y-1 text-hira-muted">
        {lines.map((line) => <li key={`${title}-${line}`}>{line}</li>)}
      </ul>
    </section>
  );
}

import type { RetrievalDiagnostics, SearchIntent } from '@hira/contracts';
import { X } from 'lucide-react';
import { IconButton } from '../../common/components/icon-button';
import { seniorityLabel } from '../../common/utils/enum-labels';
import { constraintLines, intentSkills } from './context-lines';
import type { AccountContext } from './panel-context';

/** Everything the context column shows. */
export interface PanelData {
  intent: SearchIntent | null;
  diagnostics: RetrievalDiagnostics | null;
  context: AccountContext;
  account: boolean;
  /** Cross-chat memory switch. Off: facts are not used, so they are not listed here. */
  crossChat: boolean;
}

const MEMORY_PREVIEW = 5;

/** Right column that slides open from the header button: intent, filters, profile skills, and memory. */
export function ContextPanel({ data, open, onClose }: { data: PanelData; open: boolean; onClose: () => void }) {
  return (
    <aside data-open={open} inert={!open} aria-label="Context" className="motion-width hidden w-0 shrink-0 overflow-hidden border-line-light data-[open=true]:w-panel data-[open=true]:border-l md:block">
      <div className="scroll-on-hover h-full w-panel overflow-y-auto p-4">
        <PanelHeader onClose={onClose} />
        <PanelBody data={data} />
      </div>
    </aside>
  );
}

/** Title and close button, in the column and in the phone sheet. */
export function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-base font-medium">Context</p>
      <IconButton label="Hide context" shape="action" onClick={onClose}><X className="size-icon-md" aria-hidden="true" /></IconButton>
    </div>
  );
}

/** Same body inside the mobile drawer. */
export function PanelBody({ data }: { data: PanelData }) {
  const lines = constraintLines(data.intent, data.diagnostics);
  return (
    <div className="space-y-4 text-sm">
      <Section title="Intent" lines={data.intent === null ? ['Waiting for a message'] : [data.intent.rewrittenQuery, ...intentSkills(data.intent)]} />
      <Section title="Filters" lines={lines.length === 0 ? ['None yet'] : lines} />
      {data.account ? <Section title="Profile" lines={profileLines(data.context)} /> : null}
      {data.account ? <Section title="Memory" lines={memoryLines(data.context.facts, data.crossChat)} /> : null}
    </div>
  );
}

function profileLines(context: AccountContext): string[] {
  const seniority = context.seniority === null ? [] : [`Seniority: ${seniorityLabel(context.seniority)}`];
  const skills = context.skills.length === 0 ? ['No skills on your profile yet'] : context.skills;
  return [...seniority, ...skills];
}

function memoryLines(facts: readonly string[], crossChat: boolean): string[] {
  if (!crossChat) return ['Cross-chat memory is off'];
  if (facts.length === 0) return ['No facts yet'];
  return [`${facts.length} facts`, ...facts.slice(0, MEMORY_PREVIEW)];
}

function Section({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <section>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-1 space-y-1 text-ink-tertiary">
        {lines.map((line, index) => <li key={`${title}-${index}`}>{line}</li>)}
      </ul>
    </section>
  );
}

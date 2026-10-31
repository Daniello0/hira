'use client';

import { SkillImportance, VacancyStatus, type VacancyDetailDto, type VacancyDto, type VacancySkillDto } from '@hira/contracts';
import { X } from 'lucide-react';
import { Badge } from '../../common/components/badge';
import { MutedText, AlertText, SkeletonList } from '../../common/components/feedback';
import { IconButton } from '../../common/components/icon-button';
import { Sheet } from '../../common/components/sheet';
import { useLastDefined } from '../../common/hooks/use-last-defined';
import { employmentLabel, seniorityLabel, skillImportanceLabel, workFormatLabel } from '../../common/utils/enum-labels';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { FavoriteToggle } from './favorite-toggle';
import { SkillGapView } from './skill-gap-view';
import { useVacancyDetailData } from './use-vacancy-detail-data';
import { payLabel } from './vacancy-card-model';
import { useVacancyDetail } from './vacancy-detail.store';
import { ForeignRemoteBadge, PostingLink } from './vacancy-links';

const IMPORTANCE_ORDER: readonly SkillImportance[] = [SkillImportance.Required, SkillImportance.Preferred, SkillImportance.Mentioned];

/** Right-side panel with the full vacancy. Mounted once in the shell; it keeps its content while sliding out. */
export function VacancyDetailDrawer() {
  const openId = useVacancyDetail((state) => state.openId);
  const close = useVacancyDetail((state) => state.close);
  const shownId = useLastDefined(openId);
  return (
    <Sheet open={openId !== null} label="Vacancy" onClose={close} side="right" widthClass="w-full md:w-vacancy">
      <div className="flex h-header shrink-0 items-center justify-end px-2">
        <IconButton label="Close" onClick={close}><X size={20} aria-hidden="true" /></IconButton>
      </div>
      <div className="px-5 pb-8">
        {shownId !== null ? <VacancyDetailBody key={shownId} id={shownId} /> : null}
      </div>
    </Sheet>
  );
}

function VacancyDetailBody({ id }: { id: string }) {
  const account = useSession((state) => state.status) === SessionStatus.Account;
  const data = useVacancyDetailData(id, account);
  if (data.loading) return <SkeletonList />;
  if (data.detail === null) return <AlertText>Could not load this vacancy.</AlertText>;
  return (
    <div className="motion-fade space-y-6">
      <DetailHeader detail={data.detail} />
      {account ? <SkillGapView gap={data.gap} failed={data.gapFailed} /> : null}
      <SkillSection skills={data.detail.skills} />
      <section className="space-y-2 text-sm">
        <h3 className="font-medium">Description</h3>
        <p className="whitespace-pre-wrap text-ink-tertiary">{data.detail.description}</p>
      </section>
      <SimilarList items={data.similar} />
    </div>
  );
}

function DetailHeader({ detail }: { detail: VacancyDetailDto }) {
  const facts = [
    detail.workFormat === null ? null : workFormatLabel(detail.workFormat),
    detail.employment === null ? null : employmentLabel(detail.employment),
    detail.seniority === null ? null : seniorityLabel(detail.seniority),
    detail.schedule,
  ].filter((fact): fact is string => fact !== null && fact.length > 0);
  return (
    <header className="space-y-2">
      <h2 className="text-xl font-semibold">{detail.title}</h2>
      <p className="text-sm text-ink-tertiary">{[detail.companyName, detail.locationLabel].filter(Boolean).join(' · ')}</p>
      <p className="text-sm text-ink-tertiary">{[payLabel(detail), ...facts].join(' · ')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <ForeignRemoteBadge show={detail.isForeignRemote} />
        <PostingLink url={detail.url} closed={detail.status !== VacancyStatus.Active} />
        <FavoriteToggle vacancyId={detail.id} />
      </div>
    </header>
  );
}

function SkillSection({ skills }: { skills: readonly VacancySkillDto[] }) {
  if (skills.length === 0) return null;
  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-medium">Skills</h3>
      {IMPORTANCE_ORDER.map((importance) => (
        <SkillGroup key={importance} importance={importance} skills={skills.filter((skill) => skill.importance === importance)} />
      ))}
    </section>
  );
}

function SkillGroup({ importance, skills }: { importance: SkillImportance; skills: readonly VacancySkillDto[] }) {
  if (skills.length === 0) return null;
  return (
    <div>
      <p className="text-ink-tertiary">{skillImportanceLabel(importance)}</p>
      <ul className="mt-1 space-y-1">
        {skills.map((skill) => (
          <li key={skill.skillId}>
            <Badge>{skill.name}</Badge>
            {skill.evidenceSpan ? <q className="ml-2 text-xs text-ink-tertiary">{skill.evidenceSpan}</q> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimilarList({ items }: { items: readonly VacancyDto[] | null }) {
  const open = useVacancyDetail((state) => state.open);
  if (items === null) return <MutedText>Similar vacancies are unavailable.</MutedText>;
  if (items.length === 0) return null;
  return (
    <section className="space-y-2 text-sm">
      <h3 className="font-medium">Similar vacancies</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="text-left text-link transition-colors hover:text-link-hover" onClick={() => open(item.id)}>{item.title}</button>
            <p className="text-xs text-ink-tertiary">{[item.companyName, item.locationLabel, payLabel(item)].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

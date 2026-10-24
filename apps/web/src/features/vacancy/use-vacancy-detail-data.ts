'use client';

import type { SkillGapDto, VacancyDetailDto, VacancyDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { fetchSimilar, fetchSkillGap, fetchVacancy } from './vacancy-api';

/** What the detail drawer has loaded so far. Each part fails on its own. */
export interface VacancyDetailData {
  loading: boolean;
  detail: VacancyDetailDto | null;
  similar: VacancyDto[] | null;
  gap: SkillGapDto | null;
  gapFailed: boolean;
}

const EMPTY: VacancyDetailData = { loading: true, detail: null, similar: null, gap: null, gapFailed: false };

/** Loads the vacancy, its neighbours, and (for an account) the skill gap in parallel. */
export function useVacancyDetailData(id: string, account: boolean): VacancyDetailData {
  const [data, setData] = useState<VacancyDetailData>(EMPTY);
  useEffect(() => {
    let active = true;
    setData(EMPTY);
    void loadAll(id, account).then((next) => {
      if (active) setData(next);
    });
    return () => {
      active = false;
    };
  }, [id, account]);
  return data;
}

async function loadAll(id: string, account: boolean): Promise<VacancyDetailData> {
  const [detail, similar, gap] = await Promise.all([
    fetchVacancy(id).catch(() => null),
    fetchSimilar(id).catch(() => null),
    account ? fetchSkillGap(id).catch(() => null) : Promise.resolve(null),
  ]);
  return { loading: false, detail, similar: similar?.items.filter((item) => item.id !== id) ?? null, gap, gapFailed: account && gap === null };
}

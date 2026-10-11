import { DAY_MS } from '../../ingestion.constants';

export interface DateWindow {
  from: Date;
  to: Date;
}

/** Splits a search window in half. A window of one day cannot be split further. */
export function nextDateShards(from: Date, to: Date): DateWindow[] {
  const span = to.getTime() - from.getTime();
  if (span <= DAY_MS) return [];
  const mid = new Date(from.getTime() + span / 2);
  return [
    { from, to: mid },
    { from: mid, to },
  ];
}

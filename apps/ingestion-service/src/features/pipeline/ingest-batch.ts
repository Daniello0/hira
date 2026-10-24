import { randomUUID } from 'node:crypto';
import { VacancySource, VacancyStatus } from '@hira/contracts';
import { crossSourceDecision } from '../dedupe/cross-source';
import { decideUpsert } from '../dedupe/decide-upsert';
import { HOUR_MS, STALE_THRESHOLD_HOURS } from '../ingestion.constants';
import type { RawVacancy } from '../connectors/raw-vacancy';
import { normalizeVacancy, type CanonicalVacancy } from '../normalize/normalize-vacancy';
import type { StoredVacancy, VacancyWriter } from '../store/vacancy-writer';

export interface IngestCounts {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface IngestBatchInput {
  source: VacancySource;
  raws: readonly RawVacancy[];
  rates: Record<string, number>;
  writer: VacancyWriter;
  now: Date;
}

/** Writes a batch. A blank title is a failure and does not create a row. */
export async function ingestBatch(input: IngestBatchInput): Promise<IngestCounts> {
  const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const raw of input.raws) {
    await ingestRaw(input, raw, counts);
  }
  return counts;
}

/** True when a posting has not been seen within the stale window. */
export function isStale(lastSeen: Date, now: Date): boolean {
  return now.getTime() - lastSeen.getTime() >= STALE_THRESHOLD_HOURS * HOUR_MS;
}

/**
 * Expires active rows last seen more than 48 hours ago. Deliberately not scheduled: a crawl is
 * capped by `INGEST_LIMIT`, so "not in the last list pages" does not mean "closed". The nightly
 * liveness pass (`check-alive`) asks each detail page instead and only closes what the source
 * itself reports archived or gone (Wiki/03 §2.4).
 */
export async function expireUnseen(writer: VacancyWriter, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_HOURS * HOUR_MS);
  return writer.expireOlderThan(cutoff);
}

async function ingestRaw(
  input: IngestBatchInput,
  raw: RawVacancy,
  counts: IngestCounts,
): Promise<void> {
  const canonical = tryCanonical(raw, input.rates, input.source);
  if (canonical === null) {
    counts.failed += 1;
    return;
  }
  const outcome = await writeOne(input, canonical);
  counts[outcome] += 1;
}

function tryCanonical(
  raw: RawVacancy,
  rates: Record<string, number>,
  source: VacancySource,
): CanonicalVacancy | null {
  try {
    return normalizeVacancy(raw, rates, source);
  } catch {
    return null;
  }
}

async function writeOne(
  input: IngestBatchInput,
  canonical: CanonicalVacancy,
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await input.writer.findByNaturalKey(canonical.source, canonical.externalId);
  const decision = decideUpsert(existing?.sourceHash ?? null, canonical.sourceHash);
  const row = await applyWrite(input.writer, decision, existing, canonical, input.now);
  if (decision !== 'skip') await hideIfCopy(input.writer, row);
  if (decision === 'insert') return 'created';
  if (decision === 'update') return 'updated';
  return 'skipped';
}

async function applyWrite(
  writer: VacancyWriter,
  decision: ReturnType<typeof decideUpsert>,
  existing: StoredVacancy | null,
  canonical: CanonicalVacancy,
  seenAt: Date,
): Promise<StoredVacancy> {
  if (decision === 'skip' && existing !== null) {
    await writer.touch(existing.id, seenAt);
    return { ...existing, lastSeenAt: seenAt };
  }
  const row = toStored(canonical, existing?.id ?? randomUUID(), seenAt);
  if (decision === 'insert') await writer.insert(row);
  else await writer.replaceContent(row);
  return row;
}

async function hideIfCopy(writer: VacancyWriter, row: StoredVacancy): Promise<void> {
  if (row.status !== VacancyStatus.Active) return;
  const others = await writer.findActiveExcept(row.id);
  const copy = others.find(
    (existing) => crossSourceDecision({ incoming: row, existing }).duplicate,
  );
  if (copy === undefined) return;
  await writer.markDuplicate(row.id);
  row.status = VacancyStatus.Duplicate;
}

function toStored(canonical: CanonicalVacancy, id: string, seenAt: Date): StoredVacancy {
  return {
    id,
    source: canonical.source,
    externalId: canonical.externalId,
    title: canonical.title,
    companyName: canonical.companyName,
    city: canonical.city,
    description: canonical.description,
    simhash: canonical.simhash,
    contentHash: canonical.contentHash,
    sourceHash: canonical.sourceHash,
    skillsText: canonical.skillsText,
    status: canonical.status,
    lastSeenAt: seenAt,
    embedding: null,
    skillsExtractedAt: null,
  };
}

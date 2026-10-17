import { VacancySource, VacancyStatus } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { RawVacancy } from '../connectors/raw-vacancy';
import { expireUnseen, ingestBatch, isStale } from './ingest-batch';
import type { StoredVacancy, VacancyWriter } from '../store/vacancy-writer';

function raw(patch: Partial<RawVacancy> = {}): RawVacancy {
  return {
    externalId: '1',
    url: 'https://example.test/1',
    title: 'Backend',
    companyName: 'Рога',
    unp: null,
    region: 'Минск',
    city: 'Минск',
    descriptionHtml: '<p>пишем api на typescript и postgres</p>',
    seniorityRaw: null,
    employmentRaw: null,
    workFormatRaw: null,
    schedule: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    isGross: null,
    publishedAt: null,
    archived: false,
    ...patch,
  };
}

class MemoryWriter implements VacancyWriter {
  rows: StoredVacancy[] = [];

  async findByNaturalKey(source: VacancySource, externalId: string): Promise<StoredVacancy | null> {
    return this.rows.find((row) => row.source === source && row.externalId === externalId) ?? null;
  }

  async insert(row: StoredVacancy): Promise<void> {
    this.rows.push(row);
  }

  async touch(id: string, seenAt: Date): Promise<void> {
    const row = this.required(id);
    row.lastSeenAt = seenAt;
  }

  async replaceContent(row: StoredVacancy): Promise<void> {
    const index = this.rows.findIndex((item) => item.id === row.id);
    this.rows[index] = row;
  }

  async findActiveExcept(id: string): Promise<StoredVacancy[]> {
    return this.rows.filter((row) => row.id !== id && row.status === VacancyStatus.Active);
  }

  async markDuplicate(id: string): Promise<void> {
    this.required(id).status = VacancyStatus.Duplicate;
  }

  async expireOlderThan(cutoff: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.status === VacancyStatus.Active && row.lastSeenAt < cutoff) {
        row.status = VacancyStatus.Expired;
        count += 1;
      }
    }
    return count;
  }

  private required(id: string): StoredVacancy {
    const row = this.rows.find((item) => item.id === id);
    if (row === undefined) throw new Error(`missing ${id}`);
    return row;
  }
}

describe('ingestBatch', () => {
  const now = new Date('2026-10-11T12:00:00Z');

  it('inserts, skips an unchanged posting, and clears the vector when the text changes', async () => {
    const writer = new MemoryWriter();
    const first = await ingestBatch({
      source: VacancySource.RabotaBy,
      raws: [raw()],
      rates: {},
      writer,
      now,
    });
    expect(first).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0 });
    const again = await ingestBatch({
      source: VacancySource.RabotaBy,
      raws: [raw()],
      rates: {},
      writer,
      now,
    });
    expect(again.skipped).toBe(1);
    writer.rows[0]!.embedding = '[1]';
    writer.rows[0]!.skillsExtractedAt = now;
    const changed = await ingestBatch({
      source: VacancySource.RabotaBy,
      raws: [raw({ descriptionHtml: '<p>другой текст вакансии совсем</p>' })],
      rates: {},
      writer,
      now,
    });
    expect(changed.updated).toBe(1);
    expect(writer.rows[0]?.embedding).toBeNull();
    expect(writer.rows[0]?.skillsExtractedAt).toBeNull();
  });

  it('counts a blank title as failed and does not insert it', async () => {
    const writer = new MemoryWriter();
    const result = await ingestBatch({
      source: VacancySource.Gsz,
      raws: [raw({ title: '  ' })],
      rates: {},
      writer,
      now,
    });
    expect(result.failed).toBe(1);
    expect(writer.rows).toHaveLength(0);
  });

  it('hides a cross-source copy and expires a row that was not seen for 48 hours', async () => {
    const writer = new MemoryWriter();
    await ingestBatch({
      source: VacancySource.RabotaBy,
      raws: [raw({ externalId: 'hh' })],
      rates: {},
      writer,
      now,
    });
    await ingestBatch({
      source: VacancySource.HabrCareer,
      raws: [raw({ externalId: 'habr' })],
      rates: {},
      writer,
      now,
    });
    const copy = writer.rows.find((row) => row.externalId === 'habr');
    expect(copy?.status).toBe(VacancyStatus.Duplicate);
    const old = new Date('2026-10-08T11:00:00Z');
    writer.rows[0]!.lastSeenAt = old;
    expect(isStale(old, now)).toBe(true);
    expect(await expireUnseen(writer, now)).toBe(1);
    expect(writer.rows[0]?.status).toBe(VacancyStatus.Expired);
  });
});

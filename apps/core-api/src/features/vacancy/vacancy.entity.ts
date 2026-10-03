import {
  EmploymentType,
  RateUnit,
  SeniorityLevel,
  VacancySource,
  VacancyStatus,
  WorkFormat,
} from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SEARCH_DOCUMENT_EXPRESSION } from '../database/database.constants';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** Canonical vacancy. `searchDocument` is the BM25 text, generated from this row only. */
@Entity('vacancies')
export class Vacancy {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: VacancySource, enumName: 'vacancy_source' })
  source!: VacancySource;

  @Column({ type: 'char', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 128 })
  externalId!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ type: 'int', nullable: true })
  locationId!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionRaw!: string | null;

  @Column({ type: 'enum', enum: SeniorityLevel, enumName: 'seniority_level', nullable: true })
  seniority!: SeniorityLevel | null;

  @Column({ type: 'enum', enum: EmploymentType, enumName: 'employment_type', nullable: true })
  employment!: EmploymentType | null;

  @Column({ type: 'enum', enum: WorkFormat, enumName: 'work_format', nullable: true })
  workFormat!: WorkFormat | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  schedule!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMin!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMax!: string | null;

  @Column({ type: 'char', length: 3, nullable: true })
  salaryCurrency!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMinByn!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMaxByn!: string | null;

  @Column({ type: 'boolean', nullable: true })
  isGross!: boolean | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  rateAmount!: string | null;

  @Column({ type: 'enum', enum: RateUnit, enumName: 'rate_unit', nullable: true })
  rateUnit!: RateUnit | null;

  @Column({ type: 'int', nullable: true })
  projectDurationDays!: number | null;

  @Column({ type: 'boolean', default: false })
  isForeignRemote!: boolean;

  @Column({ type: 'enum', enum: VacancyStatus, enumName: 'vacancy_status' })
  status!: VacancyStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz' })
  lastSeenAt!: Date;

  @Column({ type: 'char', length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ type: 'text', default: '' })
  skillsText!: string;

  @Column({ type: 'text', default: '' })
  companyName!: string;

  @Column({ type: 'timestamptz', nullable: true })
  skillsExtractedAt!: Date | null;

  @VectorColumn()
  embedding!: string | null;

  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: SEARCH_DOCUMENT_EXPRESSION,
    insert: false,
    update: false,
  })
  searchDocument!: string;
}

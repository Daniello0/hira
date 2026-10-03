import { AuthorKind, DocumentFormat, DocumentKind, ParseStatus } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** File in the personal library. A resume is the only PDF. */
@Entity('user_documents')
export class UserDocument {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: DocumentKind, enumName: 'document_kind' })
  kind!: DocumentKind;

  @Column({ type: 'varchar', length: 256 })
  title!: string;

  @Column({ type: 'enum', enum: DocumentFormat, enumName: 'document_format' })
  format!: DocumentFormat;

  @Column({ type: 'varchar', length: 1024 })
  storagePath!: string;

  @Column({ type: 'char', length: 64 })
  contentHash!: string;

  @Column({ type: 'text' })
  extractedText!: string;

  @VectorColumn()
  embedding!: string | null;

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'enum', enum: AuthorKind, enumName: 'author_kind' })
  createdBy!: AuthorKind;

  @Column({ type: 'enum', enum: ParseStatus, enumName: 'parse_status', nullable: true })
  parseStatus!: ParseStatus | null;
}

import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** `created_at` / `updated_at`. A database trigger refreshes `updated_at` on every table. */
export class Timestamps {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Embeds timestamp columns without a name prefix. */
export function TimestampsColumn(): PropertyDecorator {
  return Column(() => Timestamps, { prefix: false });
}

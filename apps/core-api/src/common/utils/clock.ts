export const CLOCK = Symbol('CLOCK');

export interface Clock {
  /** Current instant. Tests supply a fixed clock. */
  now(): Date;
}

/** Wall clock used outside tests. */
export class SystemClock implements Clock {
  /** @inheritdoc */
  now(): Date {
    return new Date();
  }
}

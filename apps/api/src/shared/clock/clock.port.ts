/**
 * Outbound port for reading the current time.
 *
 * Time is an external dependency like any other: transaction timestamps,
 * idempotency-key expiry and payment polling all read it. Injecting it keeps the
 * use cases deterministic under test instead of relying on `new Date()` and
 * tolerances.
 */
export interface Clock {
  now(): Date;
}

/** Injection token for {@link Clock}. */
export const CLOCK = Symbol('CLOCK');

/** Production adapter backed by the system clock. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * Test adapter returning a fixed instant, optionally advanced by hand.
 * Lives beside the port so every suite uses the same double.
 */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

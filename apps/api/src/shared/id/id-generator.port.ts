import { randomUUID } from 'node:crypto';

/**
 * Outbound port for generating entity identifiers.
 *
 * Injected for the same reason as {@link Clock}: a use case that called
 * `randomUUID()` directly would produce a different, unpredictable id every test
 * run, forcing every assertion into a regex match instead of an exact value.
 */
export interface IdGenerator {
  generate(): string;
}

/** Injection token for {@link IdGenerator}. */
export const ID_GENERATOR = Symbol('ID_GENERATOR');

/** Production adapter backed by Node's UUID v4 generator. */
export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

/**
 * Test adapter producing short, readable, strictly incrementing ids.
 * Lives beside the port so every suite uses the same double.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix: string = 'id') {}

  generate(): string {
    this.counter += 1;

    return `${this.prefix}-${this.counter}`;
  }
}

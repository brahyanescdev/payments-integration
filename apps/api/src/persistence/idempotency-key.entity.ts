import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'idempotency_keys' })
export class IdempotencyKeyEntity {
  @PrimaryKey({ type: 'string', length: 255 })
  idempotencyKey!: string;

  @Property({ type: 'string', length: 255 })
  endpoint!: string;

  @Property({ type: 'string', length: 64 })
  requestHash!: string;

  @Property({ type: 'integer', nullable: true })
  responseStatus!: number | null;

  @Property({ type: 'json', nullable: true })
  responseBody!: unknown;

  @Property({ type: 'string', nullable: true, length: 255 })
  transactionId!: string | null;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'Date' })
  expiresAt!: Date;
}

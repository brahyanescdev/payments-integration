import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'webhook_events' })
export class WebhookEventEntity {
  @PrimaryKey({ type: 'string', length: 36 })
  id!: string;

  @Unique()
  @Property({ type: 'string', length: 64 })
  checksum!: string;

  @Property({ type: 'string', length: 64 })
  eventType!: string;

  @Property({ type: 'json' })
  payload!: unknown;

  @Property({ type: 'Date', onCreate: () => new Date() })
  processedAt!: Date;
}

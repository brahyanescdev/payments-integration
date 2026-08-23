import { Migration } from '@mikro-orm/migrations';

export class Migration20260823214708 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "webhook_events" ("id" varchar(36) not null, "checksum" varchar(64) not null, "event_type" varchar(64) not null, "payload" jsonb not null, "processed_at" timestamptz not null, constraint "webhook_events_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "webhook_events" add constraint "webhook_events_checksum_unique" unique ("checksum");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "webhook_events" cascade;`);
  }
}

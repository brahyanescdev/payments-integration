import { Migration } from '@mikro-orm/migrations';

export class Migration20260823010445 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "idempotency_keys" ("idempotency_key" varchar(255) not null, "endpoint" varchar(255) not null, "request_hash" varchar(64) not null, "response_status" int null, "response_body" jsonb null, "transaction_id" varchar(255) null, "created_at" timestamptz not null, "expires_at" timestamptz not null, constraint "idempotency_keys_pkey" primary key ("idempotency_key"));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "idempotency_keys" cascade;`);
  }
}

import { Migration } from '@mikro-orm/migrations';

export class Migration20260822203126 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "customers" ("id" uuid not null, "email" varchar(254) not null, "full_name" varchar(160) not null, "phone" varchar(32) not null, "legal_id" varchar(32) not null, "legal_id_type" text check ("legal_id_type" in ('CC', 'CE', 'NIT', 'PP')) not null, "created_at" timestamptz not null, constraint "customers_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "customers" add constraint "customers_email_unique" unique ("email");`,
    );

    this.addSql(
      `create table "deliveries" ("id" uuid not null, "transaction_id" uuid not null, "recipient_name" varchar(160) not null, "phone" varchar(32) not null, "address_line1" varchar(200) not null, "address_line2" varchar(200) null, "city" varchar(120) not null, "region" varchar(120) not null, "country" varchar(2) not null, "postal_code" varchar(20) not null, "status" text check ("status" in ('PENDING', 'ASSIGNED', 'CANCELLED')) not null, "created_at" timestamptz not null, constraint "deliveries_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "deliveries" add constraint "deliveries_transaction_id_unique" unique ("transaction_id");`,
    );

    this.addSql(
      `create table "products" ("id" uuid not null, "sku" varchar(64) not null, "name" varchar(160) not null, "description" text not null, "price_in_cents" int not null, "currency" varchar(3) not null, "image_url" text not null, "stock" int not null, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "products_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "products" add constraint "products_sku_unique" unique ("sku");`);

    this.addSql(
      `create table "stock_movements" ("id" uuid not null, "product_id" uuid not null, "transaction_id" uuid not null, "type" text check ("type" in ('RESERVE', 'COMMIT', 'RELEASE')) not null, "quantity" int not null, "created_at" timestamptz not null, constraint "stock_movements_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "stock_movements_product_id_index" on "stock_movements" ("product_id");`,
    );
    this.addSql(
      `alter table "stock_movements" add constraint "stock_movements_transaction_id_type_unique" unique ("transaction_id", "type");`,
    );

    this.addSql(
      `create table "transactions" ("id" uuid not null, "reference" varchar(255) not null, "customer_id" uuid not null, "product_id" uuid not null, "quantity" int not null, "product_amount_in_cents" int not null, "base_fee_in_cents" int not null, "delivery_fee_in_cents" int not null, "amount_in_cents" int not null, "currency" varchar(3) not null, "status" text check ("status" in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')) not null, "gateway_transaction_id" varchar(64) null, "card_brand" varchar(32) null, "card_last_four" varchar(4) null, "failure_reason" text null, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "transactions_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "transactions" add constraint "transactions_reference_unique" unique ("reference");`,
    );
    this.addSql(`create index "transactions_status_index" on "transactions" ("status");`);
  }
}

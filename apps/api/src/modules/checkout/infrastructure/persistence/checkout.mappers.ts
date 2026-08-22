import type { Result } from 'neverthrow';

import { Email } from '../../../../shared/domain/email';
import { Money } from '../../../../shared/domain/money';
import type { DomainError } from '../../../../shared/result/domain-error';
import { AmountBreakdown } from '../../domain/amount-breakdown';
import { Customer } from '../../domain/customer';
import { Delivery } from '../../domain/delivery';
import { StockMovement } from '../../domain/stock-movement';
import { Transaction } from '../../domain/transaction';
import {
  CustomerEntity,
  DeliveryEntity,
  StockMovementEntity,
  TransactionEntity,
} from './checkout.entities';

export const customerMapper = {
  toDomain(row: CustomerEntity): Result<Customer, DomainError> {
    return Email.create(row.email).map((email) =>
      Customer.rehydrate({
        id: row.id,
        email,
        fullName: row.fullName,
        phone: row.phone,
        legalId: row.legalId,
        legalIdType: row.legalIdType,
        createdAt: row.createdAt,
      }),
    );
  },

  applyToRow(customer: Customer, row: CustomerEntity): void {
    const snapshot = customer.toSnapshot();

    row.email = snapshot.email.value;
    row.fullName = snapshot.fullName;
    row.phone = snapshot.phone;
    row.legalId = snapshot.legalId;
    row.legalIdType = snapshot.legalIdType;
  },

  toNewRow(customer: Customer): CustomerEntity {
    const row = new CustomerEntity();
    row.id = customer.id;
    customerMapper.applyToRow(customer, row);

    return row;
  },
};

export const transactionMapper = {
  toDomain(row: TransactionEntity): Result<Transaction, DomainError> {
    const amount = (cents: number) => Money.create(cents, row.currency);

    return amount(row.productAmountInCents)
      .andThen((productAmount) =>
        amount(row.baseFeeInCents).andThen((baseFee) =>
          amount(row.deliveryFeeInCents).andThen((deliveryFee) =>
            AmountBreakdown.create(productAmount, baseFee, deliveryFee),
          ),
        ),
      )
      .map((breakdown) =>
        Transaction.rehydrate({
          id: row.id,
          reference: row.reference,
          customerId: row.customerId,
          productId: row.productId,
          quantity: row.quantity,
          breakdown,
          status: row.status,
          gatewayTransactionId: row.gatewayTransactionId,
          card:
            row.cardBrand !== null && row.cardLastFour !== null
              ? { brand: row.cardBrand, lastFour: row.cardLastFour }
              : null,
          failureReason: row.failureReason,
          version: row.version,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }),
      );
  },

  applyToRow(transaction: Transaction, row: TransactionEntity): void {
    const snapshot = transaction.toSnapshot();

    row.reference = snapshot.reference;
    row.customerId = snapshot.customerId;
    row.productId = snapshot.productId;
    row.quantity = snapshot.quantity;
    row.productAmountInCents = snapshot.breakdown.productAmount.amountInCents;
    row.baseFeeInCents = snapshot.breakdown.baseFee.amountInCents;
    row.deliveryFeeInCents = snapshot.breakdown.deliveryFee.amountInCents;
    row.amountInCents = snapshot.breakdown.total.amountInCents;
    row.currency = snapshot.breakdown.currency;
    row.status = snapshot.status;
    row.gatewayTransactionId = snapshot.gatewayTransactionId;
    row.cardBrand = snapshot.card?.brand ?? null;
    row.cardLastFour = snapshot.card?.lastFour ?? null;
    row.failureReason = snapshot.failureReason;
  },

  toNewRow(transaction: Transaction): TransactionEntity {
    const row = new TransactionEntity();
    row.id = transaction.id;
    transactionMapper.applyToRow(transaction, row);

    return row;
  },
};

export const deliveryMapper = {
  toDomain(row: DeliveryEntity): Delivery {
    return Delivery.rehydrate({
      id: row.id,
      transactionId: row.transactionId,
      recipientName: row.recipientName,
      phone: row.phone,
      address: {
        line1: row.addressLine1,
        line2: row.addressLine2,
        city: row.city,
        region: row.region,
        country: row.country,
        postalCode: row.postalCode,
      },
      status: row.status,
      createdAt: row.createdAt,
    });
  },

  applyToRow(delivery: Delivery, row: DeliveryEntity): void {
    const snapshot = delivery.toSnapshot();

    row.transactionId = snapshot.transactionId;
    row.recipientName = snapshot.recipientName;
    row.phone = snapshot.phone;
    row.addressLine1 = snapshot.address.line1;
    row.addressLine2 = snapshot.address.line2;
    row.city = snapshot.address.city;
    row.region = snapshot.address.region;
    row.country = snapshot.address.country;
    row.postalCode = snapshot.address.postalCode;
    row.status = snapshot.status;
  },

  toNewRow(delivery: Delivery): DeliveryEntity {
    const row = new DeliveryEntity();
    row.id = delivery.id;
    deliveryMapper.applyToRow(delivery, row);

    return row;
  },
};

export const stockMovementMapper = {
  toDomain(row: StockMovementEntity): StockMovement {
    return StockMovement.rehydrate({
      id: row.id,
      productId: row.productId,
      transactionId: row.transactionId,
      type: row.type,
      quantity: row.quantity,
      createdAt: row.createdAt,
    });
  },

  /** Ledger entries are never rewritten, so there is only a "new row" direction. */
  toNewRow(movement: StockMovement): StockMovementEntity {
    const snapshot = movement.toSnapshot();
    const row = new StockMovementEntity();

    row.id = snapshot.id;
    row.productId = snapshot.productId;
    row.transactionId = snapshot.transactionId;
    row.type = snapshot.type;
    row.quantity = snapshot.quantity;

    return row;
  },
};

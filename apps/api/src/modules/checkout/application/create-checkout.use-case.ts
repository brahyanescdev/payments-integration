import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import type { Clock } from '../../../shared/clock/clock.port';
import { Email } from '../../../shared/domain/email';
import type { IdGenerator } from '../../../shared/id/id-generator.port';
import { type DomainError, productNotFound } from '../../../shared/result/domain-error';
import type {
  RepositoryRegistry,
  UnitOfWork,
} from '../../../shared/unit-of-work/unit-of-work.port';
import type { AmountBreakdown } from '../domain/amount-breakdown';
import { Customer, type LegalIdType } from '../domain/customer';
import { Delivery, type Address } from '../domain/delivery';
import type { Product } from '../../catalog/domain/product';
import type { PricingPolicy } from '../domain/pricing-policy';
import { StockMovement } from '../domain/stock-movement';
import { Transaction } from '../domain/transaction';
import { TransactionReference } from '../domain/transaction-reference';

/** Injection token for {@link CreateCheckoutUseCase}. */
export const CREATE_CHECKOUT_USE_CASE = Symbol('CREATE_CHECKOUT_USE_CASE');

export interface CreateCheckoutInput {
  readonly productId: string;
  readonly quantity: number;
  readonly customer: {
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
    readonly legalId: string;
    readonly legalIdType: LegalIdType;
  };
  readonly delivery: {
    readonly recipientName: string;
    readonly phone: string;
    readonly address: Address;
  };
}

/**
 * Opens a checkout: reserves stock, records the buyer and the delivery, and
 * starts a `PENDING` transaction — all in one commit.
 *
 * This is the operation the Unit of Work exists for. Reserving stock and then
 * failing to record who reserved it (or the reverse) would leave the shop in a
 * state that matches nothing the customer sees, so every step below stages its
 * change in the same unit and nothing reaches the database until all of them
 * have succeeded.
 *
 * No amount is accepted from the caller: the price is computed here, from the
 * catalogue and the injected pricing rules, which is what stops a client from
 * checking out at a price it made up.
 *
 * `execute` reads as the business process itself; each step it calls does one
 * thing and is named for what it means, not for how it's implemented.
 */
export class CreateCheckoutUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly pricing: PricingPolicy,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: CreateCheckoutInput): ResultAsync<Transaction, DomainError> {
    return Email.create(input.customer.email).asyncAndThen((email) =>
      this.unitOfWork.run((repositories) => {
        const now = this.clock.now();

        return this.reserveProduct(repositories, input)
          .andThen((breakdown) =>
            this.resolveCustomer(repositories, input, email, now).map((customer) => ({
              customer,
              breakdown,
            })),
          )
          .andThen(({ customer, breakdown }) =>
            this.openTransaction(repositories, input, customer, breakdown, now),
          )
          .andThen((transaction) => this.openDelivery(repositories, input, transaction, now))
          .andThen((transaction) => this.recordReservation(repositories, input, transaction, now));
      }),
    );
  }

  /** Loads the product, prices the line, and reserves the requested quantity. */
  private reserveProduct(
    repositories: RepositoryRegistry,
    input: CreateCheckoutInput,
  ): ResultAsync<AmountBreakdown, DomainError> {
    return repositories.products
      .findById(input.productId)
      .andThen((product) =>
        product === null ? errAsync(productNotFound(input.productId)) : okAsync(product),
      )
      .andThen((product) => this.quoteAndReserve(repositories, product, input.quantity));
  }

  private quoteAndReserve(
    repositories: RepositoryRegistry,
    product: Product,
    quantity: number,
  ): ResultAsync<AmountBreakdown, DomainError> {
    return this.pricing.quote(product.price, quantity).asyncAndThen((breakdown) =>
      product
        .reserve(quantity)
        .map(() => breakdown)
        .asyncAndThen((quotedBreakdown) =>
          repositories.products.save(product).map(() => quotedBreakdown),
        ),
    );
  }

  /** Finds the buyer by email, or registers them if this is their first order. */
  private resolveCustomer(
    repositories: RepositoryRegistry,
    input: CreateCheckoutInput,
    email: Email,
    now: Date,
  ): ResultAsync<Customer, DomainError> {
    return repositories.customers.findByEmail(email).andThen((existing) => {
      const customer =
        existing ??
        Customer.rehydrate({
          id: this.ids.generate(),
          email,
          fullName: input.customer.fullName,
          phone: input.customer.phone,
          legalId: input.customer.legalId,
          legalIdType: input.customer.legalIdType,
          createdAt: now,
        });

      return repositories.customers.save(customer).map(() => customer);
    });
  }

  /** Opens the `PENDING` transaction, referenced towards the gateway by its own id. */
  private openTransaction(
    repositories: RepositoryRegistry,
    input: CreateCheckoutInput,
    customer: Customer,
    breakdown: AmountBreakdown,
    now: Date,
  ): ResultAsync<Transaction, DomainError> {
    const transactionId = this.ids.generate();

    return TransactionReference.forTransaction(transactionId)
      .map((reference) =>
        Transaction.open({
          id: transactionId,
          reference: reference.toString(),
          customerId: customer.id,
          productId: input.productId,
          quantity: input.quantity,
          breakdown,
          now,
        }),
      )
      .asyncAndThen((transaction) =>
        repositories.transactions.save(transaction).map(() => transaction),
      );
  }

  /** Records where the order ships, tied to the transaction that will pay for it. */
  private openDelivery(
    repositories: RepositoryRegistry,
    input: CreateCheckoutInput,
    transaction: Transaction,
    now: Date,
  ): ResultAsync<Transaction, DomainError> {
    return Delivery.open({
      id: this.ids.generate(),
      transactionId: transaction.id,
      recipientName: input.delivery.recipientName,
      phone: input.delivery.phone,
      address: input.delivery.address,
      now,
    }).asyncAndThen((delivery) => repositories.deliveries.save(delivery).map(() => transaction));
  }

  /** Appends the ledger entry that makes this reservation auditable and idempotent. */
  private recordReservation(
    repositories: RepositoryRegistry,
    input: CreateCheckoutInput,
    transaction: Transaction,
    now: Date,
  ): ResultAsync<Transaction, DomainError> {
    return repositories.stockMovements
      .append(
        StockMovement.record({
          id: this.ids.generate(),
          productId: input.productId,
          transactionId: transaction.id,
          type: 'RESERVE',
          quantity: input.quantity,
          now,
        }),
      )
      .map(() => transaction);
  }
}

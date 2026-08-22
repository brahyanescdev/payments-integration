import { HttpException, HttpStatus } from '@nestjs/common';
import { err, ok } from 'neverthrow';

import {
  concurrencyConflict,
  gatewayUnavailable,
  idempotencyConflict,
  insufficientStock,
  invalidQuantity,
  invalidWebhookSignature,
  persistence,
  productNotFound,
  transactionNotFound,
  transactionNotPending,
  validation,
} from '../result/domain-error';
import { httpStatusFor, toHttpException, unwrapOrThrow } from './domain-error.http';

describe('httpStatusFor', () => {
  it.each([
    [productNotFound('p1'), HttpStatus.NOT_FOUND],
    [transactionNotFound('t1'), HttpStatus.NOT_FOUND],
    [validation('email', 'is invalid'), HttpStatus.BAD_REQUEST],
    [invalidQuantity(0), HttpStatus.BAD_REQUEST],
    [insufficientStock('p1', 2, 1), HttpStatus.CONFLICT],
    [transactionNotPending('t1', 'APPROVED'), HttpStatus.CONFLICT],
    [idempotencyConflict('key-1'), HttpStatus.CONFLICT],
    [concurrencyConflict('Product'), HttpStatus.CONFLICT],
    [gatewayUnavailable('timeout'), HttpStatus.BAD_GATEWAY],
    [invalidWebhookSignature(), HttpStatus.UNAUTHORIZED],
    [persistence('products.save'), HttpStatus.INTERNAL_SERVER_ERROR],
  ])('maps $kind', (error, status) => {
    expect(httpStatusFor(error)).toBe(status);
  });

  it('treats a state conflict as 409 rather than 400, since the request is well formed', () => {
    expect(httpStatusFor(insufficientStock('p1', 5, 1))).toBe(HttpStatus.CONFLICT);
  });
});

describe('toHttpException', () => {
  it('returns the uniform envelope with a stable discriminator', () => {
    const response = toHttpException(insufficientStock('p1', 5, 1)).getResponse();

    expect(response).toMatchObject({
      error: { kind: 'InsufficientStock', details: { requested: 5, available: 1 } },
    });
  });

  it('keeps the explanation for failures the caller can act on', () => {
    const response = toHttpException(validation('email', 'is not valid')).getResponse();

    expect(response).toMatchObject({ error: { message: expect.stringContaining('email') } });
  });

  it('never leaks internal detail for a persistence failure', () => {
    const response = toHttpException(persistence('products.save')).getResponse() as {
      error: { message: string; details?: unknown };
    };

    expect(response.error.message).not.toMatch(/products\.save/);
    expect(response.error.details).toBeUndefined();
    expect(response.error.kind).toBe('Persistence');
  });

  it('stays opaque for an invalid webhook signature, so probing reveals nothing', () => {
    const response = toHttpException(invalidWebhookSignature()).getResponse() as {
      error: { message: string };
    };

    expect(response.error.message).toBe('La solicitud no pudo completarse.');
  });
});

describe('unwrapOrThrow', () => {
  it('returns the value of a successful result', () => {
    expect(unwrapOrThrow(ok({ id: 'p1' }))).toEqual({ id: 'p1' });
  });

  it('throws the mapped exception for a failure, converting exactly once at the edge', () => {
    expect(() => unwrapOrThrow(err(productNotFound('p1')))).toThrow(HttpException);

    try {
      unwrapOrThrow(err(productNotFound('p1')));
    } catch (thrown) {
      expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});

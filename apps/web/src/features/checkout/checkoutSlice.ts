import type { AmountBreakdownDto, GatewayModeDto, TransactionStatusDto } from '@payments/shared';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { CardBrand } from './card';

/**
 * Card display metadata only — brand and last four digits.
 *
 * The slice's state shape is the actual privacy guarantee, not a filter applied
 * later: the full card number, expiry and CVC are never constructed as an action
 * payload anywhere in this codebase, so there is no raw card value for
 * `redux-persist` to accidentally write to `localStorage` in the first place.
 */
export interface CardMeta {
  readonly brand: CardBrand;
  readonly lastFour: string;
}

export type CheckoutStep = 'idle' | 'form' | 'summary' | 'result';

export interface CheckoutState {
  readonly step: CheckoutStep;
  readonly productId: string | null;
  readonly quantity: number;
  /**
   * Generated once when the checkout opens and reused on every retry of the same
   * attempt — a double submission (or a browser retry after a dropped response)
   * reuses this key instead of minting a new one, which is what makes the retry
   * idempotent on the server.
   */
  readonly idempotencyKey: string | null;
  /** Same guarantee as {@link CheckoutState.idempotencyKey}, but for `POST /checkout/:id/pay` — a distinct key, since the two endpoints must not share one. */
  readonly payIdempotencyKey: string | null;
  readonly cardMeta: CardMeta | null;
  /**
   * Single-use values from tokenising the card and accepting the gateway's
   * terms, both produced while the buyer is still on the form. Safe to persist
   * alongside everything else here: none of them can be turned back into the
   * card number, and an unused one simply expires on the gateway's side.
   */
  readonly cardToken: string | null;
  readonly acceptanceToken: string | null;
  readonly acceptPersonalAuthToken: string | null;
  readonly transactionId: string | null;
  readonly reference: string | null;
  readonly breakdown: AmountBreakdownDto | null;
  readonly transactionStatus: TransactionStatusDto | null;
  readonly failureReason: string | null;
  /** Which gateway adapter actually processed the charge — the one honest way to tell a `fake`-driver test apart from a real sandbox hit. */
  readonly gatewayMode: GatewayModeDto | null;
  readonly errorMessage: string | null;
}

const initialState: CheckoutState = {
  step: 'idle',
  productId: null,
  quantity: 1,
  idempotencyKey: null,
  payIdempotencyKey: null,
  cardMeta: null,
  cardToken: null,
  acceptanceToken: null,
  acceptPersonalAuthToken: null,
  transactionId: null,
  reference: null,
  breakdown: null,
  transactionStatus: null,
  failureReason: null,
  gatewayMode: null,
  errorMessage: null,
};

export const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    /** Starts a new attempt for one product; a fresh idempotency key is minted here. */
    checkoutOpened: (
      state,
      action: PayloadAction<{ productId: string; quantity: number; idempotencyKey: string }>,
    ) => {
      state.step = 'form';
      state.productId = action.payload.productId;
      state.quantity = action.payload.quantity;
      state.idempotencyKey = action.payload.idempotencyKey;
      state.payIdempotencyKey = null;
      state.cardMeta = null;
      state.cardToken = null;
      state.acceptanceToken = null;
      state.acceptPersonalAuthToken = null;
      state.transactionId = null;
      state.reference = null;
      state.breakdown = null;
      state.transactionStatus = null;
      state.failureReason = null;
      state.gatewayMode = null;
      state.errorMessage = null;
    },
    /** Cancels the in-progress attempt, discarding everything about it. */
    checkoutClosed: () => initialState,
    /** Screen 2 submitted: the transaction is open and the card is tokenised. Moves to the summary. */
    checkoutSucceeded: (
      state,
      action: PayloadAction<{
        transactionId: string;
        reference: string;
        breakdown: AmountBreakdownDto;
        cardMeta: CardMeta;
        cardToken: string;
        acceptanceToken: string;
        acceptPersonalAuthToken: string;
        payIdempotencyKey: string;
      }>,
    ) => {
      state.step = 'summary';
      state.transactionId = action.payload.transactionId;
      state.reference = action.payload.reference;
      state.breakdown = action.payload.breakdown;
      state.cardMeta = action.payload.cardMeta;
      state.cardToken = action.payload.cardToken;
      state.acceptanceToken = action.payload.acceptanceToken;
      state.acceptPersonalAuthToken = action.payload.acceptPersonalAuthToken;
      state.payIdempotencyKey = action.payload.payIdempotencyKey;
      state.errorMessage = null;
    },
    /** Reported by either screen: opening the checkout or charging the card. Leaves the step as-is, so the buyer can retry. */
    checkoutFailed: (state, action: PayloadAction<string>) => {
      state.errorMessage = action.payload;
    },
    /** The gateway resolved the charge (synchronously, or the caller already polled it to a final state). */
    paymentSucceeded: (
      state,
      action: PayloadAction<{
        status: TransactionStatusDto;
        failureReason: string | null;
        gatewayMode: GatewayModeDto;
      }>,
    ) => {
      state.step = 'result';
      state.transactionStatus = action.payload.status;
      state.failureReason = action.payload.failureReason;
      state.gatewayMode = action.payload.gatewayMode;
      state.errorMessage = null;
    },
  },
});

export const {
  checkoutOpened,
  checkoutClosed,
  checkoutSucceeded,
  checkoutFailed,
  paymentSucceeded,
} = checkoutSlice.actions;

export default checkoutSlice.reducer;

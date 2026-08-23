import type { AmountBreakdownDto } from '@payments/shared';
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

export type CheckoutStep = 'idle' | 'form' | 'awaiting-payment';

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
  readonly cardMeta: CardMeta | null;
  readonly transactionId: string | null;
  readonly reference: string | null;
  readonly breakdown: AmountBreakdownDto | null;
  readonly errorMessage: string | null;
}

const initialState: CheckoutState = {
  step: 'idle',
  productId: null,
  quantity: 1,
  idempotencyKey: null,
  cardMeta: null,
  transactionId: null,
  reference: null,
  breakdown: null,
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
      state.cardMeta = null;
      state.transactionId = null;
      state.reference = null;
      state.breakdown = null;
      state.errorMessage = null;
    },
    /** Cancels the in-progress attempt, discarding everything about it. */
    checkoutClosed: () => initialState,
    checkoutSucceeded: (
      state,
      action: PayloadAction<{
        transactionId: string;
        reference: string;
        breakdown: AmountBreakdownDto;
        cardMeta: CardMeta;
      }>,
    ) => {
      state.step = 'awaiting-payment';
      state.transactionId = action.payload.transactionId;
      state.reference = action.payload.reference;
      state.breakdown = action.payload.breakdown;
      state.cardMeta = action.payload.cardMeta;
      state.errorMessage = null;
    },
    checkoutFailed: (state, action: PayloadAction<string>) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { checkoutOpened, checkoutClosed, checkoutSucceeded, checkoutFailed } =
  checkoutSlice.actions;

export default checkoutSlice.reducer;

import { zodResolver } from '@hookform/resolvers/zod';
import {
  TEST_IDS,
  type AcceptanceTokensDto,
  type AmountBreakdownDto,
  type CheckoutCreatedDto,
  type GatewayModeDto,
  type TransactionStatusDto,
} from '@payments/shared';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type ControllerRenderProps,
  type FieldError,
  type FieldErrors,
  type FieldPath,
} from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';

import type { RootState } from '../../app/store';
import { Modal } from '../../components/Modal';
import { useConfig } from '../../config/config.context';
import { useCatalogApi } from '../catalog/catalog-api.context';
import { t } from '../../i18n/es';
import { formatMoney } from '../../shared/money';
import { CardBrandBadge } from './CardBrandBadge';
import { detectCardBrand, formatCardNumber, onlyDigits } from './card';
import { useCheckoutApi } from './checkout-api.context';
import { checkoutFormSchema, type CheckoutFormValues } from './checkout-form.schema';
import {
  checkoutClosed,
  checkoutFailed,
  checkoutSucceeded,
  paymentSucceeded,
  type CardMeta,
} from './checkoutSlice';
import { resolveTokenizationUrl, tokenizeCard } from './tokenize-card';

/** The gateway supports up to 36; this checkout never offers instalments, so it always charges in one. */
const SINGLE_INSTALLMENT = 1;

const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP'] as const;

const DEFAULT_VALUES: CheckoutFormValues = {
  cardNumber: '',
  cardHolder: '',
  expiry: '',
  cvc: '',
  customer: { email: '', fullName: '', phone: '', legalId: '', legalIdType: 'CC' },
  delivery: {
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'CO',
    postalCode: '',
  },
};

/** Renders whichever screen the checkout slice's step calls for; nothing when idle. */
export function CheckoutModalHost() {
  const step = useSelector((state: RootState) => state.checkout.step);

  if (step === 'form') return <CheckoutModal />;
  if (step === 'summary') return <SummaryBackdrop />;
  if (step === 'result') return <ResultPanel />;

  return null;
}

/** Copy shown on the result screen for each terminal status the gateway can report. */
const RESULT_COPY: Record<TransactionStatusDto, { title: string; body: string }> = {
  APPROVED: { title: t.result.approvedTitle, body: t.result.approvedBody },
  DECLINED: { title: t.result.declinedTitle, body: t.result.declinedBody },
  ERROR: { title: t.result.errorTitle, body: t.result.errorBody },
  VOIDED: { title: t.result.declinedTitle, body: t.result.declinedBody },
  PENDING: { title: t.result.pendingTitle, body: t.result.pendingBody },
};

/** Names which gateway adapter actually processed the charge — split out of {@link ResultPanel} to keep it short. */
function GatewayModeBadge({ gatewayMode }: { gatewayMode: GatewayModeDto }) {
  const isSandbox = gatewayMode === 'sandbox';

  return (
    <span
      data-testid={TEST_IDS.resultPage.gatewayMode}
      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        isSandbox ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
      }`}
    >
      {isSandbox ? t.result.gatewayModeSandbox : t.result.gatewayModeFake}
    </span>
  );
}

/** Amount charged and the card that paid — split out of {@link ResultPanel} to keep it short. */
function PaymentSummary({
  breakdown,
  cardMeta,
}: {
  breakdown: AmountBreakdownDto;
  cardMeta: CardMeta;
}) {
  return (
    <div className="mt-3 flex flex-col gap-1 rounded-md border border-neutral-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-neutral-600">{t.result.paidAmountLabel}</span>
        <span data-testid={TEST_IDS.resultPage.paidAmount} className="font-semibold">
          {formatMoney(breakdown.totalInCents, breakdown.currency)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-600">{t.result.cardLabel}</span>
        <span data-testid={TEST_IDS.resultPage.card} className="flex items-center gap-1.5">
          <CardBrandBadge brand={cardMeta.brand} />
          •••• {cardMeta.lastFour}
        </span>
      </div>
    </div>
  );
}

/**
 * Drives screens 4–5's polling and copy — split out of {@link ResultPanel} so
 * the component stays a render function.
 *
 * A charge the gateway left `PENDING` is polled here — via `GET /transactions/:id`
 * at the interval `webConfig` names — until either a terminal status arrives (the
 * same `paymentSucceeded` action the synchronous pay response already dispatches)
 * or the configured timeout passes, whichever comes first. The fake driver never
 * actually produces this path (every sandbox test card resolves synchronously),
 * so this only ever engages against the real gateway.
 */
function useResultPanelState() {
  const dispatch = useDispatch();
  const config = useConfig();
  const {
    transactionId,
    reference,
    transactionStatus,
    failureReason,
    gatewayMode,
    breakdown,
    cardMeta,
  } = useSelector((state: RootState) => state.checkout);
  const { useGetTransactionQuery } = useCheckoutApi();
  const catalogApi = useCatalogApi();
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const isPending = transactionStatus === 'PENDING';

  const { data: polled } = useGetTransactionQuery(
    isPending && transactionId !== null ? transactionId : skipToken,
    { pollingInterval: config.transactionPolling.intervalMs },
  );

  useEffect(() => {
    if (polled !== undefined && polled.status !== 'PENDING') {
      dispatch(
        paymentSucceeded({
          status: polled.status,
          failureReason: polled.failureReason,
          gatewayMode: polled.gatewayMode,
        }),
      );
    }
  }, [polled, dispatch]);

  useEffect(() => {
    if (!isPending) {
      setPollingTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => setPollingTimedOut(true), config.transactionPolling.timeoutMs);

    return () => clearTimeout(timeout);
  }, [isPending, config.transactionPolling.timeoutMs]);

  const copy = RESULT_COPY[transactionStatus ?? 'PENDING'];
  const body = isPending && pollingTimedOut ? t.result.timeoutBody : copy.body;

  const onClose = () => {
    // The buyer is headed back to the catalogue: whatever this checkout just
    // did to stock (committed or released) should be visible immediately,
    // not stale until some unrelated refetch happens to occur.
    dispatch(catalogApi.util.resetApiState());
    dispatch(checkoutClosed());
  };

  return { copy, body, gatewayMode, breakdown, cardMeta, failureReason, reference, onClose };
}

/** Screens 4–5: the final outcome of the charge. */
function ResultPanel() {
  const { copy, body, gatewayMode, breakdown, cardMeta, failureReason, reference, onClose } =
    useResultPanelState();

  return (
    <Modal title={copy.title} onClose={onClose}>
      <div data-testid={TEST_IDS.resultPage.root}>
        <p data-testid={TEST_IDS.resultPage.status} className="text-sm text-neutral-700">
          {body}
        </p>
        {gatewayMode !== null && <GatewayModeBadge gatewayMode={gatewayMode} />}
        {breakdown !== null && cardMeta !== null && (
          <PaymentSummary breakdown={breakdown} cardMeta={cardMeta} />
        )}
        {failureReason !== null && <p className="mt-2 text-xs text-neutral-500">{failureReason}</p>}
        {reference !== null && <p className="mt-2 text-xs text-neutral-500">{reference}</p>}
        <button
          type="button"
          data-testid={TEST_IDS.resultPage.backToProduct}
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          {t.result.backToProduct}
        </button>
      </div>
    </Modal>
  );
}

/** One line of the price breakdown: a label on the left, a formatted amount on the right. */
function BreakdownRow({
  label,
  amountInCents,
  currency,
  testId,
  emphasis = false,
}: {
  label: string;
  amountInCents: number;
  currency: string;
  testId: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${emphasis ? 'text-base font-semibold' : 'text-sm text-neutral-700'}`}
    >
      <span>{label}</span>
      <span data-testid={testId}>{formatMoney(amountInCents, currency)}</span>
    </div>
  );
}

/** The four breakdown lines of {@link SummaryBackdrop}, split out to keep that component short. */
function BreakdownList({ breakdown }: { breakdown: AmountBreakdownDto }) {
  return (
    <>
      <BreakdownRow
        label={t.summary.productAmountLabel}
        amountInCents={breakdown.productAmountInCents}
        currency={breakdown.currency}
        testId={TEST_IDS.summaryBackdrop.productAmount}
      />
      <BreakdownRow
        label={t.summary.baseFeeLabel}
        amountInCents={breakdown.baseFeeInCents}
        currency={breakdown.currency}
        testId={TEST_IDS.summaryBackdrop.baseFee}
      />
      <BreakdownRow
        label={t.summary.deliveryFeeLabel}
        amountInCents={breakdown.deliveryFeeInCents}
        currency={breakdown.currency}
        testId={TEST_IDS.summaryBackdrop.deliveryFee}
      />
      <hr className="border-neutral-200" />
      <BreakdownRow
        label={t.summary.totalLabel}
        amountInCents={breakdown.totalInCents}
        currency={breakdown.currency}
        testId={TEST_IDS.summaryBackdrop.total}
        emphasis
      />
    </>
  );
}

/**
 * Drives `POST /checkout/:id/pay` — split out of {@link SummaryBackdrop} so the
 * component stays a render function and this stays a state machine.
 */
function useSummaryPayment() {
  const dispatch = useDispatch();
  const {
    transactionId,
    breakdown,
    cardToken,
    acceptanceToken,
    acceptPersonalAuthToken,
    payIdempotencyKey,
    cardMeta,
    errorMessage,
  } = useSelector((state: RootState) => state.checkout);
  const { usePayCheckoutMutation } = useCheckoutApi();
  const [payCheckout, { isLoading }] = usePayCheckoutMutation();

  const canPay =
    transactionId !== null &&
    cardToken !== null &&
    acceptanceToken !== null &&
    acceptPersonalAuthToken !== null &&
    payIdempotencyKey !== null &&
    cardMeta !== null;

  const onPay = async () => {
    if (!canPay) return;

    try {
      const result = await payCheckout({
        transactionId,
        idempotencyKey: payIdempotencyKey,
        body: {
          cardToken,
          acceptanceToken,
          acceptPersonalAuthToken,
          installments: SINGLE_INSTALLMENT,
          cardBrand: cardMeta.brand,
          cardLastFour: cardMeta.lastFour,
        },
      }).unwrap();

      dispatch(
        paymentSucceeded({
          status: result.status,
          failureReason: result.failureReason,
          gatewayMode: result.gatewayMode,
        }),
      );
    } catch {
      dispatch(checkoutFailed(t.summary.genericError));
    }
  };

  return { breakdown, errorMessage, canPay, isLoading, onPay };
}

/**
 * Screen 3: the price breakdown and the button that actually charges the card.
 *
 * Everything the charge needs — the card token and the gateway's acceptance
 * tokens — was already produced while the buyer was still on the form; this
 * screen only has to send it on to `POST /checkout/:id/pay`.
 */
function SummaryBackdrop() {
  const dispatch = useDispatch();
  const { breakdown, errorMessage, canPay, isLoading, onPay } = useSummaryPayment();

  if (breakdown === null) return null;

  return (
    <Modal title={t.summary.title} onClose={() => dispatch(checkoutClosed())}>
      <div data-testid={TEST_IDS.summaryBackdrop.root} className="flex flex-col gap-3">
        <BreakdownList breakdown={breakdown} />

        {errorMessage !== null && <p className="text-sm text-red-600">{errorMessage}</p>}

        <button
          type="button"
          data-testid={TEST_IDS.summaryBackdrop.payButton}
          onClick={() => void onPay()}
          disabled={isLoading || !canPay}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isLoading ? t.summary.paying : t.summary.payButton}
        </button>
      </div>
    </Modal>
  );
}

/**
 * The card number input, formatted with spaces as the buyer types.
 *
 * Reformatting inserts characters (the spaces) that a plain controlled value
 * would let the browser's default caret placement fight with — React re-renders
 * a *longer* string than what was just typed, and jsdom (like some real
 * browsers) resets the caret to the start rather than after the inserted
 * character. Restoring the caret to the end on every render is a deliberate
 * simplification: this field is realistically always typed left-to-right, never
 * edited in the middle, so "after the last digit" is always the right place for
 * the cursor to be, and it can be restored synchronously via `useLayoutEffect`,
 * before the browser paints — a `requestAnimationFrame` fires too late relative
 * to React's own render/effect cycle to keep up with fast typing.
 */
function CardNumberField({
  field,
  error,
  brand,
}: {
  field: ControllerRenderProps<CheckoutFormValues, 'cardNumber'>;
  error?: string;
  brand: ReturnType<typeof detectCardBrand>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatted = formatCardNumber(onlyDigits(field.value ?? ''));

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input !== null && document.activeElement === input) {
      input.setSelectionRange(formatted.length, formatted.length);
    }
  }, [formatted]);

  return (
    <Field label={t.checkout.cardNumberLabel} error={error}>
      <div className="flex items-center gap-2">
        <input
          ref={(node) => {
            inputRef.current = node;
            field.ref(node);
          }}
          data-testid={TEST_IDS.checkoutModal.cardNumber}
          inputMode="numeric"
          autoComplete="cc-number"
          value={formatted}
          onChange={(event) => field.onChange(onlyDigits(event.target.value).slice(0, 19))}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="4242 4242 4242 4242"
        />
        <CardBrandBadge brand={brand} />
      </div>
    </Field>
  );
}

/** Reads a nested field error by its dotted RHF path, e.g. "delivery.city". */
function fieldErrorAt(
  errors: FieldErrors<CheckoutFormValues>,
  path: string,
): FieldError | undefined {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node !== null && typeof node === 'object' && key in node) {
      return (node as Record<string, unknown>)[key];
    }

    return undefined;
  }, errors) as FieldError | undefined;
}

/**
 * One registered input with its label and validation error.
 *
 * Every field in this form is register-name, label, and an optional HTML input
 * type — collapsing that repetition here is what keeps each fieldset below a
 * short enough to read as a list of fields, rather than growing a single large
 * function block per section.
 */
function TextField({
  name,
  label,
  className,
  testId,
  ...inputProps
}: {
  name: FieldPath<CheckoutFormValues>;
  label: string;
  className?: string;
  testId?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'className'>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const error = fieldErrorAt(errors, name)?.message;

  return (
    <Field label={label} error={error} className={className}>
      <input {...register(name)} {...inputProps} data-testid={testId} className={INPUT_CLASS} />
    </Field>
  );
}

/** Card number, holder, expiry and CVC. Reads the shared form context, no prop drilling. */
function CardFieldset({ brand }: { brand: ReturnType<typeof detectCardBrand> }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-neutral-700">
        {t.checkout.cardSectionTitle}
      </legend>

      <Controller
        control={control}
        name="cardNumber"
        render={({ field }) => (
          <CardNumberField field={field} error={errors.cardNumber?.message} brand={brand} />
        )}
      />

      <TextField name="cardHolder" label={t.checkout.cardHolderLabel} autoComplete="cc-name" />

      <div className="flex gap-3">
        <TextField
          name="expiry"
          label={t.checkout.expiryLabel}
          className="flex-1"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
        />
        <TextField
          name="cvc"
          label={t.checkout.cvcLabel}
          className="w-24"
          testId={TEST_IDS.checkoutModal.cvc}
          inputMode="numeric"
          autoComplete="cc-csc"
        />
      </div>
    </fieldset>
  );
}

/** Buyer identity: email, name, phone and legal id. */
function BuyerFieldset() {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-neutral-700">Comprador</legend>

      <TextField
        name="customer.email"
        label={t.checkout.emailLabel}
        type="email"
        autoComplete="email"
      />
      <TextField name="customer.fullName" label={t.checkout.fullNameLabel} autoComplete="name" />
      <TextField
        name="customer.phone"
        label={t.checkout.phoneLabel}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel"
      />
      {/* Its own row, not squeezed next to another field: "Tipo de documento" is
          long enough to wrap onto two lines in a narrow shared column, which pushed
          this select down and out of line with whatever sat beside it. */}
      <LegalIdTypeField />
      <TextField
        name="customer.legalId"
        label={t.checkout.legalIdLabel}
        inputMode="numeric"
        pattern="[0-9]*"
      />
    </fieldset>
  );
}

/** The one non-text field in the buyer section: a select, kept separate from TextField's <input>. */
function LegalIdTypeField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  return (
    <Field label={t.checkout.legalIdTypeLabel} error={errors.customer?.legalIdType?.message}>
      <select
        {...register('customer.legalIdType')}
        className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
      >
        {LEGAL_ID_TYPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Where the order ships. */
function DeliveryFieldset() {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-neutral-700">
        {t.checkout.deliverySectionTitle}
      </legend>

      <TextField
        name="delivery.recipientName"
        label={t.checkout.recipientNameLabel}
        autoComplete="name"
      />
      <TextField
        name="delivery.phone"
        label={t.checkout.phoneLabel}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel"
      />
      <TextField
        name="delivery.addressLine1"
        label={t.checkout.addressLine1Label}
        autoComplete="address-line1"
      />
      <TextField
        name="delivery.addressLine2"
        label={t.checkout.addressLine2Label}
        autoComplete="address-line2"
      />
      <div className="flex gap-3">
        <TextField
          name="delivery.city"
          label={t.checkout.cityLabel}
          className="flex-1"
          autoComplete="address-level2"
        />
        <TextField
          name="delivery.region"
          label={t.checkout.regionLabel}
          className="flex-1"
          autoComplete="address-level1"
        />
      </div>
      {/* Own row: "País (código de 2 letras)" wraps in a narrow shared column. */}
      <TextField
        name="delivery.country"
        label={t.checkout.countryLabel}
        className="uppercase"
        maxLength={2}
        autoComplete="country"
      />
      <TextField
        name="delivery.postalCode"
        label={t.checkout.postalCodeLabel}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="postal-code"
      />
    </fieldset>
  );
}

/** Builds the create-checkout request body from validated form values. */
function toCheckoutRequestBody(productId: string, quantity: number, values: CheckoutFormValues) {
  return {
    productId,
    quantity,
    customer: values.customer,
    delivery: {
      ...values.delivery,
      addressLine2:
        values.delivery.addressLine2 === '' ? null : (values.delivery.addressLine2 ?? null),
    },
  };
}

/**
 * Tokenises the card, then opens the checkout — everything Screen 2's submit
 * button needs to hand off to the summary screen, split out so the component
 * itself only has to call this once and dispatch its result.
 */
async function openTokenizedCheckout({
  productId,
  quantity,
  idempotencyKey,
  values,
  brand,
  apiBaseUrl,
  fetchAcceptanceTokens,
  createCheckout,
}: {
  productId: string;
  quantity: number;
  idempotencyKey: string;
  values: CheckoutFormValues;
  brand: ReturnType<typeof detectCardBrand>;
  apiBaseUrl: string;
  fetchAcceptanceTokens: () => { unwrap: () => Promise<AcceptanceTokensDto> };
  createCheckout: (args: {
    idempotencyKey: string;
    body: ReturnType<typeof toCheckoutRequestBody>;
  }) => { unwrap: () => Promise<CheckoutCreatedDto> };
}) {
  const [expMonth, expYear] = values.expiry.split('/');
  if (expMonth === undefined || expYear === undefined) {
    throw new Error('The expiry field was not validated before submit.');
  }

  const acceptanceTokens = await fetchAcceptanceTokens().unwrap();
  const tokenizationUrl = resolveTokenizationUrl(acceptanceTokens.tokenizationUrl, apiBaseUrl);
  const tokenizedCard = await tokenizeCard(tokenizationUrl, acceptanceTokens.publicKey, {
    cardNumber: onlyDigits(values.cardNumber),
    cvc: values.cvc,
    expMonth,
    expYear,
    cardHolder: values.cardHolder,
  });

  const response = await createCheckout({
    idempotencyKey,
    body: toCheckoutRequestBody(productId, quantity, values),
  }).unwrap();

  return {
    transactionId: response.transactionId,
    reference: response.reference,
    breakdown: response.breakdown,
    cardMeta: { brand, lastFour: tokenizedCard.lastFour },
    cardToken: tokenizedCard.token,
    acceptanceToken: acceptanceTokens.acceptance.token,
    acceptPersonalAuthToken: acceptanceTokens.personalDataAuthorization.token,
    payIdempotencyKey: crypto.randomUUID(),
  };
}

function CheckoutModal() {
  const dispatch = useDispatch();
  const { productId, quantity, idempotencyKey, errorMessage } = useSelector(
    (state: RootState) => state.checkout,
  );
  const { useCreateCheckoutMutation, useLazyGetAcceptanceTokensQuery } = useCheckoutApi();
  const [createCheckout, { isLoading }] = useCreateCheckoutMutation();
  const [fetchAcceptanceTokens] = useLazyGetAcceptanceTokensQuery();
  const config = useConfig();

  const methods = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const cardNumber = methods.watch('cardNumber');
  const brand = detectCardBrand(onlyDigits(cardNumber ?? ''));

  const onSubmit = async (values: CheckoutFormValues) => {
    if (productId === null || idempotencyKey === null) return;

    try {
      const payload = await openTokenizedCheckout({
        productId,
        quantity,
        idempotencyKey,
        values,
        brand,
        apiBaseUrl: config.apiBaseUrl,
        fetchAcceptanceTokens,
        createCheckout,
      });

      dispatch(checkoutSucceeded(payload));
    } catch {
      dispatch(checkoutFailed(t.checkout.genericError));
    }
  };

  return (
    <Modal title={t.checkout.modalTitle} onClose={() => dispatch(checkoutClosed())}>
      <FormProvider {...methods}>
        <form
          data-testid={TEST_IDS.checkoutModal.root}
          onSubmit={(event) => void methods.handleSubmit(onSubmit)(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <CardFieldset brand={brand} />
          <BuyerFieldset />
          <DeliveryFieldset />

          {errorMessage !== null && <p className="text-sm text-red-600">{errorMessage}</p>}

          <button
            type="submit"
            data-testid={TEST_IDS.checkoutModal.submit}
            disabled={isLoading}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {isLoading ? t.checkout.submitting : t.checkout.submit}
          </button>
        </form>
      </FormProvider>
    </Modal>
  );
}

const INPUT_CLASS = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm';

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-neutral-700 ${className ?? ''}`}>
      {label}
      {children}
      {error !== undefined && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

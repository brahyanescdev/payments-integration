import { zodResolver } from '@hookform/resolvers/zod';
import { TEST_IDS } from '@payments/shared';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
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
import { t } from '../../i18n/es';
import { CardBrandBadge } from './CardBrandBadge';
import { detectCardBrand, formatCardNumber, onlyDigits } from './card';
import { useCheckoutApi } from './checkout-api.context';
import { checkoutFormSchema, type CheckoutFormValues } from './checkout-form.schema';
import { checkoutClosed, checkoutFailed, checkoutSucceeded } from './checkoutSlice';

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
  if (step === 'awaiting-payment') return <CheckoutSuccessPanel />;

  return null;
}

function CheckoutSuccessPanel() {
  const dispatch = useDispatch();
  const reference = useSelector((state: RootState) => state.checkout.reference);

  return (
    <Modal title={t.checkout.successTitle} onClose={() => dispatch(checkoutClosed())}>
      <p data-testid={TEST_IDS.resultPage.status} className="text-sm text-neutral-700">
        {t.checkout.successBody}
      </p>
      {reference !== null && <p className="mt-2 text-xs text-neutral-500">{reference}</p>}
      <button
        type="button"
        onClick={() => dispatch(checkoutClosed())}
        className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        {t.checkout.cancel}
      </button>
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
      <div className="flex gap-3">
        <TextField
          name="customer.phone"
          label={t.checkout.phoneLabel}
          className="flex-1"
          inputMode="numeric"
          autoComplete="tel"
        />
        <LegalIdTypeField />
      </div>
      <TextField name="customer.legalId" label={t.checkout.legalIdLabel} />
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
    <Field
      label={t.checkout.legalIdTypeLabel}
      error={errors.customer?.legalIdType?.message}
      className="w-28"
    >
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
      <div className="flex gap-3">
        <TextField
          name="delivery.country"
          label={t.checkout.countryLabel}
          className="w-24 uppercase"
          maxLength={2}
          autoComplete="country"
        />
        <TextField
          name="delivery.postalCode"
          label={t.checkout.postalCodeLabel}
          className="flex-1"
          autoComplete="postal-code"
        />
      </div>
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

function CheckoutModal() {
  const dispatch = useDispatch();
  const { productId, quantity, idempotencyKey, errorMessage } = useSelector(
    (state: RootState) => state.checkout,
  );
  const { useCreateCheckoutMutation } = useCheckoutApi();
  const [createCheckout, { isLoading }] = useCreateCheckoutMutation();

  const methods = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const cardNumber = methods.watch('cardNumber');
  const brand = detectCardBrand(onlyDigits(cardNumber ?? ''));

  const onSubmit = async (values: CheckoutFormValues) => {
    if (productId === null || idempotencyKey === null) return;

    const digits = onlyDigits(values.cardNumber);

    try {
      const response = await createCheckout({
        idempotencyKey,
        body: toCheckoutRequestBody(productId, quantity, values),
      }).unwrap();

      dispatch(
        checkoutSucceeded({
          transactionId: response.transactionId,
          reference: response.reference,
          breakdown: response.breakdown,
          cardMeta: { brand, lastFour: digits.slice(-4) },
        }),
      );
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

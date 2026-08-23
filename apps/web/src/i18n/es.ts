/**
 * User-facing copy, in one place.
 *
 * Keeping strings out of JSX means specs assert on stable keys and test ids rather
 * than on wording, so a copy tweak never turns into a failing test suite.
 */
export const t = {
  app: {
    title: 'Tienda',
    tagline: 'Compra segura con tarjeta de crédito',
  },
  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    unexpectedError: 'Algo salió mal. Vuelve a intentarlo en un momento.',
  },
  catalog: {
    title: 'Catálogo',
    empty: 'Todavía no hay productos disponibles.',
    outOfStock: 'Agotado',
    unitsAvailable: 'unidades disponibles',
    payWithCard: 'Pagar con tarjeta de crédito',
    quantityLabel: 'Cantidad',
  },
  checkout: {
    modalTitle: 'Datos de pago y entrega',
    cardSectionTitle: 'Tarjeta de crédito',
    deliverySectionTitle: 'Datos de entrega',
    cardNumberLabel: 'Número de tarjeta',
    cardHolderLabel: 'Nombre en la tarjeta',
    expiryLabel: 'Vencimiento (MM/AA)',
    cvcLabel: 'CVC',
    emailLabel: 'Correo electrónico',
    fullNameLabel: 'Nombre completo',
    phoneLabel: 'Teléfono',
    legalIdLabel: 'Documento de identidad',
    legalIdTypeLabel: 'Tipo de documento',
    recipientNameLabel: 'Nombre de quien recibe',
    addressLine1Label: 'Dirección',
    addressLine2Label: 'Complemento (opcional)',
    cityLabel: 'Ciudad',
    regionLabel: 'Departamento',
    countryLabel: 'País (código de 2 letras)',
    postalCodeLabel: 'Código postal',
    submit: 'Continuar',
    submitting: 'Procesando…',
    cancel: 'Cancelar',
    genericError: 'No pudimos abrir tu compra. Verifica los datos e inténtalo de nuevo.',
    successTitle: '¡Listo! Tu compra fue registrada',
    successBody: 'Continuaremos con el pago en un momento.',
  },
  summary: {
    title: 'Resumen de tu compra',
    productAmountLabel: 'Producto',
    baseFeeLabel: 'Tarifa base',
    deliveryFeeLabel: 'Envío',
    totalLabel: 'Total a pagar',
    payButton: 'Pagar',
    paying: 'Procesando pago…',
    cancel: 'Cancelar',
    genericError: 'No pudimos procesar tu pago. Verifica los datos e inténtalo de nuevo.',
  },
  result: {
    approvedTitle: '¡Pago aprobado!',
    approvedBody: 'Tu compra fue procesada con éxito.',
    declinedTitle: 'Pago rechazado',
    declinedBody: 'La entidad emisora rechazó la transacción. Intenta con otra tarjeta.',
    errorTitle: 'No pudimos procesar el pago',
    errorBody: 'Ocurrió un error con la pasarela de pagos. Intenta de nuevo más tarde.',
    pendingTitle: 'Procesando tu pago',
    pendingBody: 'Te avisaremos en cuanto se confirme.',
    backToProduct: 'Volver al producto',
  },
} as const;

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
  },
} as const;

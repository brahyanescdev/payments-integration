# ADR 0002 — Idempotencia en tres capas

- **Estado**: aceptada
- **Fecha**: 2026-08-22

## Contexto

Un pago no puede cobrarse dos veces. Los reintentos llegan por tres caminos
distintos y cada uno necesita su propia defensa: el usuario que pulsa dos veces o
recarga, el reintento de red hacia la pasarela, y el webhook que la pasarela reenvía
hasta tres veces en 24 horas si no recibe un `200`.

## Decisión

1. **Header `Idempotency-Key`** en los POST mutantes. Se almacena la clave junto al
   hash del cuerpo y la respuesta emitida, dentro de la misma transacción de base de
   datos que la operación. Misma clave + mismo cuerpo devuelve la respuesta guardada;
   misma clave + cuerpo distinto responde `409`.
2. **`reference` único** hacia la pasarela, con constraint `UNIQUE`. Reintentar con
   la misma referencia no genera un segundo cobro del lado del proveedor.
3. **Webhook idempotente**: `webhook_events.checksum` único, y la transición de
   estado se aplica solo desde `PENDING`, de modo que un evento tardío o duplicado
   nunca revierte un `APPROVED`.

El stock se apoya en un ledger `stock_movements` con `UNIQUE (transaction_id, type)`:
reprocesar un `COMMIT` o un `RELEASE` es inofensivo por construcción.

## Consecuencias

- Toda mutación de dinero exige una clave de idempotencia; el interceptor la rechaza
  con `400` si falta, en lugar de aceptarla silenciosamente.
- Hay dos tablas de soporte (`idempotency_keys`, `webhook_events`) que no pertenecen
  al dominio de negocio pero sí a su fiabilidad.
- Las claves caducan según `IDEMPOTENCY_TTL_HOURS`, para que la tabla no crezca sin
  límite.

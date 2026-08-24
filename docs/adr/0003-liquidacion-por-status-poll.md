# ADR 0003 — Liquidación por status-poll cuando el webhook no llega

- **Estado**: aceptada
- **Fecha**: 2026-08-24

## Contexto

El pago es asíncrono: nace `PENDING` y la pasarela resuelve el resultado final
más tarde. Su documentación recomienda resolverlo **exclusivamente por
webhook** ("Usa siempre los eventos para finalizar tu integración") y advierte
explícitamente contra depender de la redirección del navegador como método de
validación.

Esa recomendación asume que el merchant puede registrar su propia URL de
webhook en el dashboard de la pasarela. En esta prueba, la cuenta de sandbox
es **compartida entre candidatos** y no es nuestra para reconfigurar — no hay
forma de apuntar el webhook a nuestro despliegue. El resultado, verificado en
producción: la pasarela resuelve el pago en segundos del lado de ellos, pero
nuestro sistema nunca se entera, y la transacción queda en `PENDING` para
siempre.

## Decisión

`GetTransactionUseCase` (el caso de uso detrás de `GET /transactions/:id`, al
que el frontend hace polling) le pregunta directamente a la pasarela
(`GET /transactions/{id}` del lado de ellos) cuando encuentra una transacción
todavía `PENDING` y ya vinculada a un `gatewayTransactionId`. Si la pasarela
responde con un estado terminal, la transacción se liquida ahí mismo con
`SettleTransactionUseCase` — el mismo caso de uso que ya usa el webhook, para
que el stock y la máquina de estados de la transacción se comporten igual sin
importar cuál de los dos caminos la resuelva primero.

Si la pasarela no responde (timeout, 5xx), el error se absorbe y se devuelve
la transacción tal cual: el fallback nunca puede convertir una respuesta lenta
de la pasarela en un error para quien está mirando la pantalla de resultado.

## Consecuencias

- El webhook sigue siendo el camino primario en un entorno donde sí se puede
  registrar su URL (una cuenta propia, no compartida); este mecanismo es
  puramente el respaldo para cuando eso no es posible.
- Cada `GET /transactions/:id` de una transacción `PENDING` genera una llamada
  saliente a la pasarela. Para el volumen de este proyecto (una persona
  probando el flujo) es insignificante; un sistema con más tráfico
  concurrente debería limitar la frecuencia de este poll en vez de hacerlo en
  cada request.
- El adapter fake (`PAYMENT_GATEWAY_DRIVER=fake`) nunca ejercita este camino:
  sus cargos siempre resuelven de forma síncrona, así que
  `getTransactionStatus` en ese adapter falla a propósito — es una garantía
  de que nadie confía en un valor que el fake nunca podría producir
  honestamente.

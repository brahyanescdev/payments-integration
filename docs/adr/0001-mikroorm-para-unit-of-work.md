# ADR 0001 — MikroORM como ORM, por el Unit of Work

- **Estado**: aceptada
- **Fecha**: 2026-08-22

## Contexto

El diseño exige el patrón **Unit of Work**: reservar stock, crear el cliente, la
entrega y la transacción deben confirmarse o revertirse como una sola operación.

No todos los ORM de Node lo implementan de verdad:

| ORM      | Unit of Work | Observación                                                               |
| -------- | ------------ | ------------------------------------------------------------------------- |
| MikroORM | Nativo       | Identity Map + `em.persist()` / `em.flush()`, al estilo Doctrine          |
| TypeORM  | Parcial      | `DataSource.transaction()` sin change tracking; hay que envolverlo a mano |
| Prisma   | No           | Solo `$transaction`; emularlo se nota forzado en revisión                 |

## Decisión

Usar **MikroORM** con PostgreSQL. Además del Unit of Work aporta bloqueo optimista
por columna `version`, necesario para que dos compras simultáneas no vendan la
última unidad dos veces.

## Consecuencias

- El puerto `UnitOfWork` vive en el dominio sin rastro del ORM; el adapter que lo
  implementa hace `em.fork()` y `em.transactional()`.
- Las entidades del ORM llevan decoradores, así que **no** se usan como entidades de
  dominio: viven en `infrastructure/persistence` con un mapper por agregado. Cuesta
  un archivo extra por agregado y a cambio el dominio queda libre de framework.
- Curva de aprendizaje mayor que Prisma, asumida deliberadamente porque el requisito
  es el patrón, no la velocidad de scaffolding.

# Tienda — checkout de pago con tarjeta de crédito

Aplicación de onboarding de pago: el cliente ve un producto con su stock, paga con
tarjeta de crédito a través de una pasarela colombiana en modo sandbox, recibe el
resultado de la transacción y vuelve a la página del producto con el stock ya
actualizado.

Monorepo con una SPA en React y una API en Nest.js construida con **arquitectura
hexagonal**, **Unit of Work**, **Railway Oriented Programming** y **transacciones
idempotentes**.

> La pasarela se nombra en el código y en la documentación como `PSP` /
> `payment-gateway`, nunca por su marca comercial.

---

## Stack

| Capa                   | Tecnología                                                      |
| ---------------------- | --------------------------------------------------------------- |
| Backend                | Nest.js 11 · TypeScript · MikroORM · PostgreSQL 16              |
| Programación funcional | `neverthrow` (`Result` / `ResultAsync`)                         |
| Frontend               | React 19 · Vite · Redux Toolkit + `redux-persist` · Tailwind v4 |
| Contrato compartido    | Zod, en `packages/shared`                                       |
| Tests unitarios        | Jest (backend, frontend y contrato)                             |
| E2E e integración      | Playwright                                                      |
| Infraestructura        | AWS CDK · S3 + CloudFront · App Runner · RDS                    |

## Estructura

```
apps/
  api/        API Nest.js
    src/
      modules/<slice>/
        domain/           entidades POJO, value objects, puertos, errores
        application/      casos de uso (ROP)
        infrastructure/   controllers HTTP, repositorios, adapters del PSP
      shared/             kernel compartido (Unit of Work, Clock, Result)
      config/             único punto que lee variables de entorno
  web/        SPA React
packages/
  shared/     schemas Zod, rutas y test-ids compartidos entre front, back y e2e
e2e/          Playwright: pruebas funcionales, de integración y evidencia visual
docs/
  adr/        decisiones de arquitectura
  evidence/   capturas por rama, adjuntas a cada pull request
scripts/      utilidades de desarrollo (generación de evidencia)
```

La **regla de dependencia** (`domain` → nada; `application` → `domain`;
`infrastructure` → todo) no es una convención documentada: la aplica
`eslint-plugin-boundaries` y romperla rompe el build.

## Modelo de datos

```mermaid
erDiagram
    PRODUCTS {
        uuid id PK
        varchar sku UK
        varchar name
        text description
        int price_in_cents
        varchar currency
        text image_url
        int stock
        int version "bloqueo optimista"
    }
    CUSTOMERS {
        uuid id PK
        varchar email UK "clave natural"
        varchar full_name
        varchar phone
        varchar legal_id
        enum legal_id_type "CC CE NIT PP"
    }
    TRANSACTIONS {
        uuid id PK
        varchar reference UK "ancla de idempotencia"
        uuid customer_id FK
        uuid product_id FK
        int quantity
        int product_amount_in_cents
        int base_fee_in_cents
        int delivery_fee_in_cents
        int amount_in_cents
        enum status "PENDING APPROVED DECLINED VOIDED ERROR"
        varchar gateway_transaction_id
        varchar card_brand "sin PAN"
        varchar card_last_four "sin PAN"
        int version "bloqueo optimista"
    }
    DELIVERIES {
        uuid id PK
        uuid transaction_id FK,UK
        varchar recipient_name
        varchar address_line1
        varchar city
        enum status "PENDING ASSIGNED CANCELLED"
    }
    STOCK_MOVEMENTS {
        uuid id PK
        uuid product_id FK
        uuid transaction_id FK
        enum type "RESERVE COMMIT RELEASE"
        int quantity
    }

    CUSTOMERS ||--o{ TRANSACTIONS : "realiza"
    PRODUCTS  ||--o{ TRANSACTIONS : "se vende en"
    TRANSACTIONS ||--|| DELIVERIES : "se entrega mediante"
    TRANSACTIONS ||--o{ STOCK_MOVEMENTS : "genera"
    PRODUCTS  ||--o{ STOCK_MOVEMENTS : "afecta a"
```

Tres restricciones sostienen la corrección del sistema y merecen leerse juntas:

| Restricción                                        | Qué impide                                                   |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `transactions.reference` **único**                 | Un reintento hacia la pasarela no genera un segundo cobro    |
| `stock_movements (transaction_id, type)` **único** | Un webhook reenviado no vuelve a mover el inventario         |
| `products.version` (bloqueo optimista)             | Dos compradores simultáneos no venden la misma última unidad |

El inventario es un **ledger de solo anexado**: `RESERVE` al abrir la transacción,
`COMMIT` si el pago se aprueba y `RELEASE` si falla. Nunca se actualiza ni se borra
un movimiento, así que el histórico explica cómo se llegó al stock actual.

## Puesta en marcha

Requisitos: Node ≥ 20, pnpm 11, Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm --filter @payments/api migration:up
pnpm --filter @payments/api seed
pnpm build
```

> `pnpm db:up` usa `docker compose`. Si tu Docker no trae el plugin de Compose
> (habitual con Colima), instálalo con `brew install docker-compose` y enlázalo:
> `mkdir -p ~/.docker/cli-plugins && ln -sf $(brew --prefix)/bin/docker-compose ~/.docker/cli-plugins/docker-compose`.

Desarrollo:

```bash
pnpm --filter @payments/api dev     # API en http://localhost:3000/api/v1
pnpm --filter @payments/web dev     # SPA en http://localhost:5173
```

Documentación interactiva de la API (Swagger UI, con el servidor local corriendo):
`http://localhost:3000/api/v1/docs`.

Sin necesidad de levantar nada: el spec OpenAPI está exportado en
[`docs/api/openapi.json`](docs/api/openapi.json), y la colección de Postman lista
para importar en [`docs/api/postman-collection.json`](docs/api/postman-collection.json)
(generada directamente desde ese spec — importarla en Postman reconstruye cada
endpoint con su esquema de request/response).

## Configuración

Todas las variables se declaran en `.env.example` y se validan **al arranque** con
Zod. Si falta una o está mal formada, el proceso falla en el bootstrap nombrando la
variable, en lugar de reventar a mitad de una transacción.

Ningún otro módulo lee `process.env` ni `import.meta.env`: una regla de ESLint lo
rechaza fuera de `src/config`, que es lo que impide que reaparezcan valores quemados.

## Tests

```bash
pnpm test          # unitarios (Jest) en todos los workspaces
pnpm test:cov      # con el umbral de cobertura del 80%
pnpm e2e           # Playwright sobre los artefactos compilados
```

El umbral vive en cada `jest.config.js`, de modo que `pnpm test:cov` falla en local
por la misma razón por la que falla CI. En los pull requests, además, un bot publica
la tabla de cobertura por archivo.

### Cobertura actual

| Workspace          | Statements | Branches | Functions | Lines  |
| ------------------ | ---------- | -------- | --------- | ------ |
| `@payments/shared` | 87.27%     | 100%     | 100%      | 97.05% |
| `@payments/api`    | 98.21%     | 95.97%   | 98.49%    | 98.72% |
| `@payments/web`    | 97.99%     | 88.54%   | 100%      | 99.64% |

Playwright **no** cuenta para este porcentaje: son dos suites con propósitos
distintos. Jest cubre unidades y contratos; Playwright prueba el sistema completo y
genera la evidencia visual de cada PR.

## Flujo de trabajo

`main` está protegida: sin push directo, PR obligatorio y los checks `api`, `web` y
`e2e` en verde como condición de merge, con squash e historial lineal.

Ritual antes de abrir un PR:

```bash
pnpm test:cov
pnpm evidence                       # capturas en docs/evidence/<rama>
git add docs/evidence/<rama>
git commit -m "docs(e2e): evidencia de <rama>"
git push -u origin HEAD
pnpm pr:body                        # enlaza por SHA y verifica cada imagen
gh pr create --body-file .github/pr-body.md
```

`pnpm evidence` compila los artefactos y corre Playwright capturando pantallas en
375×667 y 1280×800. `pnpm pr:body` se ejecuta **después del push** y arma la
descripción del PR.

Son dos pasos y no uno por una razón concreta: las imágenes se enlazan por **SHA de
commit**, no por nombre de rama. Una URL de rama deja de resolver en cuanto la rama
se borra —justo lo que hace un squash merge con `--delete-branch`—, y todas las
imágenes del PR ya mergeado se rompen en silencio. GitHub conserva
`refs/pull/N/head` para siempre, así que un SHA nunca caduca; pero ese SHA no existe
hasta después del push. Además `pnpm pr:body` hace un `HEAD` contra cada URL y
aborta si alguna no devuelve `200`, de modo que una descripción con imágenes muertas
no puede llegar a un PR.

Si el PR ya está abierto, `pnpm pr:body --apply` actualiza su descripción en sitio.

## Decisiones de arquitectura

- [ADR 0001 — MikroORM como ORM, por el Unit of Work](docs/adr/0001-mikroorm-para-unit-of-work.md)
- [ADR 0002 — Idempotencia en tres capas](docs/adr/0002-idempotencia-en-tres-capas.md)

## Estado

| Etapa | Alcance                                                         | Estado     |
| ----- | --------------------------------------------------------------- | ---------- |
| 1     | Andamiaje, CI, gate de cobertura, harness de evidencia          | Completado |
| 2     | Núcleo de dominio, Unit of Work, ROP, MikroORM, contrato Zod    | Completado |
| 3     | Catálogo de producto — `GET /products` + pantalla 1             | Completado |
| 4     | Formulario de tarjeta y entrega — `POST /checkout` + pantalla 2 | Completado |
| 5     | Resumen y cobro — `POST /checkout/:id/pay` + pantalla 3         | Completado |
| 6     | Resultado y stock — webhook + pantallas 4 y 5                   | Completado |
| 7     | Cierre de cobertura                                             | Completado |
| 8     | Infraestructura AWS y despliegue                                | Pendiente  |

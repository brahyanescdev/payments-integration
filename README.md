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

## Puesta en marcha

Requisitos: Node ≥ 20, pnpm 11, Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm build
```

Desarrollo:

```bash
pnpm --filter @payments/api dev     # API en http://localhost:3000/api/v1
pnpm --filter @payments/web dev     # SPA en http://localhost:5173
```

Documentación interactiva de la API (Swagger UI): `http://localhost:3000/api/v1/docs`.

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
| `@payments/shared` | 90.90%     | 100%     | 100%      | 87.50% |
| `@payments/api`    | 100%       | 100%     | 100%      | 100%   |
| `@payments/web`    | 100%       | 100%     | 100%      | 100%   |

Playwright **no** cuenta para este porcentaje: son dos suites con propósitos
distintos. Jest cubre unidades y contratos; Playwright prueba el sistema completo y
genera la evidencia visual de cada PR.

## Flujo de trabajo

`main` está protegida: sin push directo, PR obligatorio y los checks `api`, `web` y
`e2e` en verde como condición de merge, con squash e historial lineal.

Ritual antes de abrir un PR:

```bash
pnpm test:cov
pnpm evidence
git add docs/evidence/<rama>
git commit -m "docs(e2e): evidencia de <rama>"
git push -u origin HEAD
gh pr create --body-file .github/pr-body.md
```

`pnpm evidence` compila los artefactos, corre Playwright capturando pantallas en
375×667 y 1280×800, y deja listo el cuerpo del PR con las imágenes enlazadas.

## Decisiones de arquitectura

- [ADR 0001 — MikroORM como ORM, por el Unit of Work](docs/adr/0001-mikroorm-para-unit-of-work.md)
- [ADR 0002 — Idempotencia en tres capas](docs/adr/0002-idempotencia-en-tres-capas.md)

## Estado

| Etapa | Alcance                                                         | Estado    |
| ----- | --------------------------------------------------------------- | --------- |
| 1     | Andamiaje, CI, gate de cobertura, harness de evidencia          | En curso  |
| 2     | Núcleo de dominio, Unit of Work, ROP, MikroORM, contrato Zod    | Pendiente |
| 3     | Catálogo de producto — `GET /products` + pantalla 1             | Pendiente |
| 4     | Formulario de tarjeta y entrega — `POST /checkout` + pantalla 2 | Pendiente |
| 5     | Resumen y cobro — `POST /checkout/:id/pay` + pantalla 3         | Pendiente |
| 6     | Resultado y stock — webhook + pantallas 4 y 5                   | Pendiente |
| 7     | Cierre de cobertura                                             | Pendiente |
| 8     | Infraestructura AWS y despliegue                                | Pendiente |

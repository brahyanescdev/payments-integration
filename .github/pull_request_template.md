## Qué cambia

<!-- Alcance de la rebanada: endpoint, pantalla y regla de negocio que entrega. -->

## Evidencia de los casos de prueba

<!--
Generada con `pnpm evidence`, que produce las capturas y un cuerpo de PR listo:

    pnpm evidence
    git add docs/evidence/<rama> && git commit -m "docs(e2e): evidencia de <rama>"
    git push -u origin HEAD
    gh pr create --body-file .github/pr-body.md
-->

## Checklist

- [ ] Tests unitarios (Jest) añadidos junto al código de este PR
- [ ] Cobertura ≥ 80% en los workspaces tocados
- [ ] Capturas de los casos de prueba adjuntas
- [ ] OpenAPI / README actualizados si el contrato cambió
- [ ] Sin secretos ni valores quemados en el diff

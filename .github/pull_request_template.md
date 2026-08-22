## Qué cambia

<!-- Alcance de la rebanada: endpoint, pantalla y regla de negocio que entrega. -->

## Evidencia de los casos de prueba

<!--
Generada con `pnpm evidence` y enlazada con `pnpm pr:body`, que la verifica:

    pnpm evidence
    git add docs/evidence/<rama> && git commit -m "docs(e2e): evidencia de <rama>"
    git push -u origin HEAD
    pnpm pr:body
    gh pr create --body-file .github/pr-body.md

`pr:body` enlaza las imágenes por SHA de commit, nunca por rama: una URL de rama
muere cuando el squash merge borra la rama y rompe el PR ya mergeado.
-->

## Checklist

- [ ] Tests unitarios (Jest) añadidos junto al código de este PR
- [ ] Cobertura ≥ 80% en los workspaces tocados
- [ ] Capturas de los casos de prueba adjuntas y verificadas
- [ ] OpenAPI / README actualizados si el contrato cambió
- [ ] Sin secretos ni valores quemados en el diff

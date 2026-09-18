# Matrizes das mãos

Os PNG daqui são a **fonte**, não o que o site serve. O site usa os `.webp` em
`public/`, gerados a partir destes. Eles ficam FORA de `public/` de propósito:
lá dentro seriam baixáveis por qualquer um, a 1,2 MB e 1,5 MB, sem servir para
nada.

## Como gerar o webp

```bash
node -e '
const sharp = require("sharp");
for (const n of ["mao-feminina", "mao-masculina"])
  sharp(`assets/maos/${n}.png`)
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
    .toFile(`public/${n}.webp`)
    .then((i) => console.log(n, (i.size / 1024).toFixed(0) + " KB"));
'
```

`alphaQuality: 100` não é capricho. O alpha desta imagem é usado como **máscara
de recorte** da aliança em `MaoComAlianca.tsx`, então alpha borrado vira aliança
com borda suja em cima da pele.

## Ao trocar ou acrescentar uma mão

As medidas de `src/lib/ferramentas/maos.ts` são tiradas da imagem, uma a uma, e
não se adivinham. O procedimento está escrito lá.

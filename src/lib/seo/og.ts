/**
 * A arte de compartilhamento padrão, descrita num lugar só.
 *
 * Fica fora da rota porque arquivo de rota do Next só aceita os nomes que ele
 * conhece (`GET`, `dynamic`, `revalidate` e afins), e exportar constante de lá
 * quebra o build. Quem desenha é `(site)/og/route.tsx`; quem aponta para ela é
 * `buildMetadata`.
 */
export const OG_PADRAO = {
  path: "/og",
  width: 1200,
  height: 630,
  alt: "JK Alianças: guia de alianças",
} as const;

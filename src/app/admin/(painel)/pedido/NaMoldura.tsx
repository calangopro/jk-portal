"use client";

import { Suspense, lazy } from "react";
import { useHistoricoAberto } from "./abrir";
import { AbrindoOHistorico } from "./Casca";

const Gaveta = lazy(() => import("./Gaveta"));

/**
 * O histórico do pedido na moldura: nada enquanto ninguém abriu. Aberto, a
 * gaveta (e o que ela puxa) é buscada por `import()`. Cada abertura lê o
 * histórico de novo: é um retrato do pedido agora.
 */
export function HistoricoDoPedidoNaMoldura() {
  const aberto = useHistoricoAberto();
  if (!aberto) return null;
  return (
    <Suspense fallback={<AbrindoOHistorico numero={aberto.numero} />}>
      <Gaveta key={aberto.vez} numero={aberto.numero} />
    </Suspense>
  );
}

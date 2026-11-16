"use client";

import { useState } from "react";
import { SeloDaRede } from "@/components/redes/Selo";
import type { RedeId } from "@/lib/redes/redes";

/**
 * A miniatura de uma publicação. O endereço vem da rede e VENCE (o do
 * Instagram dura poucos dias), então imagem quebrada é o normal em post
 * antigo: quando falha, entra o selo da rede no lugar, sem ícone de erro.
 *
 * É `<img>` comum, de propósito: o endereço é de terceiro e muda a cada
 * leitura, então o otimizador do Next só guardaria cópia de imagem que vence.
 */
export function Miniatura({ src, rede }: { src: string | null; rede: RedeId }) {
  const [quebrou, setQuebrou] = useState(false);
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-ink/[0.06]">
      {src && !quebrou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={56} height={56} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setQuebrou(true)} className="h-full w-full object-cover" />
      ) : (
        <SeloDaRede id={rede} tamanho={26} />
      )}
    </span>
  );
}

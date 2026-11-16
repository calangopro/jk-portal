"use client";

import { useState } from "react";
import { SeloDaRede } from "@/components/redes/Selo";
import type { RedeId } from "@/lib/redes/redes";

/**
 * A capa de uma publicação, ocupando a caixa em volta. O endereço vem da rede
 * e vence (o do Instagram dura poucos dias): quando a imagem falha, entra o
 * selo da rede, sem ícone de erro. Mesmo motivo da `Miniatura` para ser
 * `<img>` comum e não o otimizador do Next.
 */
export function Capa({ src, rede, alt = "" }: { src: string | null; rede: RedeId; alt?: string }) {
  const [quebrou, setQuebrou] = useState(false);
  return src && !quebrou ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setQuebrou(true)} className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <span className="absolute inset-0 grid place-items-center bg-ink/[0.06]">
      <SeloDaRede id={rede} tamanho={34} />
    </span>
  );
}
